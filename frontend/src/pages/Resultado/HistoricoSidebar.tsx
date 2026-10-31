/**
 * Barra Lateral de Histórico Cronológico de Exames do Paciente.
 * Permite navegar entre imagens/exames enviados, filtrar por data/status,
 * fazer upload de novo exame e excluir um exame enviado por engano.
 */

import { useState } from 'react';
import {
  Box,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Button,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Search, Upload, Trash2 } from 'lucide-react';
import { colors } from '@/theme/theme';
import dayjs from 'dayjs';
import type { Exame } from '@/types';

interface Props {
  exames: Exame[];
  exameSelecionadoId: string;
  onSelecionar: (id: string) => void;
  onNovoUpload: () => void;
  onDeletarExame?: (exame: Exame) => void;
}

export function HistoricoSidebar({
  exames,
  exameSelecionadoId,
  onSelecionar,
  onNovoUpload,
  onDeletarExame,
}: Props) {
  const [filtro, setFiltro] = useState('');

  const examesFiltrados = exames.filter((ex) => {
    const dataFormatada = dayjs(ex.criadoEm).format('DD/MM/YYYY');
    return (
      dataFormatada.includes(filtro) ||
      ex.status.toLowerCase().includes(filtro.toLowerCase())
    );
  });

  return (
    <Box
      sx={{
        width: 270,
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
        placeholder="Pesquisar exame..."
        size="small"
        fullWidth
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
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
        {examesFiltrados.map((exame) => (
          <ListItemButton
            key={exame.id}
            selected={exame.id === exameSelecionadoId}
            onClick={() => onSelecionar(exame.id)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              '&.Mui-selected': { bgcolor: colors.wine900 },
            }}
          >
            <ListItemText
              primary={dayjs(exame.criadoEm).format('DD/MM/YYYY HH:mm')}
              secondary={exame.status}
              secondaryTypographyProps={{
                sx: { color: colors.wine100, fontSize: '0.75rem' },
              }}
            />

            {onDeletarExame && exames.length > 0 && exame.status !== 'PENDENTE' && (
              <Tooltip title="Excluir esta imagem/exame">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletarExame(exame);
                  }}
                  sx={{
                    color: 'rgba(255,255,255,0.75)',
                    '&:hover': {
                      color: '#ff8a80',
                      bgcolor: 'rgba(255,255,255,0.12)',
                    },
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </Tooltip>
            )}
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
