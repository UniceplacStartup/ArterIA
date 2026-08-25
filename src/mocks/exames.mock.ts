import type { Exame } from '@/types';


export const examesMock: Record<string, Exame> = {

  '101': {
    id: '101',
    pacienteId: '101',
    arquivoDicomUrl: 'mock:cranio',
    status: 'LAUDADO',
    criadoEm: '2026-06-03T10:00:00Z',
    resultadoIA: {
      classificacao: 'MODERADA',
      localizacao: 'Quadrante Superior Externo',
      padrao: 'Linear',
      nivelConfianca: 92,
      leituraTecnica:
        'Identificada calcificação vascular de padrão linear em topografia de artéria mamária, quadrante superior externo, compatível com calcificação arterial mamária de grau moderado.',   
    }, diagnosticoFinalMedico:
      'Confirmado achado de calcificação arterial mamária moderada, padrão linear, quadrante superior externo. Recomendo acompanhamento cardiovascular de rotina.',
    laudoPdfUrl: 'mock:laudo-101.pdf',
  },
  
  '102': {
    id: '102',
    pacienteId: '102',
    arquivoDicomUrl: 'mock:cranio',
    status: 'PROCESSANDO',
    criadoEm: '2026-05-02T09:00:00Z',
  },
 
  '103': {
    id: '103',
    pacienteId: '103',
    arquivoDicomUrl: 'mock:cranio',
    status: 'FALHA_PROCESSAMENTO',
    criadoEm: '2026-04-27T09:00:00Z',
  },
 
  '104': {
    id: '104',
    pacienteId: '104',
    arquivoDicomUrl: '',
    status: 'PENDENTE',
    criadoEm: '2026-03-22T09:00:00Z',
  },
  '105': {
    id: '105',
    pacienteId: '105',
    arquivoDicomUrl: '',
    status: 'PENDENTE',
    criadoEm: '2026-03-10T09:00:00Z',
  },
  }
