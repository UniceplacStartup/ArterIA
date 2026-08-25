import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buscarExame, uploadExame, reprocessarExame, assinarLaudo } from '@/services/exames';
import type { Exame } from '@/types';

export function useExame(exameId: string) {
  return useQuery({
    queryKey: ['exame', exameId],
    queryFn: () => buscarExame(exameId),
    // RE02
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSANDO' ? 3000 : false;
    },
  });
}

export function useUploadExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pacienteId, arquivo }: { pacienteId: string; arquivo: File }) =>
      uploadExame(pacienteId, arquivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}

export function useReprocessarExame(exameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reprocessarExame(exameId),
    onSuccess: (data: Exame) => {
      queryClient.setQueryData(['exame', exameId], data);
    },
  });
}

// RF04
export function useAssinarLaudo(exameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (diagnosticoFinalMedico: string) => assinarLaudo(exameId, diagnosticoFinalMedico),
    onSuccess: (data: Exame) => {
      queryClient.setQueryData(['exame', exameId], data);
      queryClient.invalidateQueries({ queryKey: ['pacientes'] }); 
    },
  });
}
