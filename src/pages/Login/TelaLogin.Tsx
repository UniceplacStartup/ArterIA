import { useNavigate } from 'react-router-dom';
import { Button, Stack, Typography } from '@mui/material';
import { PageWrapper, BrandTitle, BrandSubtitle, FormCard } from '../../components/AuthCard/AuthCard.styles';

export default function TelaLogin() {
  const navigate = useNavigate();

  return (
    <PageWrapper>
      <BrandTitle>
        Arter<span>IA</span>
      </BrandTitle>
      <BrandSubtitle>Sistema de Apoio ao Diagnóstico Radiológico por IA</BrandSubtitle>

      <FormCard elevation={0}>
        <Typography variant="h6" fontWeight={700} textAlign="center" mb={3}>
          Como você quer entrar?
        </Typography>

        <Stack spacing={2}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login-profissional')}
            sx={{
              py: 1.3,
              backgroundColor: '#a3226e',
              '&:hover': { backgroundColor: '#861b5a' },
            }}
          >
            Sou Profissional de Saúde
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/login-paciente')}
            sx={{
              py: 1.3,
              borderColor: '#a3226e',
              color: '#a3226e',
              '&:hover': { borderColor: '#861b5a', backgroundColor: 'rgba(163,34,110,0.04)' },
            }}
          >
            Sou Paciente
          </Button>
        </Stack>
      </FormCard>
    </PageWrapper>
  );
}