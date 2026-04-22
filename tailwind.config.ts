import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong: 'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        },
        chrome: {
          DEFAULT: 'rgb(var(--color-chrome) / <alpha-value>)',
          text: 'rgb(var(--color-chrome-text) / <alpha-value>)',
          muted: 'rgb(var(--color-chrome-muted) / <alpha-value>)',
          border: 'rgb(var(--color-chrome-border) / <alpha-value>)',
        },
        credit: 'rgb(var(--color-credit) / <alpha-value>)',
        debit: 'rgb(var(--color-debit) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--color-accent-soft) / <alpha-value>)',
        },
        reconciled: 'rgb(var(--color-reconciled) / <alpha-value>)',
        stat: {
          1: 'rgb(var(--stat-1) / <alpha-value>)',
          2: 'rgb(var(--stat-2) / <alpha-value>)',
          3: 'rgb(var(--stat-3) / <alpha-value>)',
          4: 'rgb(var(--stat-4) / <alpha-value>)',
          5: 'rgb(var(--stat-5) / <alpha-value>)',
          6: 'rgb(var(--stat-6) / <alpha-value>)',
          7: 'rgb(var(--stat-7) / <alpha-value>)',
          8: 'rgb(var(--stat-8) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['0.875rem', { lineHeight: '1.35rem' }],
        dense: ['0.8125rem', { lineHeight: '1.25rem' }],
      },
      boxShadow: {
        surface: '0 1px 2px rgb(0 0 0 / 0.25)',
        card: '0 4px 16px rgb(0 0 0 / 0.25)',
      },
      transitionDuration: {
        '120': '120ms',
        '180': '180ms',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
