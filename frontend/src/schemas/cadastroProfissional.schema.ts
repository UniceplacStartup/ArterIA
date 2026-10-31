import { z } from 'zod';

export const cadastroProfissionalSchema = z.object({
  nomeCompleto: z
    .string()
    .min(1, 'Nome completo é obrigatório')
    .min(3, 'Informe o nome completo (mínimo 3 caracteres)'),
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Informe um endereço de e-mail válido'),
  senha: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'A senha deve ter pelo menos 6 caracteres'),
  crm: z
    .string()
    .min(1, 'CRM é obrigatório')
    .min(3, 'O CRM deve conter pelo menos 3 dígitos'),
  ufCrm: z
    .string()
    .min(1, 'Selecione a UF do CRM'),
});

export type CadastroProfissionalFormData = z.infer<
  typeof cadastroProfissionalSchema
>;
