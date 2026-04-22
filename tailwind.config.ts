import type { Config } from 'tailwindcss';

// Design tokens — these mirror app/globals.css so Tailwind utilities resolve
// to the same CSS custom properties, letting light/dark swap via [data-theme].
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        },
        credit: 'rgb(var(--color-credit) / <alpha-value>)',
        debit: 'rgb(var(--color-debit) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        reconciled: 'rgb(var(--color-reconciled) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['0.875rem', { lineHeight: '1.35rem' }], // 14px
        dense: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
      },
      spacing: {
        row: '2.25rem', // 36px default register row
        'row-compact': '2rem', // 32px compact
      },
      boxShadow: {
        surface: '0 1px 2px rgb(0 0 0 / 0.04)',
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
