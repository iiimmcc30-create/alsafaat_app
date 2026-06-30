// SAFAT — Premium Midnight Theme (v2)
// Palette: Kuretake Black · Midnight Mirage · Dark Denim · Tofino Blue · Blue Slate

export const colors = {
  // Deep midnight backgrounds
  bgDeep: '#011723',          // Kuretake Black Manga
  bgPrimary: '#01273B',       // Midnight Mirage
  bgSurface: '#023852',       // Dark Denim Blue
  bgElevated: '#03466A',      // Elevated denim
  bgGlass: 'rgba(2, 56, 82, 0.55)',
  bgGlassStrong: 'rgba(1, 39, 59, 0.88)',
  bgOverlay: 'rgba(1, 23, 35, 0.72)',

  // Tofino Blue accent system
  royal: '#023852',
  royalDeep: '#01273B',
  electric: '#026E98',        // Tofino Blue — primary accent
  electricBright: '#0A8FC4',
  glow: '#38BDEC',
  cyan: '#5ED4F7',

  // Text
  textPrimary: '#F4F8FB',
  textSecondary: '#C6D2DC',
  textMuted: '#8A97A3',
  textSubtle: '#5A5F67',      // Blue Slate

  // Accents
  gold: '#F5C56A',
  silver: '#C6D2DC',
  emerald: '#10B981',
  rose: '#F43F5E',
  amber: '#FBBF24',

  // Borders — refined rim-light
  borderSoft: 'rgba(56, 189, 236, 0.10)',
  borderMid: 'rgba(56, 189, 236, 0.22)',
  borderStrong: 'rgba(56, 189, 236, 0.42)',
  borderHairline: 'rgba(244, 248, 251, 0.06)',

  // Status
  success: '#10B981',
  danger: '#F43F5E',
  warning: '#FBBF24',

  // Live
  liveRed: '#EF4444',
};

export const gradients = {
  hero: ['#011723', '#01273B', '#023852'] as const,
  royal: ['#01273B', '#023852', '#026E98'] as const,
  glass: ['rgba(2,110,152,0.32)', 'rgba(1,39,59,0.78)'] as const,
  liveOverlay: ['transparent', 'rgba(1,23,35,0.45)', 'rgba(1,23,35,0.96)'] as const,
  card: ['rgba(2,110,152,0.18)', 'rgba(1,39,59,0.85)'] as const,
  cardHover: ['rgba(2,110,152,0.30)', 'rgba(2,56,82,0.92)'] as const,
  goldRing: ['#F5C56A', '#FBBF24', '#F5C56A'] as const,
  electric: ['#026E98', '#0A8FC4', '#38BDEC'] as const,
  primary: ['#0A8FC4', '#026E98', '#023852'] as const,
  rim: ['rgba(56,189,236,0.45)', 'rgba(56,189,236,0)'] as const,
};

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

export const shadow = {
  glow: {
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 12,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    shadowColor: '#000814',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
  pressed: {
    shadowColor: colors.electric,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const theme = { colors, gradients, spacing, radius, typography, shadow };
export default theme;
