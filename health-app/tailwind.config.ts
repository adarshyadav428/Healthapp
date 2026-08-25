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
        // The label colour that sits ON an accent fill. Never hard-code white:
        // the dark-mode accent is bright and white on it measures 2.3:1.
        'on-accent':   'var(--on-accent)',

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
      // ── Type scale · ten steps, named for intent ──
      //
      // Before this existed the app rendered ~29 distinct sizes: Tailwind's nine
      // defaults plus twenty arbitrary `text-[Npx]` values. Eight sizes were
      // spelled two ways at once — `text-sm` and `text-[14px]` are both 14px and
      // both shipped. That inconsistency is the thing a user reads as "cheap"
      // before they read a single word, so the scale is now finite and the token
      // guard fails the build on anything outside it.
      //
      // Each step carries its own line-height and tracking. Tracking tightens as
      // size grows — the single detail that separates a designed numeral from a
      // default one, and the reason the calorie hero needs no other treatment.
      // Sizes map onto Apple's text styles so the names carry intent, not px.
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
        // Display type gets its tracking from the scale step above, so the only
        // tracking a component still sets by hand is letterspaced caps — and
        // five values were doing that one job: .025em (52 labels), .1em, .12em,
        // .14em, and Tailwind's `widest`. At 0.025em the letterspacing is
        // invisible on caps; at 0.14em it is a mannerism. 0.08em sits inside
        // the range Apple tracks caps at and holds up at both 11px and 13px.
        caps: '0.08em',
      },
      // Three named rhythm values on top of Tailwind's 4px scale. Not a
      // replacement for it — p-4/gap-3 stay correct for everything local. These
      // exist so the screen edge, card padding and section gap are stated once
      // instead of being re-guessed per screen, which is how they drifted.
      spacing: {
        edge:    'var(--space-edge)',     // 24px · screen edge margin
        card:    'var(--space-card)',     // 20px · card padding
        section: 'var(--space-section)',  // 28px · gap between sections
      },
      borderRadius: {
        // Four steps: controls · cards · large cards · sheets (full pill is built-in).
        // `card` is 20px, not the 18px it used to be: docs/design-system.md already
        // told every core screen to write rounded-[20px], so the config was the
        // half of the pair that was wrong. 20 and 24 were the two most-used radii
        // in the app and neither existed here.
        // Values live in globals.css as --radius-*, so radius is themeable in the
        // same place as colour rather than in a second, silently-diverging list.
        control:   'var(--radius-control)',  // 12px
        card:      'var(--radius-card)',     // 20px
        'card-lg': 'var(--radius-card-lg)',  // 24px
        sheet:     'var(--radius-sheet)',    // 28px
        // legacy aliases mapped onto the scale
        xl:      '0.75rem',
        '2xl':   '1.25rem',
        '3xl':   '1.75rem',
      },
      boxShadow: {
        rest:  'var(--shadow-rest)',
        float: 'var(--shadow-float)',
        cta:   'var(--cta-shadow)',
        fab:   'var(--fab-shadow)',
        // `--shadow-air` is the Ember Air card elevation and has existed as a
        // token since that pass began — but never as a Tailwind key, so the
        // only way to reach it was an inline style, which is why ~27 sites
        // write `style={{ boxShadow: 'var(--shadow-air)' }}` by hand. Worse,
        // `shadow-air` silently rendered as *no shadow at all*: Tailwind emits
        // nothing for an unknown key, so the class looked right in review and
        // did nothing in the browser. Prefer this class from here on; the
        // remaining inline uses still work, and the conditional ones
        // (`isToday ? undefined : …`) genuinely need to stay inline.
        air:   'var(--shadow-air)',
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
