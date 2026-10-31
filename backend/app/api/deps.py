"""
Dependências de Segurança e Injeção de Contexto para as Rotas FastAPI.
Valida tokens JWT Bearer, verifica se o médico está ativo e extrai metadados de auditoria.
"""

from typing import Optional
import uuid
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.security import decodificar_token
from app.db.session import get_db
from app.models.usuario import Usuario
from app.repositories.usuario_repo import UsuarioRepository

# Esquema HTTP Bearer para leitura do header `Authorization: Bearer <token>`
security_bearer = HTTPBearer(auto_error=False)


def obter_ip_cliente(request: Request) -> str:
    """Extrai o endereço IP de origem da requisição (considerando proxies reversos)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def obter_user_agent(request: Request) -> Optional[str]:
    """Extrai o cabeçalho User-Agent para registro em logs de auditoria LGPD."""
    return request.headers.get("User-Agent")


def obter_usuario_atual(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Dependência obrigatória para rotas protegidas (RF01).
    Valida o Access Token JWT, consulta o médico no banco e garante que sua conta está ativa.
    """
    if not credenciais or not credenciais.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação obrigatória. Token Bearer não fornecido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decodificar_token(credenciais.credentials, tipo_esperado="access")
        usuario_id = uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    repo = UsuarioRepository(db)
    usuario = repo.buscar_por_id(usuario_id)
    if not usuario or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Profissional não encontrado ou conta inativa.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return usuario

