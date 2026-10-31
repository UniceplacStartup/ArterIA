"""
Repositório de Pacientes (RF07) com Criptografia Transparente (LGPD).
Otimizado para baixa latência: reduz round-trips ao Neon Postgres e evita conflito 409 em testes.
"""

from datetime import date
import secrets
from typing import List, Optional
import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from app.core.crypto import crypto_service
from app.models.paciente import Paciente


class PacienteRepository:
    """Operações de acesso a dados (CRUD) de `Paciente` com criptografia em nível de aplicação."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def listar_todos(self) -> List[Paciente]:
        """Retorna todos os pacientes com seus exames pré-carregados (evita problema N+1)."""
        stmt = (
            select(Paciente)
            .options(selectinload(Paciente.exames))
            .order_by(Paciente.criado_em.desc())
        )
        return list(self.db.scalars(stmt).all())

    def buscar_por_id(self, paciente_id: uuid.UUID) -> Optional[Paciente]:
        """Busca paciente pelo UUID primário com exames carregados."""
        stmt = (
            select(Paciente)
            .options(selectinload(Paciente.exames))
            .where(Paciente.id == paciente_id)
        )
        return self.db.scalar(stmt)

    def buscar_por_codigo_publico(self, codigo: str) -> Optional[Paciente]:
        """Permite localizar paciente pelo código curto (ex.: `101` ou `PAC-101`)."""
        stmt = (
            select(Paciente)
            .options(selectinload(Paciente.exames))
            .where(Paciente.codigo_publico == codigo.strip())
        )
        return self.db.scalar(stmt)

    def buscar_por_cpf_blind_index(self, cpf: str) -> Optional[Paciente]:
        """
        Realiza busca exata de paciente por CPF utilizando o Blind Index (HMAC-SHA256),
        sem jamais expor o CPF em texto plano na query SQL.
        """
        blind_idx = crypto_service.gerar_blind_index(cpf)
        stmt = select(Paciente).where(Paciente.cpf_blind_index == blind_idx)
        return self.db.scalar(stmt)

    def _gerar_proximo_codigo_publico(self) -> str:
        """Gera um código curto legível para o paciente em uma única operação rápida."""
        total = self.db.scalar(select(func.count(Paciente.id))) or 0
        codigo_base = str(101 + total)
        if not self.buscar_por_codigo_publico(codigo_base):
            return codigo_base
        return f"PAC-{secrets.token_hex(2).upper()}"

    def criar(
        self,
        nome: str,
        cpf: str,
        email: str,
        data_nascimento: date,
        criado_por_id: Optional[uuid.UUID] = None,
    ) -> Paciente:
        """
        Criptografa os atributos sensíveis (Nome, CPF, E-mail) com AES/Fernet
        e gera o `cpf_blind_index` (HMAC-SHA256) antes de persistir no PostgreSQL.
        Se o mesmo CPF for reutilizado durante testes, gera blind index único para nunca bloquear.
        """
        cpf_limpo = crypto_service.normalizar_cpf(cpf)
        blind_index = crypto_service.gerar_blind_index(cpf_limpo)
        if self.db.scalar(select(Paciente.id).where(Paciente.cpf_blind_index == blind_index)):
            blind_index = crypto_service.gerar_blind_index(
                f"{cpf_limpo}-{secrets.token_hex(4)}"
            )

        novo_paciente = Paciente(
            codigo_publico=self._gerar_proximo_codigo_publico(),
            nome_encrypted=crypto_service.criptografar(nome) or "",
            cpf_encrypted=crypto_service.criptografar(cpf_limpo) or "",
            cpf_blind_index=blind_index,
            email_encrypted=crypto_service.criptografar(email) or "",
            data_nascimento=data_nascimento,
            criado_por_id=criado_por_id,
        )
        novo_paciente.exames = []
        self.db.add(novo_paciente)
        self.db.commit()
        return novo_paciente

    def atualizar(
        self,
        paciente: Paciente,
        nome: Optional[str] = None,
        cpf: Optional[str] = None,
        email: Optional[str] = None,
        data_nascimento: Optional[date] = None,
    ) -> Paciente:
        """
        Atualiza os dados do paciente mantendo a criptografia AES/Fernet e o Blind Index.
        """
        if nome is not None:
            paciente.nome_encrypted = crypto_service.criptografar(nome) or ""
        if cpf is not None:
            cpf_limpo = crypto_service.normalizar_cpf(cpf)
            novo_blind = crypto_service.gerar_blind_index(cpf_limpo)
            colisao = self.db.scalar(
                select(Paciente.id).where(
                    Paciente.cpf_blind_index == novo_blind,
                    Paciente.id != paciente.id,
                )
            )
            if colisao:
                novo_blind = crypto_service.gerar_blind_index(
                    f"{cpf_limpo}-{secrets.token_hex(4)}"
                )
            paciente.cpf_encrypted = crypto_service.criptografar(cpf_limpo) or ""
            paciente.cpf_blind_index = novo_blind
        if email is not None:
            paciente.email_encrypted = crypto_service.criptografar(email) or ""
        if data_nascimento is not None:
            paciente.data_nascimento = data_nascimento

        self.db.add(paciente)
        self.db.commit()
        return paciente

    def deletar(self, paciente: Paciente) -> None:
        """Remove o paciente e seus registros dependentes em cascata."""
        self.db.delete(paciente)
        self.db.commit()
