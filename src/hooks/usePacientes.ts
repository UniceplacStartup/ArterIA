import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listarPacientes, criarPaciente } from '@/services/pacientes';
import type { Paciente } from '@/types';


export function usePacientes() {
  return useQuery({
    queryKey: ['pacientes'],
    queryFn: listarPacientes,
  });
}

export function useCriarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paciente: Omit<Paciente, 'id' | 'ultimoExame' | 'statusUltimoExame'>) =>
      criarPaciente(paciente),
    onSuccess: () => {
      
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}
