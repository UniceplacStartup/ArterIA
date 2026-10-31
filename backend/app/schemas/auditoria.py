"""
Schemas Pydantic para Logs de Divergência Clínica (RA01) e Trilha de Auditoria (LGPD).
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel


class LogDivergenciaResponse(BaseModel):
    """
    Formato compatível com a interface `LogDivergencia` (RA01) definida no Frontend.
    """

    id: str
    examId: str
    aiDiagnosis: str
    doctorDiagnosis: str
    modoValidacao: str
    changedAt: str
    doctorId: str


class LogAuditoriaResponse(BaseModel):
    """
    Representação de um evento da trilha de auditoria de segurança (LGPD).
    """

    id: str
    usuarioId: Optional[str] = None
    acao: str
    recurso: str
    recursoId: Optional[str] = None
    ipOrigem: Optional[str] = None
    detalhes: Optional[Dict[str, Any]] = None
    criadoEm: str

