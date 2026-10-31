/**
 * Schema Zod para Cadastro de Paciente + Upload de Exame Inicial (Opcional ou Imediato)
 * (DICOM .dcm, PDF .pdf, PNG .png ou JPEG .jpg/.jpeg).
 */

import { z } from 'zod';
import { ehExtensaoExamePermitida } from './uploadSchema';

export const cadastroPacienteSchema = z.object({
  nomeCompleto: z
    .string()
    .min(1, 'Nome completo é obrigatório')
    .min(2, 'Informe o nome do paciente'),
  cpfId: z
    .string()
    .min(1, 'CPF/ID é obrigatório'),
  dataNascimento: z
    .string()
    .min(1, 'Data de nascimento é obrigatória'),
  email: z
    .string()
    .optional()
    .or(z.literal('')),
  exame: z
    .custom<File | null | undefined>(
      (val) =>
        val === undefined ||
        val === null ||
        (typeof File !== 'undefined' && val instanceof File),
      {
        message: 'Selecione um arquivo válido (DICOM, PDF, PNG ou JPEG)',
      },
    )
    .refine(
      (file) => !file || ehExtensaoExamePermitida(file.name),
      {
        message:
          'O arquivo deve estar no formato DICOM (.dcm), PDF (.pdf), PNG (.png) ou JPEG (.jpg/.jpeg)',
      },
    )
    .optional()
    .nullable(),
});

export type CadastroPacienteFormData = z.infer<typeof cadastroPacienteSchema>;
