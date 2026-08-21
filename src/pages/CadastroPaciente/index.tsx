import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { TextField, Button, Stack, Typography, Box } from '@mui/material';
import toast from 'react-hot-toast';
import {
  cadastroPacienteSchema,
  type CadastroPacienteFormData,
} from '../../schemas/cadastroPaciente.schema';
import {
  PageWrapper,
  BrandTitle,
  BrandSubtitle,
  FormCard,
} from '../../components/AuthCard/AuthCard.styles';
import { DicomUpload } from '../../components/Upload/DicomUpload';
import { FieldWrapper } from '../../components/FieldWrapper/FieldWrapper';

export default function CadastroPaciente() {
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
    console.log(data);
    toast.success('Paciente cadastrado com sucesso!');
  };

  return (
    <PageWrapper>
      <BrandTitle>
        Arter<span>IA</span>
      </BrandTitle>
      <BrandSubtitle>Sistema de Apoio ao Diagnóstico Radiológico por IA</BrandSubtitle>

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
                      placeholder="CPF/ID"
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

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{
                mt: 1,
                py: 1.3,
                backgroundColor: '#a3226e',
                '&:hover': { backgroundColor: '#861b5a' },
              }}
            >
              Confirmar Cadastro
            </Button>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}