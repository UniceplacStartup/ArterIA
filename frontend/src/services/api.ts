/**
 * Cliente HTTP Axios Centralizado com Interceptors de Segurança (RF01 / RE02).
 *
 * Responsabilidades:
 * 1. Anexa automaticamente o cabeçalho `Authorization: Bearer <token>` em todas as chamadas.
 * 2. Define timeout de 35 segundos (RE02) para suportar uploads de arquivos DICOM.
 * 3. Intercepta erros 401 (Não Autorizado) e realiza renovação automática via Refresh Token
 *    ou encerra a sessão com segurança caso a renovação falhe.
 */

import axios from 'axios';
import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import type { AuthResponse } from '@/types';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 35_000, // RE02: Timeout estendido para upload e processamento de imagens médicas
  headers: {
    Accept: 'application/json',
  },
});

// Interceptor de Requisição: injeta token JWT de acesso
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de Resposta: trata expiração de sessão (HTTP 401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Tenta renovar o token automaticamente uma única vez se houver refreshToken válido
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes('/auth/login') &&
      !originalRequest?.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const { data } = await axios.post<AuthResponse>(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken },
          );
          useAuthStore
            .getState()
            .login(data.usuario, data.token, data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);
