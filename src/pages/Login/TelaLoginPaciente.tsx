import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Stack, Typography, Link as MuiLink } from '@mui/material';
import toast from 'react-hot-toast';
import {
  loginPacienteSchema,
  type LoginPacienteFormData,
} from '../../schemas/loginPaciente.schema';
import {
  PageWrapper,
  BrandTitle,
  BrandSubtitle,
  FormCard,
} from '../../components/AuthCard/AuthCard.styles';
import { FieldWrapper } from '../../components/FieldWrapper/FieldWrapper';
import { pacientesMock } from '@/mocks/pacientes.mock';

export default function TelaLoginPaciente() {
  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginPacienteFormData>({
    resolver: zodResolver(loginPacienteSchema),
    defaultValues: { identificador: '' },
  });

  const onSubmit = async (data: LoginPacienteFormData) => {
    const paciente = pacientesMock.find((p) => p.id === data.identificador.trim());

    if (!paciente) {
      toast.error('Paciente não encontrado. Confira o ID informado.');
      return;
    }

    navigate(`/resultado/${paciente.id}`);
  };

  return (
    <PageWrapper>
      <BrandTitle>
        Arter<span>IA</span>
      </BrandTitle>
      <BrandSubtitle>Sistema de Apoio ao Diagnóstico Radiológico por IA</BrandSubtitle>

      <FormCard elevation={0}>
        <Typography variant="h6" fontWeight={700} textAlign="center" mb={3}>
          Login do Paciente
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            <FieldWrapper label="CPF ou ID de Paciente">
              <Controller
                name="identificador"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    placeholder="Ex: 101"
                    fullWidth
                    error={!!errors.identificador}
                    helperText={errors.identificador?.message}
                  />
                )}
              />
            </FieldWrapper>

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
              Ver Resultado
            </Button>

            <Typography textAlign="center" fontSize="0.9rem">
              Ainda não tem cadastro?{' '}
              <MuiLink href="/cadastro-paciente" color="#a3226e" fontWeight={600}>
                Cadastre-se
              </MuiLink>
            </Typography>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}