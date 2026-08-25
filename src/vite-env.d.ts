/// <reference types="vite/client" />
/// <reference types="vite/client" />

import type { SystemProps } from '@mui/system';

declare module '@mui/material/Typography' {
  interface TypographyOwnProps extends SystemProps<any> {}
}

declare module '@mui/material/Box' {
  interface BoxOwnProps extends SystemProps<any> {}
}

declare module '@mui/material/Stack' {
  interface StackOwnProps extends SystemProps<any> {
    alignItems?: string;
  }
}
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
