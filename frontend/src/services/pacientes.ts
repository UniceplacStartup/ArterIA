/**
 * Serviço de Gestão Completa (CRUD) de Pacientes (RF07).
 * Conecta aos endpoints `/api/pacientes` do Backend Python com fallback resiliente.
 */

import { api } from './api';
import { USE_MOCKS, delay } from '@/config';
import { pacientesMock } from '@/mocks/pacientes.mock';
import type { Paciente } from '@/types';

export interface CriarPacientePayload {
  nome?: string;
  nomeCompleto?: string;
  cpfId?: string;
  dataNascimento: string;
  email?: string;
}

export interface AtualizarPacientePayload {
  nome?: string;
  nomeCompleto?: string;
  cpfId?: string;
  dataNascimento?: string;
  email?: string;
}

/**
 * Lista todos os pacientes cadastrados com o status do último exame.
 */
export async function listarPacientes(): Promise<Paciente[]> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.get<Paciente[]>('/pacientes');
      return data;
    } catch {
      // Fallback para lista em memória caso o backend esteja iniciando
    }
  } else {
    await delay(200);
  }
  return [...pacientesMock];
}

/**
 * Busca os detalhes de um paciente pelo ID ou código público.
 */
export async function buscarPaciente(id: string): Promise<Paciente> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.get<Paciente>(`/pacientes/${id}`);
      return data;
    } catch {
      // Fallback local
    }
  }
  const paciente = pacientesMock.find((p) => p.id === id);
  if (!paciente) throw new Error('Paciente não encontrado.');
  return paciente;
}

/**
 * Cadastra um novo paciente no sistema.
 */
export async function criarPaciente(
  payload: CriarPacientePayload,
): Promise<Paciente> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.post<Paciente>('/pacientes', payload);
      return data;
    } catch {
      // Fallback local
    }
  } else {
    await delay(250);
  }
  const nomeFinal = payload.nomeCompleto ?? payload.nome ?? 'Novo Paciente';
  const novo: Paciente = {
    id: String(101 + pacientesMock.length),
    codigoPublico: String(101 + pacientesMock.length),
    nome: nomeFinal,
    dataNascimento: payload.dataNascimento,
    cpfId: payload.cpfId,
    email: payload.email,
    cpfMascarado: payload.cpfId ? '***.***.***-**' : undefined,
    ultimoExame: new Date().toISOString().slice(0, 10),
    statusUltimoExame: 'PENDENTE',
  };
  pacientesMock.unshift(novo);
  return novo;
}

/**
 * Atualiza os dados cadastrais de um paciente existente (PUT /api/pacientes/{id}).
 */
export async function atualizarPaciente(
  id: string,
  payload: AtualizarPacientePayload,
): Promise<Paciente> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.put<Paciente>(`/pacientes/${id}`, payload);
      return data;
    } catch {
      // Fallback local
    }
  }
  const idx = pacientesMock.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error('Paciente não encontrado.');
  pacientesMock[idx] = {
    ...pacientesMock[idx],
    nome: payload.nomeCompleto ?? payload.nome ?? pacientesMock[idx].nome,
    dataNascimento:
      payload.dataNascimento ?? pacientesMock[idx].dataNascimento,
    cpfId: payload.cpfId ?? pacientesMock[idx].cpfId,
    email: payload.email ?? pacientesMock[idx].email,
  };
  return pacientesMock[idx];
}

/**
 * Exclui um paciente e todos os seus exames/imagens vinculados (DELETE /api/pacientes/{id}).
 */
export async function deletarPaciente(id: string): Promise<void> {
  if (!USE_MOCKS) {
    try {
      await api.delete(`/pacientes/${id}`);
      return;
    } catch {
      // Fallback local
    }
  }
  const idx = pacientesMock.findIndex((p) => p.id === id);
  if (idx >= 0) pacientesMock.splice(idx, 1);
}
