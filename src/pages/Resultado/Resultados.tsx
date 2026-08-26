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
} from '@mui/material';
import toast from 'react-hot-toast';
import { colors } from '@/theme/theme';
import type { ResultadoIA, NivelCalcificacao } from '@/types';
import { useAssinarLaudo } from '@/hooks/useExame';

type ModoValidacao = 'CONFIRMAR' | 'AJUSTAR' | 'INVALIDAR';

// RF03
export function AIResultsPanel({ exameId, resultadoIA }: { exameId: string; resultadoIA: ResultadoIA }) {
  const [modo, setModo] = useState<ModoValidacao>('CONFIRMAR');
  const [classificacaoAjustada, setClassificacaoAjustada] = useState<NivelCalcificacao>(
    resultadoIA.classificacao,
  );
  const [diagnosticoFinal, setDiagnosticoFinal] = useState('');
  const { mutateAsync: assinar, isPending } = useAssinarLaudo(exameId);

  async function handleAssinar() {
    // RF04
    if (!diagnosticoFinal.trim()) {
      toast.error('Descreva o diagnóstico final antes de assinar o laudo.');
      return;
    }
    try {
      await assinar(diagnosticoFinal);
      toast.success('Laudo assinado e salvo no histórico do paciente.');
    } catch {
      toast.error('Não foi possível assinar o laudo. Tente novamente.');
    }
  }

  return (
    <Stack spacing={3} sx={{ width: 340 }}>
      <Box>
        <Typography fontWeight={700} sx={{ mb: 1 }}>
          Resultados da IA
        </Typography>
        <Paper
          sx={{
            bgcolor: colors.wine700,
            color: '#fff',
            p: 2,
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Calcificação Arterial Mamária (CAM): {resultadoIA.classificacao}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Localização: {resultadoIA.localizacao}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Padrão: {resultadoIA.padrao}
          </Typography>
          <Typography variant="body2">Nível de Confiança: {resultadoIA.nivelConfianca}%</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            LEITURA TÉCNICA
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {resultadoIA.leituraTecnica}
          </Typography>
        </Paper>
      </Box>

      <RadioGroup value={modo} onChange={(e) => setModo(e.target.value as ModoValidacao)}>
        <FormControlLabel value="CONFIRMAR" control={<Radio />} label="Confirmar resposta" />
        <FormControlLabel
          value="AJUSTAR"
          control={<Radio />}
          label={
            modo === 'AJUSTAR' ? (
              <Select
                size="small"
                value={classificacaoAjustada}
                onChange={(e) => setClassificacaoAjustada(e.target.value as NivelCalcificacao)}
                onClick={(e) => e.stopPropagation()}
              >
                <MenuItem value="LEVE">Leve</MenuItem>
                <MenuItem value="MODERADA">Moderada</MenuItem>
                <MenuItem value="ACENTUADA">Acentuada</MenuItem>
              </Select>
            ) : (
              'Ajustar classificação'
            )
          }
        />
        <FormControlLabel value="INVALIDAR" control={<Radio />} label="Invalidar" />
      </RadioGroup>

      <Box>
        <Typography fontWeight={700} sx={{ mb: 1 }}>
          Diagnóstico Final do Médico
        </Typography>
        <TextField
          multiline
          minRows={4}
          fullWidth
          placeholder="Digite..."
          value={diagnosticoFinal}
          onChange={(e) => setDiagnosticoFinal(e.target.value)}
          sx={{ bgcolor: colors.wine50 }}
        />
      </Box>

      <Button variant="contained" size="large" onClick={handleAssinar} disabled={isPending}>
        {isPending ? 'Assinando...' : 'Assinar Laudo'}
      </Button>
    </Stack>
  );
}
