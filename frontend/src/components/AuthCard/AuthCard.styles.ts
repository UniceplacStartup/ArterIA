import { styled } from '@mui/material/styles';
import { Box, Paper } from '@mui/material';

export const PageWrapper = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4, 2),
  background: 'linear-gradient(180deg, #d16ba5 0%, #86214f 100%)',
}));

export const BrandTitle = styled('h1')(() => ({
  fontFamily: '"Segoe UI", Roboto, sans-serif',
  fontWeight: 300,
  fontSize: '2.75rem',
  color: '#fff',
  margin: 0,
  textAlign: 'center',
  '& span': {
    fontWeight: 700,
  },
}));

export const BrandSubtitle = styled('p')(() => ({
  color: 'rgba(255,255,255,0.9)',
  fontStyle: 'italic',
  fontSize: '0.95rem',
  marginTop: 4,
  marginBottom: 32,
  textAlign: 'center',
}));

export const FormCard = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 480,
  padding: theme.spacing(4),
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
}));