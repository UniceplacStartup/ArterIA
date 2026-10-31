"""
Módulo de Tratamento Global de Exceções.

Garante que erros internos de banco de dados ou de sistema NUNCA exponham
stack traces, queries SQL ou detalhes da infraestrutura ao cliente final
(Prevenção contra Information Disclosure - OWASP Top 10).
"""

import logging
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger("arteria.security")


def registrar_exception_handlers(app: FastAPI) -> None:
    """Registra tratadores globais de exceções na instância do FastAPI."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """
        Formata erros de validação de entrada (Pydantic) de forma limpa e amigável em português,
        sem ecoar payloads sensíveis como senhas ou CPFs nos logs.
        """
        erros_formatados = []
        for err in exc.errors():
            campo = " -> ".join(str(loc) for loc in err.get("loc", []) if loc != "body")
            mensagem = err.get("msg", "Valor inválido")
            erros_formatados.append({"campo": campo, "mensagem": mensagem})

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Dados de entrada inválidos. Verifique os campos informados.",
                "erros": erros_formatados,
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        """
        Intercepta falhas do banco de dados (ex.: queda momentânea de rede ou constraint),
        registrando internamente o erro e retornando mensagem segura e genérica ao cliente.
        """
        request_id = getattr(request.state, "request_id", "N/A")
        logger.error(
            "Erro de banco de dados [Request-ID: %s]: %s",
            request_id,
            exc.__class__.__name__,
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": (
                    "Serviço de banco de dados temporariamente indisponível. "
                    "Tente novamente em alguns instantes."
                ),
                "request_id": request_id,
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """
         Barreira final contra exceções não tratadas para evitar vazamento de informações internas.
        """
        request_id = getattr(request.state, "request_id", "N/A")
        logger.exception("Erro interno não tratado [Request-ID: %s]", request_id)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Ocorreu um erro interno inesperado ao processar a solicitação.",
                "request_id": request_id,
            },
        )

