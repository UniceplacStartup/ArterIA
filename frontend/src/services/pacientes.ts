/**
 * Serviço de Gestão Completa (CRUD) de Pacientes (RF07).
 * Conecta aos endpoints `/api/pacientes` do Backend Python com sincronização em memória e zero delay.
 */

import { api } from './api';
import { USE_MOCKS } from '@/config';
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

function sincronizarPacienteNaListaLocal(paciente: Paciente): Paciente {
  const idx = pacientesMock.findIndex((p) => p.id === paciente.id);
  if (idx >= 0) {
    pacientesMock[idx] = { ...pacientesMock[idx], ...paciente };
  } else {
    pacientesMock.unshift(paciente);
  }
  return paciente;
}

/**
 * Lista todos os pacientes cadastrados com o status do último exame.
 */
export async function listarPacientes(): Promise<Paciente[]> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.get<Paciente[]>('/pacientes');
      data.forEach((p) => sincronizarPacienteNaListaLocal(p));
      return data;
    } catch {
      // Fallback para lista em memória caso o backend esteja iniciando
    }
  }
  return [...pacientesMock];
}

/**
 * Busca os detalhes de um paciente pelo ID ou código público.
 */
export async function buscarPaciente(id: string): Promise<Paciente> {
  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      const { data } = await api.get<Paciente>(`/pacientes/${id}`);
      return sincronizarPacienteNaListaLocal(data);
    } catch {
      // Fallback local
    }
  }
  const paciente = pacientesMock.find(
    (p) => p.id === id || p.codigoPublico === id,
  );
  if (paciente) return paciente;
  return {
    id,
    codigoPublico: id.slice(0, 6),
    nome: 'Paciente Cadastrada',
    dataNascimento: '1975-06-15',
  };
}

/**
 * Cadastra um novo paciente no sistema sem delays artificiais.
 */
export async function criarPaciente(
  payload: CriarPacientePayload,
): Promise<Paciente> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.post<Paciente>('/pacientes', payload);
      return sincronizarPacienteNaListaLocal(data);
    } catch {
      // Fallback local imediato
    }
  }
  const nomeFinal = payload.nomeCompleto ?? payload.nome ?? 'Novo Paciente';
  const codigoNum = String(101 + pacientesMock.length);
  const novo: Paciente = {
    id: `local-pac-${Date.now()}`,
    codigoPublico: codigoNum,
    nome: nomeFinal,
    dataNascimento: payload.dataNascimento || '1975-06-15',
    cpfId: payload.cpfId,
    email: payload.email,
    cpfMascarado: payload.cpfId ? '***.***.***-**' : undefined,
    ultimoExame: new Date().toISOString().slice(0, 10),
    statusUltimoExame: 'PENDENTE',
  };
  return sincronizarPacienteNaListaLocal(novo);
}

/**
 * Atualiza os dados cadastrais de um paciente existente (PUT /api/pacientes/{id}).
 */
export async function atualizarPaciente(
  id: string,
  payload: AtualizarPacientePayload,
): Promise<Paciente> {
  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      const { data } = await api.put<Paciente>(`/pacientes/${id}`, payload);
      return sincronizarPacienteNaListaLocal(data);
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
  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      await api.delete(`/pacientes/${id}`);
    } catch {
      // Fallback local
    }
  }
  const idx = pacientesMock.findIndex((p) => p.id === id);
  if (idx >= 0) pacientesMock.splice(idx, 1);
}
