import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import CadastroProfissional from './pages/CadastroProfissional';
import CadastroPaciente from './pages/CadastroPaciente';

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/cadastro-profissional" element={<CadastroProfissional />} />
        <Route path="/cadastro-paciente" element={<CadastroPaciente />} />
        <Route path="/" element={<Navigate to="/cadastro-profissional" replace />} />
      </Routes>
    </>
  );
}

export default App;