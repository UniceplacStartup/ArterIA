/**
 * Configurações de Ambiente do Frontend ArterIA.
 * Normaliza automaticamente `VITE_API_URL` para garantir que termine sempre com `/api`.
 */

function normalizarApiUrl(rawUrl?: string): string {
  const base = (rawUrl ?? 'http://localhost:8000/api').trim().replace(/\/+$/, '');
  if (!base) return 'http://localhost:8000/api';
  return base.endsWith('/api') ? base : `${base}/api`;
}

export const API_BASE_URL = normalizarApiUrl(import.meta.env.VITE_API_URL);

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

/** Utilitário para simular latência de rede quando em modo de demonstração (`USE_MOCKS=true`). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
