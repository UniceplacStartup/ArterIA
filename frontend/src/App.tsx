/**
 * Componente Raiz da Aplicação Frontend ArterIA.
 * Inclui ErrorBoundary global anti-tela-branca e pré-aquecimento (warm-up) do Backend.
 */

import { Component, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { ThemeProvider, CssBaseline, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { theme } from '@/theme/theme';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoadingScreen } from '@/components/Loading/LoadingScreen';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { API_BASE_URL } from '@/config';
import Dashboard from '@/pages/Dashboard/Dashboard';
import ExameDetalhe from '@/pages/Resultado/ExameDetalhe';
import CadastroProfissional from '@/pages/CadastroProfissional';
import CadastroPaciente from '@/pages/CadastroPaciente';
import Login from '@/pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 300_000,
      retry: 0,
      refetchOnWindowFocus: false,
    },
  },
});

interface ErrorBoundaryState {
  hasError: boolean;
}

class GlobalErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro capturado pelo GlobalErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#fdf8fa',
            p: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 4,
              maxWidth: 460,
              borderRadius: 3,
              textAlign: 'center',
              border: '1px solid rgba(114, 15, 50, 0.15)',
            }}
          >
            <Stack spacing={2} alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                Recuperação Automática de Tela
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Seus dados e o cadastro do paciente foram preservados com
                segurança. Clique abaixo para voltar ao painel principal.
              </Typography>
              <Button
                variant="contained"
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.href = '/dashboard';
                }}
              >
                Voltar ao Painel Principal
              </Button>
            </Stack>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

function App() {
  // Pré-aquece o servidor do Render em background assim que o usuário abre o site
  useEffect(() => {
    const healthUrl = API_BASE_URL.replace(/\/api$/, '/health');
    fetch(healthUrl, { method: 'GET', mode: 'cors' }).catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster position="top-right" />
        <GlobalErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/dashboard" replace />}
                />

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

                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </GlobalErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
