"""
Repositório de Exames e Resultados da IA (RF02, RF03, RF04, RE02).
Otimizado com `selectinload` completo para evitar queries N+1 em conexões cloud (Neon).
"""

from datetime import datetime, timezone
from typing import List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.core.crypto import crypto_service
from app.models.exame import (
    Exame,
    ModoValidacaoEnum,
    NivelCalcificacaoEnum,
    ResultadoIA,
    StatusExameEnum,
)
from app.models.paciente import Paciente


class ExameRepository:
    """Operações de banco de dados para `Exame` e `ResultadoIA`."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def buscar_por_id(self, exame_id: uuid.UUID) -> Optional[Exame]:
        """Busca exame pelo UUID com o resultado da IA e paciente pré-carregados."""
        stmt = (
            select(Exame)
            .options(
                selectinload(Exame.resultado_ia),
                selectinload(Exame.paciente)
                .selectinload(Paciente.exames)
                .selectinload(Exame.resultado_ia),
            )
            .where(Exame.id == exame_id)
        )
        return self.db.scalar(stmt)

    def listar_por_paciente(self, paciente_id: uuid.UUID) -> List[Exame]:
        """Retorna todo o histórico de exames de um paciente em ordem cronológica reversa (RN06)."""
        stmt = (
            select(Exame)
            .options(
                selectinload(Exame.resultado_ia),
                selectinload(Exame.paciente)
                .selectinload(Paciente.exames)
                .selectinload(Exame.resultado_ia),
            )
            .where(Exame.paciente_id == paciente_id)
            .order_by(Exame.criado_em.desc())
        )
        return list(self.db.scalars(stmt).all())

    def criar_exame(
        self,
        paciente_id: uuid.UUID,
        medico_id: Optional[uuid.UUID],
        nome_arquivo_seguro: str,
        sha256_hash: str,
        tamanho_bytes: int,
        status_inicial: StatusExameEnum = StatusExameEnum.PENDENTE_LAUDO,
    ) -> Exame:
        """Registra um novo exame mamográfico vinculado ao paciente (RN01 e RN02)."""
        exame = Exame(
            paciente_id=paciente_id,
            medico_responsavel_id=medico_id,
            arquivo_dicom_nome_seguro=nome_arquivo_seguro,
            arquivo_dicom_sha256=sha256_hash,
            arquivo_dicom_tamanho_bytes=tamanho_bytes,
            status=status_inicial,
        )
        self.db.add(exame)
        self.db.commit()
        return exame

    def salvar_resultado_ia(
        self,
        exame: Exame,
        classificacao: NivelCalcificacaoEnum,
        localizacao: str,
        padrao: str,
        nivel_confianca: float,
        leitura_tecnica: str,
        tempo_processamento_ms: int = 120,
        versao_modelo: str = "ArterIA-CSBI-TopHat",
    ) -> Exame:
        """
        Registra ou atualiza o resultado da análise de IA para o exame (RN04)
        e avança o status do exame para `PENDENTE_LAUDO`.
        """
        if exame.resultado_ia:
            exame.resultado_ia.classificacao = classificacao
            exame.resultado_ia.localizacao = localizacao
            exame.resultado_ia.padrao = padrao
            exame.resultado_ia.nivel_confianca = nivel_confianca
            exame.resultado_ia.leitura_tecnica = leitura_tecnica
            exame.resultado_ia.tempo_processamento_ms = tempo_processamento_ms
            exame.resultado_ia.versao_modelo = versao_modelo
        else:
            novo_resultado = ResultadoIA(
                exame_id=exame.id,
                classificacao=classificacao,
                localizacao=localizacao,
                padrao=padrao,
                nivel_confianca=nivel_confianca,
                leitura_tecnica=leitura_tecnica,
                tempo_processamento_ms=tempo_processamento_ms,
                versao_modelo=versao_modelo,
            )
            self.db.add(novo_resultado)
            exame.resultado_ia = novo_resultado

        exame.status = StatusExameEnum.PENDENTE_LAUDO
        self.db.add(exame)
        self.db.commit()
        return exame

    def atualizar_status(self, exame: Exame, novo_status: StatusExameEnum) -> Exame:
        """Atualiza o status de processamento de um exame."""
        exame.status = novo_status
        self.db.add(exame)
        self.db.commit()
        return exame

    def assinar_laudo(
        self,
        exame: Exame,
        medico_id: uuid.UUID,
        diagnostico_final: str,
        modo_validacao: ModoValidacaoEnum,
        classificacao_final: Optional[NivelCalcificacaoEnum],
        laudo_pdf_url: str,
    ) -> Exame:
        """
        Criptografa o diagnóstico final do médico com AES/Fernet,
        atualiza o status para `LAUDADO` e registra o timestamp de assinatura (RF04).
        """
        exame.medico_responsavel_id = medico_id
        exame.diagnostico_final_encrypted = crypto_service.criptografar(diagnostico_final)
        exame.modo_validacao_medica = modo_validacao
        exame.classificacao_final_medica = classificacao_final
        exame.laudo_pdf_url = laudo_pdf_url
        exame.status = StatusExameEnum.LAUDADO
        exame.laudado_em = datetime.now(timezone.utc)

        self.db.add(exame)
        self.db.commit()
        return exame

    def deletar(self, exame: Exame) -> None:
        """Remove o exame e seu resultado de IA vinculado."""
        self.db.delete(exame)
        self.db.commit()
