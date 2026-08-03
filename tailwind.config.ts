import type { Config } from 'tailwindcss'

// ─────────────────────────────────────────────────────────────────────────────
// Cortex Design System — Tailwind Configuration
// Module 00 · Step 1 · Design System Foundation
//
// Loaded in CSS via:  @config "../../tailwind.config.ts";
// Mirrored in JS via: src/styles/theme.ts  (for use with Recharts, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const config: Config = {
  darkMode: 'class',

  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    // ── Font Families ────────────────────────────────────────────────────────
    fontFamily: {
      display: ['Sora', 'system-ui', 'sans-serif'],
      body:    ['Inter', 'system-ui', 'sans-serif'],
      sans:    ['Inter', 'system-ui', 'sans-serif'],
      mono:    ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
    },

    // ── Font Size Scale (enterprise-compact: base = 14 px) ──────────────────
    fontSize: {
      xs:   ['11px', { lineHeight: '1.5',  letterSpacing: '0.01em' }],
      sm:   ['12px', { lineHeight: '1.5',  letterSpacing: '0.005em' }],
      base: ['14px', { lineHeight: '1.6',  letterSpacing: '0' }],
      md:   ['15px', { lineHeight: '1.6',  letterSpacing: '0' }],
      lg:   ['16px', { lineHeight: '1.5',  letterSpacing: '-0.005em' }],
      xl:   ['18px', { lineHeight: '1.4',  letterSpacing: '-0.01em' }],
      '2xl':['20px', { lineHeight: '1.4',  letterSpacing: '-0.01em' }],
      '3xl':['24px', { lineHeight: '1.3',  letterSpacing: '-0.015em' }],
      '4xl':['30px', { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
      '5xl':['36px', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
    },

    // ── Border Radius ────────────────────────────────────────────────────────
    borderRadius: {
      none: '0px',
      sm:   '4px',
      md:   '6px',
      DEFAULT: '6px',
      lg:   '10px',
      xl:   '14px',
      '2xl':'20px',
      full: '9999px',
    },

    // ── Box Shadow (enterprise-grade: extremely subtle, no heavy glows) ──────
    boxShadow: {
      none: 'none',
      sm:  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      DEFAULT:
            '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
      md:  '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
      lg:  '0 4px 8px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      xl:  '0 10px 20px -4px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.05)',
      // Dark-mode variants (lighter, since dark bg)
      'dark-sm':  '0 1px 2px 0 rgb(0 0 0 / 0.25)',
      'dark-md':  '0 1px 3px 0 rgb(0 0 0 / 0.3),  0 1px 2px -1px rgb(0 0 0 / 0.2)',
      'dark-lg':  '0 4px 8px -2px rgb(0 0 0 / 0.35), 0 2px 4px -2px rgb(0 0 0 / 0.25)',
      'dark-xl':  '0 10px 20px -4px rgb(0 0 0 / 0.4), 0 4px 8px -4px rgb(0 0 0 / 0.3)',
      // Focus ring (not a shadow, but co-located for reference)
      'focus': '0 0 0 2px #6366f1, 0 0 0 4px transparent',
    },

    extend: {
      // ── Color Palette ──────────────────────────────────────────────────────

      colors: {
        // ── Slate (primary neutral / scaffold) ──────────────────────────────
        slate: {
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
        },

        // ── Indigo brand accent ──────────────────────────────────────────────
        brand: {
          50:      '#eef2ff',
          100:     '#e0e7ff',
          200:     '#c7d2fe',
          300:     '#a5b4fc',
          400:     '#818cf8',
          500:     '#6366f1',   // hover
          DEFAULT: '#4f46e5',   // indigo-600 — primary action
          600:     '#4f46e5',
          700:     '#4338ca',   // active
          800:     '#3730a3',
          900:     '#312e81',
          950:     '#1e1b4b',
        },

        // ── Semantic colours ─────────────────────────────────────────────────
        success: {
          DEFAULT: '#16a34a',
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          900: '#14532d',
        },
        warning: {
          DEFAULT: '#d97706',
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          900: '#78350f',
        },
        danger: {
          DEFAULT: '#dc2626',
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          900: '#7f1d1d',
        },
        info: {
          DEFAULT: '#2563eb',
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },

        // ── Semantic surface tokens (mapped to CSS vars, theme-aware) ────────
        // These reference CSS custom properties defined in globals.css.
        // They work in both light and dark mode via the .dark class.
        background: 'var(--color-background)',
        surface:    'var(--color-surface)',
        elevated:   'var(--color-elevated)',
        overlay:    'var(--color-overlay)',
        border:     'var(--color-border)',
        'muted':    'var(--color-muted)',
      },

      // ── Spacing (4 px base — matches Tailwind default, explicit for clarity)
      // Default Tailwind spacing: 1=0.25rem=4px, 2=0.5rem=8px … at 16px root.
      // Explicit pixel overrides ensure the intent survives root-font changes.
      spacing: {
        px:  '1px',
        0:   '0px',
        0.5: '2px',
        1:   '4px',
        1.5: '6px',
        2:   '8px',
        2.5: '10px',
        3:   '12px',
        3.5: '14px',
        4:   '16px',
        5:   '20px',
        6:   '24px',
        7:   '28px',
        8:   '32px',
        9:   '36px',
        10:  '40px',
        11:  '44px',
        12:  '48px',
        14:  '56px',
        16:  '64px',
        20:  '80px',
        24:  '96px',
        28:  '112px',
        32:  '128px',
        36:  '144px',
        40:  '160px',
        44:  '176px',
        48:  '192px',
        52:  '208px',
        56:  '224px',
        60:  '240px',
        64:  '256px',
        72:  '288px',
        80:  '320px',
        96:  '384px',
      },

      // ── Custom Keyframes ─────────────────────────────────────────────────
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to:   { opacity: '0' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          from: { opacity: '1', transform: 'scale(1)' },
          to:   { opacity: '0', transform: 'scale(0.95)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition:  '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        bounceIn: {
          '0%':   { opacity: '0', transform: 'scale(0.3)' },
          '50%':  { opacity: '1', transform: 'scale(1.05)' },
          '70%':  {               transform: 'scale(0.9)' },
          '100%': {               transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-14px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        checkDraw: {
          '0%':   { strokeDashoffset: '48' },
          '100%': { strokeDashoffset: '0' },
        },
      },

      // ── Named Animations ─────────────────────────────────────────────────
      animation: {
        fadeIn:       'fadeIn 0.15s ease-out both',
        fadeOut:      'fadeOut 0.1s ease-in both',
        slideUp:      'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        slideDown:    'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        slideInLeft:  'slideInLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        slideInRight: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        scaleIn:      'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) both',
        scaleOut:     'scaleOut 0.1s ease-in both',
        shimmer:      'shimmer 2s linear infinite',
        pulse:        'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        spin:         'spin 0.8s linear infinite',
        spinSlow:     'spin 2s linear infinite',
        bounceIn:     'bounceIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        float:        'float 6s ease-in-out infinite',
        floatSlow:    'floatSlow 8s ease-in-out infinite',
        floatDelay:   'floatSlow 7s ease-in-out 1.5s infinite',
        checkDraw:    'checkDraw 0.6s ease-out 0.2s both',
      },

      // ── Transition Timing ────────────────────────────────────────────────
      transitionTimingFunction: {
        spring:  'cubic-bezier(0.16, 1, 0.3, 1)',
        snappy:  'cubic-bezier(0.4, 0, 0.2, 1)',
        ease:    'cubic-bezier(0.4, 0, 0.6, 1)',
        'ease-in':  'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },

      transitionDuration: {
        fast:   '100ms',
        base:   '150ms',
        slow:   '250ms',
        slower: '350ms',
      },

      // ── Z-index scale ────────────────────────────────────────────────────
      zIndex: {
        hide:         '-1',
        base:          '0',
        raised:       '10',
        dropdown:    '100',
        sticky:      '200',
        overlay:     '300',
        modal:       '400',
        popover:     '500',
        toast:       '600',
        tooltip:     '700',
        max:        '9999',
      },

      // ── Breakpoints ──────────────────────────────────────────────────────
      screens: {
        xs:  '480px',
        sm:  '640px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl': '1440px',
        '3xl': '1920px',
      },
    },
  },

  plugins: [],
}

export default config
