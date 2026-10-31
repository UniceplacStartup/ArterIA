"""
Ponto de Entrada Principal da API ArterIA (FastAPI + PostgreSQL Neon).

Configura:
- Ciclo de vida (Lifespan) para verificação de conectividade, criação segura de tabelas
  e seed inicial em desenvolvimento.
- Middlewares de Segurança (OWASP Headers, Rate Limiting por IP e CORS estrito).
- Tratadores globais de exceções para evitar vazamento de stack traces.
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import registrar_exception_handlers
from app.core.middlewares import RateLimitMiddleware, SecurityHeadersMiddleware
from app.db.base import Base
from app.db.session import engine
import app.models  # noqa: F401 - garante registro de todos os modelos no metadata
from scripts.seed_neon import popular_dados_iniciais

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("arteria.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    Gerencia o ciclo de inicialização e encerramento do servidor.
    Sincroniza o schema SQLAlchemy com o banco de dados e popula dados iniciais em dev.
    """
    logger.info("Iniciando %s no ambiente [%s]...", settings.APP_NAME, settings.ENVIRONMENT)
    try:
        Base.metadata.create_all(bind=engine)
        if engine.dialect.name == "postgresql":
            try:
                with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                    conn.execute(
                        text("ALTER TYPE nivel_calcificacao_enum ADD VALUE IF NOT EXISTS 'AUSENTE'")
                    )
                    conn.execute(
                        text("ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS uq_usuarios_crm_uf")
                    )
            except Exception:
                pass
        popular_dados_iniciais()
        logger.info("Banco de dados inicializado e pronto para uso.")
    except Exception as exc:
        logger.warning(
            "Aviso na inicialização do banco (%s). Verifique a variável DATABASE_URL no .env.",
            exc.__class__.__name__,
        )
    yield
    logger.info("Encerrando conexões do %s...", settings.APP_NAME)
    engine.dispose()


def criar_aplicacao() -> FastAPI:
    """Fábrica de criação da aplicação FastAPI configurada com camadas de segurança."""
    exibir_docs = settings.ENVIRONMENT.lower() != "production"

    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "API segura de apoio à análise de mamografias e classificação de "
            "Calcificação Arterial Mamária (CAM), otimizada para Neon Serverless PostgreSQL."
        ),
        version="1.0.0",
        docs_url="/docs" if exibir_docs else None,
        redoc_url="/redoc" if exibir_docs else None,
        openapi_url="/openapi.json" if exibir_docs else None,
        lifespan=lifespan,
    )

    # 1. Middleware de CORS restrito às origens autorizadas no .env e domínios Vercel
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    # 2. Middleware de Cabeçalhos de Segurança OWASP e Anti-Cache de Dados Sensíveis
    app.add_middleware(SecurityHeadersMiddleware)

    # 3. Middleware de Rate Limiting contra Força Bruta e Abuso
    app.add_middleware(RateLimitMiddleware)

    # 4. Tratamento Global de Exceções sem vazamento de detalhes internos
    registrar_exception_handlers(app)

    # 5. Registro das rotas versionadas (/api/...)
    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["Monitoramento"])
    def health_check():
        """Endpoint público de verificação de saúde da API (sem expor dados sensíveis)."""
        return {
            "status": "online",
            "servico": settings.APP_NAME,
            "ambiente": settings.ENVIRONMENT,
        }

    return app


app = criar_aplicacao()
