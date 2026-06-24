/**
 * theme/spacing.ts
 * 8pt 栅格 + 圆角 + 字号 + 动画 Tokens。
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  caption: 12,
  body: 14,
  bodyLg: 16,
  titleSm: 16,
  title: 20,
  heading: 24,
  display: 32,
  hero: 40,
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const motion = {
  fast: '150ms',
  normal: '240ms',
  slow: '320ms',
  easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const layout = {
  siderCollapsed: 64,
  siderExpanded: 240,
  headerHeight: 64,
  contentMax: 1440,
  contentNarrow: 900,
} as const;
