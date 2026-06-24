/**
 * theme/colors.ts — 柔和通透版
 *
 * 全站语义色 Token，双模 (Light / Dark) 原生支持。
 * 主色：柔和 indigo，点缀 emerald，背景暖白。
 */
export const palette = {
  /* ──── 品牌主色 (柔靛蓝) ──── */
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primaryActive: '#4338ca',
  primaryLight: 'rgba(99, 102, 241, 0.10)',
  primarySoft: 'rgba(99, 102, 241, 0.05)',

  /* ──── 点缀色 (翡翠绿) ──── */
  accent: '#059669',
  accentLight: 'rgba(5, 150, 105, 0.10)',
  accentMuted: 'rgba(5, 150, 105, 0.06)',

  /* ──── 信托色 ──── */
  trust: '#0F766E',
  trustLight: 'rgba(15, 118, 110, 0.10)',

  /* ──── 中性色 Light ──── */
  ink: '#1e293b',
  inkSecondary: '#64748b',
  inkMuted: '#94a3b8',
  inkInverse: '#ffffff',

  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  surfaceHover: '#f1f5f9',

  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  divider: '#eef2f7',

  /* ──── 中性色 Dark ──── */
  dark: {
    ink: '#e2e8f0',
    inkSecondary: '#94a3b8',
    inkMuted: '#64748b',
    inkInverse: '#0f172a',

    surface: '#1e293b',
    surfaceMuted: '#0f172a',
    surfaceHover: '#334155',

    border: '#334155',
    borderStrong: '#475569',
    divider: '#1e293b',

    bg: '#0f172a',
    bgCard: '#1a2332',
  },

  /* ──── 毛玻璃 (Light 半透白 / Dark 半透黑) ──── */
  glass: {
    light: {
      bg: 'rgba(255, 255, 255, 0.70)',
      border: 'rgba(255, 255, 255, 0.30)',
      shadow: '0 8px 32px rgba(100, 116, 139, 0.08)',
    },
    dark: {
      bg: 'rgba(30, 41, 59, 0.75)',
      border: 'rgba(255, 255, 255, 0.06)',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
    },
    blur: '12px',
  },

  /* ──── 状态色 ──── */
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.12)',
  successInk: '#047857',

  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  warningInk: '#b45309',

  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.10)',
  dangerInk: '#b91c1c',

  info: '#0ea5e9',
  infoLight: 'rgba(14, 165, 233, 0.10)',

  /* ──── 图表色 ──── */
  chart: [
    '#6366f1', '#059669', '#f59e0b', '#ef4444',
    '#0ea5e9', '#ec4899', '#14b8a6', '#8b5cf6',
  ],

  /* ──── 角色色 ──── */
  role: { admin: '#8b5cf6', landlord: '#6366f1', user: '#10b981' },

  /* ──── 阴影 ──── */
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.05)',
    lg: '0 12px 28px rgba(0, 0, 0, 0.06)',
    xl: '0 20px 48px rgba(0, 0, 0, 0.08)',
    inset: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
  },

  /* ──── 渐变 (柔和版) ──── */
  gradient: {
    primary: 'linear-gradient(135deg, #667eea 0%, #818cf8 100%)',
    accent: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
    trust: 'linear-gradient(135deg, #14b8a6 0%, #34d399 100%)',
    hero: 'linear-gradient(135deg, #eef2ff 0%, #f0f9ff 50%, #ecfdf5 100%)',
    card1: 'linear-gradient(135deg, #667eea 0%, #818cf8 100%)',
    card2: 'linear-gradient(135deg, #14b8a6 0%, #34d399 100%)',
    card3: 'linear-gradient(135deg, #a78bfa 0%, #c4b5fd 100%)',
    card4: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)',
    card5: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
    card6: 'linear-gradient(135deg, #f472b6 0%, #f9a8d4 100%)',
  },
} as const;

export type Palette = typeof palette;
