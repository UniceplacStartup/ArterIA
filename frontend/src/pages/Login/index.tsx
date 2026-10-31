/**
 * Página de Autenticação (Login) do Profissional de Saúde (RF01).
 * Integra com o endpoint `/api/auth/login` do Backend Python e armazena a sessão JWT.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import {
  TextField,
  Button,
  Stack,
  Typography,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginSchema, type LoginFormData } from '@/schemas/login.schema';
import {
  PageWrapper,
  BrandTitle,
  BrandSubtitle,
  FormCard,
} from '@/components/AuthCard/AuthCard.styles';
import { FieldWrapper } from '@/components/FieldWrapper/FieldWrapper';
import { autenticarProfissional } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

export default function Login() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'medico@arteria.med.br',
      senha: 'ArterIA@2026',
    },
  });

  const onSubmit = async (dados: LoginFormData) => {
    try {
      const resposta = await autenticarProfissional(dados);
      loginStore(resposta.usuario, resposta.token, resposta.refreshToken);
      toast.success(`Bem-vindo(a), ${resposta.usuario.nome}!`);
      navigate('/dashboard', { replace: true });
    } catch {
      toast.error('Credenciais inválidas ou conta temporariamente bloqueada.');
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

      <FormCard elevation={0}>
        <Typography variant="h6" fontWeight={700} textAlign="center" mb={2}>
          Acesso do Profissional
        </Typography>

        <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.8rem' }}>
          Credencial médica inicial pronta para teste:{' '}
          <strong>medico@arteria.med.br</strong> / <strong>ArterIA@2026</strong>
        </Alert>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            <FieldWrapper label="E-mail Profissional">
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    placeholder="medico@arteria.med.br"
                    type="email"
                    autoComplete="email"
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
                    placeholder="Sua senha segura"
                    type="password"
                    autoComplete="current-password"
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
              {isSubmitting ? 'Autenticando...' : 'Entrar no Sistema'}
            </Button>

            <Typography textAlign="center" fontSize="0.9rem">
              Ainda não possui acesso?{' '}
              <MuiLink
                component={RouterLink}
                to="/cadastro-profissional"
                color="#a3226e"
                fontWeight={600}
              >
                Solicitar cadastro médico
              </MuiLink>
            </Typography>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}
