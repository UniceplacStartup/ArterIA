/**
 * Página de Autenticação (Login) do Profissional de Saúde (RF01).
 * Permite entrar com a conta padrão (`medico@arteria.med.br` / `ArterIA@2026`)
 * ou criar uma nova conta médica em `/cadastro-profissional` e fazer login em seguida.
 */

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import {
  TextField,
  Button,
  Stack,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
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
  const [searchParams] = useSearchParams();
  const emailRecemCadastrado = searchParams.get('email');
  const loginStore = useAuthStore((s) => s.login);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: emailRecemCadastrado ?? 'medico@arteria.med.br',
      senha: emailRecemCadastrado ? '' : 'ArterIA@2026',
    },
  });

  useEffect(() => {
    if (emailRecemCadastrado) {
      setValue('email', emailRecemCadastrado);
      setValue('senha', '');
    }
  }, [emailRecemCadastrado, setValue]);

  const onSubmit = async (dados: LoginFormData) => {
    try {
      const resposta = await autenticarProfissional(dados);
      loginStore(resposta.usuario, resposta.token, resposta.refreshToken);
      toast.success(`Bem-vindo(a), ${resposta.usuario.nome}!`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detalhe = (err.response?.data as { detail?: string } | undefined)
          ?.detail;
        if (typeof detalhe === 'string') {
          toast.error(detalhe);
          return;
        }
      }
      toast.error(
        'Não foi possível conectar ao servidor ou credenciais inválidas.',
      );
    }
  };

  function preencherContaPadrao() {
    setValue('email', 'medico@arteria.med.br');
    setValue('senha', 'ArterIA@2026');
  }

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

        {emailRecemCadastrado ? (
          <Alert severity="success" sx={{ mb: 2.5, fontSize: '0.82rem' }}>
            Conta criada para <strong>{emailRecemCadastrado}</strong>! Digite
            sua senha abaixo para entrar.
          </Alert>
        ) : (
          <Alert
            severity="info"
            sx={{ mb: 2.5, fontSize: '0.8rem', cursor: 'pointer' }}
            onClick={preencherContaPadrao}
          >
            Conta padrão pronta para uso:{' '}
            <strong>medico@arteria.med.br</strong> /{' '}
            <strong>ArterIA@2026</strong>
          </Alert>
        )}

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
                    placeholder="Sua senha de acesso"
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

            <Divider sx={{ my: 0.5 }}>ou</Divider>

            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/cadastro-profissional')}
              sx={{
                py: 1.1,
                borderColor: '#a3226e',
                color: '#a3226e',
                fontWeight: 700,
              }}
            >
              Criar Nova Conta (Cadastrar Médico)
            </Button>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}
