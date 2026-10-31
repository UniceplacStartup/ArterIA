/**
 * Página de Cadastro de Paciente + Upload Inicial de Exame (RF02 / RF07).
 *
 * Otimizada para resposta instantânea:
 * - Permite cadastrar o paciente com exame anexado (indo direto para o resultado da IA)
 *   ou sem exame inicial (indo para a página do paciente pronta para upload futuro).
 * - Atualiza o cache do React Query imediatamente antes de navegar para evitar telas de carregamento.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { TextField, Button, Stack, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
import { useChaveMedicoQuery, useCriarPaciente } from '@/hooks/usePacientes';
import { useUploadExame } from '@/hooks/useExame';
import type { Exame, Paciente } from '@/types';

export default function CadastroPaciente() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chaveMedico = useChaveMedicoQuery();
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
      dataNascimento: '1975-06-15',
      email: '',
      exame: undefined,
    },
  });

  const onSubmit = async (data: CadastroPacienteFormData) => {
    try {
      // 1. Cadastra o paciente
      const novoPaciente = await cadastrarPaciente({
        nomeCompleto: data.nomeCompleto.trim(),
        cpfId: data.cpfId.trim(),
        dataNascimento: data.dataNascimento || '1975-06-15',
        email: data.email?.trim() || undefined,
      });

      // Atualiza imediatamente a lista em cache do médico logado no React Query
      queryClient.setQueryData<Paciente[]>(
        ['pacientes', chaveMedico],
        (antigos) => {
          const lista = antigos ? [...antigos] : [];
          const semDuplicata = lista.filter((p) => p.id !== novoPaciente.id);
          return [novoPaciente, ...semDuplicata];
        },
      );

      // 2. Se o usuário anexou um exame, faz o upload e navega direto para a análise
      if (data.exame instanceof File) {
        const exameCriado = await enviarExameDicom({
          pacienteId: novoPaciente.id,
          arquivo: data.exame,
        });

        queryClient.setQueryData<Exame>(['exame', exameCriado.id], exameCriado);
        queryClient.setQueryData<Exame[]>(
          ['exames-paciente', novoPaciente.id],
          [exameCriado],
        );

        toast.success(
          'Paciente cadastrado e exame analisado com sucesso!',
        );
        navigate(`/resultado/${exameCriado.id}`);
        return;
      }

      // 3. Caso tenha cadastrado apenas os dados do paciente (sem arquivo no momento)
      const estadoPendente: Exame = {
        id: novoPaciente.id,
        pacienteId: novoPaciente.id,
        arquivoDicomUrl: '',
        status: 'PENDENTE',
        criadoEm: new Date().toISOString(),
      };
      queryClient.setQueryData<Exame>(
        ['exame', novoPaciente.id],
        estadoPendente,
      );
      queryClient.setQueryData<Exame[]>(
        ['exames-paciente', novoPaciente.id],
        [],
      );

      toast.success('Paciente cadastrado com sucesso!');
      navigate(`/resultado/${novoPaciente.id}`);
    } catch {
      toast.error(
        'Não foi possível concluir o cadastro do paciente.',
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
                      placeholder="CPF ou ID do paciente"
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

              <FieldWrapper label="E-mail (opcional)">
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      placeholder="E-mail (opcional)"
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
