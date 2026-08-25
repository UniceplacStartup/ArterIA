import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Usuario } from '@/types';

// RF01
interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (usuario: Usuario, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      token: null,
      isAuthenticated: false,
      login: (usuario, token) => set({ usuario, token, isAuthenticated: true }),
      logout: () => set({ usuario: null, token: null, isAuthenticated: false }),
    }),
    { name: 'arteria-auth' }, 
  ),
);
