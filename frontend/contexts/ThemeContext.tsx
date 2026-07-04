import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyThemeScheme,
  colors,
  getActiveScheme,
  gradients,
  shadow,
  type ColorScheme,
} from '@/constants/theme';
import {
  resolveScheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/constants/themeBootstrap';

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: ColorScheme;
  isDark: boolean;
  colors: typeof colors;
  gradients: typeof gradients;
  shadow: typeof shadow;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [scheme, setScheme] = useState<ColorScheme>(getActiveScheme());

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const nextPreference =
          stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
        const resolved = resolveScheme(nextPreference);
        applyThemeScheme(resolved);
        if (!mounted) return;
        setPreferenceState(nextPreference);
        setScheme(resolved);
      } catch (error) {
        console.warn('[theme] failed to load preference', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
        if (stored && stored !== 'system') return;
        const next: ColorScheme = colorScheme === 'light' ? 'light' : 'dark';
        if (next === getActiveScheme()) return;
        applyThemeScheme(next);
        setScheme(next);
      });
    });

    return () => subscription.remove();
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    const resolved = resolveScheme(next);
    applyThemeScheme(resolved);
    setPreferenceState(next);
    setScheme(resolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme,
      isDark: scheme === 'dark',
      colors,
      gradients,
      shadow,
      setPreference,
    }),
    [preference, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      preference: 'system' as ThemePreference,
      scheme: getActiveScheme(),
      isDark: getActiveScheme() === 'dark',
      colors,
      gradients,
      shadow,
      setPreference: async () => {},
    };
  }
  return ctx;
}
