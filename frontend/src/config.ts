/**
 * Configurações de Ambiente do Frontend ArterIA.
 *
 * Permite alternar de forma limpa entre:
 * - Modo API Real (`VITE_USE_MOCKS=false`): conecta ao Backend Python (FastAPI) + Neon Postgres.
 * - Modo Simulação (`VITE_USE_MOCKS=true`): utiliza mocks em memória para demonstração rápida.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

/** Utilitário para simular latência de rede quando em modo de demonstração (`USE_MOCKS=true`). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
