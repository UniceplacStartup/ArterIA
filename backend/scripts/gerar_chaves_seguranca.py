"""
Script utilitário para gerar chaves criptográficas de alta entropia para o arquivo `.env`.
Execução:
    python scripts/gerar_chaves_seguranca.py
"""

import secrets
from cryptography.fernet import Fernet


def main() -> None:
    jwt_secret = secrets.token_hex(32)
    fernet_key = Fernet.generate_key().decode("utf-8")
    blind_pepper = secrets.token_hex(32)

    print("=" * 78)
    print("CHAVES CRIPTOGRÁFICAS GERADAS COM SUCESSO — COPIE PARA SEU ARQUIVO .env")
    print("=" * 78)
    print(f'JWT_SECRET_KEY="{jwt_secret}"')
    print(f'DATA_ENCRYPTION_KEY="{fernet_key}"')
    print(f'BLIND_INDEX_PEPPER="{blind_pepper}"')
    print("=" * 78)


if __name__ == "__main__":
    main()

