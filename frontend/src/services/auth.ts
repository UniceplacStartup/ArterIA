/**
 * Serviço de Autenticação e CRUD Completo de Profissionais Médicos (RF01).
 * Integra com os endpoints `/api/auth/*` do Backend Python (FastAPI).
 */

import { api } from './api';
import { USE_MOCKS, delay } from '@/config';
import type { AuthResponse, Usuario } from '@/types';
import type { CadastroProfissionalFormData } from '@/schemas/cadastroProfissional.schema';
import type { LoginFormData } from '@/schemas/login.schema';

export interface AtualizarProfissionalPayload {
  nomeCompleto?: string;
  email?: string;
  crm?: string;
  ufCrm?: string;
  novaSenha?: string;
}

/**
 * Autentica um profissional de saúde com e-mail e senha.
 */
export async function autenticarProfissional(
  credenciais: LoginFormData,
): Promise<AuthResponse> {
  if (USE_MOCKS) {
    await delay(400);
    const usuarioMock: Usuario = {
      id: 'med-101',
      nome: 'Dra. Helena Vasconcelos',
      crm: '123456-DF',
      crmNumero: '123456',
      ufCrm: 'DF',
      email: credenciais.email,
    };
    return {
      usuario: usuarioMock,
      token: 'mock-jwt-access-token',
      refreshToken: 'mock-jwt-refresh-token',
      expiresInMinutes: 30,
    };
  }

  const { data } = await api.post<AuthResponse>('/auth/login', credenciais);
  return data;
}

/**
 * Cadastra um novo profissional médico (CRM + UF) e retorna a sessão autenticada.
 */
export async function registrarProfissional(
  dados: CadastroProfissionalFormData,
): Promise<AuthResponse> {
  if (USE_MOCKS) {
    await delay(500);
    const novoUsuario: Usuario = {
      id: `med-${Date.now()}`,
      nome: dados.nomeCompleto,
      crm: `${dados.crm}-${dados.ufCrm}`,
      crmNumero: dados.crm,
      ufCrm: dados.ufCrm,
      email: dados.email,
    };
    return {
      usuario: novoUsuario,
      token: 'mock-jwt-access-token',
      refreshToken: 'mock-jwt-refresh-token',
      expiresInMinutes: 30,
    };
  }

  const { data } = await api.post<AuthResponse>('/auth/registro', dados);
  return data;
}

/**
 * Lista todos os profissionais médicos cadastrados no sistema.
 */
export async function listarProfissionais(): Promise<Usuario[]> {
  if (USE_MOCKS) {
    await delay(200);
    return [
      {
        id: 'med-101',
        nome: 'Dra. Helena Vasconcelos',
        crm: '123456-DF',
        crmNumero: '123456',
        ufCrm: 'DF',
        email: 'medico@arteria.med.br',
      },
    ];
  }
  const { data } = await api.get<Usuario[]>('/auth/profissionais');
  return data;
}

/**
 * Atualiza os dados do próprio médico logado (PUT /api/auth/me).
 */
export async function atualizarMeuPerfil(
  payload: AtualizarProfissionalPayload,
): Promise<Usuario> {
  const { data } = await api.put<Usuario>('/auth/me', payload);
  return data;
}

/**
 * Exclui a própria conta profissional (DELETE /api/auth/me).
 */
export async function deletarMeuPerfil(): Promise<void> {
  await api.delete('/auth/me');
}

/**
 * Atualiza os dados de um profissional médico pelo ID (PUT /api/auth/profissionais/{id}).
 */
export async function atualizarProfissionalPorId(
  id: string,
  payload: AtualizarProfissionalPayload,
): Promise<Usuario> {
  const { data } = await api.put<Usuario>(`/auth/profissionais/${id}`, payload);
  return data;
}

/**
 * Exclui um profissional médico pelo ID (DELETE /api/auth/profissionais/{id}).
 */
export async function deletarProfissionalPorId(id: string): Promise<void> {
  await api.delete(`/auth/profissionais/${id}`);
}
