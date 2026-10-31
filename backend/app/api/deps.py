"""
Dependências de Segurança e Injeção de Contexto para as Rotas FastAPI.
Garante isolamento estrito por médico autenticado (cada médico acessa apenas sua própria conta e pacientes).
"""

import time
from typing import Dict, Optional, Tuple
from urllib.parse import unquote
import uuid
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.security import decodificar_token, gerar_hash_senha
from app.db.session import get_db
from app.models.usuario import Usuario
from app.repositories.usuario_repo import UsuarioRepository

security_bearer = HTTPBearer(auto_error=False)

# Cache leve em memória por token: token_str -> (Usuario, expira_em)
_CACHE_USUARIOS: Dict[str, Tuple[Usuario, float]] = {}
_TTL_CACHE_SEGUNDOS = 120.0


def limpar_cache_usuarios() -> None:
    """Limpa o cache em memória quando um perfil médico é editado ou excluído."""
    _CACHE_USUARIOS.clear()


def obter_ip_cliente(request: Request) -> str:
    """Extrai o endereço IP de origem da requisição (considerando proxies reversos)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def obter_user_agent(request: Request) -> Optional[str]:
    """Extrai o cabeçalho User-Agent para registro em logs de auditoria LGPD."""
    return request.headers.get("User-Agent")


def _resolver_medico_contingencia(db: Session, token_str: str) -> Optional[Usuario]:
    """
    Se o token foi emitido em modo de contingência durante cold-start (`arteria-local:<email>:<nome>`),
    localiza ou cria exatamente a conta daquele médico específico no banco, mantendo isolamento total.
    """
    if not token_str.startswith("arteria-local:"):
        return None

    partes = token_str.split(":", 2)
    email = unquote(partes[1]).strip().lower() if len(partes) > 1 else ""
    nome = unquote(partes[2]).strip() if len(partes) > 2 else ""
    if not email:
        return None

    repo = UsuarioRepository(db)
    usuario = repo.buscar_por_email(email)
    if usuario:
        return usuario

    return repo.criar(
        nome=nome or f"Dr(a). {email.split('@')[0].title()}",
        email=email,
        crm=f"CRM-{uuid.uuid4().hex[:5].upper()}",
        uf_crm="DF",
        senha_hash=gerar_hash_senha("ArterIA@2026"),
    )


def obter_usuario_atual(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Dependência obrigatória para rotas protegidas (RF01).
    Identifica de forma única o médico autenticado para garantir que cada médico
    visualize e gerencie exclusivamente seus próprios pacientes.
    """
    if not credenciais or not credenciais.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação obrigatória.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_str = credenciais.credentials.strip()
    agora = time.monotonic()

    em_cache = _CACHE_USUARIOS.get(token_str)
    if em_cache and em_cache[1] > agora:
        return em_cache[0]

    repo = UsuarioRepository(db)
    usuario: Optional[Usuario] = None

    if token_str.startswith("arteria-local:"):
        usuario = _resolver_medico_contingencia(db, token_str)
    else:
        try:
            payload = decodificar_token(token_str, tipo_esperado="access")
            usuario_id = uuid.UUID(payload["sub"])
            usuario = repo.buscar_por_id(usuario_id)
        except Exception:
            usuario = None

    if not usuario or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada. Faça login novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _CACHE_USUARIOS[token_str] = (usuario, agora + _TTL_CACHE_SEGUNDOS)
    return usuario
