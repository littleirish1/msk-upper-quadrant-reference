import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.mdx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Primary brand: HSC NI teal/blue ──────────────────────────────
        brand: {
          50:  '#eef6f9',
          100: '#d4ecf4',
          200: '#a8d9e9',
          300: '#72c0d8',
          400: '#3aa3c2',
          500: '#1a87aa',   // primary
          600: '#146b88',
          700: '#105470',
          800: '#0c3f55',
          900: '#072c3d',
          950: '#041c28',
        },
        // ── Accent: clinical amber ────────────────────────────────────────
        accent: {
          50:  '#fff8ed',
          100: '#ffeece',
          200: '#ffd99a',
          300: '#ffbf5c',
          400: '#ffa020',
          500: '#f08000',   // warning/highlight
          600: '#cc6400',
          700: '#a34d00',
          800: '#7d3c00',
          900: '#5c2e00',
        },
        // ── Red flags ────────────────────────────────────────────────────
        danger: {
          50:  '#fff2f2',
          100: '#ffe0e0',
          200: '#ffc0c0',
          300: '#ff9090',
          400: '#ff5050',
          500: '#e02020',   // red flag
          600: '#b81010',
          700: '#920c0c',
          800: '#6e0c0c',
          900: '#4a0808',
        },
        // ── Neutral (slate-based) ─────────────────────────────────────────
        surface: {
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
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      typography: (theme: (path: string) => string) => ({
        DEFAULT: {
          css: {
            '--tw-prose-links': theme('colors.brand.600'),
            '--tw-prose-headings': theme('colors.surface.900'),
            maxWidth: '72ch',
          },
        },
        invert: {
          css: {
            '--tw-prose-links': theme('colors.brand.300'),
            '--tw-prose-headings': theme('colors.surface.50'),
          },
        },
      }),
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
