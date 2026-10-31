/**
 * Serviço de Gestão de Exames Mamográficos, Upload, Exclusão e Assinatura de Laudos
 * (RF02, RF03, RF04, RE02, RA01).
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
  if (USE_MOCKS) {
    await delay(500);
    const exameId = String(Date.now());
    const exame: Exame = {
      id: exameId,
      pacienteId,
      arquivoDicomUrl: 'mock:cranio',
      status: 'PROCESSANDO',
      criadoEm: new Date().toISOString(),
    };
    examesMock[exame.id] = exame;

    const pacienteIdx = pacientesMock.findIndex((p) => p.id === pacienteId);
    if (pacienteIdx >= 0) {
      pacientesMock[pacienteIdx] = {
        ...pacientesMock[pacienteIdx],
        ultimoExame: new Date().toISOString().slice(0, 10),
        ultimoExameId: exame.id,
        statusUltimoExame: 'PROCESSANDO',
      };
    }

    setTimeout(() => {
      examesMock[exame.id] = {
        ...examesMock[exame.id],
        status: 'PENDENTE_LAUDO',
        resultadoIA: {
          classificacao: 'LEVE',
          localizacao: 'Quadrante Inferior Interno',
          padrao: 'Puntiforme',
          nivelConfianca: 87,
          leituraTecnica:
            'Focos puntiformes de calcificação em topografia vascular, quadrante inferior interno, sugestivos de calcificação arterial mamária leve.',
        },
      };
      if (pacienteIdx >= 0) {
        pacientesMock[pacienteIdx] = {
          ...pacientesMock[pacienteIdx],
          statusUltimoExame: 'PENDENTE_LAUDO',
        };
      }
    }, 4000);

    return exame;
  }

  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('pacienteId', pacienteId);

  const { data } = await api.post<Exame>('/exames/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Busca os detalhes de um exame pelo seu ID (ou pelo ID do paciente).
 */
export async function buscarExame(id: string): Promise<Exame> {
  if (USE_MOCKS) {
    await delay(200);
    const exameDireto = examesMock[id];
    if (exameDireto) return exameDireto;

    const examesDoPaciente = Object.values(examesMock)
      .filter((e) => e.pacienteId === id)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

    if (examesDoPaciente.length > 0) {
      return examesDoPaciente[0];
    }
    throw new Error('Exame não encontrado.');
  }
  const { data } = await api.get<Exame>(`/exames/${id}`);
  return data;
}

/**
 * Lista todo o histórico de exames realizados por um paciente (RN06).
 */
export async function listarExamesPorPaciente(
  pacienteId: string,
): Promise<Exame[]> {
  if (USE_MOCKS) {
    await delay(200);
    return Object.values(examesMock)
      .filter((e) => e.pacienteId === pacienteId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }
  const { data } = await api.get<Exame[]>(`/pacientes/${pacienteId}/exames`);
  return data;
}

/**
 * Solicita o reprocessamento de um exame pela IA em caso de falha ou revisão (RE02).
 */
export async function reprocessarExame(id: string): Promise<Exame> {
  if (USE_MOCKS) {
    await delay(300);
    examesMock[id] = { ...examesMock[id], status: 'PROCESSANDO' };
    setTimeout(() => {
      examesMock[id] = {
        ...examesMock[id],
        status: 'PENDENTE_LAUDO',
        resultadoIA: {
          classificacao: 'ACENTUADA',
          localizacao: 'Quadrante Superior Interno',
          padrao: 'Vascular difuso',
          nivelConfianca: 95,
          leituraTecnica:
            'Calcificações vasculares extensas em padrão difuso, quadrante superior interno, compatíveis com calcificação arterial mamária de grau acentuado.',
        },
      };
    }, 4000);
    return examesMock[id];
  }
  const { data } = await api.post<Exame>(`/exames/${id}/reprocessar`);
  return data;
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

  if (USE_MOCKS) {
    await delay(400);
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
    const pacienteId = examesMock[id].pacienteId;
    const pacIdx = pacientesMock.findIndex((p) => p.id === pacienteId);
    if (pacIdx >= 0) {
      pacientesMock[pacIdx] = {
        ...pacientesMock[pacIdx],
        statusUltimoExame: 'LAUDADO',
      };
    }
    return examesMock[id];
  }

  const { data } = await api.post<Exame>(`/exames/${id}/assinar`, corpo);
  return data;
}

/**
 * Exclui um exame específico e remove sua imagem/PDF/DICOM enviada por engano.
 */
export async function deletarExame(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay(250);
    delete examesMock[id];
    return;
  }
  await api.delete(`/exames/${id}`);
}

/**
 * Envia mensagem e dados de triagem para a Assistente Virtual CSBI de Saúde da Mama.
 */
export async function interagirAssistenteCsbi(
  exameId: string,
  payload: AssistenteCsbiRequest,
): Promise<AssistenteCsbiResponse> {
  const { data } = await api.post<AssistenteCsbiResponse>(
    `/exames/${exameId}/assistente-csbi`,
    payload,
  );
  return data;
}
