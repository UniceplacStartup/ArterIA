/**
 * Modal de Upload de Exame (DICOM, PDF, PNG ou JPEG) no Dashboard e na Página do Paciente (RF02 / RE01).
 * Pré-seleciona automaticamente o paciente quando aberto a partir da linha de um paciente
 * ou após a exclusão de um exame, permitindo submeter outro exame a qualquer momento.
 */

import { useCallback, useEffect, useState } from 'react';
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
import {
  ehExtensaoExamePermitida,
  pareceDicomValido,
} from '@/schemas/uploadSchema';
import { useUploadExame } from '@/hooks/useExame';
import type { Paciente } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  pacientes: Paciente[];
  pacientePreSelecionadoId?: string;
}

const CEM_MB = 100 * 1024 * 1024;

export function UploadDicomModal({
  open,
  onClose,
  pacientes,
  pacientePreSelecionadoId,
}: Props) {
  const [pacienteId, setPacienteId] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const navigate = useNavigate();
  const { mutateAsync: enviarUpload, isPending } = useUploadExame();

  useEffect(() => {
    if (open) {
      if (pacientePreSelecionadoId) {
        setPacienteId(pacientePreSelecionadoId);
      } else if (pacientes.length === 1) {
        setPacienteId(pacientes[0].id);
      }
      setArquivo(null);
    }
  }, [open, pacientePreSelecionadoId, pacientes]);

  const onDrop = useCallback(async (accepted: File[], rejected: unknown[]) => {
    if (rejected.length > 0 || accepted.length === 0) {
      toast.error(
        'Formato inválido. Aceitos: DICOM (.dcm), PDF (.pdf), PNG (.png) ou JPEG (.jpg/.jpeg).',
      );
      return;
    }

    const file = accepted[0];

    if (!ehExtensaoExamePermitida(file.name)) {
      toast.error(
        'Formato inválido. Aceitos: DICOM (.dcm), PDF (.pdf), PNG (.png) ou JPEG (.jpg/.jpeg).',
      );
      return;
    }

    if (file.size > CEM_MB) {
      toast.error('Arquivo excede o limite de 100 MB permitido por exame.');
      return;
    }

    const valido = await pareceDicomValido(file);
    if (!valido) {
      toast.error(
        'Arquivo corrompido ou assinatura binária inválida (DICOM, PDF, PNG ou JPEG).',
      );
      return;
    }

    setArquivo(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/dicom': ['.dcm'],
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  });

  async function handleEnviar() {
    if (!pacienteId || !arquivo) {
      toast.error(
        'Selecione um paciente e um arquivo válido (.dcm, .pdf, .png ou .jpg).',
      );
      return;
    }
    try {
      const exame = await enviarUpload({ pacienteId, arquivo });
      toast.success(
        'Novo exame enviado com sucesso! Análise da IA em processamento.',
      );
      setArquivo(null);
      onClose();
      navigate(`/resultado/${exame.id}`);
    } catch {
      toast.error('Falha ao enviar o exame. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle fontWeight={700}>
        Submeter exame (DICOM, PDF, PNG ou JPEG)
      </DialogTitle>
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
            {arquivo
              ? arquivo.name
              : 'Arraste um arquivo (.dcm, .pdf, .png, .jpg) ou clique para selecionar'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Aceita DICOM (.dcm), PDF (.pdf), PNG (.png) e JPEG (.jpg/.jpeg), até
            100 MB
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleEnviar}
          disabled={isPending}
        >
          {isPending ? 'Enviando...' : 'Enviar exame'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
