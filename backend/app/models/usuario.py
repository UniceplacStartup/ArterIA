"""
Modelo ORM de Usuário (Profissional de Saúde / Médico Radiologista - RF01).
Inclui mecanismos de bloqueio temporário de conta contra ataques de força bruta.
Compatível nativamente com Neon PostgreSQL (UUID nativo) e ambiente local de desenvolvimento.
"""

from datetime import datetime, timezone
import enum
from typing import Optional
import uuid
from sqlalchemy import Boolean, DateTime, Enum, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class PerfilUsuarioEnum(str, enum.Enum):
    """Papéis de acesso no sistema (RBAC)."""

    MEDICO = "MEDICO"
    ADMIN = "ADMIN"


class Usuario(Base):
    """
    Representa um médico ou profissional habilitado cadastrado na plataforma ArterIA.
    """

    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    crm: Mapped[str] = mapped_column(String(20), nullable=False)
    uf_crm: Mapped[str] = mapped_column(String(2), nullable=False)
    perfil: Mapped[PerfilUsuarioEnum] = mapped_column(
        Enum(PerfilUsuarioEnum, name="perfil_usuario_enum"),
        default=PerfilUsuarioEnum.MEDICO,
        nullable=False,
    )
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Controle de segurança contra tentativas sucessivas de login inválido (Account Lockout)
    tentativas_falhas_login: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    bloqueado_ate: Mapped[Optional[datetime]] = mapped_column(
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
