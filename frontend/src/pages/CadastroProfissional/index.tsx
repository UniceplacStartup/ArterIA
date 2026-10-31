/**
 * Página de Cadastro de Profissional de Saúde (Médico / Radiologista - RF01).
 * Valida CRM, UF e força de senha, integrando com o endpoint `/api/auth/registro`.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import {
  TextField,
  Button,
  MenuItem,
  Stack,
  Typography,
  Box,
  Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  cadastroProfissionalSchema,
  type CadastroProfissionalFormData,
} from '@/schemas/cadastroProfissional.schema';
import {
  PageWrapper,
  BrandTitle,
  BrandSubtitle,
  FormCard,
} from '@/components/AuthCard/AuthCard.styles';
import { FieldWrapper } from '@/components/FieldWrapper/FieldWrapper';
import { registrarProfissional } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function CadastroProfissional() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CadastroProfissionalFormData>({
    resolver: zodResolver(cadastroProfissionalSchema),
    defaultValues: {
      nomeCompleto: '',
      email: '',
      senha: '',
      crm: '',
      ufCrm: '',
    },
  });

  const onSubmit = async (data: CadastroProfissionalFormData) => {
    try {
      const resposta = await registrarProfissional(data);
      loginStore(resposta.usuario, resposta.token, resposta.refreshToken);
      toast.success('Cadastro profissional realizado com sucesso!');
      navigate('/dashboard', { replace: true });
    } catch {
      toast.error(
        'Não foi possível concluir o cadastro. Verifique se o e-mail ou CRM já estão registrados.',
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

      <FormCard elevation={0}>
        <Typography variant="h6" fontWeight={700} textAlign="center" mb={3}>
          Cadastro do Profissional
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
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
                    placeholder="Mínimo de 8 caracteres (letras e números)"
                    type="password"
                    fullWidth
                    error={!!errors.senha}
                    helperText={errors.senha?.message}
                  />
                )}
              />
            </FieldWrapper>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                columnGap: 2,
                rowGap: 2.5,
              }}
            >
              <FieldWrapper label="CRM">
                <Controller
                  name="crm"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      placeholder="CRM"
                      fullWidth
                      error={!!errors.crm}
                      helperText={errors.crm?.message}
                    />
                  )}
                />
              </FieldWrapper>

              <FieldWrapper label="UF do CRM">
                <Controller
                  name="ufCrm"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      fullWidth
                      error={!!errors.ufCrm}
                      helperText={errors.ufCrm?.message}
                    >
                      <MenuItem value="" disabled>
                        Selecione
                      </MenuItem>
                      {UFS.map((uf) => (
                        <MenuItem key={uf} value={uf}>
                          {uf}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </FieldWrapper>
            </Box>

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
              {isSubmitting ? 'Registrando...' : 'Solicitar Acesso'}
            </Button>

            <Typography textAlign="center" fontSize="0.9rem">
              Já possui uma conta?{' '}
              <MuiLink
                component={RouterLink}
                to="/login"
                color="#a3226e"
                fontWeight={600}
              >
                Fazer login
              </MuiLink>
            </Typography>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}
