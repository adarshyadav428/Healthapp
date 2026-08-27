import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──
        canvas:        'var(--canvas)',
        surface:       'var(--surface)',
        'surface-2':   'var(--surface-2)',
        ink:           'var(--ink)',
        'ink-2':       'var(--ink-2)',
        'ink-3':       'var(--ink-3)',
        hairline:      'var(--hairline)',
        scrim:         'var(--scrim)',
        'header-bg':   'var(--header-bg)',

        // ── Accent · ember (brand and energy are the same family now) ──
        brand:         'var(--brand)',
        'brand-soft':  'var(--brand-soft)',
        'brand-ink':   'var(--brand-text)',
        'brand-ring':  'var(--brand-ring)',
        energy:        'var(--energy)',
        'energy-ink':  'var(--energy-ink)',
        'energy-soft': 'var(--energy-soft)',
        track:         'var(--track)',

        // ── Semantic ──
        good:          'var(--good)',
        danger:        'var(--bad)',
        'danger-soft': 'var(--bad-soft)',

        // ── Macros ──
        protein:       'var(--protein)',
        carbs:         'var(--carbs)',
        fat:           'var(--fat)',

        // ── Back-compat aliases (existing class names → new tokens) ──
        // Surfaces
        background:    'var(--canvas)',
        foreground:    'var(--ink)',
        card:          'var(--surface)',
        'card-border': 'var(--hairline)',
        border:        'var(--hairline)',
        muted:         'var(--ink-2)',
        secondary:     'var(--ink-2)',
        // Interactive
        primary:       'var(--brand)',
        accent:        'var(--brand)',
        'accent-soft': 'var(--brand-soft)',
        'accent-ink':  'var(--brand-text)',
        'accent-line': 'var(--brand-soft)',
        'accent-2':    'var(--energy)',
        // Semantic
        success:       'var(--good)',
        warning:       'var(--energy-ink)',
        // Water → protein blue
        water:         'var(--protein)',
        'water-soft':  'var(--brand-soft)',
        'water-border':'var(--hairline)',
      },
      fontFamily: {
        sans:    ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
      // Two named steps, not a scale. The share-card chooser sheet
      // (components/progress/ShareProgressButton.tsx, ShareDayButton.tsx) was
      // built against a named type scale from an unrelated branch that never
      // landed here — without these, `text-body`/`text-caption` are unknown
      // Tailwind classes and silently apply no font size at all. Only the two
      // sizes those components actually use are added; this is not an attempt
      // to introduce the fuller scale.
      fontSize: {
        caption: ['0.8125rem', { lineHeight: '1.125rem' }], // 13px
        body:    ['0.9375rem', { lineHeight: '1.25rem'  }], // 15px
      },
      borderRadius: {
        // Four steps: controls · cards · sheets (full pill is built-in)
        control: '0.75rem',  // 12px
        card:    '1.125rem', // 18px
        sheet:   '1.75rem',  // 28px
        // legacy aliases mapped onto the scale
        xl:      '0.75rem',
        '2xl':   '1.125rem',
        '3xl':   '1.75rem',
      },
      boxShadow: {
        rest:  'var(--shadow-rest)',
        float: 'var(--shadow-float)',
        cta:   'var(--cta-shadow)',
        fab:   'var(--fab-shadow)',
      },
      backgroundImage: {
        'cta-grad':  'var(--cta-grad)',
        'ava-grad':  'var(--ava-grad)',
        'hero-wash': 'var(--hero-wash)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.32,.72,0,1)',
        out:    'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
}

export default config
