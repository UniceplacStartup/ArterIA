"""
Repositório de Usuários (Profissionais de Saúde - RF01).
Suporta todas as operações de CRUD (Criar, Listar, Buscar, Atualizar e Excluir).
"""

from typing import List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.usuario import Usuario


class UsuarioRepository:
    """Operações de persistência e consulta da entidade `Usuario`."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def listar_todos(self) -> List[Usuario]:
        """Lista todos os médicos/profissionais cadastrados ordenados por nome."""
        stmt = select(Usuario).order_by(Usuario.nome.asc())
        return list(self.db.scalars(stmt).all())

    def buscar_por_id(self, usuario_id: uuid.UUID) -> Optional[Usuario]:
        """Localiza um profissional pelo seu UUID."""
        stmt = select(Usuario).where(Usuario.id == usuario_id)
        return self.db.scalar(stmt)

    def buscar_por_email(self, email: str) -> Optional[Usuario]:
        """Localiza um profissional pelo e-mail normalizado em minúsculas."""
        stmt = select(Usuario).where(Usuario.email == email.strip().lower())
        return self.db.scalar(stmt)

    def buscar_por_crm(self, crm: str, uf_crm: str) -> Optional[Usuario]:
        """Verifica se já existe profissional com a combinação CRM + UF."""
        stmt = select(Usuario).where(
            Usuario.crm == crm.strip(),
            Usuario.uf_crm == uf_crm.strip().upper(),
        )
        return self.db.scalar(stmt)

    def criar(
        self,
        nome: str,
        email: str,
        senha_hash: str,
        crm: str,
        uf_crm: str,
    ) -> Usuario:
        """Persiste um novo profissional médico no banco de dados."""
        novo_usuario = Usuario(
            nome=nome.strip(),
            email=email.strip().lower(),
            senha_hash=senha_hash,
            crm=crm.strip(),
            uf_crm=uf_crm.strip().upper(),
        )
        self.db.add(novo_usuario)
        self.db.commit()
        self.db.refresh(novo_usuario)
        return novo_usuario

    def atualizar(self, usuario: Usuario) -> Usuario:
        """Salva alterações cadastrais ou de estado do usuário."""
        self.db.add(usuario)
        self.db.commit()
        self.db.refresh(usuario)
        return usuario

    def deletar(self, usuario: Usuario) -> None:
        """Exclui o registro do profissional de saúde do banco."""
        self.db.delete(usuario)
        self.db.commit()
