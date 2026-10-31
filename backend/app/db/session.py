"""
Gerenciamento de Conexão e Sessão com o Neon Serverless PostgreSQL e Fallback Automático SQLite.

Otimizado para baixa latência: mantém conexões quentes no pool sem `SELECT 1` extra a cada requisição,
e faz fallback automático para SQLite local se o banco externo estiver inacessível.
"""

import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings

logger = logging.getLogger("arteria.db")


def _criar_engine_resiliente():
    db_uri = settings.sqlalchemy_database_uri
    if not db_uri.startswith("sqlite"):
        try:
            eng = create_engine(
                db_uri,
                pool_pre_ping=True,
                pool_recycle=1800,
                pool_size=10,
                max_overflow=20,
                pool_use_lifo=True,
                connect_args={"connect_timeout": 5},
                echo=False,
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Conectado com sucesso ao PostgreSQL (Neon) com pool otimizado.")
            return eng
        except Exception as exc:
            logger.warning(
                "Não foi possível conectar ao PostgreSQL externo (%s). Ativando fallback SQLite local.",
                exc.__class__.__name__,
            )

    return create_engine(
        "sqlite:///./arteria_dev_vault.db",
        connect_args={"check_same_thread": False},
        echo=False,
    )


engine = _criar_engine_resiliente()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """
    Dependência FastAPI que fornece uma sessão de banco de dados por requisição
    e garante seu fechamento seguro ao final do ciclo.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
