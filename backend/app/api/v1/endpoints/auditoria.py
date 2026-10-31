"""
Rotas de Auditoria de Segurança (LGPD) e Divergência Clínica IA vs Médico (RA01).
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import obter_usuario_atual
from app.db.session import get_db
from app.models.usuario import Usuario
from app.repositories.auditoria_repo import AuditoriaRepository
from app.schemas.auditoria import LogAuditoriaResponse, LogDivergenciaResponse

router = APIRouter(prefix="/auditoria", tags=["Auditoria e Conformidade LGPD/RA01"])


@router.get(
    "/divergencias",
    response_model=List[LogDivergenciaResponse],
    summary="Listar divergências clínicas entre IA e Médico (RA01)",
)
def listar_divergencias(
    db: Session = Depends(get_db),
    _usuario: Usuario = Depends(obter_usuario_atual),
) -> List[LogDivergenciaResponse]:
    """
    Retorna os registros de auditoria clínica (RA01) gerados quando um médico
    ajusta ou invalida a classificação da Inteligência Artificial.
    """
    repo = AuditoriaRepository(db)
    registros = repo.listar_divergencias(limite=100)
    return [
        LogDivergenciaResponse(
            id=str(r.id),
            examId=str(r.exame_id),
            aiDiagnosis=r.classificacao_ia.value,
            doctorDiagnosis=(
                f"[{r.classificacao_medica.value}] {r.diagnostico_medico_resumo}"
                if r.classificacao_medica
                else r.diagnostico_medico_resumo
            ),
            modoValidacao=r.modo_validacao.value,
            changedAt=r.criado_em.isoformat(),
            doctorId=str(r.medico_id),
        )
        for r in registros
    ]


@router.get(
    "/logs",
    response_model=List[LogAuditoriaResponse],
    summary="Listar trilha de auditoria de segurança (LGPD)",
)
def listar_logs_auditoria(
    db: Session = Depends(get_db),
    _usuario: Usuario = Depends(obter_usuario_atual),
) -> List[LogAuditoriaResponse]:
    """Retorna os últimos eventos de segurança registrados na plataforma."""
    repo = AuditoriaRepository(db)
    logs = repo.listar_logs_auditoria(limite=100)
    return [
        LogAuditoriaResponse(
            id=str(item.id),
            usuarioId=str(item.usuario_id) if item.usuario_id else None,
            acao=item.acao,
            recurso=item.recurso,
            recursoId=item.recurso_id,
            ipOrigem=item.ip_origem,
            detalhes=item.detalhes,
            criadoEm=item.criado_em.isoformat(),
        )
        for item in logs
    ]

