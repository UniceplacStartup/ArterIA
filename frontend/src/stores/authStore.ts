/**
 * Store Global de Autenticação (Zustand - RF01).
 *
 * Segurança no Cliente:
 * - Utiliza `sessionStorage` em vez de `localStorage` para reduzir a janela de exposição
 *   de tokens JWT caso a aba seja encerrada em estações médicas compartilhadas.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Usuario } from '@/types';

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (usuario: Usuario, token: string, refreshToken?: string) => void;
  atualizarUsuario: (usuario: Usuario) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (usuario, token, refreshToken) =>
        set({
          usuario,
          token,
          refreshToken: refreshToken ?? null,
          isAuthenticated: true,
        }),
      atualizarUsuario: (usuario) =>
        set((state) => ({
          ...state,
          usuario,
        })),
      logout: () =>
        set({
          usuario: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'arteria-auth-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
