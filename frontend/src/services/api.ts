/**
 * Cliente HTTP Axios Centralizado com Interceptors de Segurança (RF01 / RE02).
 * Otimizado com timeout enxuto (12s) para nunca travar a interface durante cold-start.
 */

import axios from 'axios';
import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import type { AuthResponse } from '@/types';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12_000,
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

// Interceptor de Resposta: trata expiração de sessão (HTTP 401) sem derrubar sessões de contingência
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const tokenAtual = useAuthStore.getState().token;

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes('/auth/login') &&
      !originalRequest?.url?.includes('/auth/refresh') &&
      !tokenAtual?.startsWith('arteria-local-')
    ) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken && !refreshToken.startsWith('arteria-local-')) {
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
          // Mantém sessão ativa em contingência para não interromper o uso
        }
      }
    }

    return Promise.reject(error);
  },
);
