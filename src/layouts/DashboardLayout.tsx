import { Outlet } from 'react-router-dom';
import { Box, AppBar, Toolbar, Avatar, Typography, IconButton, Stack } from '@mui/material';
import { Settings, LogOut, UserRound } from 'lucide-react';
import { colors } from '@/theme/theme';
import { useAuthStore } from '@/stores/authStore';

export function DashboardLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.wine50 }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: colors.wine700, px: { xs: 2, md: 4 } }}
      >
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: colors.wine900 }}>
              <UserRound size={20} />
            </Avatar>
            <Box>
              <Typography fontWeight={700} lineHeight={1.2}>
                Olá, {usuario?.nome ?? 'Dr(a).'}!
              </Typography>
              <Typography
                variant="caption"
                onClick={logout}
                sx={{ cursor: 'pointer', color: colors.wine100, '&:hover': { textDecoration: 'underline' } }}
              >
                Sair
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <IconButton sx={{ color: '#fff' }} aria-label="Configurações">
              <Settings size={20} />
            </IconButton>
            <IconButton sx={{ color: '#fff' }} aria-label="Sair" onClick={logout}>
              <LogOut size={20} />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
