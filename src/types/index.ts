
export interface Usuario {
  id: string;
  nome: string; 
  crm: string; 
  email: string;
}

// RF01
// RE02

export type StatusExame =
  | 'PENDENTE'
  | 'PROCESSANDO' 
  | 'FALHA_PROCESSAMENTO' 
  | 'PENDENTE_LAUDO' 
  | 'LAUDADO'; 

export interface Paciente {
  id: string;
  nome: string;
  dataNascimento: string; 
  ultimoExame?: string; 
  statusUltimoExame?: StatusExame;
}

// RF03
export type NivelCalcificacao = 'LEVE' | 'MODERADA' | 'ACENTUADA';

export interface ResultadoIA {
  classificacao: NivelCalcificacao;
  localizacao: string; 
  padrao: string; 
  nivelConfianca: number; 
  leituraTecnica: string;
}

export interface Exame {
  id: string;
  pacienteId: string;
  arquivoDicomUrl: string;
  status: StatusExame;
  criadoEm: string;
  resultadoIA?: ResultadoIA;
  diagnosticoFinalMedico?: string; // RF04
  laudoPdfUrl?: string; // RF05
}

// RA01
export interface LogDivergencia {
  examId: string;
  aiDiagnosis: string;
  doctorDiagnosis: string;
  changedAt: string; // UTC
  doctorId: string;
}
