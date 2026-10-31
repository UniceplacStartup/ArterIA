"""
Classe Base Declarativa do SQLAlchemy 2.0.
Define convenções de nomenclatura para constraints e índices no PostgreSQL,
facilitando migrações limpas com Alembic no Neon.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Convenção de nomes determinísticos para chaves e índices no PostgreSQL
POSTGRES_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Classe base para todos os modelos ORM do ArterIA."""

    metadata = MetaData(naming_convention=POSTGRES_NAMING_CONVENTION)

