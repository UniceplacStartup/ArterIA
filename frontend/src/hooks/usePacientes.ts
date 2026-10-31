/**
 * Hooks React Query para Listagem, Cadastro, Edição e Exclusão de Pacientes (RF07).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarPacientes,
  criarPaciente,
  atualizarPaciente,
  deletarPaciente,
  type CriarPacientePayload,
  type AtualizarPacientePayload,
} from '@/services/pacientes';

export function usePacientes() {
  return useQuery({
    queryKey: ['pacientes'],
    queryFn: listarPacientes,
  });
}

export function useCriarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paciente: CriarPacientePayload) => criarPaciente(paciente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}

export function useAtualizarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: AtualizarPacientePayload;
    }) => atualizarPaciente(id, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}

export function useDeletarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletarPaciente(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}
