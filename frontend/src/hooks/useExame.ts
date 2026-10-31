/**
 * Hooks React Query para Gerenciamento de Exames, Upload, Exclusão e Assinatura de Laudos
 * (RF02, RF03, RF04, RE02), otimizados com atualização imediata de cache (`setQueryData`).
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
import { examesMock } from '@/mocks/exames.mock';
import { useChaveMedicoQuery } from '@/hooks/usePacientes';
import type { AssinarLaudoPayload, Exame, Paciente } from '@/types';

export function useExame(exameId: string) {
  return useQuery({
    queryKey: ['exame', exameId],
    queryFn: () => buscarExame(exameId),
    enabled: Boolean(exameId),
    placeholderData: () => examesMock[exameId],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSANDO' ? 2000 : false;
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
  const chaveMedico = useChaveMedicoQuery();
  return useMutation({
    mutationFn: ({
      pacienteId,
      arquivo,
    }: {
      pacienteId: string;
      arquivo: File;
    }) => uploadExame(pacienteId, arquivo),
    onSuccess: (novoExame) => {
      queryClient.setQueryData<Exame>(['exame', novoExame.id], novoExame);
      queryClient.setQueryData<Exame>(
        ['exame', novoExame.pacienteId],
        novoExame,
      );
      queryClient.setQueryData<Exame[]>(
        ['exames-paciente', novoExame.pacienteId],
        (antigos) => {
          const lista = antigos ? [...antigos] : [];
          const semDuplicata = lista.filter((e) => e.id !== novoExame.id);
          return [novoExame, ...semDuplicata];
        },
      );
      queryClient.setQueryData<Paciente[]>(
        ['pacientes', chaveMedico],
        (antigos) => {
          if (!antigos) return antigos;
          return antigos.map((p) =>
            p.id === novoExame.pacienteId
              ? {
                  ...p,
                  ultimoExame: (
                    novoExame.criadoEm || new Date().toISOString()
                  ).slice(0, 10),
                  ultimoExameId: novoExame.id,
                  statusUltimoExame: novoExame.status,
                }
              : p,
          );
        },
      );
    },
  });
}

export function useReprocessarExame(exameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reprocessarExame(exameId),
    onSuccess: (data: Exame) => {
      queryClient.setQueryData<Exame>(['exame', exameId], data);
      queryClient.setQueryData<Exame>(['exame', data.id], data);
      queryClient.setQueryData<Exame[]>(
        ['exames-paciente', data.pacienteId],
        (antigos) =>
          antigos
            ? antigos.map((e) => (e.id === data.id ? data : e))
            : [data],
      );
    },
  });
}

export function useAssinarLaudo(exameId: string) {
  const queryClient = useQueryClient();
  const chaveMedico = useChaveMedicoQuery();
  return useMutation({
    mutationFn: (payload: AssinarLaudoPayload | string) =>
      assinarLaudo(exameId, payload),
    onSuccess: (data: Exame) => {
      queryClient.setQueryData<Exame>(['exame', exameId], data);
      queryClient.setQueryData<Exame>(['exame', data.id], data);
      queryClient.setQueryData<Exame[]>(
        ['exames-paciente', data.pacienteId],
        (antigos) =>
          antigos
            ? antigos.map((e) => (e.id === data.id ? data : e))
            : [data],
      );
      queryClient.setQueryData<Paciente[]>(
        ['pacientes', chaveMedico],
        (antigos) => {
          if (!antigos) return antigos;
          return antigos.map((p) =>
            p.id === data.pacienteId
              ? { ...p, statusUltimoExame: 'LAUDADO' }
              : p,
          );
        },
      );
    },
  });
}

export function useDeletarExame() {
  const queryClient = useQueryClient();
  const chaveMedico = useChaveMedicoQuery();
  return useMutation({
    mutationFn: ({ exameId }: { exameId: string; pacienteId?: string }) =>
      deletarExame(exameId),
    onSuccess: (_data, variaveis) => {
      queryClient.removeQueries({ queryKey: ['exame', variaveis.exameId] });
      if (variaveis.pacienteId) {
        queryClient.setQueryData<Exame[]>(
          ['exames-paciente', variaveis.pacienteId],
          (antigos) =>
            antigos
              ? antigos.filter((e) => e.id !== variaveis.exameId)
              : [],
        );
        queryClient.invalidateQueries({
          queryKey: ['exame', variaveis.pacienteId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['pacientes', chaveMedico] });
    },
  });
}
