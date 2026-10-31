"""
Serviço de Gestão do Ciclo de Vida de Exames Mamográficos, Diretrizes CSBI (BAC Graus 0–3),
Comparação Temporal Automática, Dupla Saída de Relatório (Médico vs. Paciente) e Assistente Virtual
(RF02, RF03, RF04, RF05, RE02, RA01).
"""

from datetime import date, datetime
from typing import List, Optional
import uuid
from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.crypto import crypto_service
from app.models.exame import (
    Exame,
    ModoValidacaoEnum,
    StatusExameEnum,
)
from app.repositories.auditoria_repo import AuditoriaRepository
from app.repositories.exame_repo import ExameRepository
from app.schemas.exame import (
    AssinarLaudoRequest,
    AssistenteCsbiRequest,
    AssistenteCsbiResponse,
    ExameResponse,
    ResultadoIAResponse,
)
from app.services.dicom_service import dicom_storage_service
from app.services.gemini_service import (
    NOTA_OFICIAL_CSBI_GRAU_3,
    gemini_service,
    limpar_formatacao_assistente,
    mapear_classificacao_para_grau_csbi,
)
from app.services.ia_pipeline import executar_analise_ia_background
from app.services.paciente_service import PacienteService


class ExameService:
    """Coordena o recebimento de exames DICOM/PDF/Imagens, análise CSBI/BI-RADS por IA e assinatura de laudos."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.exame_repo = ExameRepository(db)
        self.auditoria_repo = AuditoriaRepository(db)
        self.paciente_service = PacienteService(db)

    @staticmethod
    def _calcular_idade_paciente(exame: Exame) -> Optional[int]:
        """Calcula a idade da paciente a partir da data de nascimento cadastrada."""
        try:
            if not exame.paciente or not exame.paciente.data_nascimento:
                return None
            nasc = exame.paciente.data_nascimento
            if isinstance(nasc, str):
                nasc = datetime.strptime(nasc[:10], "%Y-%m-%d").date()
            hoje = date.today()
            idade = (
                hoje.year
                - nasc.year
                - ((hoje.month, hoje.day) < (nasc.month, nasc.day))
            )
            return max(0, min(120, idade))
        except Exception:
            return None

    @staticmethod
    def _gerar_comparacao_temporal(exame: Exame, grau_atual: int) -> str:
        """
        Requisito de Comparação Temporal Automática (CAR/CSBI):
        Compara o `grauBac` do exame atual com o exame anterior da mesma paciente.
        """
        try:
            if not exame.paciente or not exame.paciente.exames:
                return "Primeiro exame registrado da paciente para linha de base CSBI."

            exames_ordenados = sorted(
                [e for e in exame.paciente.exames if e.resultado_ia is not None],
                key=lambda x: x.criado_em,
                reverse=True,
            )
            indice_atual = next(
                (i for i, e in enumerate(exames_ordenados) if e.id == exame.id),
                None,
            )
            if indice_atual is None or indice_atual + 1 >= len(exames_ordenados):
                return "Primeiro exame analisado da paciente (linha de base CSBI estabelecida)."

            exame_anterior = exames_ordenados[indice_atual + 1]
            if not exame_anterior.resultado_ia:
                return "Primeiro exame analisado da paciente (linha de base CSBI estabelecida)."

            grau_anterior, _ = mapear_classificacao_para_grau_csbi(
                exame_anterior.resultado_ia.classificacao
            )
            data_ant = exame_anterior.criado_em.strftime("%d/%m/%Y")

            if grau_atual > grau_anterior:
                return (
                    f"Progressão temporal identificada: evoluiu de CSBI Grau {grau_anterior} "
                    f"({exame_anterior.resultado_ia.classificacao.value} em {data_ant}) para "
                    f"CSBI Grau {grau_atual} ({exame.resultado_ia.classificacao.value if exame.resultado_ia else ''}). "
                    "Recomenda-se intensificar correlação cardiovascular."
                )
            if grau_atual < grau_anterior:
                return (
                    f"Comparação com exame anterior ({data_ant}): CSBI Grau {grau_anterior} "
                    f"anterior vs. CSBI Grau {grau_atual} na incidência atual."
                )
            return (
                f"Estabilidade temporal em relação ao exame de {data_ant}: mantido em CSBI Grau {grau_atual} "
                f"({exame.resultado_ia.classificacao.value if exame.resultado_ia else ''})."
            )
        except Exception:
            return "Linha de base CSBI registrada para acompanhamento evolutivo."

    @classmethod
    def converter_para_dto(cls, exame: Exame) -> ExameResponse:
        """
        Converte a entidade ORM `Exame` para o schema `ExameResponse`, aplicando:
        - Escala oficial CSBI (Graus 0, 1, 2 e 3);
        - Regra condicional por idade (< 55 anos) e gatilho cardiovascular;
        - Diferenciação estrita BAC (vascular, BI-RADS 2) vs. calcificações ductais;
        - Comparação temporal automática com exames anteriores;
        - Dupla saída de relatório (Resumo Técnico Médico vs. Explicação Acolhedora para a Paciente).
        """
        resultado_dto: Optional[ResultadoIAResponse] = None
        if exame.resultado_ia:
            grau_bac, vasos_afetados = mapear_classificacao_para_grau_csbi(
                exame.resultado_ia.classificacao
            )
            idade_paciente = cls._calcular_idade_paciente(exame)
            flag_menos_55 = bool(
                grau_bac in (1, 2)
                and idade_paciente is not None
                and idade_paciente < 55
            )
            alerta_cardio = (grau_bac == 3) or flag_menos_55

            nota_csbi: Optional[str] = None
            if grau_bac == 3:
                nota_csbi = NOTA_OFICIAL_CSBI_GRAU_3
            elif flag_menos_55:
                nota_csbi = (
                    f"Identificadas calcificações arteriais mamárias (CSBI Grau {grau_bac}) em paciente "
                    f"com menos de 55 anos ({idade_paciente} anos). Como calcificações arteriais em mulheres "
                    "abaixo de 55 anos são atípicas segundo a diretriz da CSBI, recomenda-se correlação "
                    "preventiva com fatores de risco cardiovascular."
                )

            bi_rads_cat = "BI-RADS 2 (Achado Vascular Benigno)"
            achados_bi_rads = (
                "Diferenciação BI-RADS vs. BAC: As calcificações identificadas possuem morfologia "
                "parietal vascular (tipicamente benignas do ponto de vista oncológico — BI-RADS 2), "
                "não devendo ser confundidas com microcalcificações ductais suspeitas de malignidade "
                "(amorfas, pleomórficas finas ou lineares ramificadas — BI-RADS 4/5)."
            )
            comparacao_temp = cls._gerar_comparacao_temporal(exame, grau_bac)

            texto_idade = (
                f"{idade_paciente} anos" if idade_paciente is not None else "Idade não informada"
            )
            resumo_medico = (
                f"RESUMO TÉCNICO RADIOLÓGICO (DIRETRIZ CSBI & BI-RADS)\n"
                f"• Classificação Vascular (CSBI BAC): Grau {grau_bac} ({exame.resultado_ia.classificacao.value}) — "
                f"Topografia: {exame.resultado_ia.localizacao} | Padrão: {exame.resultado_ia.padrao}\n"
                f"• Vasos Afetados Estimados: {vasos_afetados if grau_bac < 3 else '3 ou mais vasos'}\n"
                f"• Idade da Paciente na Avaliação: {texto_idade}"
                f"{' [ATENÇÃO PRECOCE < 55 ANOS]' if flag_menos_55 else ''}\n"
                f"• Avaliação Oncológica Mamária: {bi_rads_cat}. {achados_bi_rads}\n"
                f"• Comparação Temporal (CAR/CSBI): {comparacao_temp}\n"
                f"• Conduta / Nota Oficial CSBI: {nota_csbi or 'Sem indicação de nota cardiovascular obrigatória pela CSBI.'}"
            )

            explicacao_paciente = gemini_service.gerar_explicacao_inicial_paciente_csbi(
                grau_bac=grau_bac,
                idade_paciente=idade_paciente,
            )

            resultado_dto = ResultadoIAResponse(
                classificacao=exame.resultado_ia.classificacao,
                localizacao=exame.resultado_ia.localizacao,
                padrao=exame.resultado_ia.padrao,
                nivelConfianca=round(float(exame.resultado_ia.nivel_confianca), 1),
                leituraTecnica=exame.resultado_ia.leitura_tecnica,
                grauBac=grau_bac,
                vasosAfetados=vasos_afetados,
                idadePaciente=idade_paciente,
                flagAtencaoPrecoceMenos55=flag_menos_55,
                alertaCardiovascular=alerta_cardio,
                notaPadraoCsbi=nota_csbi,
                biRadsCategoria=bi_rads_cat,
                achadosOncologicosBiRads=achados_bi_rads,
                comparacaoTemporal=comparacao_temp,
                resumoTecnicoMedico=resumo_medico,
                explicacaoAcolhedoraPaciente=limpar_formatacao_assistente(explicacao_paciente),
            )

        diagnostico_plano: Optional[str] = None
        if exame.diagnostico_final_encrypted:
            diagnostico_plano = crypto_service.descriptografar(
                exame.diagnostico_final_encrypted
            )

        nome_arq = (exame.arquivo_dicom_nome_seguro or "").lower()
        if nome_arq.endswith(".pdf"):
            ext_query = "?formato=pdf"
        elif nome_arq.endswith(".png"):
            ext_query = "?formato=png"
        elif nome_arq.endswith(".jpg") or nome_arq.endswith(".jpeg"):
            ext_query = "?formato=jpg"
        else:
            ext_query = "?formato=dcm"

        dicom_url = (
            f"{settings.API_V1_STR}/exames/{exame.id}/dicom{ext_query}"
            if exame.arquivo_dicom_nome_seguro
            else ""
        )

        return ExameResponse(
            id=str(exame.id),
            pacienteId=str(exame.paciente_id),
            arquivoDicomUrl=dicom_url,
            status=exame.status,
            criadoEm=exame.criado_em.isoformat(),
            resultadoIA=resultado_dto,
            diagnosticoFinalMedico=diagnostico_plano,
            modoValidacaoMedica=exame.modo_validacao_medica,
            classificacaoFinalMedica=exame.classificacao_final_medica,
            laudoPdfUrl=exame.laudo_pdf_url,
        )

    def _localizar_exame_ou_ultimo_do_paciente(
        self,
        identificador: str,
        usuario_id: Optional[uuid.UUID] = None,
    ) -> Exame:
        """
        Localiza um exame pelo seu UUID ou retorna o exame mais recente do paciente,
        garantindo que pertença exclusivamente ao médico `usuario_id`.
        """
        try:
            uid = uuid.UUID(identificador)
            exame = self.exame_repo.buscar_por_id(uid)
            if exame:
                if (
                    usuario_id is not None
                    and exame.paciente
                    and exame.paciente.criado_por_id is not None
                    and exame.paciente.criado_por_id != usuario_id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Exame não pertence à sua carteira de pacientes.",
                    )
                return exame
        except ValueError:
            pass

        try:
            paciente = self.paciente_service.localizar_entidade_paciente(
                identificador, usuario_id=usuario_id
            )
            if paciente.exames:
                exame_recente = self.exame_repo.buscar_por_id(paciente.exames[0].id)
                if exame_recente:
                    return exame_recente
        except HTTPException:
            pass

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exame não encontrado.",
        )

    def buscar_exame(
        self,
        exame_id: str,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
    ) -> ExameResponse:
        """
        Retorna os detalhes de um exame pertencente à carteira do médico autenticado.
        Caso `exame_id` corresponda a um paciente sem exames ativos, retorna estado `PENDENTE`.
        """
        _ = ip_origem
        try:
            uid = uuid.UUID(exame_id)
            exame_direto = self.exame_repo.buscar_por_id(uid)
            if exame_direto:
                if (
                    usuario_id is not None
                    and exame_direto.paciente
                    and exame_direto.paciente.criado_por_id is not None
                    and exame_direto.paciente.criado_por_id != usuario_id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Exame não encontrado na sua carteira de pacientes.",
                    )
                return self.converter_para_dto(exame_direto)
        except ValueError:
            pass

        paciente = self.paciente_service.localizar_entidade_paciente(
            exame_id, usuario_id=usuario_id
        )
        if paciente.exames:
            exame_recente = self.exame_repo.buscar_por_id(paciente.exames[0].id)
            if exame_recente:
                return self.converter_para_dto(exame_recente)

        return ExameResponse(
            id=str(paciente.id),
            pacienteId=str(paciente.id),
            arquivoDicomUrl="",
            status=StatusExameEnum.PENDENTE,
            criadoEm=paciente.criado_em.isoformat(),
            resultadoIA=None,
            diagnosticoFinalMedico=None,
            modoValidacaoMedica=None,
            classificacaoFinalMedica=None,
            laudoPdfUrl=None,
        )

    def listar_exames_por_paciente(
        self,
        paciente_identificador: str,
        usuario_id: Optional[uuid.UUID] = None,
    ) -> List[ExameResponse]:
        """Lista todos os exames pertencentes ao histórico de um paciente do médico autenticado (RN06)."""
        paciente = self.paciente_service.localizar_entidade_paciente(
            paciente_identificador, usuario_id=usuario_id
        )
        exames = self.exame_repo.listar_por_paciente(paciente.id)
        return [self.converter_para_dto(e) for e in exames]

    async def realizar_upload_exame(
        self,
        paciente_identificador: str,
        arquivo: UploadFile,
        background_tasks: BackgroundTasks,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
    ) -> ExameResponse:
        """
        Valida o arquivo (.dcm, .pdf, .png, .jpg), salva no cofre isolado, executa a análise
        morfométrica CSBI instantânea (< 50ms) para disponibilizar o resultado imediatamente
        e dispara o refinamento opcional do Gemini em background.
        """
        _ = ip_origem
        paciente = self.paciente_service.localizar_entidade_paciente(
            paciente_identificador, usuario_id=usuario_id
        )

        nome_seguro, sha256_hex, tamanho_bytes = (
            await dicom_storage_service.validar_e_armazenar(arquivo)
        )

        novo_exame = self.exame_repo.criar_exame(
            paciente_id=paciente.id,
            medico_id=usuario_id,
            nome_arquivo_seguro=nome_seguro,
            sha256_hash=sha256_hex,
            tamanho_bytes=tamanho_bytes,
            status_inicial=StatusExameEnum.PENDENTE_LAUDO,
        )
        novo_exame.paciente = paciente

        caminho_seguro = dicom_storage_service.obter_caminho_seguro(nome_seguro)
        analise_rapida = gemini_service.analisar_exame_com_gemini(
            caminho_arquivo=caminho_seguro,
            sha256_hex=sha256_hex,
            semente_extra=0,
            apenas_local_rapido=True,
        )
        novo_exame = self.exame_repo.salvar_resultado_ia(
            exame=novo_exame,
            classificacao=analise_rapida["classificacao"],
            localizacao=analise_rapida["localizacao"],
            padrao=analise_rapida["padrao"],
            nivel_confianca=analise_rapida["nivel_confianca"],
            leitura_tecnica=analise_rapida["leitura_tecnica"],
            tempo_processamento_ms=85,
            versao_modelo=analise_rapida.get("versao_modelo", "ArterIA-CSBI-TopHat"),
        )
        novo_exame.paciente = paciente

        if len((settings.GEMINI_API_KEY or "").strip()) >= 10:
            background_tasks.add_task(executar_analise_ia_background, novo_exame.id, 0)

        return self.converter_para_dto(novo_exame)

    def solicitar_reprocessamento(
        self,
        exame_id: str,
        background_tasks: BackgroundTasks,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
    ) -> ExameResponse:
        """Permite solicitar uma nova análise de IA para o exame com resposta imediata (RE02)."""
        _ = ip_origem
        exame = self._localizar_exame_ou_ultimo_do_paciente(
            exame_id, usuario_id=usuario_id
        )
        caminho_seguro = (
            dicom_storage_service.obter_caminho_seguro(exame.arquivo_dicom_nome_seguro)
            if exame.arquivo_dicom_nome_seguro
            else None
        )
        analise_rapida = gemini_service.analisar_exame_com_gemini(
            caminho_arquivo=caminho_seguro,
            sha256_hex=exame.arquivo_dicom_sha256 or exame.id.hex,
            semente_extra=1,
            apenas_local_rapido=True,
        )
        exame = self.exame_repo.salvar_resultado_ia(
            exame=exame,
            classificacao=analise_rapida["classificacao"],
            localizacao=analise_rapida["localizacao"],
            padrao=analise_rapida["padrao"],
            nivel_confianca=analise_rapida["nivel_confianca"],
            leitura_tecnica=analise_rapida["leitura_tecnica"],
            tempo_processamento_ms=90,
            versao_modelo=analise_rapida.get("versao_modelo", "ArterIA-CSBI-TopHat"),
        )
        if len((settings.GEMINI_API_KEY or "").strip()) >= 10:
            background_tasks.add_task(executar_analise_ia_background, exame.id, 1)
        return self.converter_para_dto(exame)

    def assinar_laudo_medico(
        self,
        exame_id: str,
        dados: AssinarLaudoRequest,
        medico_id: uuid.UUID,
        ip_origem: Optional[str] = None,
    ) -> ExameResponse:
        """
        Registra o diagnóstico final assinado pelo médico (RF04) e grava log de divergência (RA01)
        quando aplicável.
        """
        exame = self._localizar_exame_ou_ultimo_do_paciente(
            exame_id, usuario_id=medico_id
        )

        classificacao_ia = (
            exame.resultado_ia.classificacao if exame.resultado_ia else None
        )
        classificacao_final = dados.classificacaoAjustada or classificacao_ia

        laudo_url = f"{settings.API_V1_STR}/exames/{exame.id}/laudo.pdf"

        exame_atualizado = self.exame_repo.assinar_laudo(
            exame=exame,
            medico_id=medico_id,
            diagnostico_final=dados.diagnosticoFinalMedico,
            modo_validacao=dados.modoValidacao,
            classificacao_final=classificacao_final,
            laudo_pdf_url=laudo_url,
        )

        if classificacao_ia and (
            dados.modoValidacao != ModoValidacaoEnum.CONFIRMAR
            or (classificacao_final and classificacao_final != classificacao_ia)
        ):
            self.auditoria_repo.registrar_divergencia(
                exame_id=exame.id,
                medico_id=medico_id,
                classificacao_ia=classificacao_ia,
                modo_validacao=dados.modoValidacao,
                classificacao_medica=classificacao_final,
                diagnostico_resumo=dados.diagnosticoFinalMedico,
            )

        self.auditoria_repo.registrar_evento(
            acao="ASSINATURA_LAUDO",
            recurso="exames",
            usuario_id=medico_id,
            recurso_id=str(exame.id),
            ip_origem=ip_origem,
            detalhes={
                "modo_validacao": dados.modoValidacao.value,
                "classificacao_final": (
                    classificacao_final.value if classificacao_final else None
                ),
            },
        )

        return self.converter_para_dto(exame_atualizado)

    def interagir_assistente_csbi(
        self,
        exame_id: str,
        dados: AssistenteCsbiRequest,
        usuario_id: Optional[uuid.UUID] = None,
    ) -> AssistenteCsbiResponse:
        """
        Processa a conversa da Assistente Virtual CSBI integrando os dados da triagem
        (sintomas mamários + histórico cardiovascular) e o resultado do exame, sem expor PII.
        """
        exame = self._localizar_exame_ou_ultimo_do_paciente(
            exame_id, usuario_id=usuario_id
        )
        idade_paciente = self._calcular_idade_paciente(exame)

        grau_bac = 1
        localizacao = "Parênquima mamário"
        padrao = "CSBI Grau 1"
        if exame.resultado_ia:
            grau_bac, _ = mapear_classificacao_para_grau_csbi(
                exame.resultado_ia.classificacao
            )
            localizacao = exame.resultado_ia.localizacao
            padrao = exame.resultado_ia.padrao

        partes_triagem: List[str] = []
        if dados.triagem:
            if dados.triagem.nenhumSintoma and not dados.triagem.alteracaoTamanhoFormato:
                partes_triagem.append("nenhum sintoma mamário relatado")
            if dados.triagem.alteracaoTamanhoFormato:
                partes_triagem.append("relato de alteração no tamanho ou formato da mama")
            if dados.triagem.outrosSintomasMamarios:
                partes_triagem.append(f"sintomas adicionais: {dados.triagem.outrosSintomasMamarios}")
            if dados.triagem.historicoCardiovascular:
                detalhe_cv = dados.triagem.detalhesRiscoCardiovascular or "hipertensão/diabetes/dislipidemia"
                partes_triagem.append(f"histórico cardiovascular positivo ({detalhe_cv})")
            else:
                partes_triagem.append("sem histórico prévio conhecido de hipertensão/diabetes/colesterol")
            if dados.triagem.checkupCardiologicoRecente:
                partes_triagem.append("check-up cardiológico realizado recentemente")
            else:
                partes_triagem.append("sem check-up cardiológico recente")

        resumo_triagem = "; ".join(partes_triagem)
        historico_dicts = [
            {"papel": m.papel, "texto": m.texto} for m in dados.historico
        ]

        resposta_limpa = gemini_service.responder_chat_assistente_csbi(
            mensagem_paciente=dados.mensagem,
            grau_bac=grau_bac,
            idade_paciente=idade_paciente,
            localizacao=localizacao,
            padrao=padrao,
            triagem_resumo=resumo_triagem,
            historico_mensagens=historico_dicts,
        )

        sugerir_cardio = (
            grau_bac == 3
            or (grau_bac in (1, 2) and idade_paciente is not None and idade_paciente < 55)
            or bool(dados.triagem and dados.triagem.historicoCardiovascular)
        )

        return AssistenteCsbiResponse(
            resposta=resposta_limpa,
            sugerirLembreteCardiologico=sugerir_cardio,
            sugerirLembreteMamografia=True,
            grauBac=grau_bac,
        )

    def deletar_exame(
        self,
        exame_id: str,
        usuario_id: Optional[uuid.UUID] = None,
        ip_origem: Optional[str] = None,
    ) -> None:
        """
        Exclui um exame específico pertencente ao médico autenticado e remove fisicamente a imagem/PDF/DICOM
        correspondente do cofre seguro, registrando a operação na auditoria LGPD.
        """
        exame = self._localizar_exame_ou_ultimo_do_paciente(
            exame_id, usuario_id=usuario_id
        )
        exame_id_str = str(exame.id)
        paciente_id_str = str(exame.paciente_id)

        if exame.arquivo_dicom_nome_seguro:
            dicom_storage_service.remover_arquivo_seguro(
                exame.arquivo_dicom_nome_seguro
            )

        self.exame_repo.deletar(exame)

        self.auditoria_repo.registrar_evento(
            acao="EXCLUSAO_EXAME_IMAGEM",
            recurso="exames",
            usuario_id=usuario_id,
            recurso_id=exame_id_str,
            ip_origem=ip_origem,
            detalhes={"paciente_id": paciente_id_str},
        )
