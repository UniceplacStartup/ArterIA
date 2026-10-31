import { Box, CircularProgress } from '@mui/material';
import { colors } from '@/theme/theme';

export function LoadingScreen() {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress sx={{ color: colors.wine700 }} />
    </Box>
  );
}
