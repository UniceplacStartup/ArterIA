/**
 * Layout Principal do Dashboard Médico.
 * Inclui:
 * - Barra superior com identificação do(a) doutor(a) autenticado(a);
 * - CRUD Completo de Doutor(a) / Equipe Médica (Meu Perfil + Gerenciar Médicos);
 * - Configuração da IA Google Gemini (seleção de modelo Pro/Flash + chave API);
 * - Logout seguro.
 */

import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Avatar,
  Typography,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Chip,
  Link as MuiLink,
  Tabs,
  Tab,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Settings,
  LogOut,
  UserRound,
  Sparkles,
  Stethoscope,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { colors } from '@/theme/theme';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { USE_MOCKS } from '@/config';
import {
  listarProfissionais,
  atualizarMeuPerfil,
  deletarMeuPerfil,
  registrarProfissional,
  atualizarProfissionalPorId,
  deletarProfissionalPorId,
} from '@/services/auth';
import type { Usuario } from '@/types';

const UFS_BRASIL: readonly string[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

interface GeminiStatus {
  ativo: boolean;
  modelo: string;
  chaveMascarada?: string | null;
  modoAtual: string;
}

export function DashboardLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const atualizarUsuarioStore = useAuthStore((s) => s.atualizarUsuario);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Estados do Modal IA Gemini
  const [modalGemini, setModalGemini] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modeloInput, setModeloInput] = useState('gemini-2.5-pro');
  const [salvandoKey, setSalvandoKey] = useState(false);
  const [statusGemini, setStatusGemini] = useState<GeminiStatus | null>(null);

  // Estados do Modal CRUD de Doutor(a) / Equipe Médica
  const [modalMedicos, setModalMedicos] = useState(false);
  const [abaMedicos, setAbaMedicos] = useState(0);

  // Aba 0: Meu Perfil
  const [meuNome, setMeuNome] = useState('');
  const [meuEmail, setMeuEmail] = useState('');
  const [meuCrm, setMeuCrm] = useState('');
  const [minhaUf, setMinhaUf] = useState('DF');
  const [minhaNovaSenha, setMinhaNovaSenha] = useState('');
  const [salvandoMeuPerfil, setSalvandoMeuPerfil] = useState(false);
  const [confirmarExclusaoMinhaConta, setConfirmarExclusaoMinhaConta] =
    useState(false);

  // Aba 1: Equipe Médica (CRUD de Doutores)
  const [listaMedicos, setListaMedicos] = useState<Usuario[]>([]);
  const [carregandoMedicos, setCarregandoMedicos] = useState(false);
  const [medicoEditando, setMedicoEditando] = useState<Usuario | null>(null);
  const [criandoNovoMedico, setCriandoNovoMedico] = useState(false);

  const [formMedicoNome, setFormMedicoNome] = useState('');
  const [formMedicoEmail, setFormMedicoEmail] = useState('');
  const [formMedicoCrm, setFormMedicoCrm] = useState('');
  const [formMedicoUf, setFormMedicoUf] = useState('DF');
  const [formMedicoSenha, setFormMedicoSenha] = useState('');
  const [salvandoMedicoEquipe, setSalvandoMedicoEquipe] = useState(false);

  useEffect(() => {
    if (modalGemini && !USE_MOCKS) {
      api
        .get<GeminiStatus>('/auth/gemini-status')
        .then((res) => {
          setStatusGemini(res.data);
          if (res.data.modelo) {
            setModeloInput(res.data.modelo);
          }
        })
        .catch(() => {});
    }
  }, [modalGemini]);

  function extrairCrmEUf(med?: Usuario | null): { crm: string; uf: string } {
    if (!med) return { crm: '', uf: 'DF' };
    if (med.crmNumero && med.ufCrm) {
      return { crm: med.crmNumero, uf: med.ufCrm };
    }
    const partes = (med.crm ?? '').split('-');
    return {
      crm: partes[0] ?? '',
      uf: partes[1] ?? 'DF',
    };
  }

  async function carregarEquipeMedica() {
    setCarregandoMedicos(true);
    try {
      const dados = await listarProfissionais();
      setListaMedicos(dados);
    } catch {
      toast.error('Não foi possível carregar a lista de médicos.');
    } finally {
      setCarregandoMedicos(false);
    }
  }

  function abrirModalMedicos(abaInicial = 0) {
    if (usuario) {
      const { crm, uf } = extrairCrmEUf(usuario);
      setMeuNome(usuario.nome);
      setMeuEmail(usuario.email);
      setMeuCrm(crm);
      setMinhaUf(uf);
      setMinhaNovaSenha('');
    }
    setConfirmarExclusaoMinhaConta(false);
    setMedicoEditando(null);
    setCriandoNovoMedico(false);
    setAbaMedicos(abaInicial);
    setModalMedicos(true);
    void carregarEquipeMedica();
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleSalvarConfigGemini() {
    setSalvandoKey(true);
    try {
      const { data } = await api.post<GeminiStatus>('/auth/gemini-config', {
        apiKey: apiKeyInput.trim(),
        modelo: modeloInput,
      });
      setStatusGemini(data);
      setApiKeyInput('');
      toast.success(
        `Configuração da IA atualizada (${data.modelo})!`,
      );
      setModalGemini(false);
    } catch {
      toast.error(
        'Informe uma chave válida ou verifique a conexão com o servidor.',
      );
    } finally {
      setSalvandoKey(false);
    }
  }

  async function handleSalvarMeuPerfil() {
    if (meuNome.trim().length < 3) {
      toast.error('Informe seu nome completo.');
      return;
    }
    setSalvandoMeuPerfil(true);
    try {
      const atualizado = await atualizarMeuPerfil({
        nomeCompleto: meuNome.trim(),
        email: meuEmail.trim(),
        crm: meuCrm.trim(),
        ufCrm: minhaUf,
        novaSenha: minhaNovaSenha.trim() || undefined,
      });
      atualizarUsuarioStore(atualizado);
      setMinhaNovaSenha('');
      toast.success('Seu perfil médico foi atualizado com sucesso!');
      void carregarEquipeMedica();
    } catch {
      toast.error(
        'Não foi possível atualizar seu perfil (verifique se e-mail/CRM já estão em uso).',
      );
    } finally {
      setSalvandoMeuPerfil(false);
    }
  }

  async function handleExcluirMinhaConta() {
    try {
      await deletarMeuPerfil();
      toast.success('Sua conta médica foi excluída.');
      setModalMedicos(false);
      handleLogout();
    } catch {
      toast.error(
        'Não é possível excluir a única conta médica ativa do sistema.',
      );
    }
  }

  function iniciarCriacaoMedico() {
    setMedicoEditando(null);
    setCriandoNovoMedico(true);
    setFormMedicoNome('');
    setFormMedicoEmail('');
    setFormMedicoCrm('');
    setFormMedicoUf('DF');
    setFormMedicoSenha('');
  }

  function iniciarEdicaoMedico(med: Usuario) {
    const { crm, uf } = extrairCrmEUf(med);
    setCriandoNovoMedico(false);
    setMedicoEditando(med);
    setFormMedicoNome(med.nome);
    setFormMedicoEmail(med.email);
    setFormMedicoCrm(crm);
    setFormMedicoUf(uf);
    setFormMedicoSenha('');
  }

  async function handleSalvarMedicoEquipe() {
    if (formMedicoNome.trim().length < 3) {
      toast.error('O nome do(a) doutor(a) deve ter ao menos 3 caracteres.');
      return;
    }
    setSalvandoMedicoEquipe(true);
    try {
      if (criandoNovoMedico) {
        if (formMedicoSenha.length < 8) {
          toast.error('A senha inicial deve ter no mínimo 8 caracteres.');
          setSalvandoMedicoEquipe(false);
          return;
        }
        await registrarProfissional({
          nomeCompleto: formMedicoNome.trim(),
          email: formMedicoEmail.trim(),
          crm: formMedicoCrm.trim(),
          ufCrm: formMedicoUf,
          senha: formMedicoSenha,
        });
        toast.success('Novo(a) doutor(a) cadastrado(a) com sucesso!');
      } else if (medicoEditando) {
        const atualizado = await atualizarProfissionalPorId(medicoEditando.id, {
          nomeCompleto: formMedicoNome.trim(),
          email: formMedicoEmail.trim(),
          crm: formMedicoCrm.trim(),
          ufCrm: formMedicoUf,
          novaSenha: formMedicoSenha.trim() || undefined,
        });
        if (usuario && atualizado.id === usuario.id) {
          atualizarUsuarioStore(atualizado);
        }
        toast.success('Cadastro do(a) doutor(a) atualizado!');
      }
      setCriandoNovoMedico(false);
      setMedicoEditando(null);
      await carregarEquipeMedica();
    } catch {
      toast.error(
        'Erro ao salvar médico(a). Verifique se o CRM ou e-mail já existem e se a senha contém letras e números.',
      );
    } finally {
      setSalvandoMedicoEquipe(false);
    }
  }

  async function handleExcluirMedicoDaLista(med: Usuario) {
    try {
      await deletarProfissionalPorId(med.id);
      toast.success(`Doutor(a) "${med.nome}" removido(a) com sucesso.`);
      await carregarEquipeMedica();
    } catch {
      toast.error(
        'Não foi possível excluir este médico (não é permitido excluir o último médico ou sua própria sessão ativa por esta lista).',
      );
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.wine50 }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: colors.wine700, px: { xs: 2, md: 4 } }}
      >
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            onClick={() => navigate('/dashboard')}
            sx={{ cursor: 'pointer' }}
          >
            <Avatar sx={{ bgcolor: colors.wine900 }}>
              <UserRound size={20} />
            </Avatar>
            <Box>
              <Typography fontWeight={700} lineHeight={1.2}>
                Olá, {usuario?.nome ?? 'Dr(a).'}!
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: colors.wine100, display: 'block' }}
              >
                CRM {usuario?.crm ?? '—'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              startIcon={<Stethoscope size={16} />}
              onClick={() => abrirModalMedicos(0)}
              sx={{
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.14)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.24)' },
              }}
            >
              Médicos / Meu Perfil
            </Button>

            <Button
              size="small"
              startIcon={<Sparkles size={16} />}
              onClick={() => setModalGemini(true)}
              sx={{
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.14)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.24)' },
              }}
            >
              IA Gemini
            </Button>

            <IconButton
              sx={{ color: '#fff' }}
              aria-label="Configurações"
              onClick={() => setModalGemini(true)}
            >
              <Settings size={20} />
            </IconButton>

            <IconButton
              sx={{ color: '#fff' }}
              aria-label="Sair"
              onClick={handleLogout}
            >
              <LogOut size={20} />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
        <Outlet />
      </Box>

      {/* Modal de CRUD Completo do(a) Doutor(a) e Equipe Médica */}
      <Dialog
        open={modalMedicos}
        onClose={() => setModalMedicos(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle fontWeight={700}>
          Gestão de Doutor(a) e Equipe Médica (CRUD)
        </DialogTitle>
        <DialogContent>
          <Tabs
            value={abaMedicos}
            onChange={(_e, novaAba) => {
              setAbaMedicos(novaAba);
              setMedicoEditando(null);
              setCriandoNovoMedico(false);
            }}
            sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Meu Perfil Médico" />
            <Tab label="Equipe Médica (Cadastrar / Editar / Excluir)" />
          </Tabs>

          {abaMedicos === 0 && (
            <Stack spacing={2.2} sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ fontSize: '0.84rem' }}>
                Atualize seus dados profissionais de identificação nos laudos
                ou gerencie sua conta de acesso.
              </Alert>

              <TextField
                label="Nome completo do(a) Doutor(a)"
                fullWidth
                value={meuNome}
                onChange={(e) => setMeuNome(e.target.value)}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Número do CRM"
                  fullWidth
                  value={meuCrm}
                  onChange={(e) => setMeuCrm(e.target.value)}
                />
                <TextField
                  select
                  label="UF do CRM"
                  sx={{ minWidth: 140 }}
                  value={minhaUf}
                  onChange={(e) => setMinhaUf(e.target.value)}
                >
                  {UFS_BRASIL.map((uf) => (
                    <MenuItem key={uf} value={uf}>
                      {uf}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <TextField
                label="E-mail profissional"
                type="email"
                fullWidth
                value={meuEmail}
                onChange={(e) => setMeuEmail(e.target.value)}
              />

              <TextField
                label="Nova senha (deixe em branco para manter a atual)"
                type="password"
                fullWidth
                value={minhaNovaSenha}
                onChange={(e) => setMinhaNovaSenha(e.target.value)}
              />

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ pt: 1 }}
              >
                {!confirmarExclusaoMinhaConta ? (
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<Trash2 size={16} />}
                    onClick={() => setConfirmarExclusaoMinhaConta(true)}
                  >
                    Excluir Minha Conta
                  </Button>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="error">
                      Confirmar exclusão definitiva?
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      onClick={handleExcluirMinhaConta}
                    >
                      Sim, Excluir
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setConfirmarExclusaoMinhaConta(false)}
                    >
                      Cancelar
                    </Button>
                  </Stack>
                )}

                <Button
                  variant="contained"
                  onClick={handleSalvarMeuPerfil}
                  disabled={salvandoMeuPerfil}
                >
                  {salvandoMeuPerfil
                    ? 'Salvando...'
                    : 'Salvar Meu Perfil'}
                </Button>
              </Stack>
            </Stack>
          )}

          {abaMedicos === 1 && (
            <Stack spacing={2.5}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" color="text.secondary">
                  Profissionais médicos cadastrados na plataforma ArterIA:
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={iniciarCriacaoMedico}
                >
                  Novo(a) Doutor(a)
                </Button>
              </Stack>

              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: colors.wine100 }}>
                      <TableCell sx={{ fontWeight: 700 }}>NOME</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>CRM</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>E-MAIL</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        AÇÕES
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listaMedicos.map((med) => (
                      <TableRow key={med.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {med.nome}{' '}
                          {usuario?.id === med.id && (
                            <Chip
                              size="small"
                              label="Você"
                              color="primary"
                              sx={{ ml: 0.5, height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </TableCell>
                        <TableCell>{med.crm}</TableCell>
                        <TableCell>{med.email}</TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="flex-end"
                          >
                            <Tooltip title="Editar doutor(a)">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => iniciarEdicaoMedico(med)}
                              >
                                <Pencil size={16} />
                              </IconButton>
                            </Tooltip>
                            {usuario?.id !== med.id && (
                              <Tooltip title="Excluir doutor(a)">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    handleExcluirMedicoDaLista(med)
                                  }
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!carregandoMedicos && listaMedicos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Nenhum médico encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>

              {(criandoNovoMedico || medicoEditando) && (
                <Paper
                  variant="outlined"
                  sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fdf8fa' }}
                >
                  <Typography fontWeight={700} sx={{ mb: 2 }}>
                    {criandoNovoMedico
                      ? 'Cadastrar Novo(a) Doutor(a)'
                      : `Editar Doutor(a): ${medicoEditando?.nome}`}
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Nome completo"
                      size="small"
                      fullWidth
                      value={formMedicoNome}
                      onChange={(e) => setFormMedicoNome(e.target.value)}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        label="Número do CRM (4 a 10 dígitos)"
                        size="small"
                        fullWidth
                        value={formMedicoCrm}
                        onChange={(e) => setFormMedicoCrm(e.target.value)}
                      />
                      <TextField
                        select
                        label="UF"
                        size="small"
                        sx={{ minWidth: 120 }}
                        value={formMedicoUf}
                        onChange={(e) => setFormMedicoUf(e.target.value)}
                      >
                        {UFS_BRASIL.map((uf) => (
                          <MenuItem key={uf} value={uf}>
                            {uf}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                    <TextField
                      label="E-mail profissional"
                      type="email"
                      size="small"
                      fullWidth
                      value={formMedicoEmail}
                      onChange={(e) => setFormMedicoEmail(e.target.value)}
                    />
                    <TextField
                      label={
                        criandoNovoMedico
                          ? 'Senha inicial (mínimo 8 caracteres com letras e números)'
                          : 'Nova senha (opcional — deixe em branco para manter)'
                      }
                      type="password"
                      size="small"
                      fullWidth
                      value={formMedicoSenha}
                      onChange={(e) => setFormMedicoSenha(e.target.value)}
                    />
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      <Button
                        size="small"
                        onClick={() => {
                          setCriandoNovoMedico(false);
                          setMedicoEditando(null);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleSalvarMedicoEquipe}
                        disabled={salvandoMedicoEquipe}
                      >
                        {salvandoMedicoEquipe ? 'Salvando...' : 'Salvar Médico'}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setModalMedicos(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Configuração da IA Google Gemini de Alta Acurácia */}
      <Dialog
        open={modalGemini}
        onClose={() => setModalGemini(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle fontWeight={700}>
          Motor de IA Radiológica — Google Gemini + Visão Morfométrica
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <Typography variant="body2" fontWeight={600}>
                Status Atual:
              </Typography>
              <Chip
                size="small"
                color={statusGemini?.ativo ? 'success' : 'info'}
                label={
                  statusGemini?.modoAtual ??
                  'Visão Morfométrica Top-Hat + Google Gemini 2.5 Pro'
                }
              />
            </Box>

            {statusGemini?.chaveMascarada && (
              <Typography variant="caption" color="text.secondary">
                Chave configurada:{' '}
                <strong>{statusGemini.chaveMascarada}</strong>
              </Typography>
            )}

            <Alert severity="info" sx={{ fontSize: '0.84rem' }}>
              O motor de IA do ArterIA combina{' '}
              <strong>
                Filtragem Morfológica White Top-Hat (isolamento de calcificações
                vasculares &ldquo;em trilho de trem&rdquo;, ignorando músculo
                peitoral e parênquima denso)
              </strong>{' '}
              com os modelos multimodais do Google Gemini enviando a imagem
              original + mapa vascular realçado.
              <Box sx={{ mt: 1 }}>
                Obtenha uma chave gratuita no{' '}
                <MuiLink
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  fontWeight={700}
                >
                  Google AI Studio (aistudio.google.com/apikey)
                </MuiLink>
                .
              </Box>
            </Alert>

            <Divider />

            <TextField
              select
              label="Modelo Preferencial do Google Gemini"
              fullWidth
              value={modeloInput}
              onChange={(e) => setModeloInput(e.target.value)}
            >
              <MenuItem value="gemini-2.5-pro">
                gemini-2.5-pro (Recomendado — Máxima Acurácia Radiológica)
              </MenuItem>
              <MenuItem value="gemini-2.5-flash">
                gemini-2.5-flash (Rápido — Multimodal Balanceado)
              </MenuItem>
            </TextField>

            <TextField
              label="Chave de API do Google Gemini (GEMINI_API_KEY)"
              placeholder="AIzaSy... (deixe em branco se já configurou e deseja só trocar o modelo)"
              type="password"
              fullWidth
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setModalGemini(false)}>Fechar</Button>
          <Button
            variant="contained"
            onClick={handleSalvarConfigGemini}
            disabled={salvandoKey}
          >
            {salvandoKey ? 'Salvando...' : 'Salvar Configuração da IA'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
