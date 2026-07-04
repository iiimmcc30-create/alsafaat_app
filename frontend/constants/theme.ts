// SAFAT — Logo-aligned brand theme (forest green · white · black)
// Supports dark + light palettes; apply via bootstrap before app modules load.

import { Appearance } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  bgDeep: string;
  bgPrimary: string;
  bgSurface: string;
  bgElevated: string;
  bgGlass: string;
  bgGlassStrong: string;
  bgOverlay: string;
  royal: string;
  royalDeep: string;
  electric: string;
  electricBright: string;
  glow: string;
  cyan: string;
  silver: string;
  silverBright: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  /** Accent text — white in dark mode, brand green in light */
  textBrand: string;
  textBrandStrong: string;
  textBrandSoft: string;
  textBrandAlt: string;
  textBrandSuccess: string;
  gold: string;
  emerald: string;
  rose: string;
  amber: string;
  borderSoft: string;
  borderMid: string;
  borderStrong: string;
  borderHairline: string;
  success: string;
  danger: string;
  warning: string;
  liveRed: string;
};

type BaseThemeColors = Omit<
  ThemeColors,
  'textBrand' | 'textBrandStrong' | 'textBrandSoft' | 'textBrandAlt' | 'textBrandSuccess'
>;

export type ThemeGradients = {
  hero: readonly [string, string, string];
  royal: readonly [string, string, string];
  glass: readonly [string, string];
  liveOverlay: readonly [string, string, string];
  card: readonly [string, string];
  cardHover: readonly [string, string];
  goldRing: readonly [string, string, string];
  electric: readonly [string, string, string];
  primary: readonly [string, string, string];
  rim: readonly [string, string];
};

const sharedAccents = {
  gold: '#F5C56A',
  emerald: '#10B981',
  rose: '#F43F5E',
  amber: '#FBBF24',
  success: '#10B981',
  danger: '#F43F5E',
  warning: '#FBBF24',
  liveRed: '#EF4444',
};

const darkColors: BaseThemeColors = {
  bgDeep: '#000000',
  bgPrimary: '#050505',
  bgSurface: '#0D0D0D',
  bgElevated: '#161616',
  bgGlass: 'rgba(0, 77, 44, 0.35)',
  bgGlassStrong: 'rgba(0, 0, 0, 0.88)',
  bgOverlay: 'rgba(0, 0, 0, 0.72)',
  royal: '#002818',
  royalDeep: '#001A10',
  electric: '#006B3C',
  electricBright: '#008F4C',
  glow: '#10B981',
  cyan: '#34D399',
  silver: '#D1D5DB',
  silverBright: '#F3F4F6',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  textSubtle: '#6B7280',
  borderSoft: 'rgba(16, 185, 129, 0.12)',
  borderMid: 'rgba(16, 185, 129, 0.24)',
  borderStrong: 'rgba(16, 185, 129, 0.45)',
  borderHairline: 'rgba(255, 255, 255, 0.08)',
  ...sharedAccents,
};

const lightColors: BaseThemeColors = {
  bgDeep: '#FFFFFF',
  bgPrimary: '#F8FAF9',
  bgSurface: '#F0F4F2',
  bgElevated: '#E8EEEB',
  bgGlass: 'rgba(0, 77, 44, 0.08)',
  bgGlassStrong: 'rgba(255, 255, 255, 0.92)',
  bgOverlay: 'rgba(0, 0, 0, 0.45)',
  royal: '#E8F5EF',
  royalDeep: '#D4EDE0',
  electric: '#004D2C',
  electricBright: '#006B3C',
  glow: '#008F4C',
  cyan: '#10B981',
  silver: '#374151',
  silverBright: '#1F2937',
  textPrimary: '#0A0A0A',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  borderSoft: 'rgba(0, 77, 44, 0.10)',
  borderMid: 'rgba(0, 77, 44, 0.20)',
  borderStrong: 'rgba(0, 77, 44, 0.38)',
  borderHairline: 'rgba(0, 0, 0, 0.06)',
  ...sharedAccents,
};

const darkGradients: ThemeGradients = {
  hero: ['#000000', '#050505', '#0D0D0D'],
  royal: ['#001A10', '#002818', '#006B3C'],
  glass: ['rgba(0,107,60,0.32)', 'rgba(0,0,0,0.78)'],
  liveOverlay: ['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.96)'],
  card: ['rgba(0,107,60,0.18)', 'rgba(0,0,0,0.85)'],
  cardHover: ['rgba(0,107,60,0.30)', 'rgba(0,0,0,0.92)'],
  goldRing: ['#F5C56A', '#FBBF24', '#F5C56A'],
  electric: ['#006B3C', '#008F4C', '#10B981'],
  primary: ['#008F4C', '#006B3C', '#002818'],
  rim: ['rgba(16,185,129,0.45)', 'rgba(16,185,129,0)'],
};

