import { useState } from 'react';
import { Box, Button, Stack, Skeleton, Alert } from '@mui/material';
import { Plus, Upload } from 'lucide-react';
import { usePacientes } from '@/hooks/usePacientes';
import { PatientTable } from './TabelaPaciente';
import { UploadDicomModal } from '@/components/Upload_Dash/UploadDicomModal';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { data: pacientes, isLoading, isError } = usePacientes();
  const [modalUpload, setModalUpload] = useState(false);
  const navigate = useNavigate();

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button variant="contained" startIcon={<Plus size={18} />}
        onClick={() => navigate('/cadastro-paciente')}>
          Cadastrar paciente
        </Button>
        <Button
          variant="outlined"
          startIcon={<Upload size={18} />}
          onClick={() => setModalUpload(true)}
        >
          Upload (DICOM)
        </Button>
      </Stack>

      {isLoading && <Skeleton variant="rounded" height={280} />}
      {isError && <Alert severity="error">Não foi possível carregar a lista de pacientes.</Alert>}
      {pacientes && <PatientTable pacientes={pacientes} />}

      <UploadDicomModal
        open={modalUpload}
        onClose={() => setModalUpload(false)}
        pacientes={pacientes ?? []}
      />
    </Box>
  );
}
