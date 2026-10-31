"""
Módulo de Criptografia e Proteção de Dados Sensíveis (LGPD / HIPAA).

Responsabilidades:
1. Criptografia Simétrica Autenticada (Fernet: AES-128-CBC + HMAC-SHA256) para proteger
   Dados Pessoais Sensíveis (PII e PHI) em repouso no PostgreSQL (Neon).
2. Blind Indexing (HMAC-SHA256 com Pepper Secreto) para permitir buscas exatas e
   restrições UNIQUE (ex.: CPF do paciente) sem armazenar o dado em texto claro.
3. Mascaramento de Dados (Data Masking) para exibição parcial segura e logs.
"""

import hashlib
import hmac
import re
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings


class CryptoService:
    """
    Serviço criptográfico centralizado para proteção de dados pessoais e clínicos.
    """

    def __init__(self) -> None:
        self._fernet = Fernet(settings.DATA_ENCRYPTION_KEY.encode("utf-8"))
        self._pepper = settings.BLIND_INDEX_PEPPER.encode("utf-8")

    def criptografar(self, texto_plano: Optional[str]) -> Optional[str]:
        """
        Criptografa uma string em texto plano utilizando Fernet (AES + HMAC).
        Cada chamada gera um IV (Initialization Vector) aleatório, garantindo que
        dois valores iguais produzam ciphertexts diferentes (Segurança Semântica).
        """
        if texto_plano is None:
            return None
        valor_limpo = texto_plano.strip()
        if not valor_limpo:
            return ""
        token = self._fernet.encrypt(valor_limpo.encode("utf-8"))
        return token.decode("utf-8")

    def descriptografar(self, texto_cifrado: Optional[str]) -> Optional[str]:
        """
        Descriptografa e verifica a integridade autenticada (HMAC) de um campo cifrado.
        Levanta ValueError caso o ciphertext tenha sido adulterado ou a chave seja inválida.
        """
        if texto_cifrado is None:
            return None
        if not texto_cifrado:
            return ""
        try:
            dados = self._fernet.decrypt(texto_cifrado.encode("utf-8"))
            return dados.decode("utf-8")
        except InvalidToken as exc:
            raise ValueError(
                "Falha na verificação de integridade criptográfica do dado sensível."
            ) from exc

    def gerar_blind_index(self, valor: str) -> str:
        """
        Gera um índice cego determinístico usando HMAC-SHA256 com o pepper secreto do servidor.
        Normaliza o valor (remove pontuação/espaços e converte para minúsculas) antes do hash.
        Usado para verificar duplicidade e buscar por CPF sem armazenar o CPF em texto claro.
        """
        normalizado = re.sub(r"[\s\.\-\/]", "", valor.strip().lower())
        digest = hmac.new(
            self._pepper,
            normalizado.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return digest

    @staticmethod
    def normalizar_cpf(cpf: str) -> str:
        """Remove caracteres não numéricos de um CPF ou identificador."""
        apenas_digitos = re.sub(r"\D", "", cpf)
        return apenas_digitos if apenas_digitos else cpf.strip()

    @staticmethod
    def mascarar_cpf(cpf: str) -> str:
        """
        Aplica máscara de proteção LGPD ao CPF (ex.: `***.456.789-**`),
        evitando exposição desnecessária em listagens e logs de auditoria.
        """
        digitos = re.sub(r"\D", "", cpf)
        if len(digitos) == 11:
            return f"***.{digitos[3:6]}.{digitos[6:9]}-**"
        if len(cpf) > 4:
            return f"***{cpf[-4:]}"
        return "***"

    @staticmethod
    def mascarar_email(email: str) -> str:
        """
        Aplica máscara ao e-mail (ex.: `ad***@dominio.com`).
        """
        if "@" not in email:
            return "***"
        usuario, dominio = email.split("@", 1)
        prefixo = usuario[:2] if len(usuario) >= 2 else usuario[:1]
        return f"{prefixo}***@{dominio}"


# Instância singleton reutilizável em toda a aplicação
crypto_service = CryptoService()

