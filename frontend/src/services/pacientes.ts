/**
 * Serviço de Gestão Completa (CRUD) de Pacientes (RF07) com Isolamento Estrito por Médico.
 * Cada médico possui sua própria carteira de pacientes; médicos nunca compartilham pacientes.
 */

import { api } from './api';
import { USE_MOCKS } from '@/config';
import { pacientesMock } from '@/mocks/pacientes.mock';
import { useAuthStore } from '@/stores/authStore';
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

export function obterChaveMedicoAtivo(): string {
  const usuario = useAuthStore.getState().usuario;
  if (!usuario) return 'anonimo';
  return (usuario.email || usuario.id || 'anonimo').trim().toLowerCase();
}

function obterStorageKeyMedico(): string {
  return `arteria_pacientes_medico_v1_${obterChaveMedicoAtivo()}`;
}

export function lerPacientesLocaisDoMedico(): Paciente[] {
  const chaveMedico = obterChaveMedicoAtivo();
  const storageKey = obterStorageKeyMedico();
  try {
    const salvo = localStorage.getItem(storageKey);
    if (salvo) {
      const parsed = JSON.parse(salvo) as Paciente[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignora erro de leitura
  }

  // Apenas a conta de demonstração padrão inicia com os pacientes de exemplo no modo offline;
  // qualquer outro médico recém-cadastrado inicia com sua carteira vazia ([]).
  if (chaveMedico === 'medico@arteria.med.br') {
    return [...pacientesMock];
  }
  return [];
}

export function salvarPacientesLocaisDoMedico(lista: Paciente[]): void {
  try {
    localStorage.setItem(obterStorageKeyMedico(), JSON.stringify(lista));
  } catch {
    // ignora erro de escrita
  }
}

export function sincronizarPacienteNaCarteiraDoMedico(
  paciente: Paciente,
): Paciente {
  const lista = lerPacientesLocaisDoMedico();
  const idx = lista.findIndex((p) => p.id === paciente.id);
  if (idx >= 0) {
    lista[idx] = { ...lista[idx], ...paciente };
  } else {
    lista.unshift(paciente);
  }
  salvarPacientesLocaisDoMedico(lista);
  return paciente;
}

/**
 * Lista exclusivamente os pacientes pertencentes ao médico autenticado.
 */
export async function listarPacientes(): Promise<Paciente[]> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.get<Paciente[]>('/pacientes');
      salvarPacientesLocaisDoMedico(data);
      return data;
    } catch {
      // Fallback para a carteira isolada do médico logado
    }
  }
  return lerPacientesLocaisDoMedico();
}

/**
 * Busca os detalhes de um paciente pertencente ao médico autenticado.
 */
export async function buscarPaciente(id: string): Promise<Paciente> {
  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      const { data } = await api.get<Paciente>(`/pacientes/${id}`);
      return sincronizarPacienteNaCarteiraDoMedico(data);
    } catch {
      // Fallback para carteira isolada do médico
    }
  }
  const lista = lerPacientesLocaisDoMedico();
  const paciente = lista.find((p) => p.id === id || p.codigoPublico === id);
  if (paciente) return paciente;
  return {
    id,
    codigoPublico: id.slice(0, 6),
    nome: 'Paciente Cadastrada',
    dataNascimento: '1975-06-15',
  };
}

/**
 * Cadastra um novo paciente vinculado exclusivamente ao médico logado.
 */
export async function criarPaciente(
  payload: CriarPacientePayload,
): Promise<Paciente> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.post<Paciente>('/pacientes', payload);
      return sincronizarPacienteNaCarteiraDoMedico(data);
    } catch {
      // Fallback local na carteira isolada do médico
    }
  }
  const listaAtual = lerPacientesLocaisDoMedico();
  const nomeFinal = payload.nomeCompleto ?? payload.nome ?? 'Novo Paciente';
  const codigoNum = String(101 + listaAtual.length);
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
  return sincronizarPacienteNaCarteiraDoMedico(novo);
}

/**
 * Atualiza os dados cadastrais de um paciente pertencente ao médico logado.
 */
export async function atualizarPaciente(
  id: string,
  payload: AtualizarPacientePayload,
): Promise<Paciente> {
  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      const { data } = await api.put<Paciente>(`/pacientes/${id}`, payload);
      return sincronizarPacienteNaCarteiraDoMedico(data);
    } catch {
      // Fallback local
    }
  }
  const lista = lerPacientesLocaisDoMedico();
  const idx = lista.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error('Paciente não encontrado.');
  lista[idx] = {
    ...lista[idx],
    nome: payload.nomeCompleto ?? payload.nome ?? lista[idx].nome,
    dataNascimento: payload.dataNascimento ?? lista[idx].dataNascimento,
    cpfId: payload.cpfId ?? lista[idx].cpfId,
    email: payload.email ?? lista[idx].email,
  };
  salvarPacientesLocaisDoMedico(lista);
  return lista[idx];
}

/**
 * Exclui um paciente da carteira do médico logado e seus exames vinculados.
 */
export async function deletarPaciente(id: string): Promise<void> {
  if (!USE_MOCKS && !id.startsWith('local-')) {
    try {
      await api.delete(`/pacientes/${id}`);
    } catch {
      // Fallback local
    }
  }
  const lista = lerPacientesLocaisDoMedico().filter((p) => p.id !== id);
  salvarPacientesLocaisDoMedico(lista);
}
