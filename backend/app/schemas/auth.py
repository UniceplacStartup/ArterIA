"""
Schemas de Autenticação, CRUD Completo de Profissionais de Saúde (RF01) e Configuração da IA Gemini.
Inclui validação flexível e sanitização automática de CRM, UF, e-mail e senha.
"""

import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

UFS_BRASIL = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}


class RegistroProfissionalRequest(BaseModel):
    """Payload para cadastro de um novo médico/profissional de saúde."""

    nomeCompleto: str = Field(..., min_length=3, max_length=150)
    email: EmailStr
    senha: str = Field(..., min_length=6, max_length=72)
    crm: str = Field(..., min_length=3, max_length=15)
    ufCrm: str = Field(..., min_length=2, max_length=2)

    @field_validator("nomeCompleto")
    @classmethod
    def sanitizar_nome(cls, valor: str) -> str:
        limpo = re.sub(r"[<>\"';]", "", valor).strip()
        if len(limpo) < 3:
            raise ValueError("Informe o nome completo válido (mínimo 3 caracteres).")
        return limpo

    @field_validator("crm")
    @classmethod
    def sanitizar_crm(cls, valor: str) -> str:
        apenas_digitos = re.sub(r"\D", "", valor.strip())
        limpo = apenas_digitos if len(apenas_digitos) >= 3 else re.sub(r"[^A-Za-z0-9]", "", valor.strip())
        if len(limpo) < 3:
            raise ValueError("Informe um número de CRM válido (mínimo 3 dígitos).")
        return limpo[:12]

    @field_validator("ufCrm")
    @classmethod
    def validar_uf(cls, valor: str) -> str:
        uf = valor.strip().upper()
        if uf not in UFS_BRASIL:
            raise ValueError("Selecione uma UF válida para o CRM.")
        return uf

    @field_validator("senha")
    @classmethod
    def validar_forca_senha(cls, valor: str) -> str:
        if len(valor.strip()) < 6:
            raise ValueError("A senha deve ter pelo menos 6 caracteres.")
        return valor


class AtualizarProfissionalRequest(BaseModel):
    """Payload para atualização dos dados cadastrais e/ou senha de um médico."""

    nomeCompleto: Optional[str] = Field(default=None, min_length=3, max_length=150)
    email: Optional[EmailStr] = None
    crm: Optional[str] = Field(default=None, min_length=3, max_length=15)
    ufCrm: Optional[str] = Field(default=None, min_length=2, max_length=2)
    novaSenha: Optional[str] = Field(default=None, min_length=6, max_length=72)

    @field_validator("nomeCompleto")
    @classmethod
    def sanitizar_nome(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        limpo = re.sub(r"[<>\"';]", "", valor).strip()
        if len(limpo) < 3:
            raise ValueError("Informe o nome completo válido.")
        return limpo

    @field_validator("crm")
    @classmethod
    def sanitizar_crm(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        apenas_digitos = re.sub(r"\D", "", valor.strip())
        limpo = apenas_digitos if len(apenas_digitos) >= 3 else re.sub(r"[^A-Za-z0-9]", "", valor.strip())
        if len(limpo) < 3:
            raise ValueError("Informe um CRM válido.")
        return limpo[:12]

    @field_validator("ufCrm")
    @classmethod
    def validar_uf(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        uf = valor.strip().upper()
        if uf not in UFS_BRASIL:
            raise ValueError("UF do CRM inválida.")
        return uf

    @field_validator("novaSenha")
    @classmethod
    def validar_forca_senha(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None or not valor.strip():
            return None
        if len(valor.strip()) < 6:
            raise ValueError("A nova senha deve ter pelo menos 6 caracteres.")
        return valor


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
