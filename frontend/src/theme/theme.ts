import { createTheme } from '@mui/material/styles';

// RNF04

export const colors = {
  wine900: '#5C0E33', 
  wine700: '#7A1145', 
  wine500: '#9C1D5A', 
  wine100: '#FBD9E7', 
  wine50: '#FDEFF5', 

 
  statusLaudado: '#1F8A4C', 
  statusProcessando: '#C98A00', 
  statusFalha: '#B3261E', 
  statusPendente: '#1857B3', 

  // RNF04
  alertBg: '#FCEAEA',
  alertBorder: '#B3261E',
};

export const theme = createTheme({
  palette: {
    primary: { main: colors.wine700, dark: colors.wine900, light: colors.wine500 },
    error: { main: colors.statusFalha },
    warning: { main: colors.statusProcessando },
    success: { main: colors.statusLaudado },
    info: { main: colors.statusPendente },
    background: { default: colors.wine50, paper: '#FFFFFF' },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 24, paddingInline: 20 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, letterSpacing: 0.3 },
      },
    },
  },
});
