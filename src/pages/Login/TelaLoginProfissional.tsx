import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Stack, Typography, Link as MuiLink } from '@mui/material';
import {
  loginProfissionalSchema,
  type LoginProfissionalFormData,
} from '../../schemas/loginProfissional.schema';
import {
  PageWrapper,
  BrandTitle,
  BrandSubtitle,
  FormCard,
} from '../../components/AuthCard/AuthCard.styles';
import { FieldWrapper } from '../../components/FieldWrapper/FieldWrapper';
import { useAuthStore } from '@/stores/authStore';

export default function TelaLoginProfissional() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginProfissionalFormData>({
    resolver: zodResolver(loginProfissionalSchema),
    defaultValues: { email: '', senha: '' },
  });

  const onSubmit = async (data: LoginProfissionalFormData) => {
    // Login mockado — ainda não existe backend de autenticação.
    login(
      {
        id: 'mock-medico',
        nome: `Dr(a). ${data.email.split('@')[0]}`,
        crm: '00000-DF',
        email: data.email,
      },
      'mock-token',
    );
    navigate('/dashboard');
  };

  return (
    <PageWrapper>
      <BrandTitle>
        Arter<span>IA</span>
      </BrandTitle>
      <BrandSubtitle>Sistema de Apoio ao Diagnóstico Radiológico por IA</BrandSubtitle>

      <FormCard elevation={0}>
        <Typography variant="h6" fontWeight={700} textAlign="center" mb={3}>
          Login do Profissional
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
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

            <FieldWrapper label="Senha">
              <Controller
                name="senha"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    placeholder="Senha"
                    type="password"
                    fullWidth
                    error={!!errors.senha}
                    helperText={errors.senha?.message}
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
              Entrar
            </Button>

            <Typography textAlign="center" fontSize="0.9rem">
              Ainda não tem conta?{' '}
              <MuiLink href="/cadastro-profissional" color="#a3226e" fontWeight={600}>
                Cadastre-se
              </MuiLink>
            </Typography>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}