"""
Schemas de Autenticação, CRUD Completo de Profissionais de Saúde (RF01) e Configuração da IA Gemini.
Validação de CRM desativada para permitir testes livres sem limitação.
"""

import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegistroProfissionalRequest(BaseModel):
    """Payload para cadastro de um novo médico/profissional de saúde (CRM livre/opcional para testes)."""

    nomeCompleto: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    senha: str = Field(..., min_length=4, max_length=72)
    crm: Optional[str] = Field(default=" LIVRE", max_length=50)
    ufCrm: Optional[str] = Field(default="DF", max_length=10)

    @field_validator("nomeCompleto")
    @classmethod
    def sanitizar_nome(cls, valor: str) -> str:
        limpo = re.sub(r"[<>\"';]", "", valor).strip()
        return limpo if limpo else "Profissional ArterIA"

    @field_validator("crm")
    @classmethod
    def sanitizar_crm(cls, valor: Optional[str]) -> str:
        if not valor or not valor.strip():
            return "ISENTO"
        return valor.strip()[:20]

    @field_validator("ufCrm")
    @classmethod
    def validar_uf(cls, valor: Optional[str]) -> str:
        if not valor or not valor.strip():
            return "DF"
        return valor.strip().upper()[:2]


class AtualizarProfissionalRequest(BaseModel):
    """Payload para atualização dos dados cadastrais e/ou senha de um médico (CRM livre)."""

    nomeCompleto: Optional[str] = Field(default=None, max_length=150)
    email: Optional[EmailStr] = None
    crm: Optional[str] = Field(default=None, max_length=50)
    ufCrm: Optional[str] = Field(default=None, max_length=10)
    novaSenha: Optional[str] = Field(default=None, max_length=72)

    @field_validator("crm")
    @classmethod
    def sanitizar_crm(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        return valor.strip()[:20] if valor.strip() else "ISENTO"

    @field_validator("ufCrm")
    @classmethod
    def validar_uf(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        return valor.strip().upper()[:2] if valor.strip() else "DF"


class LoginRequest(BaseModel):
    """Payload de login do profissional médico."""

    email: EmailStr
    senha: str = Field(..., min_length=1, max_length=72)


class RefreshTokenRequest(BaseModel):
    """Payload para renovação do Access Token via Refresh Token."""

    refreshToken: str


class UsuarioResponse(BaseModel):
    """Representação pública segura do médico autenticado (jamais expõe hash de senha)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    crm: str
    crmNumero: Optional[str] = None
    ufCrm: Optional[str] = None
    email: str


class AuthTokenResponse(BaseModel):
    """Resposta completa de autenticação contendo tokens JWT e dados do usuário."""

    usuario: UsuarioResponse
    token: str
    refreshToken: str
    tokenType: str = "Bearer"
    expiresInMinutes: int


class GeminiStatusResponse(BaseModel):
    """Status atual da integração com a IA Google Gemini."""

    ativo: bool
    modelo: str
    chaveMascarada: Optional[str] = None
    modoAtual: str


class ConfigurarGeminiRequest(BaseModel):
    """Payload para configurar a chave gratuita e o modelo da API Google Gemini."""

    apiKey: Optional[str] = Field(default=None, max_length=200)
    modelo: Optional[str] = Field(default="gemini-2.5-pro", max_length=60)
