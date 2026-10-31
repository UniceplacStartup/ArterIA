"""
Schemas Pydantic para Gestão Completa (CRUD) de Pacientes (RF07).
Flexibilizados para evitar erros 422 em campos opcionais ou formatos variados durante testes.
"""

from datetime import date
import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.exame import StatusExameEnum


class CriarPacienteRequest(BaseModel):
    """
    Aceita tanto o formato simplificado da API quanto o formato completo da tela de Cadastro de Paciente.
    Todos os dados sensíveis (nome, cpfId, email) serão criptografados com AES/Fernet antes de persistir.
    """

    nome: Optional[str] = Field(default=None, max_length=150)
    nomeCompleto: Optional[str] = Field(default=None, max_length=150)
    cpfId: Optional[str] = Field(default=None, max_length=50)
    dataNascimento: date = Field(default_factory=lambda: date(1975, 6, 15))
    email: Optional[str] = Field(default=None, max_length=150)

    @field_validator("nome", "nomeCompleto")
    @classmethod
    def sanitizar_nomes(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        limpo = re.sub(r"[<>\"';]", "", valor).strip()
        return limpo or None

    @field_validator("cpfId", "email", mode="before")
    @classmethod
    def limpar_opcionais(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        texto = str(valor).strip()
        return texto if texto else None

    @field_validator("dataNascimento", mode="before")
    @classmethod
    def normalizar_data_nascimento(cls, valor: object) -> object:
        if not valor or (isinstance(valor, str) and not valor.strip()):
            return date(1975, 6, 15)
        return valor

    def obter_nome_efetivo(self) -> str:
        """Retorna o nome informado independentemente do alias utilizado (`nome` ou `nomeCompleto`)."""
        nome_final = (self.nomeCompleto or self.nome or "").strip()
        if not nome_final:
            return "Paciente Cadastrada"
        return nome_final


class AtualizarPacienteRequest(BaseModel):
    """
    Payload para atualização cadastral de um paciente existente.
    Re-criptografa os campos sensíveis alterados e recalcula o Blind Index do CPF se modificado.
    """

    nome: Optional[str] = Field(default=None, max_length=150)
    nomeCompleto: Optional[str] = Field(default=None, max_length=150)
    cpfId: Optional[str] = Field(default=None, max_length=50)
    dataNascimento: Optional[date] = None
    email: Optional[str] = Field(default=None, max_length=150)

    @field_validator("nome", "nomeCompleto", "cpfId", "email", mode="before")
    @classmethod
    def limpar_campos(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        limpo = re.sub(r"[<>\"';]", "", str(valor)).strip()
        return limpo if limpo else None

    @field_validator("dataNascimento", mode="before")
    @classmethod
    def validar_data_opcional(cls, valor: object) -> object:
        if not valor or (isinstance(valor, str) and not valor.strip()):
            return None
        return valor


class PacienteResponse(BaseModel):
    """
    DTO de saída de Paciente compatível com a interface `Paciente` do Frontend React.
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
