import { z } from 'zod';

// RF02
const CEM_MB = 100 * 1024 * 1024;

export const uploadSchema = z.object({
  arquivo: z
    .instanceof(File)
    .refine((f) => f.name.toLowerCase().endsWith('.dcm'), {
      message: 'Arquivo inválido. Apenas arquivos DICOM (.dcm) são aceitos.',
    })
    .refine((f) => f.size <= CEM_MB, {
      message: 'Arquivo excede o limite de 100 MB permitido por exame.',
    }),
  pacienteId: z.string().min(1, 'Selecione um paciente.'),
});

export type UploadFormData = z.infer<typeof uploadSchema>;

export async function pareceDicomValido(file: File): Promise<boolean> {
  const header = await file.slice(128, 132).arrayBuffer();
  const magic = new TextDecoder().decode(header);
  return magic === 'DICM';
}
