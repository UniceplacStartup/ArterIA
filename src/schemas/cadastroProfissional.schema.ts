import { z } from 'zod';

export const cadastroProfissionalSchema = z.object({
  nomeCompleto: z
    .string()
    .min(1, 'Nome completo é obrigatório')
    .min(3, 'Informe o nome completo'),
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('E-mail inválido'),
  senha: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(8, 'A senha deve ter pelo menos 8 caracteres'),
  crm: z
    .string()
    .min(1, 'CRM é obrigatório')
    .regex(/^\d{4,7}$/, 'CRM deve conter apenas números (4 a 7 dígitos)'),
  ufCrm: z
    .string()
    .min(1, 'Selecione a UF do CRM'),
});

export type CadastroProfissionalFormData = z.infer<typeof cadastroProfissionalSchema>;