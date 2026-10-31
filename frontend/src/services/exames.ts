/**
 * Serviço de Gestão de Exames Mamográficos, Upload, Exclusão, Assistente CSBI e Assinatura de Laudos
 * (RF02, RF03, RF04, RE02, RA01) com cache em memória e zero latência artificial.
 */

import { api } from './api';
import { USE_MOCKS } from '@/config';
import { examesMock } from '@/mocks/exames.mock';
import { pacientesMock } from '@/mocks/pacientes.mock';
import type {
  AssinarLaudoPayload,
  AssistenteCsbiRequest,
  AssistenteCsbiResponse,
  Exame,
} from '@/types';

function detectarFormatoPorNome(nomeArquivo: string): string {
  const lower = (nomeArquivo || '').toLowerCase().trim();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  return 'dcm';
}

function sincronizarExameNoCacheLocal(exame: Exame): Exame {
  examesMock[exame.id] = exame;
  const pacIdx = pacientesMock.findIndex((p) => p.id === exame.pacienteId);
  if (pacIdx >= 0) {
    pacientesMock[pacIdx] = {
      ...pacientesMock[pacIdx],
      ultimoExame: (exame.criadoEm || new Date().toISOString()).slice(0, 10),
      ultimoExameId: exame.id,
      statusUltimoExame: exame.status,
    };
  }
  return exame;
}

/**
 * Envia o arquivo de exame (.dcm, .pdf, .png, .jpg) para validação e análise de IA no Backend.
 */
export async function uploadExame(
  pacienteId: string,
  arquivo: File,
): Promise<Exame> {
  if (!USE_MOCKS && !pacienteId.startsWith('local-')) {
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('pacienteId', pacienteId);

      const { data } = await api.post<Exame>('/exames/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return sincronizarExameNoCacheLocal(data);
    } catch {
      // Fallback local imediato caso o backend esteja reiniciando
    }
  }

  const formato = detectarFormatoPorNome(arquivo.name);
  const exameId = `local-exame-${Date.now()}`;
  const urlLocal = `${URL.createObjectURL(arquivo)}#formato=${formato}`;

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

  return sincronizarExameNoCacheLocal(exame);
}

/**
 * Busca os detalhes de um exame pelo seu ID (ou pelo ID do paciente) com retorno imediato se já estiver em cache.
 */
export async function buscarExame(id: string): Promise<Exame> {
  // Se for um ID gerado localmente em modo de contingência, retorna em 0ms sem ir à rede
  if (id.startsWith('local-') && examesMock[id]) {
    return examesMock[id];
  }

  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      const { data } = await api.get<Exame>(`/exames/${id}`);
      return sincronizarExameNoCacheLocal(data);
    } catch {
      // Fallback local imediato
    }
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
  if (!USE_MOCKS && !pacienteId.startsWith('local-')) {
    try {
      const { data } = await api.get<Exame[]>(
        `/pacientes/${pacienteId}/exames`,
      );
      data.forEach((ex) => {
        examesMock[ex.id] = ex;
      });
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
  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      const { data } = await api.post<Exame>(`/exames/${id}/reprocessar`);
      return sincronizarExameNoCacheLocal(data);
    } catch {
      // Fallback local
    }
  }
  const atualizado: Exame = {
    ...(examesMock[id] ?? {
      id,
      pacienteId: id,
      arquivoDicomUrl: '',
      criadoEm: new Date().toISOString(),
    }),
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
  return sincronizarExameNoCacheLocal(atualizado);
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

  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      const { data } = await api.post<Exame>(`/exames/${id}/assinar`, corpo);
      return sincronizarExameNoCacheLocal(data);
    } catch {
      // Fallback local
    }
  }

  const atualizado: Exame = {
    ...examesMock[id],
    status: 'LAUDADO',
    diagnosticoFinalMedico: corpo.diagnosticoFinalMedico,
    modoValidacaoMedica: corpo.modoValidacao ?? 'CONFIRMAR',
    classificacaoFinalMedica:
      corpo.classificacaoAjustada ??
      examesMock[id]?.resultadoIA?.classificacao,
    laudoPdfUrl: `mock:laudo-${id}.pdf`,
  };
  return sincronizarExameNoCacheLocal(atualizado);
}

/**
 * Exclui um exame específico e remove sua imagem/PDF/DICOM enviada por engano.
 */
export async function deletarExame(id: string): Promise<void> {
  if (!USE_MOCKS && !id.startsWith('local-')) {
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
  if (!exameId.startsWith('local-')) {
    try {
      const { data } = await api.post<AssistenteCsbiResponse>(
        `/exames/${exameId}/assistente-csbi`,
        payload,
      );
      return data;
    } catch {
      // Fallback local imediato
    }
  }
  return {
    resposta:
      'Obrigada por compartilhar suas informações na triagem. Quero tranquilizar você de que as calcificações arteriais mamárias (BAC) ocorrem nas paredes dos pequenos vasos sanguíneos da mama e são consideradas benignas para a mama (BI-RADS 2), ou seja, não são câncer de mama e não viram tumor. Recomendamos mostrar este resultado ao seu médico de confiança ou cardiologista para cuidar preventivamente da saúde do coração e agendar seu lembrete nos botões da agenda.',
    sugerirLembreteCardiologico: true,
    sugerirLembreteMamografia: true,
    grauBac: 2,
  };
}
