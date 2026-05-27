export const Colors = {
  primary: '#0F6E56',
  primaryLight: '#1A9471',
  primaryDark: '#0A4F3E',
  primaryMuted: '#E6F4F0',

  secondary: '#2C8C6E',
  accent: '#F0A500',

  success: '#27AE60',
  successLight: '#D5F5E3',
  warning: '#F0A500',
  warningLight: '#FEF3CD',
  error: '#E74C3C',
  errorLight: '#FADBD8',

  background: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F1EE',
  border: '#E8E6E1',
  borderLight: '#F0EEE9',

  text: '#1A1A1A',
  textSecondary: '#5A5A5A',
  textTertiary: '#9A9A9A',
  textInverse: '#FFFFFF',

  neutral50: '#FAFAF9',
  neutral100: '#F5F4F1',
  neutral200: '#E8E6E1',
  neutral300: '#D4D1CA',
  neutral400: '#B0ADA5',
  neutral500: '#8A877E',
  neutral600: '#6B685F',
  neutral700: '#4A4740',
  neutral800: '#2E2B25',
  neutral900: '#1A1714',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 30,
    xxxl: 38,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.65,
  },
};
