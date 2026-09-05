import { z } from 'zod';

// RF02
const TAMANHO_MAX_TESTE_MB = 100 * 1024 * 1024;

export const EXTENSOES_ACEITAS_TESTE = ['.dcm', '.png', '.jpg', '.jpeg', '.pdf'];

export const uploadSchema = z.object({
  arquivo: z
    .instanceof(File)
    .refine(
      (f) => EXTENSOES_ACEITAS_TESTE.some((ext) => f.name.toLowerCase().endsWith(ext)),
      {
        message: `Arquivo inválido (Aceito para teste) ${EXTENSOES_ACEITAS_TESTE.join(', ')}.`,
      }
    )
    .refine((f) => f.size <= TAMANHO_MAX_TESTE_MB, {
      message: 'Arquivo excede o limite de 100 MB permitido.',
    }),
  pacienteId: z.string().min(1, 'Selecione um paciente.'),
});

export type UploadFormData = z.infer<typeof uploadSchema>;

export async function pareceDicomValido(file: File): Promise<boolean> {

  if (!file.name.toLowerCase().endsWith('.dcm')) return true;

  const header = await file.slice(128, 132).arrayBuffer();
  const magic = new TextDecoder().decode(header);
  return magic === 'DICM';
}
