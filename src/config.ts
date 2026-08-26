
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
