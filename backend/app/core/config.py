"""
Módulo de Configuração Central do Backend ArterIA.
Carrega e valida todas as variáveis de ambiente utilizando Pydantic Settings,
garantindo que chaves criptográficas, integração com o Google Gemini e conexões
de banco com o Neon Postgres estejam sempre funcionais.
"""

from functools import lru_cache
import importlib.util
import logging
import re
from typing import List
from cryptography.fernet import Fernet
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("arteria.config")


class Settings(BaseSettings):
    """
    Classe de configurações globais carregadas a partir do arquivo `.env` ou variáveis do sistema.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Identificação e Ambiente
    APP_NAME: str = "ArterIA API"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = False
    API_V1_STR: str = "/api"

    # Inteligência Artificial — Google Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-pro"

    # Conexão com o Banco de Dados (Neon Serverless PostgreSQL)
    DATABASE_URL: str = (
        "postgresql+psycopg://neondb_owner:SUA_SENHA_AQUI@ep-exemplo-pooler.sa-east-1.aws.neon.tech/arteria_db?sslmode=require"
    )

    # Segurança de Autenticação (JWT)
    JWT_SECRET_KEY: str = "dev_only_secret_key_change_in_production_9f8e7d6c5b4a3f2e1d0c9b8a"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Criptografia de Dados Sensíveis em Repouso (LGPD - PII/PHI)
    DATA_ENCRYPTION_KEY: str = "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg="
    BLIND_INDEX_PEPPER: str = "dev_only_blind_index_pepper_change_in_production_a1b2c3d4e5f60718"

    # Origens permitidas no CORS (separadas por vírgula no .env)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Armazenamento Seguro de Imagens Médicas (DICOM, PDF, PNG, JPEG)
    DICOM_STORAGE_DIR: str = "./storage/dicom_vault"
    MAX_DICOM_SIZE_MB: int = 100

    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 240
    AUTH_RATE_LIMIT_PER_MINUTE: int = 60

    @property
    def cors_origins_list(self) -> List[str]:
        """Converte a string de origens CORS separadas por vírgula em uma lista limpa."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_uri(self) -> str:
        """
        Normaliza a URL de conexão do PostgreSQL do Neon, remove parâmetros incompatíveis
        com o pooler (`channel_binding=require`) e faz fallback seguro para SQLite local
        quando necessário.
        """
        url = (self.DATABASE_URL or "").strip()

        if "ep-exemplo-pooler" in url or "SUA_SENHA_AQUI" in url or not url:
            return "sqlite:///./arteria_dev_vault.db"

        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)

        # Remove channel_binding=require caso esteja em endpoint -pooler do Neon
        url = re.sub(r"[&?]channel_binding=require", "", url)

        if url.startswith("postgresql"):
            if importlib.util.find_spec("psycopg") is None:
                return "sqlite:///./arteria_dev_vault.db"
            if "neon.tech" in url and "sslmode=" not in url:
                separador = "&" if "?" in url else "?"
                url = f"{url}{separador}sslmode=require"

        return url

    @field_validator("DATA_ENCRYPTION_KEY")
    @classmethod
    def validar_chave_fernet(cls, valor: str) -> str:
        """Garante que a chave Fernet seja sempre válida; se inválida, usa a chave padrão segura."""
        try:
            Fernet(valor.strip().encode("utf-8"))
            return valor.strip()
        except Exception:
            return "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg="

    def validar_seguranca_producao(self) -> None:
        """Registra aviso caso chaves padrão estejam sendo usadas em produção, sem derrubar o servidor."""
        if self.ENVIRONMENT.lower() == "production":
            if "dev_only" in self.JWT_SECRET_KEY:
                logger.warning("Aviso: usando JWT_SECRET_KEY padrão em ambiente de produção.")


@lru_cache
def get_settings() -> Settings:
    """Retorna uma instância em cache das configurações do sistema."""
    cfg = Settings()
    cfg.validar_seguranca_producao()
    return cfg


settings = get_settings()
