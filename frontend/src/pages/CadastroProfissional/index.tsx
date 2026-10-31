/**
 * Página de Cadastro de Conta do Profissional de Saúde (Médico / Radiologista - RF01).
 * Cria a conta no banco de dados via `/api/auth/registro` e redireciona para a tela
 * de Login (`/login`) com o e-mail recém-cadastrado já preenchido para autenticação.
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
import axios from 'axios';
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

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function CadastroProfissional() {
  const navigate = useNavigate();

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
      ufCrm: 'DF',
    },
  });

  const onSubmit = async (data: CadastroProfissionalFormData) => {
    try {
      await registrarProfissional(data);
      toast.success(
        'Conta criada com sucesso! Agora faça login com seu e-mail e senha.',
      );
      navigate(`/login?email=${encodeURIComponent(data.email.trim())}`, {
        replace: true,
      });
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
        'Não foi possível criar a conta. Verifique se o e-mail ou CRM já estão cadastrados ou se o servidor está ativo.',
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
          Criar Conta Médica (Cadastro)
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            <FieldWrapper label="Nome Completo do(a) Doutor(a)">
              <Controller
                name="nomeCompleto"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    placeholder="Ex.: Dr. Carlos Eduardo"
                    fullWidth
                    error={!!errors.nomeCompleto}
                    helperText={errors.nomeCompleto?.message}
                  />
                )}
              />
            </FieldWrapper>

            <FieldWrapper label="E-mail para Login">
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    placeholder="seu.email@clinica.med.br"
                    type="email"
                    fullWidth
                    error={!!errors.email}
                    helperText={errors.email?.message}
                  />
                )}
              />
            </FieldWrapper>

            <FieldWrapper label="Senha de Acesso">
              <Controller
                name="senha"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    placeholder="Mínimo de 6 caracteres"
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
              <FieldWrapper label="Número do CRM">
                <Controller
                  name="crm"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      placeholder="Ex.: 123456"
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
              {isSubmitting ? 'Criando conta...' : 'Criar Conta e Ir para Login'}
            </Button>

            <Typography textAlign="center" fontSize="0.9rem">
              Já possui uma conta?{' '}
              <MuiLink
                component={RouterLink}
                to="/login"
                color="#a3226e"
                fontWeight={600}
              >
                Voltar para o Login
              </MuiLink>
            </Typography>
          </Stack>
        </form>
      </FormCard>
    </PageWrapper>
  );
}
