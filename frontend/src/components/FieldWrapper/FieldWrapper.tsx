import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface FieldWrapperProps {
  label: string;
  children: ReactNode;
}

export function FieldWrapper({ label, children }: FieldWrapperProps) {
  return (
    <Box>
      <Typography variant="body2" fontWeight={600} mb={0.5}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}