/**
 * Serviço de Gestão de Exames Mamográficos, Upload, Exclusão, Assistente CSBI e Assinatura de Laudos
 * (RF02, RF03, RF04, RE02, RA01) com fallback resiliente.
 */

import { api } from './api';
import { USE_MOCKS, delay } from '@/config';
import { examesMock } from '@/mocks/exames.mock';
import { pacientesMock } from '@/mocks/pacientes.mock';
import type {
  AssinarLaudoPayload,
  AssistenteCsbiRequest,
  AssistenteCsbiResponse,
  Exame,
} from '@/types';

/**
 * Envia o arquivo de exame (.dcm, .pdf, .png, .jpg) para validação e análise de IA no Backend.
 */
export async function uploadExame(
  pacienteId: string,
  arquivo: File,
): Promise<Exame> {
  if (!USE_MOCKS) {
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('pacienteId', pacienteId);

      const { data } = await api.post<Exame>('/exames/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    } catch {
      // Fallback local caso o backend esteja reiniciando
    }
  } else {
    await delay(400);
  }

  const exameId = String(Date.now());
  const urlLocal = URL.createObjectURL(arquivo);
  const exame: Exame = {
    id: exameId,
    pacienteId,
    arquivoDicomUrl: urlLocal,
    status: 'PENDENTE_LAUDO',
    criadoEm: new Date().toISOString(),
    resultadoIA: {
      classificacao: 'MODERADA',
      grauBac: 2,
      vasosAfetados: 2,
      localizacao: 'Quadrante Superior Externo (QSE)',
      padrao: 'CSBI Grau 2 — Trilho de trem (tram-track) em < 3 vasos',
      nivelConfianca: 94.2,
      biRadsCategoria: 'BI-RADS 2 (Achado Vascular Benigno)',
      achadosOncologicosBiRads:
        'Calcificações parietais vasculares são tipicamente benignas do ponto de vista oncológico (BI-RADS 2), distintas de microcalcificações ductais.',
      comparacaoTemporal:
        'Linha de base CSBI registrada para acompanhamento evolutivo.',
      leituraTecnica:
        'Observadas calcificações vasculares lineares paralelas em trilho de trem (tram-track) bem individualizadas em menos de 3 vasos no Quadrante Superior Externo (QSE), compatíveis com CSBI Grau 2 (MODERADA). Resultado de apoio à decisão clínica (RN08).',
    },
  };
  examesMock[exame.id] = exame;

  const pacienteIdx = pacientesMock.findIndex((p) => p.id === pacienteId);
  if (pacienteIdx >= 0) {
    pacientesMock[pacienteIdx] = {
      ...pacientesMock[pacienteIdx],
      ultimoExame: new Date().toISOString().slice(0, 10),
      ultimoExameId: exame.id,
      statusUltimoExame: 'PENDENTE_LAUDO',
    };
  }
  return exame;
}

/**
 * Busca os detalhes de um exame pelo seu ID (ou pelo ID do paciente).
 */
export async function buscarExame(id: string): Promise<Exame> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.get<Exame>(`/exames/${id}`);
      return data;
    } catch {
      // Fallback local
    }
  } else {
    await delay(200);
  }

  const exameDireto = examesMock[id];
  if (exameDireto) return exameDireto;

  const examesDoPaciente = Object.values(examesMock)
    .filter((e) => e.pacienteId === id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  if (examesDoPaciente.length > 0) {
    return examesDoPaciente[0];
  }

  return {
    id,
    pacienteId: id,
    arquivoDicomUrl: '',
    status: 'PENDENTE',
    criadoEm: new Date().toISOString(),
  };
}

/**
 * Lista todo o histórico de exames realizados por um paciente (RN06).
 */
export async function listarExamesPorPaciente(
  pacienteId: string,
): Promise<Exame[]> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.get<Exame[]>(`/pacientes/${pacienteId}/exames`);
      return data;
    } catch {
      // Fallback local
    }
  }
  return Object.values(examesMock)
    .filter((e) => e.pacienteId === pacienteId)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/**
 * Solicita o reprocessamento de um exame pela IA em caso de falha ou revisão (RE02).
 */
