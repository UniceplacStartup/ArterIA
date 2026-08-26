import { api } from './api';
import { USE_MOCKS, delay } from '@/config';
import { pacientesMock } from '@/mocks/pacientes.mock';
import type { Paciente } from '@/types';

// RF07

export async function listarPacientes(): Promise<Paciente[]> {
  if (USE_MOCKS) {
    await delay(300);
    return pacientesMock;
  }
  const { data } = await api.get<Paciente[]>('/pacientes');
  return data;
}

export async function buscarPaciente(id: string): Promise<Paciente> {
  if (USE_MOCKS) {
    await delay(200);
    const paciente = pacientesMock.find((p) => p.id === id);
    if (!paciente) throw new Error('Paciente não encontrado.');
    return paciente;
  }
  const { data } = await api.get<Paciente>(`/pacientes/${id}`);
  return data;
}

export async function criarPaciente(
  paciente: Omit<Paciente, 'id' | 'ultimoExame' | 'statusUltimoExame'>,
): Promise<Paciente> {
  if (USE_MOCKS) {
    await delay(400);
    const novo: Paciente = { ...paciente, id: String(Date.now()) };
    pacientesMock.unshift(novo);
    return novo;
  }
  const { data } = await api.post<Paciente>('/pacientes', paciente);
  return data;
}
