"""
Módulo de Segurança de Autenticação e Autorização (RF01).

Implementa:
- Hash de senhas utilizando Bcrypt com fator de custo seguro (12 rounds).
- Geração e validação de tokens JWT (Access Token e Refresh Token) com `jti` único,
  compatível com `python-jose` e `PyJWT`.
- Validação de força de senha para profissionais de saúde.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import uuid
import bcrypt
from jose import ExpiredSignatureError, JWTError, jwt
from app.core.config import settings


def gerar_hash_senha(senha_plana: str) -> str:
    """
    Gera um hash Bcrypt seguro com salt aleatório de 12 rounds.
    Trunca em 72 bytes (limite algorítmico do Bcrypt) após codificação UTF-8.
    """
    senha_bytes = senha_plana.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(senha_bytes, salt)
    return hashed.decode("utf-8")


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """
    Compara em tempo constante a senha informada com o hash Bcrypt armazenado,
    prevenindo ataques de temporização (Timing Attacks).
    """
    try:
        senha_bytes = senha_plana.encode("utf-8")[:72]
        hash_bytes = senha_hash.encode("utf-8")
        return bcrypt.checkpw(senha_bytes, hash_bytes)
    except Exception:
        return False


def criar_access_token(
    subject: str,
    claims_extras: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Emite um token JWT de acesso de curta duração (padrão: 30 minutos).
    Inclui `sub` (ID do usuário), `jti` (ID único do token), `iat`, `exp` e `type="access"`.
    """
    agora = datetime.now(timezone.utc)
    expiracao = agora + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(agora.timestamp()),
        "exp": int(expiracao.timestamp()),
        "jti": str(uuid.uuid4()),
        "type": "access",
    }
    if claims_extras:
        payload.update(claims_extras)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def criar_refresh_token(subject: str) -> str:
    """
    Emite um token JWT de renovação (Refresh Token) com validade estendida.
    Possui `type="refresh"` para impedir seu uso direto como Access Token.
    """
    agora = datetime.now(timezone.utc)
    expiracao = agora + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(agora.timestamp()),
        "exp": int(expiracao.timestamp()),
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decodificar_token(token: str, tipo_esperado: str = "access") -> Dict[str, Any]:
    """
    Decodifica e valida a assinatura, expiração e o tipo (`access` ou `refresh`) de um JWT.
    Levanta `ValueError` em caso de token expirado, inválido ou de tipo incorreto.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != tipo_esperado:
            raise ValueError(f"Tipo de token inválido. Esperado: {tipo_esperado}.")
        if not payload.get("sub"):
            raise ValueError("Token JWT sem identificador de usuário (sub).")
        return payload
    except ExpiredSignatureError as exc:
        raise ValueError("Sessão expirada. Faça login novamente.") from exc
    except JWTError as exc:
        raise ValueError("Token de autenticação inválido ou adulterado.") from exc
