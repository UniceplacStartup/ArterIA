/**
 * Painel de Resultados da Inteligência Artificial (Diretrizes CSBI Graus 0–3 & BI-RADS),
 * Comparação Temporal, Dupla Saída de Relatório (Médico vs. Paciente), Triagem Cardiovascular,
 * Integração com Agenda de Lembretes (Google Calendar / iOS .ics) e Assistente Virtual CSBI
 * (RF03, RF04, RA01).
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button,
  Select,
  MenuItem,
  Stack,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  HeartPulse,
  FileText,
  MessageCircleHeart,
  CalendarPlus,
  Copy,
  Send,
  History,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { colors } from '@/theme/theme';
import type {
  ResultadoIA,
  NivelCalcificacao,
  ModoValidacao,
  MensagemChatCsbi,
  TriagemPacientePayload,
} from '@/types';
import { useAssinarLaudo } from '@/hooks/useExame';
import { interagirAssistenteCsbi } from '@/services/exames';

const NOTA_PADRAO_CSBI_GRAU_3 =
  'Foram identificadas calcificações vasculares grosseiras severas ou em trilho de trem afetando 3 ou mais vasos nas mamas (Grau 3). Uma forte associação entre calcificações arteriais mamárias e doenças cardiovasculares foi identificada em múltiplos estudos. Considere a correlação com fatores de risco cardiovascular conforme clinicamente indicado.';

function obterGrauCsbi(resultado: ResultadoIA): number {
  if (typeof resultado.grauBac === 'number') return resultado.grauBac;
  if (resultado.classificacao === 'AUSENTE') return 0;
  if (resultado.classificacao === 'LEVE') return 1;
  if (resultado.classificacao === 'MODERADA') return 2;
  return 3;
}

function construirUrlGoogleCalendar(
  titulo: string,
  detalhes: string,
  dataIso: string,
): string {
  const dataLimpa = dataIso.replace(/-/g, '');
  const inicio = `${dataLimpa}T090000`;
  const fim = `${dataLimpa}T100000`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    details: detalhes,
    dates: `${inicio}/${fim}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function baixarArquivoIcs(
  titulo: string,
  descricao: string,
  dataIso: string,
  nomeArquivo: string,
) {
  const dataLimpa = dataIso.replace(/-/g, '');
  const conteudoIcs = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ArterIA//Saude da Mama e CSBI//PT-BR',
    'BEGIN:VEVENT',
    `DTSTART:${dataLimpa}T090000`,
    `DTEND:${dataLimpa}T100000`,
    `SUMMARY:${titulo}`,
    `DESCRIPTION:${descricao.replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([conteudoIcs], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AIResultsPanel({
  exameId,
  resultadoIA,
  diagnosticoExistente,
}: {
  exameId: string;
  resultadoIA: ResultadoIA;
  diagnosticoExistente?: string;
}) {
  const grauBac = obterGrauCsbi(resultadoIA);
  const alertaCardio =
    resultadoIA.alertaCardiovascular ??
    (grauBac === 3 || Boolean(resultadoIA.flagAtencaoPrecoceMenos55));
  const notaCsbi =
    resultadoIA.notaPadraoCsbi ??
    (grauBac === 3 ? NOTA_PADRAO_CSBI_GRAU_3 : null);

  const [modo, setModo] = useState<ModoValidacao>('CONFIRMAR');
  const [classificacaoAjustada, setClassificacaoAjustada] =
    useState<NivelCalcificacao>(resultadoIA.classificacao);
  const [diagnosticoFinal, setDiagnosticoFinal] = useState(
    diagnosticoExistente ?? '',
  );
  const { mutateAsync: assinar, isPending } = useAssinarLaudo(exameId);

  // Estados do Modal CSBI (Triagem, Relatório Duplo e Assistente Virtual)
  const [modalCsbiAberto, setModalCsbiAberto] = useState(false);
  const [abaModalCsbi, setAbaModalCsbi] = useState(0);

  // Estados da Triagem Clínica e Cardiovascular (Requisito 5)
  const [nenhumSintoma, setNenhumSintoma] = useState(true);
  const [alteracaoTamanhoFormato, setAlteracaoTamanhoFormato] = useState(false);
  const [outrosSintomas, setOutrosSintomas] = useState('');
  const [historicoCardio, setHistoricoCardio] = useState(false);
  const [detalhesCardio, setDetalhesCardio] = useState('');
  const [checkupRecente, setCheckupRecente] = useState(false);
  const [dataLembrete, setDataLembrete] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  // Estados do Chat da Assistente Virtual CSBI
  const mensagemInicialPaciente =
    resultadoIA.explicacaoAcolhedoraPaciente ||
    'Olá! Sou sua assistente virtual de saúde da mama. Quero tranquilizar você: as calcificações avaliadas na escala CSBI ocorrem nas paredes dos pequenos vasos sanguíneos da mama e são benignas do ponto de vista oncológico (BI-RADS 2), ou seja, não são câncer de mama e não viram tumor. Como posso ajudar você hoje?';

  const [historicoChat, setHistoricoChat] = useState<MensagemChatCsbi[]>([
    { papel: 'assistente', texto: mensagemInicialPaciente },
  ]);
  const [perguntaInput, setPerguntaInput] = useState('');
  const [enviandoChat, setEnviandoChat] = useState(false);

  function handleInserirNotaCsbiNoLaudo() {
    const textoInserir =
      notaCsbi ??
      resultadoIA.resumoTecnicoMedico ??
      resultadoIA.leituraTecnica;
    setDiagnosticoFinal((atual) =>
      atual.trim() ? `${atual.trim()}\n\n${textoInserir}` : textoInserir,
    );
    toast.success('Nota oficial da diretriz CSBI inserida no laudo médico!');
  }

  async function handleAssinar() {
    if (!diagnosticoFinal.trim()) {
      toast.error('Descreva o diagnóstico final antes de assinar o laudo.');
      return;
    }
    try {
      await assinar({
        diagnosticoFinalMedico: diagnosticoFinal.trim(),
        modoValidacao: modo,
        classificacaoAjustada:
          modo === 'AJUSTAR'
            ? classificacaoAjustada
            : resultadoIA.classificacao,
      });
      toast.success('Laudo assinado e salvo no histórico do paciente.');
    } catch {
      toast.error('Não foi possível assinar o laudo. Tente novamente.');
    }
  }

  async function handleEnviarMensagemAssistente(mensagemCustomizada?: string) {
    const textoEnviar = (mensagemCustomizada ?? perguntaInput).trim();
    if (!textoEnviar) return;

    const triagemPayload: TriagemPacientePayload = {
      nenhumSintoma,
      alteracaoTamanhoFormato,
      outrosSintomasMamarios: outrosSintomas.trim() || undefined,
      historicoCardiovascular: historicoCardio,
      detalhesRiscoCardiovascular: detalhesCardio.trim() || undefined,
      checkupCardiologicoRecente: checkupRecente,
    };

    const novoHistorico: MensagemChatCsbi[] = [
      ...historicoChat,
      { papel: 'paciente', texto: textoEnviar },
    ];
    setHistoricoChat(novoHistorico);
    if (!mensagemCustomizada) {
      setPerguntaInput('');
    }
    setEnviandoChat(true);

    try {
      const resp = await interagirAssistenteCsbi(exameId, {
        mensagem: textoEnviar,
        triagem: triagemPayload,
        historico: historicoChat,
      });
      setHistoricoChat([
        ...novoHistorico,
        { papel: 'assistente', texto: resp.resposta },
      ]);
    } catch {
      toast.error(
        'Não foi possível obter resposta da assistente no momento.',
      );
    } finally {
      setEnviandoChat(false);
    }
  }

  async function handleAplicarTriagemNoChat() {
    setAbaModalCsbi(2);
    await handleEnviarMensagemAssistente(
      'Acabei de preencher minha triagem clínica e cardiovascular. Como esses dados se relacionam com o meu resultado de mamografia?',
    );
  }

  function copiarTexto(texto: string, rotulo: string) {
    navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado para a área de transferência!`);
  }

  return (
    <Stack spacing={2.2} sx={{ width: 380 }}>
      <Box>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <Typography fontWeight={700}>
            Resultados da IA (CSBI &amp; BI-RADS)
          </Typography>
          <Chip
            size="small"
            color={
              grauBac === 3
                ? 'error'
                : grauBac === 2
                  ? 'warning'
                  : 'success'
            }
            label={`CSBI Grau ${grauBac}`}
            sx={{ fontWeight: 700 }}
          />
        </Stack>

        <Paper
          sx={{
            bgcolor: colors.wine700,
            color: '#fff',
            p: 2,
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
            Escala CSBI (BAC): Grau {grauBac} ({resultadoIA.classificacao})
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Vasos Afetados:{' '}
            {grauBac === 0
              ? 'Nenhum vaso calcificado'
              : grauBac === 3
                ? '3 ou mais vasos'
                : `${resultadoIA.vasosAfetados ?? grauBac} vaso(s) (< 3 vasos)`}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Localização: {resultadoIA.localizacao}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Padrão: {resultadoIA.padrao}
          </Typography>
          {resultadoIA.idadePaciente !== undefined &&
            resultadoIA.idadePaciente !== null && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Idade da Paciente: {resultadoIA.idadePaciente} anos
                {resultadoIA.flagAtencaoPrecoceMenos55
                  ? ' (Atenção Precoce < 55 anos)'
                  : ''}
              </Typography>
            )}
          <Typography variant="body2">
            Nível de Confiança: {resultadoIA.nivelConfianca}%
          </Typography>
        </Paper>

        {/* Alerta Cardiovascular CSBI (Grau 3 ou Grau 1/2 < 55 anos) */}
        {alertaCardio && (
          <Alert
            severity={grauBac === 3 ? 'error' : 'warning'}
            icon={<HeartPulse size={20} />}
            sx={{ mt: 1.5, borderRadius: 2, fontSize: '0.8rem' }}
          >
            <Typography variant="caption" fontWeight={700} display="block">
              {grauBac === 3
                ? 'GATILHO CARDIOVASCULAR OBRIGATÓRIO (CSBI GRAU 3)'
                : 'FLAG DE ATENÇÃO CARDIOVASCULAR PRECOCE (< 55 ANOS)'}
            </Typography>
            {notaCsbi}
          </Alert>
        )}

        {/* Diferenciação Estrita BI-RADS (Oncológico) vs. BAC (Cardiovascular) */}
        <Paper
          variant="outlined"
          sx={{ p: 1.5, mt: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <ShieldCheck size={16} color={colors.wine700} />
            <Typography variant="caption" fontWeight={700} color="primary">
              {resultadoIA.biRadsCategoria ??
                'BI-RADS 2 (Achado Vascular Benigno)'}
            </Typography>
          </Stack>
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            {resultadoIA.achadosOncologicosBiRads ??
              'Calcificações arteriais mamárias (BAC) são benignas do ponto de vista oncológico (BI-RADS 2) e distintas de microcalcificações ductais suspeitas.'}
          </Typography>
        </Paper>

        {/* Comparação Temporal Automática (CAR/CSBI) */}
        {resultadoIA.comparacaoTemporal && (
          <Paper
            variant="outlined"
            sx={{ p: 1.2, mt: 1.2, borderRadius: 2, bgcolor: '#fff' }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <History size={15} color={colors.wine700} />
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
              >
                COMPARAÇÃO TEMPORAL AUTOMÁTICA (CSBI)
              </Typography>
            </Stack>
            <Typography variant="caption" display="block" sx={{ mt: 0.4 }}>
              {resultadoIA.comparacaoTemporal}
            </Typography>
          </Paper>
        )}

        {/* Leitura Técnica Radiológica */}
        <Paper variant="outlined" sx={{ p: 1.5, mt: 1.2, borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            LEITURA TÉCNICA (APOIO À DECISÃO CLÍNICA - RN08)
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.84rem' }}>
            {resultadoIA.leituraTecnica}
          </Typography>
        </Paper>

        {/* Botões Rápidos CSBI: Inserir Nota Oficial no Laudo + Abrir Triagem/Relatório Duplo/Chat */}
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileText size={16} />}
            onClick={handleInserirNotaCsbiNoLaudo}
          >
            Inserir Nota Oficial CSBI no Laudo
          </Button>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<MessageCircleHeart size={16} />}
            onClick={() => setModalCsbiAberto(true)}
            sx={{ bgcolor: colors.wine900 }}
          >
            Triagem, Relatório Duplo &amp; Assistente CSBI
          </Button>
        </Stack>
      </Box>

      <RadioGroup
        value={modo}
        onChange={(e) => setModo(e.target.value as ModoValidacao)}
      >
        <FormControlLabel
          value="CONFIRMAR"
          control={<Radio size="small" />}
          label="Confirmar resposta (CSBI)"
        />
        <FormControlLabel
          value="AJUSTAR"
          control={<Radio size="small" />}
          label={
            modo === 'AJUSTAR' ? (
              <Select
                size="small"
                value={classificacaoAjustada}
                onChange={(e) =>
                  setClassificacaoAjustada(
                    e.target.value as NivelCalcificacao,
                  )
                }
                onClick={(e) => e.stopPropagation()}
              >
                <MenuItem value="AUSENTE">Grau 0 — Ausente</MenuItem>
                <MenuItem value="LEVE">Grau 1 — Leve (Puntiforme)</MenuItem>
                <MenuItem value="MODERADA">
                  Grau 2 — Moderada (&lt; 3 vasos)
                </MenuItem>
                <MenuItem value="ACENTUADA">
                  Grau 3 — Acentuada (&ge; 3 vasos)
                </MenuItem>
              </Select>
            ) : (
              'Ajustar classificação (Graus 0 a 3)'
            )
          }
        />
        <FormControlLabel
          value="INVALIDAR"
          control={<Radio size="small" />}
          label="Invalidar"
        />
      </RadioGroup>

      <Box>
        <Typography fontWeight={700} sx={{ mb: 1 }}>
          Diagnóstico Final do Médico
        </Typography>
        <TextField
          multiline
          minRows={4}
          fullWidth
          placeholder="Digite seu parecer clínico final ou clique em 'Inserir Nota Oficial CSBI no Laudo'..."
          value={diagnosticoFinal}
          onChange={(e) => setDiagnosticoFinal(e.target.value)}
          sx={{ bgcolor: colors.wine50 }}
        />
      </Box>

      <Button
        variant="contained"
        size="large"
        onClick={handleAssinar}
        disabled={isPending}
      >
        {isPending ? 'Assinando...' : 'Assinar Laudo'}
      </Button>

      {/* Modal Completo CSBI: Triagem +Agenda, Dupla Saída de Relatório (Médico vs Paciente) e Chat Assistente */}
      <Dialog
        open={modalCsbiAberto}
        onClose={() => setModalCsbiAberto(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle fontWeight={700}>
          Diretriz CSBI — Rastreamento Duplo (Oncológico BI-RADS &amp;
          Cardiovascular BAC)
        </DialogTitle>
        <DialogContent>
          <Tabs
            value={abaModalCsbi}
            onChange={(_e, nova) => setAbaModalCsbi(nova)}
            sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="1. Triagem & Agenda de Lembretes" />
            <Tab label="2. Dupla Saída (Médico vs. Paciente)" />
            <Tab label="3. Assistente Virtual da Paciente (Chat)" />
          </Tabs>

          {/* ABA 0: TRIAGEM CLÍNICA & CARDIOVASCULAR + LEMBRETES GOOGLE CALENDAR / iOS */}
          {abaModalCsbi === 0 && (
            <Stack spacing={2.2}>
              <Alert severity="info" sx={{ fontSize: '0.84rem' }}>
                Cruze os achados mamográficos (CSBI Grau {grauBac}) com os
                sintomas mamários e o histórico cardiovascular da paciente para
                gerar orientações e lembretes preventivos.
              </Alert>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} variant="subtitle2" sx={{ mb: 1 }}>
                  Sintomas Mamários (Triagem)
                </Typography>
                <Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={nenhumSintoma}
                        onChange={(e) => {
                          setNenhumSintoma(e.target.checked);
                          if (e.target.checked) {
                            setAlteracaoTamanhoFormato(false);
                            setOutrosSintomas('');
                          }
                        }}
                      />
                    }
                    label="Nenhum sintoma mamário (assintomática para rastreamento)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={alteracaoTamanhoFormato}
                        onChange={(e) => {
                          setAlteracaoTamanhoFormato(e.target.checked);
                          if (e.target.checked) setNenhumSintoma(false);
                        }}
                      />
                    }
                    label="Alterações recentes no tamanho ou formato da mama"
                  />
                  <TextField
                    size="small"
                    label="Outros sintomas mamários (opcional: nódulo palpável, dor, descarga papilar)"
                    fullWidth
                    value={outrosSintomas}
                    onChange={(e) => {
                      setOutrosSintomas(e.target.value);
                      if (e.target.value.trim()) setNenhumSintoma(false);
                    }}
                    sx={{ mt: 1 }}
                  />
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} variant="subtitle2" sx={{ mb: 1 }}>
                  Histórico e Fatores de Risco Cardiovascular (Correlação CSBI)
                </Typography>
                <Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={historicoCardio}
                        onChange={(e) => setHistoricoCardio(e.target.checked)}
                      />
                    }
                    label="Histórico de hipertensão arterial, diabetes, colesterol elevado (dislipidemia) ou tabagismo"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checkupRecente}
                        onChange={(e) => setCheckupRecente(e.target.checked)}
                      />
                    }
                    label="Realizou check-up cardiológico nos últimos 12 meses"
                  />
                  {historicoCardio && (
                    <TextField
                      size="small"
                      label="Detalhes dos fatores cardiovasculares (opcional)"
                      fullWidth
                      value={detalhesCardio}
                      onChange={(e) => setDetalhesCardio(e.target.value)}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Stack>
              </Paper>

              <Paper
                variant="outlined"
                sx={{ p: 2, borderRadius: 2, bgcolor: '#fdf8fa' }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography fontWeight={700} variant="subtitle2">
                      Agenda de Lembretes Integrada (Google Calendar / iOS .ics)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alertaCardio || historicoCardio
                        ? 'Recomendado agendar Avaliação Cardiológica Preventiva (CSBI) + Retorno Mamográfico.'
                        : 'Configure lembrete para o retorno mastológico/mamografia anual e check-up.'}
                    </Typography>
                  </Box>
                  <TextField
                    type="date"
                    size="small"
                    label="Data sugerida"
                    InputLabelProps={{ shrink: true }}
                    value={dataLembrete}
                    onChange={(e) => setDataLembrete(e.target.value)}
                  />
                </Stack>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ mt: 2 }}
                >
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<CalendarPlus size={16} />}
                    component="a"
                    href={construirUrlGoogleCalendar(
                      'Consulta de Avaliação Cardiológica Preventiva (Diretriz CSBI)',
                      `Avaliação preventiva cardiovascular recomendada pelo rastreamento mamográfico ArterIA (CSBI Grau ${grauBac}). Levar laudo da mamografia ao cardiologista.`,
                      dataLembrete,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Calendar: Avaliação Cardiológica
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CalendarPlus size={16} />}
                    onClick={() =>
                      baixarArquivoIcs(
                        'Avaliação Cardiológica Preventiva e Retorno Mamográfico (ArterIA CSBI)',
                        `Lembrete de cuidado duplo da saúde da mulher (Diretriz CSBI Grau ${grauBac}): avaliação cardiológica preventiva e acompanhamento mamográfico.`,
                        dataLembrete,
                        'lembrete-arteria-csbi.ics',
                      )
                    }
                  >
                    Baixar Lembrete iOS / Outlook (.ics)
                  </Button>
                </Stack>
              </Paper>

              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={<MessageCircleHeart size={16} />}
                  onClick={handleAplicarTriagemNoChat}
                >
                  Integrar Triagem e Conversar com a Assistente Virtual
                </Button>
              </Box>
            </Stack>
          )}

          {/* ABA 1: DUPLA SAÍDA DE RELATÓRIO (MÉDICO ASSISTENTE vs. PACIENTE) */}
          {abaModalCsbi === 1 && (
            <Stack spacing={2.5}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography fontWeight={700} variant="subtitle2">
                    1. Resumo Técnico para Levar ao Médico (Script Oficial CSBI
                    + BI-RADS)
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<Copy size={15} />}
                    onClick={() =>
                      copiarTexto(
                        resultadoIA.resumoTecnicoMedico ||
                          resultadoIA.leituraTecnica,
                        'Resumo técnico médico',
                      )
                    }
                  >
                    Copiar Resumo Médico
                  </Button>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-line',
                    bgcolor: '#f8fafc',
                    p: 1.5,
                    borderRadius: 1.5,
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                  }}
                >
                  {resultadoIA.resumoTecnicoMedico ||
                    resultadoIA.leituraTecnica}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography fontWeight={700} variant="subtitle2">
                    2. Explicação Acolhedora e Educativa para a Paciente (Sem
                    termos alarmistas)
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<Copy size={15} />}
                    onClick={() =>
                      copiarTexto(
                        mensagemInicialPaciente,
                        'Explicação para a paciente',
                      )
                    }
                  >
                    Copiar Texto da Paciente
                  </Button>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-line',
                    bgcolor: '#fdf8fa',
                    p: 1.5,
                    borderRadius: 1.5,
                    lineHeight: 1.65,
                  }}
                >
                  {mensagemInicialPaciente}
                </Typography>
              </Paper>
            </Stack>
          )}

          {/* ABA 2: ASSISTENTE VIRTUAL DA PACIENTE (CHAT CSBI & BI-RADS) */}
          {abaModalCsbi === 2 && (
            <Stack spacing={2}>
              <Alert severity="success" sx={{ fontSize: '0.82rem' }}>
                Assistente configurada com o System Prompt oficial CSBI/BI-RADS:
                linguagem acolhedora, zero asteriscos ou hashtags, proteção
                total de privacidade (sem PII) e esclarecimento de que
                calcificação arterial mamária não é câncer de mama.
              </Alert>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  height: 320,
                  overflowY: 'auto',
                  borderRadius: 2,
                  bgcolor: '#fcfcfd',
                }}
              >
                <Stack spacing={1.8}>
                  {historicoChat.map((msg, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        alignSelf:
                          msg.papel === 'paciente' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        bgcolor:
                          msg.papel === 'paciente' ? colors.wine700 : '#f1f5f9',
                        color: msg.papel === 'paciente' ? '#fff' : '#1e293b',
                        p: 1.5,
                        borderRadius: 2,
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={700}
                         sx={{ display: 'block', mb: 0.4, opacity: 0.8 }}
                      >
                        {msg.papel === 'paciente'
                          ? 'Paciente / Médica(o)'
                          : 'Assistente Virtual ArterIA (CSBI)'}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}
                      >
                        {msg.texto}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>

              <Divider />

              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Tire uma dúvida sobre Calcificação Arterial Mamária (BAC), BI-RADS ou saúde do coração..."
                  value={perguntaInput}
                  onChange={(e) => setPerguntaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleEnviarMensagemAssistente();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  endIcon={<Send size={15} />}
                  onClick={() => void handleEnviarMensagemAssistente()}
                  disabled={enviandoChat}
                >
                  {enviandoChat ? '...' : 'Enviar'}
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalCsbiAberto(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
