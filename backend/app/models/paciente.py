"""
Modelo ORM de Paciente (RF07) com Criptografia de Campo para Conformidade LGPD.

Dados sensíveis (Nome, CPF e E-mail) são armazenados exclusivamente criptografados
(`nome_encrypted`, `cpf_encrypted`, `email_encrypted`).
A unicidade e a busca por CPF utilizam `cpf_blind_index` (HMAC-SHA256 com pepper secreto).
"""

from datetime import date, datetime, timezone
from typing import TYPE_CHECKING, List, Optional
import uuid
from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.exame import Exame


class Paciente(Base):
    """
    Entidade de Paciente com proteção criptográfica em nível de coluna.
    """

    __tablename__ = "pacientes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # Código curto pseudonimizado para exibição rápida em tabelas (ex.: 101)
    codigo_publico: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )

    # Dados pessoais criptografados com AES/Fernet em repouso (LGPD)
    nome_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    cpf_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    email_encrypted: Mapped[str] = mapped_column(Text, nullable=False)

    # Blind Index determinístico (HMAC-SHA256) para busca exata e garantia de unicidade de CPF
    cpf_blind_index: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )

    data_nascimento: Mapped[date] = mapped_column(Date, nullable=False)

    criado_por_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
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

    # Relacionamento 1:N com Exames
    exames: Mapped[List["Exame"]] = relationship(
        "Exame",
        back_populates="paciente",
        cascade="all, delete-orphan",
        order_by="desc(Exame.criado_em)",
    )
