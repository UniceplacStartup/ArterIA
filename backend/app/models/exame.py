"""
Modelos ORM de Exame Mamográfico e Resultado da Inteligência Artificial (RF02, RF03, RF04, RE02).
Mantém a rastreabilidade completa: Paciente -> Exame -> Imagem DICOM -> Análise IA -> Laudo Médico.
"""

from datetime import datetime, timezone
import enum
from typing import TYPE_CHECKING, Optional
import uuid
from sqlalchemy import BigInteger, DateTime, Enum, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.paciente import Paciente


class StatusExameEnum(str, enum.Enum):
    """Estados do ciclo de vida de processamento e laudo do exame."""

    PENDENTE = "PENDENTE"
    PROCESSANDO = "PROCESSANDO"
    FALHA_PROCESSAMENTO = "FALHA_PROCESSAMENTO"
    PENDENTE_LAUDO = "PENDENTE_LAUDO"
    LAUDADO = "LAUDADO"


class NivelCalcificacaoEnum(str, enum.Enum):
    """
    Níveis de classificação da Calcificação Arterial Mamária (CAM / BAC)
    alinhados à escala oficial da Canadian Society of Breast Imaging (CSBI - Graus 0 a 3).
    """

    AUSENTE = "AUSENTE"      # CSBI Grau 0: Ausência de calcificação vascular
    LEVE = "LEVE"            # CSBI Grau 1: Poucas calcificações vasculares puntiformes isoladas
    MODERADA = "MODERADA"    # CSBI Grau 2: Calcificação grosseira ou em trilho de trem em < 3 vasos
    ACENTUADA = "ACENTUADA"  # CSBI Grau 3: Calcificação grosseira severa ou em trilho de trem em >= 3 vasos


class ModoValidacaoEnum(str, enum.Enum):
    """Ação do médico sobre a sugestão de classificação gerada pela IA."""

    CONFIRMAR = "CONFIRMAR"
    AJUSTAR = "AJUSTAR"
    INVALIDAR = "INVALIDAR"


class Exame(Base):
    """
    Registro de um exame de mamografia associado obrigatoriamente a um paciente (RN01).
    """

    __tablename__ = "exames"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    paciente_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("pacientes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    medico_responsavel_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Metadados seguros do arquivo DICOM armazenado no cofre isolado
    arquivo_dicom_nome_seguro: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    arquivo_dicom_sha256: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True
    )
    arquivo_dicom_tamanho_bytes: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )

    status: Mapped[StatusExameEnum] = mapped_column(
        Enum(StatusExameEnum, name="status_exame_enum"),
        default=StatusExameEnum.PENDENTE,
        index=True,
        nullable=False,
    )

    # Dados do laudo médico final (RF04) — o diagnóstico textual é criptografado em repouso
    modo_validacao_medica: Mapped[Optional[ModoValidacaoEnum]] = mapped_column(
        Enum(ModoValidacaoEnum, name="modo_validacao_enum"),
        nullable=True,
    )
    classificacao_final_medica: Mapped[Optional[NivelCalcificacaoEnum]] = mapped_column(
        Enum(NivelCalcificacaoEnum, name="nivel_calcificacao_enum"),
        nullable=True,
    )
    diagnostico_final_encrypted: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    laudo_pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    laudado_em: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relacionamentos
    paciente: Mapped["Paciente"] = relationship("Paciente", back_populates="exames")
    resultado_ia: Mapped[Optional["ResultadoIA"]] = relationship(
        "ResultadoIA",
        back_populates="exame",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ResultadoIA(Base):
    """
    Resultado estruturado produzido pelo pipeline de análise da IA (RF03 / RN04).
    """

    __tablename__ = "resultados_ia"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    exame_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("exames.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    classificacao: Mapped[NivelCalcificacaoEnum] = mapped_column(
        Enum(NivelCalcificacaoEnum, name="nivel_calcificacao_enum"),
        nullable=False,
    )
    localizacao: Mapped[str] = mapped_column(String(150), nullable=False)
    padrao: Mapped[str] = mapped_column(String(150), nullable=False)
    nivel_confianca: Mapped[float] = mapped_column(Float, nullable=False)
    leitura_tecnica: Mapped[str] = mapped_column(Text, nullable=False)
    versao_modelo: Mapped[str] = mapped_column(
        String(50), default="ArterIA-CAM-v1.0", nullable=False
    )
    tempo_processamento_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    exame: Mapped["Exame"] = relationship("Exame", back_populates="resultado_ia")
