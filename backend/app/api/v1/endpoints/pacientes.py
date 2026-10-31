"""
Rotas de Gestão Completa (CRUD) de Pacientes e Consulta de Histórico (RF07 / RN06).
Cada médico autenticado visualiza e gerencia exclusivamente seus próprios pacientes.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.api.deps import obter_ip_cliente, obter_user_agent, obter_usuario_atual
from app.db.session import get_db
from app.models.usuario import Usuario
from app.schemas.exame import ExameResponse
from app.schemas.paciente import (
    AtualizarPacienteRequest,
    CriarPacienteRequest,
    PacienteResponse,
)
from app.services.exame_service import ExameService
from app.services.paciente_service import PacienteService

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])


@router.get(
    "",
    response_model=List[PacienteResponse],
    summary="Listar pacientes cadastrados pelo médico logado",
)
def listar_pacientes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> List[PacienteResponse]:
    """
    Lista exclusivamente os pacientes cadastrados pelo médico autenticado (`usuario.id`).
    """
    service = PacienteService(db)
    return service.listar_pacientes(usuario_id=usuario.id)


@router.post(
    "",
    response_model=PacienteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo paciente vinculado ao médico logado (com criptografia LGPD)",
)
def criar_paciente(
    dados: CriarPacienteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
    user_agent: Optional[str] = Depends(obter_user_agent),
) -> PacienteResponse:
    """
    Cadastra um novo paciente vinculado exclusivamente ao médico logado.
    """
    service = PacienteService(db)
    return service.criar_paciente(
        dados=dados,
        usuario_id=usuario.id,
        ip_origem=ip,
        user_agent=user_agent,
    )


@router.get(
    "/{paciente_id}",
    response_model=PacienteResponse,
    summary="Buscar paciente por ID ou Código Público",
)
def buscar_paciente(
    paciente_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> PacienteResponse:
    """Busca um paciente específico pertencente ao médico autenticado."""
    service = PacienteService(db)
    return service.buscar_paciente(
        identificador=paciente_id,
        usuario_id=usuario.id,
        ip_origem=ip,
    )


@router.put(
    "/{paciente_id}",
    response_model=PacienteResponse,
    summary="Editar dados cadastrais de um paciente do médico logado",
)
def atualizar_paciente(
    paciente_id: str,
    dados: AtualizarPacienteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> PacienteResponse:
    """Atualiza Nome, CPF/ID, Data de Nascimento ou E-mail de um paciente do médico autenticado."""
    service = PacienteService(db)
    return service.atualizar_paciente(
        identificador=paciente_id,
        dados=dados,
        usuario_id=usuario.id,
        ip_origem=ip,
    )


@router.delete(
    "/{paciente_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir paciente e todos os seus exames/imagens",
)
def deletar_paciente(
    paciente_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
    ip: str = Depends(obter_ip_cliente),
) -> Response:
    """Remove o paciente pertencente ao médico logado, seus exames e apaga os arquivos físicos."""
    service = PacienteService(db)
    service.deletar_paciente(
        identificador=paciente_id,
        usuario_id=usuario.id,
        ip_origem=ip,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{paciente_id}/exames",
    response_model=List[ExameResponse],
    summary="Listar histórico de exames do paciente",
)
def listar_exames_do_paciente(
    paciente_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> List[ExameResponse]:
    """Retorna todos os exames mamográficos associados ao histórico do paciente do médico autenticado (RN06)."""
    service = ExameService(db)
    return service.listar_exames_por_paciente(
        paciente_id, usuario_id=usuario.id
    )