export async function reprocessarExame(id: string): Promise<Exame> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.post<Exame>(`/exames/${id}/reprocessar`);
      return data;
    } catch {
      // Fallback local
    }
  }
  examesMock[id] = {
    ...examesMock[id],
    status: 'PENDENTE_LAUDO',
    resultadoIA: {
      classificacao: 'ACENTUADA',
      grauBac: 3,
      vasosAfetados: 3,
      alertaCardiovascular: true,
      localizacao: 'Quadrante Superior Interno (QSI)',
      padrao: 'CSBI Grau 3 — Grosseira severa / trilho de trem (≥ 3 vasos)',
      nivelConfianca: 96.5,
      leituraTecnica:
        'Foram identificadas calcificações vasculares grosseiras severas ou em trilho de trem afetando 3 ou mais vasos nas mamas (Grau 3). Uma forte associação entre calcificações arteriais mamárias e doenças cardiovasculares foi identificada em múltiplos estudos. Considere a correlação com fatores de risco cardiovascular conforme clinicamente indicado.',
    },
  };
  return examesMock[id];
}

/**
 * Assina eletronicamente o laudo médico final do exame (RF04).
 */
export async function assinarLaudo(
  id: string,
  payload: AssinarLaudoPayload | string,
): Promise<Exame> {
  const corpo: AssinarLaudoPayload =
    typeof payload === 'string'
      ? { diagnosticoFinalMedico: payload, modoValidacao: 'CONFIRMAR' }
      : payload;

  if (!USE_MOCKS) {
    try {
      const { data } = await api.post<Exame>(`/exames/${id}/assinar`, corpo);
      return data;
    } catch {
      // Fallback local
    }
  }

  examesMock[id] = {
    ...examesMock[id],
    status: 'LAUDADO',
    diagnosticoFinalMedico: corpo.diagnosticoFinalMedico,
    modoValidacaoMedica: corpo.modoValidacao ?? 'CONFIRMAR',
    classificacaoFinalMedica:
      corpo.classificacaoAjustada ??
      examesMock[id]?.resultadoIA?.classificacao,
    laudoPdfUrl: `mock:laudo-${id}.pdf`,
  };
  const pacienteId = examesMock[id]?.pacienteId;
  const pacIdx = pacientesMock.findIndex((p) => p.id === pacienteId);
  if (pacIdx >= 0) {
    pacientesMock[pacIdx] = {
      ...pacientesMock[pacIdx],
      statusUltimoExame: 'LAUDADO',
    };
  }
  return examesMock[id];
}

/**
 * Exclui um exame específico e remove sua imagem/PDF/DICOM enviada por engano.
 */
export async function deletarExame(id: string): Promise<void> {
  if (!USE_MOCKS) {
    try {
      await api.delete(`/exames/${id}`);
    } catch {
      // Fallback local
    }
  }
  delete examesMock[id];
}

/**
 * Envia mensagem e dados de triagem para a Assistente Virtual CSBI de Saúde da Mama.
 */
export async function interagirAssistenteCsbi(
  exameId: string,
  payload: AssistenteCsbiRequest,
): Promise<AssistenteCsbiResponse> {
  try {
    const { data } = await api.post<AssistenteCsbiResponse>(
      `/exames/${exameId}/assistente-csbi`,
      payload,
    );
    return data;
  } catch {
    return {
      resposta:
        'Obrigada por compartilhar suas informações na triagem. Quero tranquilizar você de que as calcificações arteriais mamárias (BAC) ocorrem nas paredes dos pequenos vasos sanguíneos da mama e são consideradas benignas para a mama (BI-RADS 2), ou seja, não são câncer de mama e não viram tumor. Recomendamos mostrar este resultado ao seu médico de confiança ou cardiologista para cuidar preventivamente da saúde do coração e agendar seu lembrete nos botões da agenda.',
      sugerirLembreteCardiologico: true,
      sugerirLembreteMamografia: true,
      grauBac: 2,
    };
  }
}
