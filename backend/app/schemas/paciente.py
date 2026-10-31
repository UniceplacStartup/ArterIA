"""
Schemas Pydantic para Gestão Completa (CRUD) de Pacientes (RF07).
Inclui sanitização contra XSS/Injection e validação de dados demográficos.
"""

from datetime import date
import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.models.exame import StatusExameEnum


class CriarPacienteRequest(BaseModel):
    """
    Aceita tanto o formato simplificado da API quanto o formato completo da tela de Cadastro de Paciente.
    Todos os dados sensíveis (nome, cpfId, email) serão criptografados com AES/Fernet antes de persistir.
    """

    nome: Optional[str] = Field(default=None, min_length=3, max_length=150)
    nomeCompleto: Optional[str] = Field(default=None, min_length=3, max_length=150)
    cpfId: Optional[str] = Field(default=None, min_length=5, max_length=30)
    dataNascimento: date
    email: Optional[EmailStr] = None

    @field_validator("nome", "nomeCompleto")
    @classmethod
    def sanitizar_nomes(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        limpo = re.sub(r"[<>\"';]", "", valor).strip()
        if len(limpo) < 3:
            raise ValueError("O nome completo deve ter pelo menos 3 caracteres.")
        return limpo

    @field_validator("dataNascimento")
    @classmethod
    def validar_data_nascimento(cls, valor: date) -> date:
        hoje = date.today()
        if valor > hoje:
            raise ValueError("A data de nascimento não pode ser uma data futura.")
        if valor.year < 1900:
            raise ValueError("Data de nascimento inválida.")
        return valor

    def obter_nome_efetivo(self) -> str:
        """Retorna o nome informado independentemente do alias utilizado (`nome` ou `nomeCompleto`)."""
        nome_final = self.nomeCompleto or self.nome
        if not nome_final:
            raise ValueError("O nome completo do paciente é obrigatório.")
        return nome_final


class AtualizarPacienteRequest(BaseModel):
    """
    Payload para atualização cadastral de um paciente existente.
    Re-criptografa os campos sensíveis alterados e recalcula o Blind Index do CPF se modificado.
    """

    nome: Optional[str] = Field(default=None, min_length=3, max_length=150)
    nomeCompleto: Optional[str] = Field(default=None, min_length=3, max_length=150)
    cpfId: Optional[str] = Field(default=None, min_length=5, max_length=30)
    dataNascimento: Optional[date] = None
    email: Optional[EmailStr] = None

    @field_validator("nome", "nomeCompleto")
    @classmethod
    def sanitizar_nomes(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        limpo = re.sub(r"[<>\"';]", "", valor).strip()
        if len(limpo) < 3:
            raise ValueError("O nome completo deve ter pelo menos 3 caracteres.")
        return limpo

    @field_validator("dataNascimento")
    @classmethod
    def validar_data_nascimento(cls, valor: Optional[date]) -> Optional[date]:
        if valor is None:
            return None
        hoje = date.today()
        if valor > hoje:
            raise ValueError("A data de nascimento não pode ser uma data futura.")
        if valor.year < 1900:
            raise ValueError("Data de nascimento inválida.")
        return valor


class PacienteResponse(BaseModel):
    """
    DTO de saída de Paciente compatível com a interface `Paciente` do Frontend React.
    Por padrão, o CPF é retornado mascarado (`***.456.789-**`) em listagens, e também inclui
    `email` e `cpfId` para preenchimento de edição pelo médico autenticado.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    codigoPublico: str
    nome: str
    dataNascimento: str
    cpfId: Optional[str] = None
    email: Optional[str] = None
    cpfMascarado: Optional[str] = None
    emailMascarado: Optional[str] = None
    ultimoExame: Optional[str] = None
    ultimoExameId: Optional[str] = None
    statusUltimoExame: Optional[StatusExameEnum] = None
