import { z } from 'zod';

export const loginProfissionalSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('E-mail inválido'),
  senha: z
    .string()
    .min(1, 'Senha é obrigatória'),
});

export type LoginProfissionalFormData = z.infer<typeof loginProfissionalSchema>;