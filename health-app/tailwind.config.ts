import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── New design tokens ──
        accent:         '#FB7445',
        'accent-2':     '#FFB36B',
        'accent-ink':   '#B5471A',
        'accent-soft':  '#FFF0E7',
        'accent-line':  '#FBDCCB',
        canvas:         '#EDEBE4',
        surface:        '#FAFAF7',
        ink:            '#16181D',
        'card-border':  '#F1EFE9',
        protein:        '#2F6FE0',
        carbs:          '#E89316',
        fat:            '#E0554D',
        water:          '#2F6FE0',
        'water-soft':   '#EFF7FE',
        'water-border': '#DDEBF8',
        secondary:      '#6B7280',
        // ── CSS-var aliases (existing components) ──
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted:      'var(--muted)',
        border:     'var(--border)',
        card:       'var(--card)',
        primary:    'var(--primary)',
        success:    'var(--success)',
        warning:    'var(--warning)',
        danger:     'var(--danger)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      borderRadius: {
        xl:   '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

export default config
