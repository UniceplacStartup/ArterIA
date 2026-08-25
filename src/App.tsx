import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { theme } from '@/theme/theme';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoadingScreen } from '@/components/Loading/LoadingScreen';
import Dashboard from '@/pages/Dashboard/Dashboard';
import ExameDetalhe from '@/pages/Resultado/ExameDetalhe';
import CadastroProfissional from './pages/CadastroProfissional';
import CadastroPaciente from './pages/CadastroPaciente';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/resultado/:exameId" element={<ExameDetalhe />} />
              </Route>

              <Route path="/cadastro-profissional" element={<CadastroProfissional />} />
              <Route path="/cadastro-paciente" element={<CadastroPaciente />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;