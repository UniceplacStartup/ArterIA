/**
 * Schema Zod para validação do formulário de Login Médico (RF01).
 */

import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Informe um endereço de e-mail válido'),
  senha: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(8, 'A senha deve ter pelo menos 8 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

