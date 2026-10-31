/**
 * Página de Detalhe do Exame, Visualizador Multimídia (DICOM/PDF/PNG/JPEG),
 * Exclusão de Imagem/Exame Enviado por Engano e Submissão de Novo Exame a Qualquer Momento
 * (RF03, RF04, RF06, RE02, RN06).
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Stack,
  Skeleton,
  Alert,
  Button,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from '@mui/material';
import { Trash2, ArrowLeft, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  useExame,
  useExamesPorPaciente,
  useReprocessarExame,
  useDeletarExame,
} from '@/hooks/useExame';
import { usePacientes } from '@/hooks/usePacientes';
import { DicomViewer } from './DicomViewer';
import { AIResultsPanel } from './Resultados';
import { HistoricoSidebar } from './HistoricoSidebar';
import { UploadDicomModal } from '@/components/Upload_Dash/UploadDicomModal';
import type { Exame } from '@/types';

export default function ExameDetalhe() {
  const { exameId } = useParams<{ exameId: string }>();
  const navigate = useNavigate();
  const { data: exame, isLoading, isError } = useExame(exameId!);
  const { data: historicoPaciente } = useExamesPorPaciente(exame?.pacienteId);
  const { data: listaPacientes } = usePacientes();
  const { mutateAsync: reprocessar, isPending: reprocessando } =
    useReprocessarExame(exame?.id ?? exameId!);
  const { mutateAsync: deletarExame, isPending: excluindoExame } =
    useDeletarExame();

  const [modalUpload, setModalUpload] = useState(false);
  const [exameParaExcluir, setExameParaExcluir] = useState<Exame | null>(null);

  async function handleReprocessar() {
    try {
      await reprocessar();
      toast.success('Nova análise com IA solicitada.');
    } catch {
      toast.error('Não foi possível solicitar nova análise.');
    }
  }

  async function handleConfirmarExclusaoExame() {
    if (!exameParaExcluir) return;
    const idRemovido = exameParaExcluir.id;
    const pacienteId = exameParaExcluir.pacienteId;

    try {
      await deletarExame({ exameId: idRemovido, pacienteId });
      toast.success(
        'Exame excluído! Você pode submeter outro exame para este paciente quando quiser.',
      );
      setExameParaExcluir(null);

      // Se havia outros exames do mesmo paciente, navega para o próximo disponível;
      // caso contrário, permanece na tela do paciente (/resultado/{pacienteId}) no estado PENDENTE
      // para que o médico possa enviar outro exame imediatamente ou quando quiser.
      const restantes = (historicoPaciente ?? []).filter(
        (item) => item.id !== idRemovido,
      );
      if (restantes.length > 0) {
        navigate(`/resultado/${restantes[0].id}`);
      } else {
        navigate(`/resultado/${pacienteId}`);
      }
    } catch {
      toast.error('Não foi possível excluir este exame.');
    }
  }

  if (isLoading) return <Skeleton variant="rounded" height={520} />;
  if (isError || !exame)
    return <Alert severity="error">Exame não encontrado.</Alert>;

  const pacienteAtual = listaPacientes?.find((p) => p.id === exame.pacienteId);
  const pacientesParaModal =
    listaPacientes && listaPacientes.length > 0
      ? listaPacientes
      : [
          {
            id: exame.pacienteId,
            nome: pacienteAtual?.nome ?? `Paciente #${exame.pacienteId}`,
            dataNascimento: pacienteAtual?.dataNascimento ?? '',
          },
        ];

  const listaExamesHistorico =
    historicoPaciente && historicoPaciente.length > 0
      ? historicoPaciente
      : exame.status === 'PENDENTE'
        ? []
        : [exame];

  return (
    <Stack spacing={2}>
      {/* Barra superior com navegação, botão de subir novo exame e excluir imagem atual */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          px: 2.5,
          borderRadius: 2.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid rgba(114, 15, 50, 0.12)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            size="small"
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Voltar aos Pacientes
          </Button>
          <Typography variant="body2" color="text.secondary">
            {pacienteAtual ? (
              <>
                Paciente: <strong>{pacienteAtual.nome}</strong>
              </>
            ) : (
              <>
                Exame de{' '}
                <strong>
                  {dayjs(exame.criadoEm).format('DD/MM/YYYY [às] HH:mm')}
                </strong>
              </>
            )}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            startIcon={<Upload size={15} />}
            onClick={() => setModalUpload(true)}
          >
            Submeter Novo Exame
          </Button>
          {exame.status !== 'PENDENTE' && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Trash2 size={15} />}
              onClick={() => setExameParaExcluir(exame)}
            >
              Excluir Imagem Atual
            </Button>
          )}
        </Stack>
      </Paper>

      <Stack direction="row" spacing={3} alignItems="flex-start">
        <HistoricoSidebar
          exames={listaExamesHistorico}
          exameSelecionadoId={exame.id}
          onSelecionar={(idSelecionado) =>
            navigate(`/resultado/${idSelecionado}`)
          }
          onNovoUpload={() => setModalUpload(true)}
          onDeletarExame={(exameAlvo) => setExameParaExcluir(exameAlvo)}
        />

        <Box sx={{ flex: 1 }}>
          {exame.status === 'PENDENTE' && (
            <Paper
              variant="outlined"
              sx={{
                py: 9,
                px: 4,
                borderRadius: 3,
                textAlign: 'center',
                bgcolor: '#fff',
              }}
            >
              <Stack alignItems="center" spacing={2}>
                <Typography variant="h6" fontWeight={700}>
                  Nenhum exame ativo para este paciente
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 460 }}
                >
                  O exame anterior foi excluído ou ainda não houve envio. Você
                  pode submeter um novo exame (DICOM, PDF, PNG ou JPEG) agora ou
                  quando desejar.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Upload size={18} />}
                  onClick={() => setModalUpload(true)}
                >
                  Submeter novo exame agora
                </Button>
              </Stack>
            </Paper>
          )}

          {exame.status === 'PROCESSANDO' && (
            <Stack alignItems="center" spacing={2} sx={{ py: 10 }}>
              <CircularProgress />
              <Typography color="text.secondary">
                Analisando exame... isso pode levar alguns segundos.
              </Typography>
            </Stack>
          )}

          {exame.status === 'FALHA_PROCESSAMENTO' && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleReprocessar}
                  disabled={reprocessando}
                >
                  {reprocessando ? 'Solicitando...' : 'Solicitar nova análise'}
                </Button>
              }
            >
              A IA não respondeu a tempo. O exame não foi perdido — você pode
              solicitar uma nova análise.
            </Alert>
          )}

          {(exame.status === 'PENDENTE_LAUDO' ||
            exame.status === 'LAUDADO') && (
            <DicomViewer arquivoDicomUrl={exame.arquivoDicomUrl} />
          )}
        </Box>

        {exame.resultadoIA && (
          <AIResultsPanel
            key={exame.id}
            exameId={exame.id}
            resultadoIA={exame.resultadoIA}
            diagnosticoExistente={exame.diagnosticoFinalMedico}
          />
        )}

        <UploadDicomModal
          open={modalUpload}
          onClose={() => setModalUpload(false)}
          pacientes={pacientesParaModal}
          pacientePreSelecionadoId={exame.pacienteId}
        />

        {/* Modal de Confirmação para Excluir Imagem / Exame */}
        <Dialog
          open={Boolean(exameParaExcluir)}
          onClose={() => setExameParaExcluir(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle fontWeight={700} color="error.main">
            Excluir Imagem / Exame
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <Typography variant="body2">
                Deseja excluir permanentemente o exame enviado em{' '}
                <strong>
                  {exameParaExcluir
                    ? dayjs(exameParaExcluir.criadoEm).format(
                        'DD/MM/YYYY HH:mm',
                      )
                    : ''}
                </strong>
                ?
              </Typography>
              <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                Após excluir, o paciente continuará cadastrado e você poderá
                submeter outro exame para ele quando quiser.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setExameParaExcluir(null)}>Cancelar</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmarExclusaoExame}
              disabled={excluindoExame}
            >
              {excluindoExame ? 'Excluindo...' : 'Excluir Imagem'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Stack>
  );
}
