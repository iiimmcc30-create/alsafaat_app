import { useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';

export function useThemedStyles<T>(factory: (theme: ReturnType<typeof useTheme>) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme.scheme]);
}
