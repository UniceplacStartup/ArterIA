import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Stack, Skeleton, Alert, Button, CircularProgress, Typography } from '@mui/material';
import toast from 'react-hot-toast';
import { useExame, useReprocessarExame } from '@/hooks/useExame';
import { DicomViewer } from './DicomViewer';
import { AIResultsPanel } from './Resultados';
import { HistoricoSidebar } from './HistoricoSidebar';
import { UploadDicomModal } from '@/components/Upload_Dash/UploadDicomModal';

export default function ExameDetalhe() {
  const { exameId } = useParams<{ exameId: string }>();
  const { data: exame, isLoading, isError } = useExame(exameId!);
  const { mutateAsync: reprocessar, isPending: reprocessando } = useReprocessarExame(exameId!);
  const [modalUpload, setModalUpload] = useState(false);

  async function handleReprocessar() {
    try {
      await reprocessar();
      toast.success('Nova análise solicitada.');
    } catch {
      toast.error('Não foi possível solicitar nova análise.');
    }
  }

  if (isLoading) return <Skeleton variant="rounded" height={520} />;
  if (isError || !exame) return <Alert severity="error">Exame não encontrado.</Alert>;

  return (
    <Stack direction="row" spacing={3} alignItems="flex-start">
      <HistoricoSidebar
        exames={[exame]}
        exameSelecionadoId={exame.id}
        onSelecionar={() => {}}
        onNovoUpload={() => setModalUpload(true)}
      />

      <Box sx={{ flex: 1 }}>
        {exame.status === 'PENDENTE' && (
          <Stack alignItems="center" spacing={2} sx={{ py: 10 }}>
            <Typography color="text.secondary">
              Este paciente ainda não tem exame enviado.
            </Typography>
            <Button variant="contained" onClick={() => setModalUpload(true)}>
              Fazer upload de exame
            </Button>
          </Stack>
        )}

        {exame.status === 'PROCESSANDO' && (
          <Stack alignItems="center" spacing={2} sx={{ py: 10 }}>
            <CircularProgress />
            <Typography color="text.secondary">
              Analisando exame... isso pode levar até 30 segundos.
            </Typography>
          </Stack>
        )}

        {exame.status === 'FALHA_PROCESSAMENTO' && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleReprocessar} disabled={reprocessando}>
                {reprocessando ? 'Solicitando...' : 'Solicitar nova análise'}
              </Button>
            }
          >
            A IA não respondeu a tempo. O exame não foi perdido — você pode solicitar uma nova
            análise.
          </Alert>
        )}

        {(exame.status === 'PENDENTE_LAUDO' || exame.status === 'LAUDADO') && (
          <DicomViewer arquivoDicomUrl={exame.arquivoDicomUrl} />
        )}
      </Box>

      {exame.resultadoIA && <AIResultsPanel exameId={exame.id} resultadoIA={exame.resultadoIA} />}

      <UploadDicomModal
        open={modalUpload}
        onClose={() => setModalUpload(false)}
        pacientes={[{ id: exame.pacienteId, nome: '', dataNascimento: '' }]}
      />
    </Stack>
  );
}
