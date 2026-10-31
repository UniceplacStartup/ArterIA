/**
 * Hooks React Query para Listagem, Cadastro, Edição e Exclusão de Pacientes (RF07).
 * A chave de cache inclui o identificador do médico autenticado (`chaveMedico`),
 * garantindo que médicos diferentes nunca compartilhem lista de pacientes na memória.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarPacientes,
  criarPaciente,
  atualizarPaciente,
  deletarPaciente,
  lerPacientesLocaisDoMedico,
  type CriarPacientePayload,
  type AtualizarPacientePayload,
} from '@/services/pacientes';
import { useAuthStore } from '@/stores/authStore';
import type { Paciente } from '@/types';

export function useChaveMedicoQuery(): string {
  const usuario = useAuthStore((s) => s.usuario);
  return (usuario?.email || usuario?.id || 'anonimo').trim().toLowerCase();
}

export function usePacientes() {
  const chaveMedico = useChaveMedicoQuery();
  return useQuery({
    queryKey: ['pacientes', chaveMedico],
    queryFn: listarPacientes,
    placeholderData: () => lerPacientesLocaisDoMedico(),
  });
}

export function useCriarPaciente() {
  const queryClient = useQueryClient();
  const chaveMedico = useChaveMedicoQuery();
  return useMutation({
    mutationFn: (paciente: CriarPacientePayload) => criarPaciente(paciente),
    onSuccess: (novoPaciente) => {
      queryClient.setQueryData<Paciente[]>(
        ['pacientes', chaveMedico],
        (antigos) => {
          const lista = antigos ? [...antigos] : lerPacientesLocaisDoMedico();
          const filtrada = lista.filter((p) => p.id !== novoPaciente.id);
          return [novoPaciente, ...filtrada];
        },
      );
    },
  });
}

export function useAtualizarPaciente() {
  const queryClient = useQueryClient();
  const chaveMedico = useChaveMedicoQuery();
  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: AtualizarPacientePayload;
    }) => atualizarPaciente(id, dados),
    onSuccess: (pacienteAtualizado) => {
      queryClient.setQueryData<Paciente[]>(
        ['pacientes', chaveMedico],
        (antigos) => {
          const lista = antigos ? [...antigos] : lerPacientesLocaisDoMedico();
          return lista.map((p) =>
            p.id === pacienteAtualizado.id ? pacienteAtualizado : p,
          );
        },
      );
    },
  });
}

export function useDeletarPaciente() {
  const queryClient = useQueryClient();
  const chaveMedico = useChaveMedicoQuery();
  return useMutation({
    mutationFn: (id: string) => deletarPaciente(id),
    onSuccess: (_res, idRemovido) => {
      queryClient.setQueryData<Paciente[]>(
        ['pacientes', chaveMedico],
        (antigos) => {
          const lista = antigos ? [...antigos] : lerPacientesLocaisDoMedico();
          return lista.filter((p) => p.id !== idRemovido);
        },
      );
    },
  });
}
