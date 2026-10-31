/**
 * Hooks React Query para Gerenciamento de Exames, Upload, Exclusão e Assinatura de Laudos
 * (RF02, RF03, RF04, RE02).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  buscarExame,
  listarExamesPorPaciente,
  uploadExame,
  reprocessarExame,
  assinarLaudo,
  deletarExame,
} from '@/services/exames';
import type { AssinarLaudoPayload, Exame } from '@/types';

export function useExame(exameId: string) {
  return useQuery({
    queryKey: ['exame', exameId],
    queryFn: () => buscarExame(exameId),
    enabled: Boolean(exameId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSANDO' ? 2500 : false;
    },
  });
}

export function useExamesPorPaciente(pacienteId?: string) {
  return useQuery({
    queryKey: ['exames-paciente', pacienteId],
    queryFn: () => listarExamesPorPaciente(pacienteId!),
    enabled: Boolean(pacienteId),
  });
}

export function useUploadExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pacienteId,
      arquivo,
    }: {
      pacienteId: string;
      arquivo: File;
    }) => uploadExame(pacienteId, arquivo),
    onSuccess: (novoExame) => {
      queryClient.setQueryData(['exame', novoExame.id], novoExame);
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({
        queryKey: ['exame', novoExame.pacienteId],
      });
      queryClient.invalidateQueries({
        queryKey: ['exames-paciente', novoExame.pacienteId],
      });
    },
  });
}

export function useReprocessarExame(exameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reprocessarExame(exameId),
    onSuccess: (data: Exame) => {
      queryClient.setQueryData(['exame', exameId], data);
      queryClient.invalidateQueries({
        queryKey: ['exames-paciente', data.pacienteId],
      });
    },
  });
}

export function useAssinarLaudo(exameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssinarLaudoPayload | string) =>
      assinarLaudo(exameId, payload),
    onSuccess: (data: Exame) => {
      queryClient.setQueryData(['exame', exameId], data);
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({
        queryKey: ['exames-paciente', data.pacienteId],
      });
    },
  });
}

export function useDeletarExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exameId }: { exameId: string; pacienteId?: string }) =>
      deletarExame(exameId),
    onSuccess: (_data, variaveis) => {
      queryClient.removeQueries({ queryKey: ['exame', variaveis.exameId] });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      if (variaveis.pacienteId) {
        queryClient.invalidateQueries({
          queryKey: ['exame', variaveis.pacienteId],
        });
        queryClient.invalidateQueries({
          queryKey: ['exames-paciente', variaveis.pacienteId],
        });
      }
    },
  });
}