const lightGradients: ThemeGradients = {
  hero: ['#FFFFFF', '#F8FAF9', '#F0F4F2'],
  royal: ['#D4EDE0', '#B8E0CC', '#006B3C'],
  glass: ['rgba(0,107,60,0.14)', 'rgba(255,255,255,0.92)'],
  liveOverlay: ['transparent', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.96)'],
  card: ['rgba(0,107,60,0.10)', 'rgba(255,255,255,0.95)'],
  cardHover: ['rgba(0,107,60,0.18)', 'rgba(240,244,242,0.98)'],
  goldRing: ['#F5C56A', '#FBBF24', '#F5C56A'],
  electric: ['#004D2C', '#006B3C', '#008F4C'],
  primary: ['#006B3C', '#004D2C', '#E8F5EF'],
  rim: ['rgba(0,107,60,0.35)', 'rgba(0,107,60,0)'],
};

export function createShadow(palette: ThemeColors) {
  return {
    glow: {
      shadowColor: palette.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 22,
      elevation: 12,
    },
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: palette === lightColors ? 0.12 : 0.32,
      shadowRadius: 16,
      elevation: 6,
    },
    card: {
      shadowColor: palette === lightColors ? '#000000' : '#000408',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: palette === lightColors ? 0.08 : 0.45,
      shadowRadius: 24,
      elevation: 10,
    },
    pressed: {
      shadowColor: palette.electric,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
  };
}

let activeScheme: ColorScheme =
  Appearance.getColorScheme() === 'light' ? 'light' : 'dark';

export const colors = {} as ThemeColors;
export const gradients: ThemeGradients = { ...darkGradients };
export const shadow = createShadow(darkColors);

export function getActiveScheme(): ColorScheme {
  return activeScheme;
}

function enrichTextColors(palette: BaseThemeColors, scheme: ColorScheme): ThemeColors {
  const whiteText = palette.textPrimary;
  return {
    ...palette,
    textBrand: scheme === 'dark' ? whiteText : palette.glow,
    textBrandStrong: scheme === 'dark' ? whiteText : palette.electricBright,
    textBrandSoft: scheme === 'dark' ? whiteText : palette.cyan,
    textBrandAlt: scheme === 'dark' ? whiteText : palette.electric,
    textBrandSuccess: scheme === 'dark' ? whiteText : palette.success,
  };
}

export function applyThemeScheme(scheme: ColorScheme) {
  activeScheme = scheme;
  const palette = scheme === 'dark' ? darkColors : lightColors;
  const paletteGradients = scheme === 'dark' ? darkGradients : lightGradients;
  Object.assign(colors, enrichTextColors(palette, scheme));
  Object.assign(gradients, paletteGradients);
  Object.assign(shadow, createShadow(palette));
}

/** Gradients that must react to light/dark at runtime (not frozen in StyleSheet). */
export function headerFadeGradient(scheme: ColorScheme): readonly [string, string] {
  return scheme === 'light'
    ? ['rgba(248, 250, 249, 0.98)', 'rgba(248, 250, 249, 0)']
    : ['rgba(0, 0, 0, 0.98)', 'rgba(0, 0, 0, 0)'];
}

export function imageCardOverlay(scheme: ColorScheme): readonly [string, string] {
  return scheme === 'light'
    ? ['transparent', 'rgba(15, 23, 42, 0.72)']
    : ['transparent', 'rgba(0, 0, 0, 0.92)'];
}

export function imageCardOverlayStrong(scheme: ColorScheme): readonly [string, string] {
  return scheme === 'light'
    ? ['transparent', 'rgba(15, 23, 42, 0.82)']
    : ['transparent', 'rgba(0, 0, 0, 0.95)'];
}

export function scrimColor(scheme: ColorScheme, opacity = 0.85): string {
  return scheme === 'light'
    ? `rgba(248, 250, 249, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;
}

applyThemeScheme(activeScheme);

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
};

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

export const typography = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.6, ...rtlText },
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3, ...rtlText },
  h2: { fontSize: 22, fontWeight: '700' as const, ...rtlText },
  h3: { fontSize: 18, fontWeight: '600' as const, ...rtlText },
  body: { fontSize: 15, fontWeight: '400' as const, ...rtlText },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, ...rtlText },
  caption: { fontSize: 13, fontWeight: '500' as const, ...rtlText },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, ...rtlText },
};

export const theme = { colors, gradients, spacing, radius, typography, shadow };
export default theme;
