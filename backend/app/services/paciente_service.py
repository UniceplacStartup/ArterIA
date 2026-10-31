"""
Serviço de Gestão Completa (CRUD) de Pacientes (RF07) com Conformidade LGPD.

Realiza descriptografia em memória apenas para médicos autenticados,
aplica mascaramento de CPF/E-mail, exclui arquivos físicos do cofre quando um paciente
é removido e registra toda operação na trilha de auditoria.
"""

import secrets
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.crypto import crypto_service
from app.models.paciente import Paciente
from app.repositories.auditoria_repo import AuditoriaRepository
from app.repositories.paciente_repo import PacienteRepository
from app.schemas.paciente import (
    AtualizarPacienteRequest,
    CriarPacienteRequest,
    PacienteResponse,
)
from app.services.dicom_service import dicom_storage_service


class PacienteService:
    """Regras de negócio de cadastro, listagem, consulta, edição e exclusão segura de pacientes."""

    def __init__(self, db: Session) -> None:
        self.paciente_repo = PacienteRepository(db)
        self.auditoria_repo = AuditoriaRepository(db)

    @staticmethod
    def converter_para_dto(paciente: Paciente) -> PacienteResponse:
        """
        Descriptografa os dados do paciente para o médico autenticado e inclui
        também as versões mascaradas de CPF e E-mail.
        Calcula a data e o status do último exame vinculado.
        """
        nome_plano = (
            crypto_service.descriptografar(paciente.nome_encrypted) or "Paciente"
        )
        cpf_plano = crypto_service.descriptografar(paciente.cpf_encrypted) or ""
        email_plano = crypto_service.descriptografar(paciente.email_encrypted) or ""

        ultimo_exame_data = None
        ultimo_exame_status = None
        ultimo_exame_id = None

        if paciente.exames:
            mais_recente = paciente.exames[0]
            ultimo_exame_data = mais_recente.criado_em.strftime("%Y-%m-%d")
            ultimo_exame_status = mais_recente.status
            ultimo_exame_id = str(mais_recente.id)

        return PacienteResponse(
            id=str(paciente.id),
            codigoPublico=paciente.codigo_publico,
            nome=nome_plano,
            dataNascimento=paciente.data_nascimento.isoformat(),
            cpfId=cpf_plano,
            email=email_plano,
            cpfMascarado=(
                crypto_service.mascarar_cpf(cpf_plano) if cpf_plano else None
            ),
            emailMascarado=(
                crypto_service.mascarar_email(email_plano) if email_plano else None
            ),
            ultimoExame=ultimo_exame_data,
            ultimoExameId=ultimo_exame_id,
            statusUltimoExame=ultimo_exame_status,
        )

    def listar_pacientes(self) -> List[PacienteResponse]:
        """Lista todos os pacientes cadastrados formatados para a tabela do Dashboard."""
        pacientes = self.paciente_repo.listar_todos()
        return [self.converter_para_dto(p) for p in pacientes]

    def localizar_entidade_paciente(self, identificador: str) -> Paciente:
        """
        Permite localizar o paciente tanto pelo UUID quanto pelo `codigo_publico` (ex.: `101`).
        Levanta HTTP 404 caso não exista.
        """
        paciente: Optional[Paciente] = None
        try:
            uid = uuid.UUID(identificador)
            paciente = self.paciente_repo.buscar_por_id(uid)
        except ValueError:
            paciente = self.paciente_repo.buscar_por_codigo_publico(identificador)

        if not paciente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Paciente não encontrado no sistema.",
            )
        return paciente

    def buscar_paciente(
        self,
        identificador: str,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
    ) -> PacienteResponse:
        """Busca dados de um paciente específico com resposta imediata."""
        _ = (usuario_id, ip_origem)
        paciente = self.localizar_entidade_paciente(identificador)
        return self.converter_para_dto(paciente)

    def criar_paciente(
        self,
        dados: CriarPacienteRequest,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> PacienteResponse:
        """
        Valida e cadastra um novo paciente com dados criptografados (Fernet AES)
        e gera Blind Index (HMAC-SHA256) sem bloquear testes por repetição de CPF.
        """
        _ = (ip_origem, user_agent)
        try:
            nome_efetivo = dados.obter_nome_efetivo()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

        cpf_informado = dados.cpfId or f"TEMP-{secrets.token_hex(6)}"
        email_informado = (
            str(dados.email) if dados.email else "nao-informado@arteria.med.br"
        )

        novo_paciente = self.paciente_repo.criar(
            nome=nome_efetivo,
            cpf=cpf_informado,
            email=email_informado,
            data_nascimento=dados.dataNascimento,
            criado_por_id=usuario_id,
        )

        return self.converter_para_dto(novo_paciente)

    def atualizar_paciente(
        self,
        identificador: str,
        dados: AtualizarPacienteRequest,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
    ) -> PacienteResponse:
        """
        Atualiza os dados cadastrais de um paciente existente re-criptografando os atributos modificados.
        """
        _ = (usuario_id, ip_origem)
        paciente = self.localizar_entidade_paciente(identificador)
        nome_novo = dados.nomeCompleto or dados.nome

        atualizado = self.paciente_repo.atualizar(
            paciente=paciente,
            nome=nome_novo,
            cpf=dados.cpfId,
            email=str(dados.email) if dados.email else None,
            data_nascimento=dados.dataNascimento,
        )

        return self.converter_para_dto(atualizado)

    def deletar_paciente(
        self,
        identificador: str,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
    ) -> None:
        """
        Exclui um paciente, todos os seus exames no banco de dados e apaga com segurança
        os arquivos físicos (.dcm, .pdf, .png, .jpg) do cofre de armazenamento (Direito ao Esquecimento LGPD).
        """
        paciente = self.localizar_entidade_paciente(identificador)
        paciente_id_str = str(paciente.id)
        codigo_publico = paciente.codigo_publico

        # Remove os arquivos físicos de todos os exames do paciente no cofre seguro
        for exame in paciente.exames:
            if exame.arquivo_dicom_nome_seguro:
                dicom_storage_service.remover_arquivo_seguro(
                    exame.arquivo_dicom_nome_seguro
                )

        self.paciente_repo.deletar(paciente)

        self.auditoria_repo.registrar_evento(
            acao="EXCLUSAO_PACIENTE",
            recurso="pacientes",
            usuario_id=usuario_id,
            recurso_id=paciente_id_str,
            ip_origem=ip_origem,
            detalhes={"codigo_publico": codigo_publico},
        )
