"""
Middlewares de Segurança HTTP, Cabeçalhos de Proteção (OWASP) e Rate Limiting.

Camadas de defesa implementadas:
1. SecurityHeadersMiddleware:
   - Strict-Transport-Security (HSTS)
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY (anti-clickjacking)
   - Referrer-Policy: strict-origin-when-cross-origin
   - Cache-Control: no-store para não armazenar dados médicos em caches compartilhados
2. RateLimitMiddleware:
   - Limita requisições por endereço IP em janela deslizante (Sliding Window),
     com limite mais rígido para rotas de autenticação (`/auth/`).
"""

from collections import defaultdict, deque
import time
from typing import Deque, Dict
import uuid
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injeta cabeçalhos de segurança recomendados pela OWASP em todas as respostas da API
    e atribui um identificador de rastreio (`X-Request-ID`) a cada requisição.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)

        # Cabeçalhos de proteção OWASP
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )

        # Impede cacheamento de respostas contendo dados clínicos e de pacientes (LGPD/PHI)
        if request.url.path.startswith(settings.API_V1_STR):
            response.headers["Cache-Control"] = (
                "no-store, no-cache, must-revalidate, private"
            )
            response.headers["Pragma"] = "no-cache"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware de Rate Limiting por IP usando janela deslizante em memória.
    Protege contra ataques de força bruta em endpoints de autenticação e DoS na API.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._geral_hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._auth_hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._janela_segundos = 60.0

    def _obter_ip_cliente(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _verificar_limite(
        self, bucket: Deque[float], agora: float, limite_maximo: int
    ) -> bool:
        while bucket and (agora - bucket[0]) > self._janela_segundos:
            bucket.popleft()
        if len(bucket) >= limite_maximo:
            return False
        bucket.append(agora)
        return True

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        ip = self._obter_ip_cliente(request)
        agora = time.monotonic()
        caminho = request.url.path

        # Limite estrito para rotas de login/registro (prevenção de Credential Stuffing / Brute Force)
        if "/auth/login" in caminho or "/auth/registro" in caminho:
            permitido = self._verificar_limite(
                self._auth_hits[ip], agora, settings.AUTH_RATE_LIMIT_PER_MINUTE
            )
            if not permitido:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": (
                            "Muitas tentativas de autenticação a partir deste endereço. "
                            "Aguarde 1 minuto antes de tentar novamente."
                        )
                    },
                )

        # Limite geral da API
        permitido_geral = self._verificar_limite(
            self._geral_hits[ip], agora, settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        )
        if not permitido_geral:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Limite de requisições por minuto excedido. Tente novamente em instantes."
                },
            )

        return await call_next(request)
