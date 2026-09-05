import { z } from 'zod';

export const loginPacienteSchema = z.object({
  identificador: z
    .string()
    .min(1, 'Informe seu CPF ou ID de paciente'),
});

export type LoginPacienteFormData = z.infer<typeof loginPacienteSchema>;