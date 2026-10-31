"""
Modelos ORM de Auditoria de Segurança (LGPD) e Divergência Clínica IA vs Médico (RA01).
Registros são exclusivamente de inserção (append-only) para garantir rastreabilidade forense.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid
from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from app.models.exame import ModoValidacaoEnum, NivelCalcificacaoEnum


class LogDivergencia(Base):
    """
    Registra divergências quando o médico responsável ajusta ou invalida
    a classificação sugerida pela Inteligência Artificial (Requisito de Auditoria RA01).
    """

    __tablename__ = "logs_divergencia"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    exame_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("exames.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    medico_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    classificacao_ia: Mapped[NivelCalcificacaoEnum] = mapped_column(
        Enum(NivelCalcificacaoEnum, name="nivel_calcificacao_enum"),
        nullable=False,
    )
    modo_validacao: Mapped[ModoValidacaoEnum] = mapped_column(
        Enum(ModoValidacaoEnum, name="modo_validacao_enum"),
        nullable=False,
    )
    classificacao_medica: Mapped[Optional[NivelCalcificacaoEnum]] = mapped_column(
        Enum(NivelCalcificacaoEnum, name="nivel_calcificacao_enum"),
        nullable=True,
    )
    diagnostico_medico_resumo: Mapped[str] = mapped_column(Text, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class LogAuditoria(Base):
    """
    Trilha de auditoria de segurança (LGPD Art. 37): registra acessos a prontuários,
    cadastros, autenticações, uploads de DICOM e assinaturas de laudos.
    Usa JSONB nativo no PostgreSQL (Neon) e JSON em banco local de desenvolvimento.
    """

    __tablename__ = "logs_auditoria"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    usuario_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    acao: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    recurso: Mapped[str] = mapped_column(String(100), nullable=False)
    recurso_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ip_origem: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    detalhes: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
