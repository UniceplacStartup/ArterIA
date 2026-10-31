/**
 * Hooks React Query para Listagem, Cadastro, Edição e Exclusão de Pacientes (RF07).
 * Otimizados com atualização imediata de cache (`setQueryData`) para resposta instantânea na UI.
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
import { pacientesMock } from '@/mocks/pacientes.mock';
import type { Paciente } from '@/types';

export function usePacientes() {
  return useQuery({
    queryKey: ['pacientes'],
    queryFn: listarPacientes,
    placeholderData: () => [...pacientesMock],
  });
}

export function useCriarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paciente: CriarPacientePayload) => criarPaciente(paciente),
    onSuccess: (novoPaciente) => {
      queryClient.setQueryData<Paciente[]>(['pacientes'], (antigos) => {
        const lista = antigos ? [...antigos] : [...pacientesMock];
        const filtrada = lista.filter((p) => p.id !== novoPaciente.id);
        return [novoPaciente, ...filtrada];
      });
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
    onSuccess: (pacienteAtualizado) => {
      queryClient.setQueryData<Paciente[]>(['pacientes'], (antigos) => {
        const lista = antigos ? [...antigos] : [...pacientesMock];
        return lista.map((p) =>
          p.id === pacienteAtualizado.id ? pacienteAtualizado : p,
        );
      });
    },
  });
}

export function useDeletarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletarPaciente(id),
    onSuccess: (_res, idRemovido) => {
      queryClient.setQueryData<Paciente[]>(['pacientes'], (antigos) => {
        const lista = antigos ? [...antigos] : [...pacientesMock];
        return lista.filter((p) => p.id !== idRemovido);
      });
    },
  });
}
