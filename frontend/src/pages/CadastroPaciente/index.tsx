/**
 * Página de Cadastro de Paciente + Upload Inicial de Exame DICOM (RF02 / RF07).
 *
 * Os dados pessoais sensíveis (Nome, CPF/ID, E-mail) são enviados via canal seguro ao Backend Python,
 * onde recebem criptografia simétrica autenticada (AES/Fernet) e Blind Indexing (HMAC-SHA256)
 * antes da persistência no banco PostgreSQL (Neon).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { TextField, Button, Stack, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  cadastroPacienteSchema,
  type CadastroPacienteFormData,
} from '@/schemas/cadastroPaciente.schema';
import {
  PageWrapper,
  BrandTitle,
  BrandSubtitle,
  FormCard,
} from '@/components/AuthCard/AuthCard.styles';
import { DicomUpload } from '@/components/Upload/DicomUpload';
import { FieldWrapper } from '@/components/FieldWrapper/FieldWrapper';
import { useCriarPaciente } from '@/hooks/usePacientes';
import { useUploadExame } from '@/hooks/useExame';

export default function CadastroPaciente() {
  const navigate = useNavigate();
  const { mutateAsync: cadastrarPaciente } = useCriarPaciente();
  const { mutateAsync: enviarExameDicom } = useUploadExame();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CadastroPacienteFormData>({
    resolver: zodResolver(cadastroPacienteSchema),
    defaultValues: {
      nomeCompleto: '',
      cpfId: '',
      dataNascimento: '',
      email: '',
      exame: undefined,
    },
  });

  const onSubmit = async (data: CadastroPacienteFormData) => {
    try {
      // 1. Cadastra o paciente (dados criptografados em repouso no Neon Postgres)
      const novoPaciente = await cadastrarPaciente({
        nomeCompleto: data.nomeCompleto,
        cpfId: data.cpfId,
        dataNascimento: data.dataNascimento,
        email: data.email,
      });

      // 2. Realiza o upload do arquivo DICOM vinculado ao paciente recém-criado
      const exameCriado = await enviarExameDicom({
        pacienteId: novoPaciente.id,
        arquivo: data.exame,
      });

      toast.success(
        'Paciente cadastrado e exame enviado para análise com segurança!',
      );
      navigate(`/resultado/${exameCriado.id}`);
    } catch {
      toast.error(
        'Não foi possível concluir o cadastro do paciente ou envio do arquivo DICOM.',
      );
    }
  };

  return (
    <PageWrapper>
      <BrandTitle>
        Arter<span>IA</span>
      </BrandTitle>
      <BrandSubtitle>
        Sistema de Apoio ao Diagnóstico Radiológico por IA
      </BrandSubtitle>

      <FormCard elevation={0} sx={{ maxWidth: 560 }}>
        <Typography variant="h6" fontWeight={700} textAlign="center" mb={3}>
          Cadastrar Novo Paciente
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                columnGap: 2,
                rowGap: 2.5,
              }}
            >
              <FieldWrapper label="Nome Completo">
                <Controller
                  name="nomeCompleto"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      placeholder="Nome Completo"
                      fullWidth
                      error={!!errors.nomeCompleto}
                      helperText={errors.nomeCompleto?.message}
                    />
                  )}
                />
              </FieldWrapper>

              <FieldWrapper label="CPF/ID">
                <Controller
                  name="cpfId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      placeholder="CPF/ID (protegido por criptografia LGPD)"
                      fullWidth
                      error={!!errors.cpfId}
                      helperText={errors.cpfId?.message}
                    />
                  )}
                />
              </FieldWrapper>

              <FieldWrapper label="Data de Nascimento">
                <Controller
                  name="dataNascimento"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="date"
                      fullWidth
                      sx={{ width: '100%' }}
                      error={!!errors.dataNascimento}
                      helperText={errors.dataNascimento?.message}
                    />
                  )}
                />
              </FieldWrapper>

              <FieldWrapper label="E-mail">
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      placeholder="E-mail"
                      type="email"
                      fullWidth
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  )}
                />
              </FieldWrapper>
            </Box>

            <Controller
              name="exame"
              control={control}
              render={({ field }) => (
                <DicomUpload
                  value={field.value ?? null}
                  onChange={field.onChange}
                  error={errors.exame?.message as string | undefined}
                />
              )}
            />

            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/dashboard')}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
                sx={{
                  py: 1.3,
                  backgroundColor: '#a3226e',
                  '&:hover': { backgroundColor: '#861b5a' },
                }}
              >
                {isSubmitting ? 'Salvando...' : 'Confirmar Cadastro'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}
