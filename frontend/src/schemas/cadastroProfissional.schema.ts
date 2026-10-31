import { z } from 'zod';

export const cadastroProfissionalSchema = z.object({
  nomeCompleto: z
    .string()
    .min(1, 'Nome completo é obrigatório')
    .min(2, 'Informe o nome completo'),
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Informe um endereço de e-mail válido'),
  senha: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(4, 'A senha deve ter pelo menos 4 caracteres'),
  crm: z.string().optional(),
  ufCrm: z.string().optional(),
});

export type CadastroProfissionalFormData = z.infer<
  typeof cadastroProfissionalSchema
>;
