"""
Rotas de Autenticação, CRUD Completo de Profissionais Médicos (RF01) e Configuração da IA Gemini.
"""

from pathlib import Path
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.api.deps import obter_ip_cliente, obter_user_agent, obter_usuario_atual
from app.core.config import settings
from app.db.session import get_db
from app.models.usuario import Usuario
from app.schemas.auth import (
    AtualizarProfissionalRequest,
    AuthTokenResponse,
    ConfigurarGeminiRequest,
    GeminiStatusResponse,
    LoginRequest,
    RefreshTokenRequest,
    RegistroProfissionalRequest,
    UsuarioResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Autenticação e Profissionais"])


def _mascarar_chave_gemini(chave: str) -> Optional[str]:
    limpa = chave.strip()
    if len(limpa) < 10:
        return None
    return f"{limpa[:6]}...{limpa[-4:]}"


@router.post(
    "/registro",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo profissional médico",
)
def registrar_profissional(
    dados: RegistroProfissionalRequest,
    db: Session = Depends(get_db),
    ip: str = Depends(obter_ip_cliente),
    user_agent: Optional[str] = Depends(obter_user_agent),
) -> AuthTokenResponse:
    """
    Realiza o cadastro de um médico/radiologista com validação de CRM/UF,
    hash Bcrypt de senha e emissão imediata de tokens JWT.
    """
    service = AuthService(db)
    return service.registrar_profissional(dados, ip_origem=ip, user_agent=user_agent)


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Autenticar profissional médico",
)
def login(
    dados: LoginRequest,
    db: Session = Depends(get_db),
    ip: str = Depends(obter_ip_cliente),
    user_agent: Optional[str] = Depends(obter_user_agent),
) -> AuthTokenResponse:
    """
    Autentica o profissional e retorna `Access Token` + `Refresh Token` JWT.
    """
    service = AuthService(db)
    return service.autenticar(dados, ip_origem=ip, user_agent=user_agent)


