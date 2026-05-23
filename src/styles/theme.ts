/**
 * SAIOS Design System — Theme Constants
 * Module 00 · Step 1 · Design System Foundation
 *
 * This file is the JavaScript/TypeScript mirror of tailwind.config.ts.
 * Use it wherever Tailwind class names cannot be applied — e.g.:
 *   • Recharts fill / stroke props
 *   • CSS-in-JS (framer-motion, react-spring)
 *   • Canvas / WebGL rendering
 *   • Dynamic style calculations
 *   • Unit tests that assert colour values
 *
 * Import:  import { theme } from '@/styles/theme'
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitive Palette
// ─────────────────────────────────────────────────────────────────────────────

export const slate = {
  50:  '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const

export const indigo = {
  50:  '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Brand Tokens
// ─────────────────────────────────────────────────────────────────────────────

export const brand = {
  default: indigo[600],   // '#4f46e5' — primary action
  hover:   indigo[500],   // '#6366f1'
  active:  indigo[700],   // '#4338ca'
  subtle:  indigo[50],    // '#eef2ff'
  muted:   indigo[100],   // '#e0e7ff'
  ...indigo,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Colours
// ─────────────────────────────────────────────────────────────────────────────

export const semantic = {
  success: {
    default: '#16a34a',
    light:   '#f0fdf4',
    border:  '#bbf7d0',
    strong:  '#166534',
  },
  warning: {
    default: '#d97706',
    light:   '#fffbeb',
    border:  '#fde68a',
    strong:  '#92400e',
  },
  danger: {
    default: '#dc2626',
    light:   '#fef2f2',
    border:  '#fecaca',
    strong:  '#991b1b',
  },
  info: {
    default: '#2563eb',
    light:   '#eff6ff',
    border:  '#bfdbfe',
    strong:  '#1e40af',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Surface Tiers — Light / Dark
// ─────────────────────────────────────────────────────────────────────────────

export const surfaces = {
  light: {
    background: '#ffffff',
    surface:    '#f8fafc',
    elevated:   '#ffffff',
    overlay:    '#ffffff',
  },
  dark: {
    background: '#0f172a',
    surface:    '#1e293b',
    elevated:   '#334155',
    overlay:    '#475569',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Border
// ─────────────────────────────────────────────────────────────────────────────

export const border = {
  light:  { default: '#e2e8f0', subtle: '#f1f5f9', strong: '#cbd5e1' },
  dark:   { default: '#334155', subtle: '#1e293b', strong: '#475569' },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────────

export const text = {
  light: {
    primary:   '#0f172a',
    secondary: '#475569',
    muted:     '#64748b',
    disabled:  '#94a3b8',
    inverse:   '#ffffff',
  },
  dark: {
    primary:   '#f8fafc',
    secondary: '#cbd5e1',
    muted:     '#94a3b8',
    disabled:  '#475569',
    inverse:   '#0f172a',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────────────

export const fontFamily = {
  display: "'Sora', system-ui, sans-serif",
  body:    "'Inter', system-ui, sans-serif",
  sans:    "'Inter', system-ui, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
} as const

export const fontSize = {
  xs:   '11px',
  sm:   '12px',
  base: '14px',
  md:   '15px',
  lg:   '16px',
  xl:   '18px',
  '2xl': '20px',
  '3xl': '24px',
  '4xl': '30px',
  '5xl': '36px',
} as const

export const fontWeight = {
  normal:   400,
  medium:   500,
  semibold: 600,
  bold:     700,
} as const

export const lineHeight = {
  tight:   1.2,
  snug:    1.3,
  normal:  1.5,
  relaxed: 1.6,
  loose:   1.75,
} as const

export const letterSpacing = {
  tighter: '-0.025em',
  tight:   '-0.015em',
  snug:    '-0.01em',
  normal:  '0em',
  wide:    '0.005em',
  wider:   '0.01em',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Spacing (4 px base unit)
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  0:    '0px',
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',
  2.5:  '10px',
  3:    '12px',
  3.5:  '14px',
  4:    '16px',
  5:    '20px',
  6:    '24px',
  7:    '28px',
  8:    '32px',
  9:    '36px',
  10:   '40px',
  11:   '44px',
  12:   '48px',
  14:   '56px',
  16:   '64px',
  20:   '80px',
  24:   '96px',
  32:   '128px',
  40:   '160px',
  48:   '192px',
  64:   '256px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Border Radius
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  none:    '0px',
  sm:      '4px',
  md:      '6px',
  default: '6px',
  lg:      '10px',
  xl:      '14px',
  '2xl':   '20px',
  full:    '9999px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Shadows
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  none: 'none',
  sm:  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md:  '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
  lg:  '0 4px 8px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
  xl:  '0 10px 20px -4px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.05)',
  // Dark-mode variants
  dark: {
    sm:  '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md:  '0 1px 3px 0 rgb(0 0 0 / 0.35), 0 1px 2px -1px rgb(0 0 0 / 0.25)',
    lg:  '0 4px 8px -2px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    xl:  '0 10px 20px -4px rgb(0 0 0 / 0.45), 0 4px 8px -4px rgb(0 0 0 / 0.35)',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Animation
// ─────────────────────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    fast:   100,
    base:   150,
    slow:   250,
    slower: 350,
  },
  easing: {
    spring:  'cubic-bezier(0.16, 1, 0.3, 1)',
    snappy:  'cubic-bezier(0.4, 0, 0.2, 1)',
    ease:    'cubic-bezier(0.4, 0, 0.6, 1)',
    easeIn:  'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    linear:  'linear',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Z-Index Scale
// ─────────────────────────────────────────────────────────────────────────────

export const zIndex = {
  hide:      -1,
  base:       0,
  raised:    10,
  dropdown: 100,
  sticky:   200,
  overlay:  300,
  modal:    400,
  popover:  500,
  toast:    600,
  tooltip:  700,
  max:     9999,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Breakpoints
// ─────────────────────────────────────────────────────────────────────────────

export const breakpoints = {
  xs:   480,
  sm:   640,
  md:   768,
  lg:  1024,
  xl:  1280,
  '2xl': 1440,
  '3xl': 1920,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Recharts / Chart Palette
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered colour sequence for chart series. Chosen to be distinct on both
 * light and dark backgrounds. Import and spread into Recharts <Cell> or
 * COLORS arrays.
 */
