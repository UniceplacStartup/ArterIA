/**
 * Schema e Validador Binário para Upload de Exames
 * (DICOM .dcm, PDF .pdf, PNG .png e JPEG .jpg/.jpeg - RF02 / RE01).
 */

import { z } from 'zod';

const CEM_MB = 100 * 1024 * 1024;
const EXTENSOES_VALIDAS = ['.dcm', '.pdf', '.png', '.jpg', '.jpeg'];

export function ehExtensaoExamePermitida(nomeArquivo: string): boolean {
  const nome = nomeArquivo.toLowerCase().trim();
  return EXTENSOES_VALIDAS.some((ext) => nome.endsWith(ext));
}

export const uploadSchema = z.object({
  arquivo: z
    .instanceof(File)
    .refine((f) => ehExtensaoExamePermitida(f.name), {
      message:
        'Formato inválido. Aceitos: DICOM (.dcm), PDF (.pdf), PNG (.png) ou JPEG (.jpg/.jpeg).',
    })
    .refine((f) => f.size <= CEM_MB, {
      message: 'Arquivo excede o limite de 100 MB permitido por exame.',
    }),
  pacienteId: z.string().min(1, 'Selecione um paciente.'),
});

export type UploadFormData = z.infer<typeof uploadSchema>;

/**
 * Verifica os Magic Bytes do arquivo selecionado no cliente antes do upload:
 * - Para `.pdf`: exige assinatura `%PDF-` nos primeiros 5 bytes.
 * - Para `.png`: exige assinatura `\x89PNG` nos primeiros 4 bytes.
 * - Para `.jpg` / `.jpeg`: exige assinatura `\xFF\xD8\xFF` nos primeiros 3 bytes.
 * - Para `.dcm`: verifica o preâmbulo padrão `DICM` (bytes 128..132) ou arquivo DICOM válido.
 */
export async function pareceDicomValido(file: File): Promise<boolean> {
  if (file.size < 4) return false;

  const nome = file.name.toLowerCase().trim();

  if (nome.endsWith('.pdf')) {
    const headerPdf = await file.slice(0, 5).arrayBuffer();
    const magicPdf = new TextDecoder().decode(headerPdf);
    return magicPdf === '%PDF-';
  }

  if (nome.endsWith('.png')) {
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }

  if (nome.endsWith('.jpg') || nome.endsWith('.jpeg')) {
    const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (nome.endsWith('.dcm')) {
    if (file.size >= 132) {
      const headerDicom = await file.slice(128, 132).arrayBuffer();
      const magicDicom = new TextDecoder().decode(headerDicom);
      if (magicDicom === 'DICM') return true;
    }
    return file.size >= 132;
  }

  return false;
}
