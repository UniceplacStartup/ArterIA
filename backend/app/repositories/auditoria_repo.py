"""
Repositório de Auditoria de Segurança (LGPD) e Logs de Divergência Clínica (RA01).
Otimizado para não realizar `db.refresh` desnecessário após inserções append-only.
"""

from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.auditoria import LogAuditoria, LogDivergencia
from app.models.exame import ModoValidacaoEnum, NivelCalcificacaoEnum


class AuditoriaRepository:
    """Persistência append-only de eventos de auditoria e divergências clínicas."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def registrar_evento(
        self,
        acao: str,
        recurso: str,
        usuario_id: Optional[uuid.UUID] = None,
        recurso_id: Optional[str] = None,
        ip_origem: Optional[str] = None,
        user_agent: Optional[str] = None,
        detalhes: Optional[Dict[str, Any]] = None,
    ) -> Optional[LogAuditoria]:
        """Registra um evento na trilha de auditoria sem bloquear a operação principal."""
        try:
            log = LogAuditoria(
                usuario_id=usuario_id,
                acao=acao,
                recurso=recurso,
                recurso_id=recurso_id,
                ip_origem=ip_origem,
                user_agent=(user_agent or "")[:500] if user_agent else None,
                detalhes=detalhes,
            )
            self.db.add(log)
            self.db.commit()
            return log
        except Exception:
            self.db.rollback()
            return None

    def registrar_divergencia(
        self,
        exame_id: uuid.UUID,
        medico_id: uuid.UUID,
        classificacao_ia: NivelCalcificacaoEnum,
        modo_validacao: ModoValidacaoEnum,
        classificacao_medica: Optional[NivelCalcificacaoEnum],
        diagnostico_resumo: str,
    ) -> Optional[LogDivergencia]:
        """
        Registra uma divergência clínica (RA01) quando o médico ajusta ou invalida
        o resultado sugerido pelo modelo de Inteligência Artificial.
        """
        try:
            divergencia = LogDivergencia(
                exame_id=exame_id,
                medico_id=medico_id,
                classificacao_ia=classificacao_ia,
                modo_validacao=modo_validacao,
                classificacao_medica=classificacao_medica,
                diagnostico_medico_resumo=diagnostico_resumo[:1000],
            )
            self.db.add(divergencia)
            self.db.commit()
            return divergencia
        except Exception:
            self.db.rollback()
            return None

    def listar_divergencias(self, limite: int = 100) -> List[LogDivergencia]:
        """Lista os registros mais recentes de divergência entre IA e Médico."""
        stmt = (
            select(LogDivergencia)
            .order_by(LogDivergencia.criado_em.desc())
            .limit(limite)
        )
        return list(self.db.scalars(stmt).all())

    def listar_logs_auditoria(self, limite: int = 100) -> List[LogAuditoria]:
        """Lista os eventos mais recentes da trilha de auditoria de segurança."""
        stmt = (
            select(LogAuditoria)
            .order_by(LogAuditoria.criado_em.desc())
            .limit(limite)
        )
        return list(self.db.scalars(stmt).all())
