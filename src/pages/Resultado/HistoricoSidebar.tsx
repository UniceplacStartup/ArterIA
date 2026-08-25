import { Box, TextField, List, ListItemButton, ListItemText, Button, InputAdornment} from '@mui/material';
import { Search, Upload } from 'lucide-react';
import { colors } from '@/theme/theme';
import dayjs from 'dayjs';
import type { Exame } from '@/types';

interface Props {
  exames: Exame[];
  exameSelecionadoId: string;
  onSelecionar: (id: string) => void;
  onNovoUpload: () => void;
}

export function HistoricoSidebar({ exames, exameSelecionadoId, onSelecionar, onNovoUpload }: Props) {
  return (
    <Box
      sx={{
        width: 260,
        bgcolor: colors.wine700,
        color: '#fff',
        borderRadius: 3,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <TextField
        placeholder="Pesquisar..."
        size="small"
        fullWidth
        sx={{
          bgcolor: '#fff',
          borderRadius: 1,
          '& .MuiOutlinedInput-root': { borderRadius: 1 },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} />
            </InputAdornment>
          ),
        }}
      />

      <List sx={{ flex: 1, overflowY: 'auto' }}>
        {exames.map((exame) => (
          <ListItemButton
            key={exame.id}
            selected={exame.id === exameSelecionadoId}
            onClick={() => onSelecionar(exame.id)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              '&.Mui-selected': { bgcolor: colors.wine900 },
            }}
          >
            <ListItemText
              primary={dayjs(exame.criadoEm).format('DD/MM/YYYY')}
              secondary={exame.status}
              secondaryTypographyProps={{ sx: { color: colors.wine100 } }}
            />
          </ListItemButton>
        ))}
      </List>

      <Button
        variant="contained"
        startIcon={<Upload size={16} />}
        onClick={onNovoUpload}
        sx={{ bgcolor: colors.wine900, '&:hover': { bgcolor: colors.wine900 } }}
      >
        Upload de novo exame
      </Button>
    </Box>
  );
}