export const chartColors = [
  indigo[500],        // #6366f1 — brand
  '#06b6d4',          // cyan-500
  '#f59e0b',          // amber-500
  '#10b981',          // emerald-500
  '#f43f5e',          // rose-500
  '#8b5cf6',          // violet-500
  '#0ea5e9',          // sky-500
  '#d97706',          // amber-600
] as const

/**
 * Semantic chart colours for consistent data encoding across dashboards.
 */
export const chartSemantic = {
  positive:  semantic.success.default,
  negative:  semantic.danger.default,
  neutral:   slate[400],
  highlight: brand.default,
  warning:   semantic.warning.default,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Master Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full theme object — use for Recharts, framer-motion, tests, and any
 * context where Tailwind utility classes are unavailable.
 *
 * @example
 * import { theme } from '@/styles/theme'
 * <Line stroke={theme.brand.default} />
 */
export const theme = {
  slate,
  indigo,
  brand,
  semantic,
  surfaces,
  border,
  text,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  spacing,
  radius,
  shadow,
  animation,
  zIndex,
  breakpoints,
  chartColors,
  chartSemantic,
} as const

export type Theme = typeof theme
export type SemanticColor = keyof typeof semantic
export type BrandShade   = keyof typeof brand
export type SpacingKey   = keyof typeof spacing
export type RadiusKey    = keyof typeof radius
export type ShadowKey    = keyof (typeof shadow) & string
export type FontSizeKey  = keyof typeof fontSize
export type ZIndexKey    = keyof typeof zIndex
export type Breakpoint   = keyof typeof breakpoints

export default theme
