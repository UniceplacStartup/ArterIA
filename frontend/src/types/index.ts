/**
 * Definições centralizadas de Tipos e Contratos de Dados do ArterIA.
 * Alinhados diretamente com os Schemas Pydantic v2 do Backend Python (FastAPI)
 * e com as diretrizes oficiais da Canadian Society of Breast Imaging (CSBI - BAC Graus 0 a 3) e BI-RADS.
 */

/** Dados públicos do médico/profissional autenticado (RF01). */
export interface Usuario {
  id: string;
  nome: string;
  crm: string;
  crmNumero?: string;
  ufCrm?: string;
  email: string;
}

/** Resposta de autenticação emitida pelo Backend (JWT Access + Refresh Token). */
export interface AuthResponse {
  usuario: Usuario;
  token: string;
  refreshToken?: string;
  tokenType?: string;
  expiresInMinutes?: number;
}

/** Estados possíveis no ciclo de vida de processamento do exame mamográfico (RE02). */
export type StatusExame =
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'FALHA_PROCESSAMENTO'
  | 'PENDENTE_LAUDO'
  | 'LAUDADO';

/** Entidade de Paciente com campos sensíveis protegidos pela política LGPD (RF07). */
export interface Paciente {
  id: string;
  codigoPublico?: string;
  nome: string;
  dataNascimento: string;
  cpfId?: string;
  email?: string;
  cpfMascarado?: string;
  emailMascarado?: string;
  ultimoExame?: string;
  ultimoExameId?: string;
  statusUltimoExame?: StatusExame;
}

/**
 * Níveis padronizados de Calcificação Arterial Mamária (CAM / BAC)
 * alinhados à escala da Canadian Society of Breast Imaging (CSBI Graus 0 a 3):
 * - AUSENTE: Grau 0
 * - LEVE: Grau 1
 * - MODERADA: Grau 2
 * - ACENTUADA: Grau 3
 */
export type NivelCalcificacao = 'AUSENTE' | 'LEVE' | 'MODERADA' | 'ACENTUADA';

/** Modos de validação clínica do médico sobre o laudo sugerido pela IA (RF04 / RA01). */
export type ModoValidacao = 'CONFIRMAR' | 'AJUSTAR' | 'INVALIDAR';

/** Estrutura do resultado analítico retornado pelo pipeline de IA (RF03 + Diretrizes CSBI & BI-RADS). */
export interface ResultadoIA {
  classificacao: NivelCalcificacao;
  localizacao: string;
  padrao: string;
  nivelConfianca: number;
  leituraTecnica: string;
  grauBac?: number;
  vasosAfetados?: number;
  idadePaciente?: number | null;
  flagAtencaoPrecoceMenos55?: boolean;
  alertaCardiovascular?: boolean;
  notaPadraoCsbi?: string | null;
  biRadsCategoria?: string;
  achadosOncologicosBiRads?: string;
  comparacaoTemporal?: string;
  resumoTecnicoMedico?: string;
  explicacaoAcolhedoraPaciente?: string;
}

/** Dados de triagem clínica e cardiovascular informados pela paciente ou equipe médica. */
export interface TriagemPacientePayload {
  nenhumSintoma: boolean;
  alteracaoTamanhoFormato: boolean;
  outrosSintomasMamarios?: string;
  historicoCardiovascular: boolean;
  detalhesRiscoCardiovascular?: string;
  checkupCardiologicoRecente: boolean;
}

/** Mensagem individual do histórico de conversa com a Assistente Virtual CSBI. */
export interface MensagemChatCsbi {
  papel: 'paciente' | 'assistente';
  texto: string;
}

/** Payload para interação com a Assistente Virtual CSBI. */
export interface AssistenteCsbiRequest {
  mensagem: string;
  triagem?: TriagemPacientePayload;
  historico: MensagemChatCsbi[];
}

/** Resposta limpa (sem asteriscos ou hashtags) da Assistente Virtual CSBI. */
export interface AssistenteCsbiResponse {
  resposta: string;
  sugerirLembreteCardiologico: boolean;
  sugerirLembreteMamografia: boolean;
  grauBac: number;
}

/** Registro completo de um exame mamográfico vinculado ao paciente (RN01 / RN07). */
export interface Exame {
  id: string;
  pacienteId: string;
  arquivoDicomUrl: string;
  status: StatusExame;
  criadoEm: string;
  resultadoIA?: ResultadoIA;
  diagnosticoFinalMedico?: string; // RF04
  modoValidacaoMedica?: ModoValidacao;
  classificacaoFinalMedica?: NivelCalcificacao;
  laudoPdfUrl?: string; // RF05
}

/** Payload enviado ao assinar um laudo médico (RF04). */
export interface AssinarLaudoPayload {
  diagnosticoFinalMedico: string;
  modoValidacao?: ModoValidacao;
  classificacaoAjustada?: NivelCalcificacao;
}

/** Registro de auditoria clínica quando o médico diverge da IA (RA01). */
export interface LogDivergencia {
  id?: string;
  examId: string;
  aiDiagnosis: string;
  doctorDiagnosis: string;
  modoValidacao?: ModoValidacao;
  changedAt: string; // UTC ISO-8601
  doctorId: string;
}
