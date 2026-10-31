/**
 * Schema Zod para Cadastro de Paciente + Upload de Exame Inicial
 * (DICOM .dcm, PDF .pdf, PNG .png ou JPEG .jpg/.jpeg).
 */

import { z } from 'zod';
import { ehExtensaoExamePermitida } from './uploadSchema';

export const cadastroPacienteSchema = z.object({
  nomeCompleto: z
    .string()
    .min(1, 'Nome completo é obrigatório')
    .min(3, 'Informe o nome completo'),
  cpfId: z
    .string()
    .min(1, 'CPF/ID é obrigatório')
    .min(5, 'CPF/ID inválido'),
  dataNascimento: z
    .string()
    .min(1, 'Data de nascimento é obrigatória'),
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('E-mail inválido'),
  exame: z
    .instanceof(File, {
      message: 'Selecione um arquivo de exame (DICOM, PDF, PNG ou JPEG)',
    })
    .refine((file) => ehExtensaoExamePermitida(file.name), {
      message:
        'O arquivo deve estar no formato DICOM (.dcm), PDF (.pdf), PNG (.png) ou JPEG (.jpg/.jpeg)',
    }),
});

export type CadastroPacienteFormData = z.infer<typeof cadastroPacienteSchema>;
