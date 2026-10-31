"""
Gerenciamento de Conexão e Sessão com o Neon Serverless PostgreSQL e Fallback Automático SQLite.

Se a conexão com o banco externo (Neon) falhar ou estiver inacessível, faz fallback automático
para o banco SQLite local para que o sistema nunca fique fora do ar.
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
                pool_recycle=300,
                pool_size=5,
                max_overflow=10,
                connect_args={"connect_timeout": 8},
                echo=settings.DEBUG,
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Conectado com sucesso ao PostgreSQL (Neon).")
            return eng
        except Exception as exc:
            logger.warning(
                "Não foi possível conectar ao PostgreSQL externo (%s). Ativando fallback SQLite local.",
                exc.__class__.__name__,
            )

    return create_engine(
        "sqlite:///./arteria_dev_vault.db",
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
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
