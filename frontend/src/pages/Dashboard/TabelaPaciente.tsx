/**
 * Tabela de Pacientes do Dashboard com CRUD Completo e Submissão Rápida de Exame (RF07).
 * Exibe código público/ID, nome, data do último exame, badge de status
 * e ações de Submeter Exame, Editar dados cadastrais ou Excluir paciente.
 */

import { useState } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  TableContainer,
  IconButton,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { StatusBadge } from '@/components/StatusBadge/StatusBadge';
import { UploadDicomModal } from '@/components/Upload_Dash/UploadDicomModal';
import { colors } from '@/theme/theme';
import {
  useAtualizarPaciente,
  useDeletarPaciente,
} from '@/hooks/usePacientes';
import type { Paciente } from '@/types';

export function PatientTable({ pacientes }: { pacientes: Paciente[] }) {
  const navigate = useNavigate();
  const { mutateAsync: atualizarPaciente, isPending: salvandoEdicao } =
    useAtualizarPaciente();
  const { mutateAsync: deletarPaciente, isPending: excluindo } =
    useDeletarPaciente();

  // Estado para submeter novo exame diretamente pela linha do paciente
  const [pacienteParaUploadId, setPacienteParaUploadId] = useState<
    string | null
  >(null);

  // Estado para o modal de Edição de Paciente
  const [pacienteEditando, setPacienteEditando] = useState<Paciente | null>(
    null,
  );
  const [nomeForm, setNomeForm] = useState('');
  const [cpfForm, setCpfForm] = useState('');
  const [dataNascForm, setDataNascForm] = useState('');
  const [emailForm, setEmailForm] = useState('');

  // Estado para o modal de Exclusão de Paciente
  const [pacienteExcluindo, setPacienteExcluindo] = useState<Paciente | null>(
    null,
  );

  function abrirModalUpload(e: React.MouseEvent, paciente: Paciente) {
    e.stopPropagation();
    setPacienteParaUploadId(paciente.id);
  }

  function abrirModalEdicao(e: React.MouseEvent, paciente: Paciente) {
    e.stopPropagation();
    setPacienteEditando(paciente);
    setNomeForm(paciente.nome ?? '');
    setCpfForm(paciente.cpfId ?? '');
    setDataNascForm(
      paciente.dataNascimento
        ? dayjs(paciente.dataNascimento).format('YYYY-MM-DD')
        : '',
    );
    setEmailForm(paciente.email ?? '');
  }

  function abrirModalExclusao(e: React.MouseEvent, paciente: Paciente) {
    e.stopPropagation();
    setPacienteExcluindo(paciente);
  }

  async function handleSalvarEdicao() {
    if (!pacienteEditando) return;
    if (nomeForm.trim().length < 3) {
      toast.error('O nome do paciente deve ter pelo menos 3 caracteres.');
      return;
    }

    try {
      await atualizarPaciente({
        id: pacienteEditando.id,
        dados: {
          nomeCompleto: nomeForm.trim(),
          cpfId: cpfForm.trim() || undefined,
          dataNascimento: dataNascForm || undefined,
          email: emailForm.trim(),
        },
      });
      toast.success('Dados do paciente atualizados com sucesso!');
      setPacienteEditando(null);
    } catch {
      toast.error(
        'Não foi possível atualizar o paciente. Verifique se o CPF já pertence a outro cadastro.',
      );
    }
  }

  async function handleConfirmarExclusao() {
    if (!pacienteExcluindo) return;
    try {
      await deletarPaciente(pacienteExcluindo.id);
      toast.success(
        `Paciente "${pacienteExcluindo.nome}" e seus exames foram excluídos.`,
      );
      setPacienteExcluindo(null);
    } catch {
      toast.error('Erro ao excluir o paciente.');
    }
  }

  return (
    <>
      <TableContainer
        component={Paper}
        sx={{ borderRadius: 3, overflow: 'hidden' }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: colors.wine100 }}>
              <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>NOME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ÚLTIMO EXAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                AÇÕES
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pacientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" fontWeight={600} gutterBottom>
                    Sua carteira de pacientes está vazia
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Cada médico possui sua própria lista exclusiva de pacientes.
                    Clique em &ldquo;Cadastrar paciente&rdquo; acima para
                    adicionar seu primeiro paciente.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {pacientes.map((paciente) => {
              const destinoId = paciente.ultimoExameId ?? paciente.id;
              return (
                <TableRow
                  key={paciente.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/resultado/${destinoId}`)}
                >
                  <TableCell>
                    {paciente.codigoPublico ?? paciente.id}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {paciente.nome}
                  </TableCell>
                  <TableCell>
                    {paciente.ultimoExame
                      ? dayjs(paciente.ultimoExame).format('DD/MM/YYYY')
                      : 'Sem exame ativo'}
                  </TableCell>
                  <TableCell>
                    {paciente.statusUltimoExame ? (
                      <StatusBadge status={paciente.statusUltimoExame} />
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        label="Submeter exame"
                        onClick={(e) => abrirModalUpload(e, paciente)}
                        sx={{
                          cursor: 'pointer',
                          borderColor: colors.wine700,
                          color: colors.wine700,
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell
                    align="right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Stack
                      direction="row"
                      spacing={0.5}
                      justifyContent="flex-end"
                    >
                      <Tooltip title="Submeter novo exame para este paciente">
                        <IconButton
                          size="small"
                          sx={{ color: colors.wine700 }}
                          onClick={(e) => abrirModalUpload(e, paciente)}
                        >
                          <Upload size={17} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar paciente">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => abrirModalEdicao(e, paciente)}
                        >
                          <Pencil size={17} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir paciente e exames">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => abrirModalExclusao(e, paciente)}
                        >
                          <Trash2 size={17} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal de Upload Rápido com o paciente já selecionado */}
      <UploadDicomModal
        open={Boolean(pacienteParaUploadId)}
        onClose={() => setPacienteParaUploadId(null)}
        pacientes={pacientes}
        pacientePreSelecionadoId={pacienteParaUploadId ?? undefined}
      />

      {/* Modal de Edição de Paciente */}
      <Dialog
        open={Boolean(pacienteEditando)}
        onClose={() => setPacienteEditando(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle fontWeight={700}>Editar Dados do Paciente</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome completo"
              fullWidth
              value={nomeForm}
              onChange={(e) => setNomeForm(e.target.value)}
            />
            <TextField
              label="CPF ou Identificador (11 dígitos)"
              fullWidth
              value={cpfForm}
              onChange={(e) => setCpfForm(e.target.value)}
            />
            <TextField
              label="Data de Nascimento"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={dataNascForm}
              onChange={(e) => setDataNascForm(e.target.value)}
            />
            <TextField
              label="E-mail (opcional)"
              type="email"
              fullWidth
              value={emailForm}
              onChange={(e) => setEmailForm(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setPacienteEditando(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSalvarEdicao}
            disabled={salvandoEdicao}
          >
            {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Confirmação de Exclusão de Paciente */}
      <Dialog
        open={Boolean(pacienteExcluindo)}
        onClose={() => setPacienteExcluindo(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle fontWeight={700} color="error.main">
          Excluir Paciente
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              Tem certeza que deseja excluir o cadastro de{' '}
              <strong>{pacienteExcluindo?.nome}</strong>?
            </Typography>
            <Alert severity="warning" sx={{ fontSize: '0.82rem' }}>
              Esta ação removerá o paciente e todas as imagens/exames enviados
              para ele do cofre seguro.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setPacienteExcluindo(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmarExclusao}
            disabled={excluindo}
          >
            {excluindo ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
