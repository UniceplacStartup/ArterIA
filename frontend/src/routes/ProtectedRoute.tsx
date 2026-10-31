/**
 * Guarda de Rotas Autenticadas (RF01).
 *
 * Em ambiente de produção/API real (`USE_MOCKS=false`), exige que o profissional
 * esteja autenticado com token JWT válido, redirecionando para `/login` caso contrário.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { USE_MOCKS } from '@/config';
import { useAuthStore } from '@/stores/authStore';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  // Quando conectado ao Backend Python real, exige sessão autenticada
  if (!USE_MOCKS && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

