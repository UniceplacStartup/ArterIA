"""
Rotas de Gestão de Exames Mamográficos, Upload DICOM/PDF, Reprocessamento e Assinatura de Laudo
(RF02, RF03, RF04, RF05, RF06, RE01, RE02).
"""

import uuid
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import obter_ip_cliente, obter_usuario_atual
from app.db.session import get_db
from app.models.usuario import Usuario
from app.repositories.exame_repo import ExameRepository
from app.schemas.exame import (
    AssinarLaudoRequest,
    AssistenteCsbiRequest,
    AssistenteCsbiResponse,
    ExameResponse,
)
from app.services.dicom_service import dicom_storage_service
from app.services.exame_service import ExameService

router = APIRouter(prefix="/exames", tags=["Exames e Mamografias"])


@router.post(
    "/upload",
    response_model=ExameResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Fazer upload de exame (DICOM .dcm ou PDF .pdf) e iniciar análise de IA",
)
async def upload_exame(
    background_tasks: BackgroundTasks,
    pacienteId: str = Form(..., description="ID ou Código Público do paciente"),
    arquivo: UploadFile = File(
        ..., description="Arquivo de exame no formato DICOM (.dcm) ou PDF (.pdf)"
    ),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> ExameResponse:
    """
    Recebe um arquivo `.dcm` ou `.pdf`, valida a assinatura binária (Magic Bytes) e o limite de 100 MB,
    armazena no cofre isolado e dispara o pipeline de classificação de Calcificação Arterial Mamária.
    """
    service = ExameService(db)
    return await service.realizar_upload_exame(
        paciente_identificador=pacienteId,
        arquivo=arquivo,
        background_tasks=background_tasks,
        usuario_id=usuario.id,
        ip_origem=ip,
    )


@router.get(
    "/{exame_id}",
    response_model=ExameResponse,
    summary="Consultar detalhes e status do exame",
)
def buscar_exame(
    exame_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> ExameResponse:
    """Retorna os metadados do exame, status da análise e o resultado da IA quando concluído."""
    service = ExameService(db)
    return service.buscar_exame(
        exame_id=exame_id,
        usuario_id=usuario.id,
        ip_origem=ip,
    )


@router.get(
    "/{exame_id}/dicom",
    summary="Baixar/visualizar arquivo de exame (DICOM ou PDF) de forma autenticada (RF06)",
)
def obter_arquivo_exame(
    exame_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> FileResponse:
    """
    Serve o arquivo DICOM (.dcm) ou PDF (.pdf) diretamente do cofre isolado
    apenas para o médico responsável pelo paciente, impedindo exposição entre médicos.
    """
    try:
        uid = uuid.UUID(exame_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador de exame inválido.",
        ) from exc

    repo = ExameRepository(db)
    exame = repo.buscar_por_id(uid)
    if (
        not exame
        or not exame.arquivo_dicom_nome_seguro
        or (
            exame.paciente
            and exame.paciente.criado_por_id is not None
            and exame.paciente.criado_por_id != usuario.id
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo de exame não encontrado.",
        )

    caminho = dicom_storage_service.obter_caminho_seguro(
        exame.arquivo_dicom_nome_seguro
    )
    sufixo = caminho.suffix.lower()
    mapa_media_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".dcm": "application/dicom",
    }
    media_type = mapa_media_types.get(sufixo, "application/octet-stream")
    extensao = sufixo if sufixo in mapa_media_types else ".dcm"

    return FileResponse(
        path=caminho,
        media_type=media_type,
        filename=f"exame-{exame.id}{extensao}",
        content_disposition_type="inline",
    )


@router.post(
    "/{exame_id}/reprocessar",
    response_model=ExameResponse,
    summary="Solicitar nova análise de IA para o exame (RE02)",
)
def reprocessar_exame(
    exame_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> ExameResponse:
    """Reencaminha o exame para a fila de processamento da IA em caso de falha ou revisão."""
    service = ExameService(db)
    return service.solicitar_reprocessamento(
        exame_id=exame_id,
        background_tasks=background_tasks,
        usuario_id=usuario.id,
        ip_origem=ip,
    )


@router.post(
    "/{exame_id}/assinar",
    response_model=ExameResponse,
    summary="Assinar laudo médico final do exame (RF04 / RA01)",
)
def assinar_laudo(
    exame_id: str,
    dados: AssinarLaudoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> ExameResponse:
    """
    Persiste o diagnóstico final do médico criptografado, muda o status para `LAUDADO`
    e registra log de divergência (RA01) caso o médico tenha ajustado ou invalidado a IA.
    """
    service = ExameService(db)
    return service.assinar_laudo_medico(
        exame_id=exame_id,
        dados=dados,
        medico_id=usuario.id,
        ip_origem=ip,
    )


@router.post(
    "/{exame_id}/assistente-csbi",
    response_model=AssistenteCsbiResponse,
    summary="Conversar com a Assistente Virtual CSBI e processar Triagem Cardiovascular/Mamária",
)
def interagir_assistente_csbi(
    exame_id: str,
    dados: AssistenteCsbiRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> AssistenteCsbiResponse:
    """
    Executa a Assistente Virtual Especialista em Saúde da Mama (Diretrizes CSBI & BI-RADS),
    cruzando a triagem clínica/cardiovascular e o grau de Calcificação Arterial Mamária (Graus 0 a 3)
    e retornando texto acolhedor sem asteriscos ou hashtags.
    """
    service = ExameService(db)
    return service.interagir_assistente_csbi(
        exame_id=exame_id, dados=dados, usuario_id=usuario.id
    )


@router.delete(
    "/{exame_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir exame e apagar imagem/PDF/DICOM enviada por engano",
)
def deletar_exame(
    exame_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> Response:
    """
    Exclui o exame selecionado do histórico do paciente e remove o arquivo físico
    do cofre seguro (`storage/dicom_vault`).
    """
    service = ExameService(db)
    service.deletar_exame(
        exame_id=exame_id,
        usuario_id=usuario.id,
        ip_origem=ip,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
