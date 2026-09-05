import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  TextField,
  Box,
  Typography,
} from '@mui/material';
import { UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { colors } from '@/theme/theme';
import { pareceDicomValido, EXTENSOES_ACEITAS_TESTE } from '@/schemas/uploadSchema';
import { useUploadExame } from '@/hooks/useExame';
import type { Paciente } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  pacientes: Paciente[];
}

const TAMANHO_MAX_TESTE_MB = 100 * 1024 * 1024;

// RE01 
export function UploadDicomModal({ open, onClose, pacientes }: Props) {
  const [pacienteId, setPacienteId] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const navigate = useNavigate();
  const { mutateAsync: enviarUpload, isPending } = useUploadExame();

    const onDrop = useCallback(async (accepted: File[], rejected: unknown[]) => {
    if (rejected.length > 0 || accepted.length === 0) {
      toast.error(`Arquivo inválido. Aceitos (Apenas para teste): ${EXTENSOES_ACEITAS_TESTE.join(', ')}.`);
      return;
    }

    const file = accepted[0];

    // Modo TESTE: aceita extensões mais leves além do .dcm
    if (!EXTENSOES_ACEITAS_TESTE.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      toast.error(`Arquivo inválido. Aceitos (Apenas para teste): ${EXTENSOES_ACEITAS_TESTE.join(', ')}.`);
      return;
    }

    if (file.size > TAMANHO_MAX_TESTE_MB) {
      toast.error('Arquivo excede o limite de 100 MB permitido.');
      return;
    }

    const valido = await pareceDicomValido(file);
    if (!valido) {
      toast.error('Arquivo corrompido ou fora do padrão DICOM.');
      return;
    }

    setArquivo(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/dicom': ['.dcm'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
  });

  async function handleEnviar() {
    if (!pacienteId || !arquivo) {
      toast.error('Selecione um paciente e um arquivo DICOM válido.');
      return;
    }
    try {
      const exame = await enviarUpload({ pacienteId, arquivo });
      toast.success('Upload realizado com sucesso. Análise em processamento.');
      onClose();
      navigate(`/resultado/${exame.id}`);
    } catch {
      toast.error('Falha ao enviar o exame. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle fontWeight={700}>Upload de exame (DICOM)</DialogTitle>
      <DialogContent>
        <TextField
          select
          fullWidth
          label="Paciente"
          value={pacienteId}
          onChange={(e) => setPacienteId(e.target.value)}
          sx={{ mt: 1, mb: 3 }}
        >
          {pacientes.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.nome}
            </MenuItem>
          ))}
        </TextField>

        <Box
          {...getRootProps()}
          sx={{
            border: `2px dashed ${isDragActive ? colors.wine500 : colors.wine100}`,
            borderRadius: 3,
            p: 5,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? colors.wine50 : 'transparent',
          }}
        >
          <input {...getInputProps()} />
          <UploadCloud size={32} color={colors.wine700} />
          <Typography sx={{ mt: 1 }}>
            {arquivo ? arquivo.name : 'Arraste o arquivo .dcm aqui ou clique para selecionar'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Para teste: .dcm, .png, .jpg, .pdf — até 100 MB
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleEnviar} disabled={isPending}>
          {isPending ? 'Enviando...' : 'Enviar exame'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
