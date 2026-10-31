"""
Pipeline de Análise de Inteligência Artificial para Calcificação Arterial Mamária (CAM - RF03 / RN05).

Integra-se ao serviço `GeminiAnalysisService` (Google Gemini 2.5 Flash Multimodal + Fallback Morfométrico Local)
para analisar exames nos formatos DICOM (.dcm), PDF (.pdf), PNG (.png) e JPEG (.jpg/.jpeg).
"""

import logging
from pathlib import Path
import time
from typing import Optional
import uuid
from app.db.session import SessionLocal
from app.models.exame import StatusExameEnum
from app.repositories.exame_repo import ExameRepository
from app.services.dicom_service import dicom_storage_service
from app.services.gemini_service import gemini_service

logger = logging.getLogger("arteria.ia_pipeline")


def executar_analise_ia_background(exame_id: uuid.UUID, semente_extra: int = 0) -> None:
    """
    Tarefa assíncrona executada em background para analisar o exame médico
    com o Google Gemini 2.5 Flash (ou analisador morfométrico local) e persistir
    o `ResultadoIA` no banco PostgreSQL (Neon).
    """
    inicio = time.perf_counter()

    db = SessionLocal()
    try:
        exame_repo = ExameRepository(db)
        exame = exame_repo.buscar_por_id(exame_id)
        if not exame:
            logger.warning("Exame %s não encontrado durante execução da IA.", exame_id)
            return

        caminho_arquivo: Optional[Path] = None
        if exame.arquivo_dicom_nome_seguro:
            try:
                caminho_arquivo = dicom_storage_service.obter_caminho_seguro(
                    exame.arquivo_dicom_nome_seguro
                )
            except Exception:
                caminho_arquivo = None

        sha_hex = exame.arquivo_dicom_sha256 or exame.id.hex

        resultado = gemini_service.analisar_exame_com_gemini(
            caminho_arquivo=caminho_arquivo,
            sha256_hex=sha_hex,
            semente_extra=semente_extra,
        )

        tempo_ms = int((time.perf_counter() - inicio) * 1000)

        exame_repo.salvar_resultado_ia(
            exame=exame,
            classificacao=resultado["classificacao"],
            localizacao=resultado["localizacao"],
            padrao=resultado["padrao"],
            nivel_confianca=resultado["nivel_confianca"],
            leitura_tecnica=resultado["leitura_tecnica"],
            tempo_processamento_ms=tempo_ms,
        )
        if exame.resultado_ia and resultado.get("versao_modelo"):
            exame.resultado_ia.versao_modelo = resultado["versao_modelo"]
            db.commit()

        logger.info(
            "Análise IA (%s) concluída para o exame %s em %d ms -> %s",
            resultado.get("versao_modelo", "ArterIA"),
            exame_id,
            tempo_ms,
            resultado["classificacao"].value,
        )
    except Exception:
        logger.exception("Falha durante o processamento de IA do exame %s", exame_id)
        try:
            exame_repo = ExameRepository(db)
            exame = exame_repo.buscar_por_id(exame_id)
            if exame:
                exame_repo.atualizar_status(exame, StatusExameEnum.FALHA_PROCESSAMENTO)
        except Exception:
            pass
    finally:
        db.close()
