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
        'hairline-2':  'var(--hairline-2)',
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
        'good-soft':   'var(--good-soft)',
        danger:        'var(--bad)',
        'danger-soft': 'var(--bad-soft)',

        // ── Azure · the public site's accent (see globals.css) ──
        azure:         'var(--azure)',
        'azure-text':  'var(--azure-text)',
        'azure-soft':  'var(--azure-soft)',
        'azure-ring':  'var(--azure-ring)',

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
      // ── Type scale · ten steps, named for intent ──
      //
      // Each step carries its own line-height and tracking; tracking tightens
      // as size grows, which is most of what separates a designed numeral from
      // a default one. Sizes map onto Apple's text styles so the names carry
      // intent, not px. `caption` and `body` predate the rest (the share-card
      // sheet needed them) and keep their values.
      //
      // Tailwind's own `text-sm`/`text-2xl` still resolve — ~500 call sites use
      // them and a page-by-page migration is how they move — but new code and
      // every shared primitive uses a named step, and `check:tokens` ratchets
      // the arbitrary `text-[Npx]` count so the parallel scale cannot grow.
      fontSize: {
        micro:      ['0.6875rem', { lineHeight: '0.875rem',  letterSpacing: '0.006em'  }], // 11 · Caption 2
        caption:    ['0.8125rem', { lineHeight: '1.125rem',  letterSpacing: '0em'      }], // 13 · Footnote
        body:       ['0.9375rem', { lineHeight: '1.25rem',   letterSpacing: '-0.006em' }], // 15 · Subheadline
        'body-lg':  ['1.0625rem', { lineHeight: '1.5rem',    letterSpacing: '-0.012em' }], // 17 · Body
        'title-sm': ['1.25rem',   { lineHeight: '1.5625rem', letterSpacing: '-0.018em' }], // 20 · Title 3
        title:      ['1.5rem',    { lineHeight: '1.8125rem', letterSpacing: '-0.022em' }], // 24 · Title 2
        'title-lg': ['1.875rem',  { lineHeight: '2.1875rem', letterSpacing: '-0.026em' }], // 30 · Title 1
        display:    ['2.25rem',   { lineHeight: '2.5rem',    letterSpacing: '-0.03em'  }], // 36 · Large Title
        hero:       ['3rem',      { lineHeight: '3.125rem',  letterSpacing: '-0.034em' }], // 48
        'hero-lg':  ['4rem',      { lineHeight: '4rem',      letterSpacing: '-0.038em' }], // 64 · calorie numeral
      },
      letterSpacing: {
        // Display type gets its tracking from the scale step above, so the
        // only tracking a component sets by hand is letterspaced caps — one
        // value for that one job. 0.08em sits inside the range Apple tracks
        // caps at and holds up at both 11px and 13px.
        caps: '0.08em',
      },
      borderRadius: {
        // Four steps: controls · cards · large cards · sheets (full pill is
        // built-in). `card` is 20px, not the 18px it used to be: the core
        // screens were already writing `rounded-[20px]` by hand, so the config
        // was the half of the pair that was wrong, and 20/24 were the two
        // most-used radii in the app with no name.
        control:   '0.75rem', // 12px
        card:      '1.25rem', // 20px
        'card-lg': '1.5rem',  // 24px
        sheet:     '1.75rem', // 28px
        // A phone bezel on the public site's product screenshots — nothing
        // inside the app is this round.
        phone:     '2.75rem', // 44px
        // legacy aliases mapped onto the scale
        xl:      '0.75rem',
        '2xl':   '1.25rem',
        '3xl':   '1.75rem',
      },
      boxShadow: {
        // `air` and `rest` are the same value on purpose — one card elevation
        // for the whole app. `air` exists as a name because 29 call sites had
        // been writing `style={{ boxShadow: 'var(--shadow-air)' }}` inline for
        // want of a class.
        air:   'var(--shadow-air)',
        rest:  'var(--shadow-rest)',
        float: 'var(--shadow-float)',
        cta:   'var(--cta-shadow)',
        fab:   'var(--fab-shadow)',
        azure: 'var(--azure-shadow)',
      },
      backgroundImage: {
        'cta-grad':  'var(--cta-grad)',
        'ava-grad':  'var(--ava-grad)',
        'hero-wash': 'var(--hero-wash)',
        'azure-grad': 'var(--azure-grad)',
        'azure-wash': 'var(--azure-wash)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.32,.72,0,1)',
        out:    'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  // `hover:` only where a pointer can hover. Without this a tap on a phone
  // leaves the hover style stuck on the element until the next tap lands
  // somewhere else — the sticky-highlight that makes a touch UI feel like a
  // website. Tailwind wraps every hover variant in `@media (hover: hover)`.
  future: { hoverOnlyWhenSupported: true },
  plugins: [],
}

export default config
