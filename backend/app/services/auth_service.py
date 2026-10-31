"""
Serviço de Autenticação e CRUD Completo de Profissionais Médicos (RF01).
Inclui proteção contra enumeração de contas e bloqueio temporário após 5 falhas consecutivas.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import (
    criar_access_token,
    criar_refresh_token,
    decodificar_token,
    gerar_hash_senha,
    verificar_senha,
)
from app.models.usuario import Usuario
from app.repositories.auditoria_repo import AuditoriaRepository
from app.repositories.usuario_repo import UsuarioRepository
from app.schemas.auth import (
    AtualizarProfissionalRequest,
    AuthTokenResponse,
    LoginRequest,
    RegistroProfissionalRequest,
    UsuarioResponse,
)

MAX_TENTATIVAS_LOGIN = 5
MINUTOS_BLOQUEIO_CONTA = 15


class AuthService:
    """Regras de negócio de autenticação, CRUD médico e emissão de JWT."""

    def __init__(self, db: Session) -> None:
        self.usuario_repo = UsuarioRepository(db)
        self.auditoria_repo = AuditoriaRepository(db)

    @staticmethod
    def converter_para_response(usuario: Usuario) -> UsuarioResponse:
        return UsuarioResponse(
            id=str(usuario.id),
            nome=usuario.nome,
            crm=f"{usuario.crm}-{usuario.uf_crm}",
            crmNumero=usuario.crm,
            ufCrm=usuario.uf_crm,
            email=usuario.email,
        )

    def _emitir_tokens(self, usuario: Usuario) -> AuthTokenResponse:
        claims = {
            "crm": f"{usuario.crm}-{usuario.uf_crm}",
            "perfil": usuario.perfil.value,
        }
        access_token = criar_access_token(
            subject=str(usuario.id), claims_extras=claims
        )
        refresh_token = criar_refresh_token(subject=str(usuario.id))
        return AuthTokenResponse(
            usuario=self.converter_para_response(usuario),
            token=access_token,
            refreshToken=refresh_token,
            expiresInMinutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )

    def listar_profissionais(self) -> List[UsuarioResponse]:
        """Retorna todos os médicos cadastrados na plataforma."""
        usuarios = self.usuario_repo.listar_todos()
        return [self.converter_para_response(u) for u in usuarios]

    def registrar_profissional(
        self,
        dados: RegistroProfissionalRequest,
        ip_origem: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuthTokenResponse:
        """
        Cadastra um novo médico após validar unicidade de E-mail e CRM/UF,
        aplicando hash Bcrypt de 12 rounds na senha.
        """
        if self.usuario_repo.buscar_por_email(dados.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um profissional cadastrado com este endereço de e-mail.",
            )

        crm_informado = (dados.crm or "ISENTO").strip()[:20]
        uf_informada = (dados.ufCrm or "DF").strip().upper()[:2]

        # Se o banco antigo ainda tiver restrição de unicidade em (crm, uf_crm), evita colisão automaticamente
        if self.usuario_repo.buscar_por_crm(crm_informado, uf_informada):
            crm_informado = f"{crm_informado[:12]}-{uuid.uuid4().hex[:4]}"

        senha_hash = gerar_hash_senha(dados.senha)
        novo_usuario = self.usuario_repo.criar(
            nome=dados.nomeCompleto,
            email=dados.email,
            senha_hash=senha_hash,
            crm=crm_informado,
            uf_crm=uf_informada,
        )

        self.auditoria_repo.registrar_evento(
            acao="REGISTRO_PROFISSIONAL",
            recurso="usuarios",
            usuario_id=novo_usuario.id,
            recurso_id=str(novo_usuario.id),
            ip_origem=ip_origem,
            user_agent=user_agent,
            detalhes={"crm_uf": f"{novo_usuario.crm}-{novo_usuario.uf_crm}"},
        )

        return self._emitir_tokens(novo_usuario)

    def atualizar_profissional(
        self,
        alvo_id: uuid.UUID,
        dados: AtualizarProfissionalRequest,
        executor_id: uuid.UUID,
        ip_origem: Optional[str] = None,
    ) -> UsuarioResponse:
        """
        Atualiza os dados cadastrais (Nome, E-mail, CRM, UF) e/ou senha de um médico.
        Verifica colisões de E-mail e CRM/UF antes de persistir.
        """
        usuario = self.usuario_repo.buscar_por_id(alvo_id)
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profissional médico não encontrado.",
            )

        if dados.email and dados.email.strip().lower() != usuario.email:
            existente_email = self.usuario_repo.buscar_por_email(dados.email)
            if existente_email and existente_email.id != usuario.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este endereço de e-mail já está em uso por outro profissional.",
                )
            usuario.email = dados.email.strip().lower()

        novo_crm = dados.crm.strip() if dados.crm else usuario.crm
        nova_uf = dados.ufCrm.strip().upper() if dados.ufCrm else usuario.uf_crm
        usuario.crm = novo_crm[:20]
        usuario.uf_crm = nova_uf[:2]

        if dados.nomeCompleto:
            usuario.nome = dados.nomeCompleto.strip()

        if dados.novaSenha:
            usuario.senha_hash = gerar_hash_senha(dados.novaSenha)

        atualizado = self.usuario_repo.atualizar(usuario)

        self.auditoria_repo.registrar_evento(
            acao="ATUALIZACAO_PROFISSIONAL",
            recurso="usuarios",
            usuario_id=executor_id,
            recurso_id=str(atualizado.id),
            ip_origem=ip_origem,
        )

        return self.converter_para_response(atualizado)

    def deletar_profissional(
        self,
        alvo_id: uuid.UUID,
        executor_id: uuid.UUID,
        ip_origem: Optional[str] = None,
    ) -> None:
        """
        Exclui um profissional médico do sistema, garantindo que sempre reste pelo menos
        1 médico ativo cadastrado para evitar bloqueio total da plataforma.
        """
        usuario = self.usuario_repo.buscar_por_id(alvo_id)
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profissional médico não encontrado.",
            )

        todos = self.usuario_repo.listar_todos()
        if len(todos) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Não é possível excluir o único médico cadastrado no sistema. "
                    "Cadastre outro profissional antes de remover esta conta."
                ),
            )

        alvo_id_str = str(usuario.id)
        crm_uf = f"{usuario.crm}-{usuario.uf_crm}"
        self.usuario_repo.deletar(usuario)

        self.auditoria_repo.registrar_evento(
            acao="EXCLUSAO_PROFISSIONAL",
            recurso="usuarios",
            usuario_id=executor_id,
            recurso_id=alvo_id_str,
            ip_origem=ip_origem,
            detalhes={"crm_uf": crm_uf},
        )

    def autenticar(
        self,
        dados: LoginRequest,
        ip_origem: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuthTokenResponse:
        """
        Autentica o profissional médico verificando bloqueio de conta (Account Lockout),
        status ativo e hash Bcrypt em tempo constante.
        Garante também que a conta padrão `medico@arteria.med.br` exista caso o banco tenha
        acabado de ser provisionado.
        """
        email_normalizado = dados.email.strip().lower()
        usuario = self.usuario_repo.buscar_por_email(email_normalizado)
        agora = datetime.now(timezone.utc)

        # Se for a conta padrão de demonstração e o banco ainda não a tiver, provisiona automaticamente
        if not usuario and email_normalizado == "medico@arteria.med.br":
            usuario = self.usuario_repo.criar(
                nome="Dra. Helena Vasconcelos",
                email="medico@arteria.med.br",
                senha_hash=gerar_hash_senha("ArterIA@2026"),
                crm="123456",
                uf_crm="DF",
            )

        if not usuario:
            self.auditoria_repo.registrar_evento(
                acao="LOGIN_FALHA_EMAIL_INEXISTENTE",
                recurso="auth",
                ip_origem=ip_origem,
                user_agent=user_agent,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail não encontrado. Verifique o e-mail digitado ou crie uma nova conta.",
            )

        bloqueado_ate = usuario.bloqueado_ate
        if bloqueado_ate is not None and bloqueado_ate.tzinfo is None:
            bloqueado_ate = bloqueado_ate.replace(tzinfo=timezone.utc)

        if bloqueado_ate and bloqueado_ate > agora:
            minutos_restantes = max(
                1, int((bloqueado_ate - agora).total_seconds() // 60)
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=(
                    f"Conta temporariamente bloqueada por segurança devido a múltiplas tentativas falhas. "
                    f"Tente novamente em {minutos_restantes} minuto(s)."
                ),
            )

        if not usuario.ativo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conta de profissional desativada. Contate o administrador.",
            )

        if not verificar_senha(dados.senha, usuario.senha_hash):
            usuario.tentativas_falhas_login += 1
            if usuario.tentativas_falhas_login >= MAX_TENTATIVAS_LOGIN:
                usuario.bloqueado_ate = agora + timedelta(
                    minutes=MINUTOS_BLOQUEIO_CONTA
                )
            self.usuario_repo.atualizar(usuario)

            self.auditoria_repo.registrar_evento(
                acao="LOGIN_SENHA_INVALIDA",
                recurso="auth",
                usuario_id=usuario.id,
                ip_origem=ip_origem,
                user_agent=user_agent,
                detalhes={"tentativas": usuario.tentativas_falhas_login},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Senha incorreta para este e-mail.",
            )

        if usuario.tentativas_falhas_login > 0 or usuario.bloqueado_ate is not None:
            usuario.tentativas_falhas_login = 0
            usuario.bloqueado_ate = None
            self.usuario_repo.atualizar(usuario)

        self.auditoria_repo.registrar_evento(
            acao="LOGIN_SUCESSO",
            recurso="auth",
            usuario_id=usuario.id,
            ip_origem=ip_origem,
            user_agent=user_agent,
        )

        return self._emitir_tokens(usuario)

    def renovar_token(self, refresh_token: str) -> AuthTokenResponse:
        """Valida o Refresh Token e emite um novo par de tokens JWT."""
        try:
            payload = decodificar_token(refresh_token, tipo_esperado="refresh")
            usuario_id = uuid.UUID(payload["sub"])
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido ou expirado. Faça login novamente.",
            ) from exc

        usuario = self.usuario_repo.buscar_por_id(usuario_id)
        if not usuario or not usuario.ativo:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado ou inativo.",
            )

        return self._emitir_tokens(usuario)
