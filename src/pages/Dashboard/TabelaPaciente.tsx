import { Table, TableHead, TableBody, TableRow, TableCell, Paper, TableContainer } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { StatusBadge } from '@/components/StatusBadge/StatusBadge';
import { colors } from '@/theme/theme';
import type { Paciente } from '@/types';

export function PatientTable({ pacientes }: { pacientes: Paciente[] }) {
  const navigate = useNavigate();

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: colors.wine100 }}>
            <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>NOME</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>ÚLTIMO EXAME</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pacientes.map((paciente) => (
            <TableRow
              key={paciente.id}
              hover
              sx={{ cursor: 'pointer' }}
              // RF03/RF04
              onClick={() => navigate(`/resultado/${paciente.id}`)}
            >
              <TableCell>{paciente.id}</TableCell>
              <TableCell sx={{ fontWeight: 500 }}>{paciente.nome}</TableCell>
              <TableCell>
                {paciente.ultimoExame ? dayjs(paciente.ultimoExame).format('DD/MM/YYYY') : '—'}
              </TableCell>
              <TableCell>
                {paciente.statusUltimoExame ? (
                  <StatusBadge status={paciente.statusUltimoExame} />
                ) : (
                  '—'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
