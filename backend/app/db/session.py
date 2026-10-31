"""
Gerenciamento de Conexão e Sessão com o Neon Serverless PostgreSQL (e fallback de dev).

Otimizações específicas para o Neon Postgres:
- `pool_pre_ping=True`: testa a saúde da conexão antes de cada uso, lidando de forma
  transparente com o recurso de Scale-to-Zero (suspensão automática de compute) do Neon.
- `pool_recycle=300`: recicla conexões a cada 5 minutos para evitar conexões órfãs.
- `sslmode=require`: garante criptografia TLS 1.2/1.3 obrigatória em trânsito entre a API e o Neon.
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings

db_uri = settings.sqlalchemy_database_uri

if db_uri.startswith("sqlite"):
    engine = create_engine(
        db_uri,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )
else:
    engine = create_engine(
        db_uri,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
        echo=settings.DEBUG,
    )

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