@router.post(
    "/refresh",
    response_model=AuthTokenResponse,
    summary="Renovar token de acesso JWT",
)
def refresh_token(
    dados: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    """Emite um novo Access Token a partir de um Refresh Token válido."""
    service = AuthService(db)
    return service.renovar_token(dados.refreshToken)


@router.get(
    "/me",
    response_model=UsuarioResponse,
    summary="Obter dados do médico autenticado",
)
def obter_perfil_atual(
    usuario_atual: Usuario = Depends(obter_usuario_atual),
) -> UsuarioResponse:
    """Retorna os dados cadastrais do médico autenticado na sessão atual."""
    return AuthService.converter_para_response(usuario_atual)


@router.put(
    "/me",
    response_model=UsuarioResponse,
    summary="Editar dados do próprio médico autenticado",
)
def atualizar_meu_perfil(
    dados: AtualizarProfissionalRequest,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> UsuarioResponse:
    """Permite ao doutor(a) editar seu Nome, E-mail, CRM, UF do CRM e Senha."""
    service = AuthService(db)
    return service.atualizar_profissional(
        alvo_id=usuario_atual.id,
        dados=dados,
        executor_id=usuario_atual.id,
        ip_origem=ip,
    )


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir a própria conta profissional",
)
def deletar_meu_perfil(
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> Response:
    """Remove a conta do profissional autenticado (desde que exista outro médico ativo)."""
    service = AuthService(db)
    service.deletar_profissional(
        alvo_id=usuario_atual.id,
        executor_id=usuario_atual.id,
        ip_origem=ip,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/profissionais",
    response_model=List[UsuarioResponse],
    summary="Listar todos os médicos/profissionais cadastrados",
)
def listar_profissionais(
    db: Session = Depends(get_db),
    _usuario_atual: Usuario = Depends(obter_usuario_atual),
) -> List[UsuarioResponse]:
    """Lista todos os doutores cadastrados na plataforma."""
    service = AuthService(db)
    return service.listar_profissionais()


@router.put(
    "/profissionais/{profissional_id}",
    response_model=UsuarioResponse,
    summary="Editar dados de um médico específico",
)
def atualizar_profissional_por_id(
    profissional_id: str,
    dados: AtualizarProfissionalRequest,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> UsuarioResponse:
    """Atualiza os dados cadastrais de um médico pelo seu ID."""
    try:
        uid = uuid.UUID(profissional_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de profissional inválido.",
        ) from exc

    service = AuthService(db)
    return service.atualizar_profissional(
        alvo_id=uid,
        dados=dados,
        executor_id=usuario_atual.id,
        ip_origem=ip,
    )


@router.delete(
    "/profissionais/{profissional_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir um médico cadastrado",
)
def deletar_profissional_por_id(
    profissional_id: str,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> Response:
    """Remove o cadastro de um médico pelo seu ID."""
    try:
        uid = uuid.UUID(profissional_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de profissional inválido.",
        ) from exc

    service = AuthService(db)
    service.deletar_profissional(
        alvo_id=uid,
        executor_id=usuario_atual.id,
        ip_origem=ip,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/gemini-status",
    response_model=GeminiStatusResponse,
    summary="Consultar status da integração com a IA Google Gemini",
)
def obter_status_gemini(
    _usuario_atual: Usuario = Depends(obter_usuario_atual),
) -> GeminiStatusResponse:
    """Retorna se a chave gratuita do Google Gemini está ativa e qual modelo está configurado."""
    chave = (settings.GEMINI_API_KEY or "").strip()
    ativo = len(chave) >= 10
    return GeminiStatusResponse(
        ativo=ativo,
        modelo=settings.GEMINI_MODEL,
        chaveMascarada=_mascarar_chave_gemini(chave) if ativo else None,
        modoAtual=(
            f"Google Gemini ({settings.GEMINI_MODEL}) + Visão Computacional Ativos"
            if ativo
            else "Motor de Visão Computacional Radiológica Local (Insira GEMINI_API_KEY para Gemini Pro/Flash)"
        ),
    )


@router.post(
    "/gemini-config",
    response_model=GeminiStatusResponse,
    summary="Configurar chave gratuita e modelo da API Google Gemini",
)
def configurar_chave_gemini(
    dados: ConfigurarGeminiRequest,
    _usuario_atual: Usuario = Depends(obter_usuario_atual),
) -> GeminiStatusResponse:
    """
    Atualiza a `GEMINI_API_KEY` e o `GEMINI_MODEL` (`gemini-2.5-pro` ou `gemini-2.5-flash`)
    em memória no servidor e persiste no arquivo `.env` local.
    """
    if dados.apiKey and len(dados.apiKey.strip()) >= 10:
        settings.GEMINI_API_KEY = dados.apiKey.strip()
    if dados.modelo:
        settings.GEMINI_MODEL = dados.modelo.strip()

    chave_atual = (settings.GEMINI_API_KEY or "").strip()
    modelo_atual = settings.GEMINI_MODEL

    if settings.ENVIRONMENT.lower() != "production":
        caminho_env = Path(".env")
        linhas_atuais: list[str] = []
        if caminho_env.is_file():
            linhas_atuais = caminho_env.read_text(encoding="utf-8").splitlines()

        novas_linhas = [
            linha
            for linha in linhas_atuais
            if not linha.strip().startswith("GEMINI_API_KEY=")
            and not linha.strip().startswith("GEMINI_MODEL=")
        ]
        if chave_atual:
            novas_linhas.append(f'GEMINI_API_KEY="{chave_atual}"')
        novas_linhas.append(f'GEMINI_MODEL="{modelo_atual}"')
        caminho_env.write_text("\n".join(novas_linhas) + "\n", encoding="utf-8")

    ativo = len(chave_atual) >= 10
    return GeminiStatusResponse(
        ativo=ativo,
        modelo=modelo_atual,
        chaveMascarada=_mascarar_chave_gemini(chave_atual) if ativo else None,
        modoAtual=(
            f"Google Gemini ({modelo_atual}) + Visão Computacional Ativos"
            if ativo
            else "Motor de Visão Computacional Radiológica Local"
        ),
    )
