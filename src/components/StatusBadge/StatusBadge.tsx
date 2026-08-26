import { Chip } from '@mui/material';
import { colors } from '@/theme/theme';
import type { StatusExame } from '@/types';

const CONFIG: Record<StatusExame, { label: string; bg: string; fg: string }> = {
  PENDENTE: { label: 'PENDENTE', bg: colors.statusPendente, fg: '#fff' },
  PROCESSANDO: { label: 'PROCESSANDO', bg: colors.statusProcessando, fg: '#fff' },
  FALHA_PROCESSAMENTO: { label: 'FALHA NO PROCESSAMENTO', bg: colors.statusFalha, fg: '#fff' },
  PENDENTE_LAUDO: { label: 'PENDENTE', bg: colors.statusPendente, fg: '#fff' },
  LAUDADO: { label: 'LAUDADO', bg: colors.statusLaudado, fg: '#fff' },
};

export function StatusBadge({ status }: { status: StatusExame }) {
  const { label, bg, fg } = CONFIG[status];
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: bg,
        color: fg,
        fontSize: '0.7rem',
        // RE02/RNF04
        border: status === 'FALHA_PROCESSAMENTO' ? `2px solid ${colors.alertBorder}` : 'none',
      }}
    />
  );
}
