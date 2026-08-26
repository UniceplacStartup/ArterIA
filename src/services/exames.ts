import { api } from './api';
import { USE_MOCKS, delay } from '@/config';
import { examesMock } from '@/mocks/exames.mock';
import type { Exame } from '@/types';

// RF02 
export async function uploadExame(pacienteId: string, arquivo: File): Promise<Exame> {
  if (USE_MOCKS) {
    await delay(500);
    const exame: Exame = {
      id: String(Date.now()),
      pacienteId,
      arquivoDicomUrl: 'mock:cranio',
      status: 'PROCESSANDO',
      criadoEm: new Date().toISOString(),
    };
    examesMock[exame.id] = exame;

    // RF03
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
          
        }
      };
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

export async function buscarExame(id: string): Promise<Exame> {
  if (USE_MOCKS) {
    await delay(200);
    const exame = examesMock[id];
    if (!exame) throw new Error('Exame não encontrado.');
    return exame;
  }
  const { data } = await api.get<Exame>(`/exames/${id}`);
  return data;
}

export async function listarExamesPorPaciente(pacienteId: string): Promise<Exame[]> {
  if (USE_MOCKS) {
    await delay(200);
    return Object.values(examesMock).filter((e) => e.pacienteId === pacienteId);
  }
  const { data } = await api.get<Exame[]>(`/pacientes/${pacienteId}/exames`);
  return data;
}

// RE02
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

// RF04
export async function assinarLaudo(id: string, diagnosticoFinalMedico: string): Promise<Exame> {
  if (USE_MOCKS) {
    await delay(400);
    examesMock[id] = {
      ...examesMock[id],
      status: 'LAUDADO',
      diagnosticoFinalMedico,
      laudoPdfUrl: `mock:laudo-${id}.pdf`,
    };
    return examesMock[id];
  }
  const { data } = await api.post<Exame>(`/exames/${id}/assinar`, { diagnosticoFinalMedico });
  return data;
}
