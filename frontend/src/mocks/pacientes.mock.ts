import type { Paciente } from '@/types';


export const pacientesMock: Paciente[] = [
  {
    id: '101',
    nome: 'Adriana Silva',
    dataNascimento: '1975-04-12',
    ultimoExame: '2026-06-03',
    statusUltimoExame: 'LAUDADO',
  },
  {
    id: '102',
    nome: 'Luís Felipe',
    dataNascimento: '1968-11-02',
    ultimoExame: '2026-05-02',
    statusUltimoExame: 'PROCESSANDO',
  },
  {
    id: '103',
    nome: 'André de Souza',
    dataNascimento: '1980-01-20',
    ultimoExame: '2026-04-27',
    statusUltimoExame: 'FALHA_PROCESSAMENTO',
  },
  {
    id: '104',
    nome: 'Marina Gomes',
    dataNascimento: '1990-07-15',
    ultimoExame: '2026-03-22',
    statusUltimoExame: 'PENDENTE',
  },
  {
    id: '105',
    nome: 'Julia Gabriela',
    dataNascimento: '1985-09-30',
    ultimoExame: '2026-03-10',
    statusUltimoExame: 'PENDENTE',
  },
];
