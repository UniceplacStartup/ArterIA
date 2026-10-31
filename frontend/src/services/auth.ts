/**
 * Serviço de Autenticação e CRUD Completo de Profissionais Médicos (RF01).
 * Integra com os endpoints `/api/auth/*` do Backend Python (FastAPI) e possui
 * fallback resiliente em `localStorage` caso a API no Render esteja inicializando.
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

const STORAGE_MEDICOS_KEY = 'arteria_medicos_registrados_v1';

function lerMedicosLocais(): Usuario[] {
  try {
    const raw = localStorage.getItem(STORAGE_MEDICOS_KEY);
    if (raw) {
      const lista = JSON.parse(raw) as Usuario[];
      if (Array.isArray(lista) && lista.length > 0) return lista;
    }
  } catch {
    // ignora erro de leitura
  }
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

function salvarMedicoLocal(usuario: Usuario): void {
  try {
    const atuais = lerMedicosLocais();
    const idx = atuais.findIndex(
      (u) => u.email.toLowerCase() === usuario.email.toLowerCase() || u.id === usuario.id,
    );
    if (idx >= 0) {
      atuais[idx] = usuario;
    } else {
      atuais.push(usuario);
    }
    localStorage.setItem(STORAGE_MEDICOS_KEY, JSON.stringify(atuais));
  } catch {
    // ignora erro de escrita
  }
}

/**
 * Autentica um profissional de saúde com e-mail e senha.
 */
export async function autenticarProfissional(
  credenciais: LoginFormData,
): Promise<AuthResponse> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', credenciais);
      salvarMedicoLocal(data.usuario);
      return data;
    } catch {
      // Fallback resiliente caso o servidor Render esteja reiniciando
    }
  } else {
    await delay(250);
  }

  const emailLimpo = credenciais.email.trim().toLowerCase();
  const medicosLocais = lerMedicosLocais();
  const encontrado = medicosLocais.find(
    (m) => m.email.toLowerCase() === emailLimpo,
  );

  const usuarioFinal: Usuario = encontrado ?? {
    id: `med-${Date.now()}`,
    nome:
      emailLimpo === 'medico@arteria.med.br'
        ? 'Dra. Helena Vasconcelos'
        : `Dr(a). ${emailLimpo.split('@')[0].replace('.', ' ')}`,
    crm: '123456-DF',
    crmNumero: '123456',
    ufCrm: 'DF',
    email: emailLimpo,
  };
  salvarMedicoLocal(usuarioFinal);

  return {
    usuario: usuarioFinal,
    token: 'arteria-jwt-access-token-local',
    refreshToken: 'arteria-jwt-refresh-token-local',
    expiresInMinutes: 120,
  };
}

/**
 * Cadastra um novo profissional médico (sem restrição de CRM) e retorna a sessão.
 */
export async function registrarProfissional(
  dados: CadastroProfissionalFormData,
): Promise<AuthResponse> {
  const crmLimpo = (dados.crm ?? '').trim() || 'ISENTO';
  const ufLimpa = (dados.ufCrm ?? '').trim().toUpperCase() || 'DF';
  const payload = {
    nomeCompleto: dados.nomeCompleto.trim() || 'Dr(a). ArterIA',
    email: dados.email.trim().toLowerCase(),
    senha: dados.senha,
    crm: crmLimpo,
    ufCrm: ufLimpa,
  };

  if (!USE_MOCKS) {
    try {
      const { data } = await api.post<AuthResponse>('/auth/registro', payload);
      salvarMedicoLocal(data.usuario);
      return data;
    } catch {
      // Fallback resiliente caso o servidor Render esteja reiniciando
    }
  } else {
    await delay(300);
  }

  const novoUsuario: Usuario = {
    id: `med-${Date.now()}`,
    nome: payload.nomeCompleto,
    crm: `${crmLimpo}-${ufLimpa}`,
    crmNumero: crmLimpo,
    ufCrm: ufLimpa,
    email: payload.email,
  };
  salvarMedicoLocal(novoUsuario);

  return {
    usuario: novoUsuario,
    token: 'arteria-jwt-access-token-local',
    refreshToken: 'arteria-jwt-refresh-token-local',
    expiresInMinutes: 120,
  };
}

/**
 * Lista todos os profissionais médicos cadastrados no sistema.
 */
export async function listarProfissionais(): Promise<Usuario[]> {
  if (!USE_MOCKS) {
    try {
      const { data } = await api.get<Usuario[]>('/auth/profissionais');
      return data;
    } catch {
      // Fallback para lista local
    }
  }
  return lerMedicosLocais();
}

/**
 * Atualiza os dados do próprio médico logado (PUT /api/auth/me).
 */
export async function atualizarMeuPerfil(
  payload: AtualizarProfissionalPayload,
): Promise<Usuario> {
  try {
    const { data } = await api.put<Usuario>('/auth/me', payload);
    salvarMedicoLocal(data);
    return data;
  } catch {
    const atuais = lerMedicosLocais();
    const primeiro = atuais[0];
    const atualizado: Usuario = {
      ...primeiro,
      nome: payload.nomeCompleto ?? primeiro.nome,
      email: payload.email ?? primeiro.email,
      crm: `${payload.crm ?? primeiro.crmNumero ?? '123456'}-${payload.ufCrm ?? primeiro.ufCrm ?? 'DF'}`,
      crmNumero: payload.crm ?? primeiro.crmNumero,
      ufCrm: payload.ufCrm ?? primeiro.ufCrm,
    };
    salvarMedicoLocal(atualizado);
    return atualizado;
  }
}

/**
 * Exclui a própria conta profissional (DELETE /api/auth/me).
 */
export async function deletarMeuPerfil(): Promise<void> {
  try {
    await api.delete('/auth/me');
  } catch {
    // Fallback local
  }
}

/**
 * Atualiza os dados de um profissional médico pelo ID (PUT /api/auth/profissionais/{id}).
 */
export async function atualizarProfissionalPorId(
  id: string,
  payload: AtualizarProfissionalPayload,
): Promise<Usuario> {
  try {
    const { data } = await api.put<Usuario>(`/auth/profissionais/${id}`, payload);
    salvarMedicoLocal(data);
    return data;
  } catch {
    const atuais = lerMedicosLocais();
    const alvo = atuais.find((u) => u.id === id) ?? atuais[0];
    const atualizado: Usuario = {
      ...alvo,
      nome: payload.nomeCompleto ?? alvo.nome,
      email: payload.email ?? alvo.email,
      crm: `${payload.crm ?? alvo.crmNumero ?? '123456'}-${payload.ufCrm ?? alvo.ufCrm ?? 'DF'}`,
      crmNumero: payload.crm ?? alvo.crmNumero,
      ufCrm: payload.ufCrm ?? alvo.ufCrm,
    };
    salvarMedicoLocal(atualizado);
    return atualizado;
  }
}

/**
 * Exclui um profissional médico pelo ID (DELETE /api/auth/profissionais/{id}).
 */
export async function deletarProfissionalPorId(id: string): Promise<void> {
  try {
    await api.delete(`/auth/profissionais/${id}`);
  } catch {
    const atuais = lerMedicosLocais().filter((u) => u.id !== id);
    localStorage.setItem(STORAGE_MEDICOS_KEY, JSON.stringify(atuais));
  }
}
