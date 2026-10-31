"""
Schemas Pydantic para Exames Mamográficos, Diretrizes CSBI (BAC Graus 0 a 3),
Diferenciação BI-RADS, Comparação Temporal, Assistente Virtual e Assinatura de Laudo
(RF02, RF03, RF04, RF05, RE02).
"""

import re
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.exame import (
    ModoValidacaoEnum,
    NivelCalcificacaoEnum,
    StatusExameEnum,
)


class ResultadoIAResponse(BaseModel):
    """
    Estrutura enriquecida de retorno da análise de IA compatível com a interface `ResultadoIA`
    do Frontend e com o posicionamento oficial da Canadian Society of Breast Imaging (CSBI).
    Separa explicitamente os achados cardiovasculares (BAC Graus 0–3) dos achados oncológicos (BI-RADS).
    """

    model_config = ConfigDict(from_attributes=True)

    # Campos clássicos do protocolo ArterIA
    classificacao: NivelCalcificacaoEnum
    localizacao: str
    padrao: str
    nivelConfianca: float
    leituraTecnica: str

    # Novos campos estruturados da Diretriz CSBI (BAC) e BI-RADS
    grauBac: int = Field(
        default=1,
        ge=0,
        le=3,
        description="Escala CSBI de Calcificação Arterial Mamária (0, 1, 2 ou 3).",
    )
    vasosAfetados: int = Field(
        default=1,
        ge=0,
        description="Estimativa do número de vasos arteriais mamários afetados.",
    )
    idadePaciente: Optional[int] = Field(
        default=None,
        description="Idade calculada da paciente no momento do exame.",
    )
    flagAtencaoPrecoceMenos55: bool = Field(
        default=False,
        description="Ativada quando BAC é Grau 1 ou 2 e a paciente tem menos de 55 anos.",
    )
    alertaCardiovascular: bool = Field(
        default=False,
        description="Ativado quando BAC é Grau 3 (qualquer idade) ou Grau 1/2 em < 55 anos.",
    )
    notaPadraoCsbi: Optional[str] = Field(
        default=None,
        description="Nota oficial da CSBI recomendada para inclusão no laudo médico.",
    )
    biRadsCategoria: str = Field(
        default="BI-RADS 2 (Achado Vascular Benigno)",
        description="Classificação oncológica BI-RADS diferenciada do achado vascular.",
    )
    achadosOncologicosBiRads: str = Field(
        default=(
            "Calcificações parietais vasculares são tipicamente benignas do ponto de vista "
            "oncológico (BI-RADS 2), distintas de microcalcificações ductais agrupadas ou pleomórficas."
        ),
        description="Diferenciação estrita entre BAC vascular e calcificações ductais/parenquimatosas.",
    )
    comparacaoTemporal: str = Field(
        default="Primeiro exame registrado da paciente para linha de base CSBI.",
        description="Comparação automática do grau BAC atual com exames anteriores da paciente.",
    )
    resumoTecnicoMedico: str = Field(
        default="",
        description="Saída técnica formal com script CSBI e nota BI-RADS para o médico assistente.",
    )
    explicacaoAcolhedoraPaciente: str = Field(
        default="",
        description="Saída educativa e acolhedora para a paciente (sem asteriscos ou hashtags).",
    )


class TriagemPacientePayload(BaseModel):
    """Dados de triagem clínica e cardiovascular informados pela paciente ou equipe médica."""

    nenhumSintoma: bool = True
    alteracaoTamanhoFormato: bool = False
    outrosSintomasMamarios: Optional[str] = None
    historicoCardiovascular: bool = False
    detalhesRiscoCardiovascular: Optional[str] = None
    checkupCardiologicoRecente: bool = False


class MensagemChatCsbi(BaseModel):
    """Mensagem individual do histórico de conversa com a Assistente Virtual CSBI."""

    papel: str = Field(..., pattern=r"^(paciente|assistente)$")
    texto: str = Field(..., min_length=1, max_length=4000)


class AssistenteCsbiRequest(BaseModel):
    """Payload para interação com a Assistente Virtual de Saúde da Mama e CSBI."""

    mensagem: str = Field(..., min_length=1, max_length=2000)
    triagem: Optional[TriagemPacientePayload] = None
    historico: List[MensagemChatCsbi] = Field(default_factory=list)


class AssistenteCsbiResponse(BaseModel):
    """Resposta limpa (sem asteriscos ou hashtags) da Assistente Virtual CSBI."""

    resposta: str
    sugerirLembreteCardiologico: bool
    sugerirLembreteMamografia: bool
    grauBac: int


class AssinarLaudoRequest(BaseModel):
    """
    Payload para assinatura médica do laudo (RF04).
    Permite confirmar, ajustar ou invalidar a sugestão da IA, gerando registro em `LogDivergencia` (RA01)
    quando houver ajuste ou invalidação.
    """

    diagnosticoFinalMedico: str = Field(..., min_length=5, max_length=5000)
    modoValidacao: ModoValidacaoEnum = Field(default=ModoValidacaoEnum.CONFIRMAR)
    classificacaoAjustada: Optional[NivelCalcificacaoEnum] = None

    @field_validator("diagnosticoFinalMedico")
    @classmethod
    def sanitizar_diagnostico(cls, valor: str) -> str:
        limpo = re.sub(r"[<>]", "", valor).strip()
        if len(limpo) < 5:
            raise ValueError("Descreva o diagnóstico final médico com pelo menos 5 caracteres.")
        return limpo


class ExameResponse(BaseModel):
    """
    Representação completa de um Exame compatível com a interface `Exame` do Frontend React.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    pacienteId: str
    arquivoDicomUrl: str
    status: StatusExameEnum
    criadoEm: str
    resultadoIA: Optional[ResultadoIAResponse] = None
    diagnosticoFinalMedico: Optional[str] = None
    modoValidacaoMedica: Optional[ModoValidacaoEnum] = None
    classificacaoFinalMedica: Optional[NivelCalcificacaoEnum] = None
    laudoPdfUrl: Optional[str] = None
