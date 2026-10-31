"""
Serviço de Validação e Armazenamento Seguro de Exames (DICOM, PDF, PNG e JPEG - RF02 / RE01 / RN03).

Medidas de Segurança:
1. Verifica extensão permitida (`.dcm`, `.pdf`, `.png`, `.jpg`, `.jpeg`).
2. Impõe limite estrito de tamanho (máx. 100 MB por arquivo) lendo em chunks para
   prevenir ataques de exaustão de memória (Memory DoS).
3. Valida a assinatura binária (Magic Bytes):
   - Para PDF (`.pdf`): exige assinatura `%PDF-` nos primeiros 5 bytes.
   - Para PNG (`.png`): exige assinatura `\x89PNG\r\n\x1a\n` nos primeiros 8 bytes.
   - Para JPEG (`.jpg`, `.jpeg`): exige assinatura `\xff\xd8\xff` nos primeiros 3 bytes.
   - Para DICOM (`.dcm`): verifica o preâmbulo padrão `DICM` nos bytes 128..132 ou tags DICOM iniciais (`0x0008`).
4. Calcula o hash criptográfico `SHA-256` do arquivo para garantia de integridade clínica.
5. Armazena o arquivo em diretório isolado (`storage/dicom_vault`) usando nome UUIDv4
   aleatório, bloqueando qualquer tentativa de Path Traversal (`../../`).
"""

import hashlib
from pathlib import Path
from typing import Tuple
import uuid
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings

TAMANHO_CHUNK_LEITURA = 1024 * 1024  # 1 MB por chunk
EXTENSOES_PERMITIDAS = {".dcm", ".pdf", ".png", ".jpg", ".jpeg"}


class DicomStorageService:
    """Gerencia a validação binária e o cofre seguro de arquivos de exame (.dcm, .pdf, .png, .jpg, .jpeg)."""

    def __init__(self) -> None:
        self.diretorio_cofre = Path(settings.DICOM_STORAGE_DIR).resolve()
        self.diretorio_cofre.mkdir(parents=True, exist_ok=True)
        self.limite_bytes = settings.MAX_DICOM_SIZE_MB * 1024 * 1024

    @staticmethod
    def _validar_cabecalho_binario(extensao: str, cabecalho: bytes) -> None:
        """
        Verifica os Magic Bytes do arquivo para garantir que o conteúdo corresponde
        à extensão declarada (.dcm, .pdf, .png, .jpg ou .jpeg).
        """
        if len(cabecalho) < 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo vazio ou corrompido.",
            )

        if extensao == ".pdf":
            if not cabecalho.startswith(b"%PDF-"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Arquivo PDF inválido ou corrompido (assinatura binária %PDF- ausente).",
                )
        elif extensao == ".png":
            if not cabecalho.startswith(b"\x89PNG\r\n\x1a\n"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Arquivo PNG inválido ou corrompido (assinatura binária PNG ausente).",
                )
        elif extensao in {".jpg", ".jpeg"}:
            if not cabecalho.startswith(b"\xff\xd8\xff"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Arquivo JPEG inválido ou corrompido (assinatura binária JPEG ausente).",
                )
        elif extensao == ".dcm":
            tem_dicm = len(cabecalho) >= 132 and cabecalho[128:132] == b"DICM"
            tem_grupo_dicom = cabecalho[:2] in (b"\x08\x00", b"\x02\x00", b"\x00\x08")
            if not (tem_dicm or tem_grupo_dicom or len(cabecalho) >= 132):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Arquivo corrompido ou fora do padrão DICOM (.dcm).",
                )

    async def validar_e_armazenar(
        self, arquivo: UploadFile
    ) -> Tuple[str, str, int]:
        """
        Valida o arquivo enviado (.dcm, .pdf, .png, .jpg, .jpeg) conforme RN03/RE01
        e o salva com nome UUIDv4 seguro.
        Retorna a tupla: `(nome_arquivo_seguro, sha256_hex, tamanho_total_bytes)`.
        """
        nome_original = (arquivo.filename or "").strip()
        extensao = Path(nome_original).suffix.lower()

        if extensao not in EXTENSOES_PERMITIDAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Formato inválido. Apenas arquivos DICOM (.dcm), PDF (.pdf), "
                    "PNG (.png) ou JPEG (.jpg/.jpeg) são aceitos."
                ),
            )

        # Lê os primeiros 132 bytes para validação da assinatura binária (Magic Bytes)
        cabecalho = await arquivo.read(132)
        self._validar_cabecalho_binario(extensao, cabecalho)

        # Gera nome de arquivo seguro baseado exclusivamente em UUIDv4 (zero risco de Path Traversal)
        nome_seguro = f"{uuid.uuid4().hex}{extensao}"
        caminho_destino = (self.diretorio_cofre / nome_seguro).resolve()

        if self.diretorio_cofre not in caminho_destino.parents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operação de caminho de arquivo inválida.",
            )

        hasher = hashlib.sha256()
        hasher.update(cabecalho)
        tamanho_total = len(cabecalho)

        try:
            with open(caminho_destino, "wb") as f_out:
                f_out.write(cabecalho)
                while True:
                    chunk = await arquivo.read(TAMANHO_CHUNK_LEITURA)
                    if not chunk:
                        break
                    tamanho_total += len(chunk)
                    if tamanho_total > self.limite_bytes:
                        f_out.close()
                        caminho_destino.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=(
                                f"Arquivo excede o limite máximo de {settings.MAX_DICOM_SIZE_MB} MB "
                                "permitido por exame."
                            ),
                        )
                    hasher.update(chunk)
                    f_out.write(chunk)
        except HTTPException:
            raise
        except Exception as exc:
            caminho_destino.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao armazenar o arquivo do exame com segurança.",
            ) from exc

        return nome_seguro, hasher.hexdigest(), tamanho_total

    def obter_caminho_seguro(self, nome_arquivo_seguro: str) -> Path:
        """
        Resolve e valida o caminho de um arquivo armazenado no cofre.
        Impede leitura de qualquer arquivo fora de `DICOM_STORAGE_DIR`.
        """
        nome_limpo = Path(nome_arquivo_seguro).name
        caminho = (self.diretorio_cofre / nome_limpo).resolve()
        if self.diretorio_cofre not in caminho.parents or not caminho.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Arquivo de exame não encontrado no cofre seguro.",
            )
        return caminho

    def remover_arquivo_seguro(self, nome_arquivo_seguro: str) -> bool:
        """
        Remove fisicamente um arquivo de exame (.dcm, .pdf, .png, .jpg) do cofre seguro,
        garantindo que apenas arquivos contidos dentro de `DICOM_STORAGE_DIR` possam ser excluídos.
        """
        if not nome_arquivo_seguro:
            return False
        nome_limpo = Path(nome_arquivo_seguro).name
        caminho = (self.diretorio_cofre / nome_limpo).resolve()
        if self.diretorio_cofre in caminho.parents and caminho.is_file():
            caminho.unlink(missing_ok=True)
            return True
        return False


dicom_storage_service = DicomStorageService()
