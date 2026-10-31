/**
 * Componente Raiz da Aplicação Frontend ArterIA.
 * Configura Provedores Globais (React Query, Material UI Theme, React Hot Toast)
 * e o Roteamento com proteção de sessão médica (`ProtectedRoute`).
 */

import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { theme } from '@/theme/theme';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoadingScreen } from '@/components/Loading/LoadingScreen';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import Dashboard from '@/pages/Dashboard/Dashboard';
import ExameDetalhe from '@/pages/Resultado/ExameDetalhe';
import CadastroProfissional from '@/pages/CadastroProfissional';
import CadastroPaciente from '@/pages/CadastroPaciente';
import Login from '@/pages/Login';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster position="top-right" />
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Rotas Públicas de Autenticação Profissional (RF01) */}
              <Route path="/login" element={<Login />} />
              <Route
                path="/cadastro-profissional"
                element={<CadastroProfissional />}
              />

              {/* Rotas Protegidas que exigem sessão médica autenticada */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route
                    path="/resultado/:exameId"
                    element={<ExameDetalhe />}
                  />
                </Route>
                <Route
                  path="/cadastro-paciente"
                  element={<CadastroPaciente />}
                />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
