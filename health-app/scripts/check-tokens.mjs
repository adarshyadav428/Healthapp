#!/usr/bin/env node
/**
 * Design-token guard for the Ember theme system (Porcelain light / Onyx dark).
 *
 * Everything visual routes through a finite, named scale: colors are CSS custom
 * properties defined once in app/globals.css (`:root` = Porcelain, `.dark` =
 * Onyx); type and radius are named steps in tailwind.config.ts. Four things
 * break that, and each is a rule below:
 *
 *  1. Raw hex/rgba color literals in components — they render identically in
 *     both themes instead of flipping with `--token`.
 *  2. Tailwind's `/NN` opacity modifier on our token color classes (e.g.
 *     `bg-surface/60`) — tailwind.config.ts defines every token as a plain
 *     `var(--x)` string, not the `rgb(var(--x) / <alpha-value>)` pattern
 *     opacity modifiers need, so `/NN` on a token is a silent no-op: Tailwind
 *     drops the modifier and renders full-strength. Found repeatedly during
 *     the Ember rollout (P3–P5) — this guard exists so it doesn't recur.
 *  3. Arbitrary type and radius (`text-[13px]`, `rounded-[20px]`). These are
 *     how the scale drifted: the app reached ~29 distinct font sizes, eight of
 *     which were spelled two ways at once (`text-sm` and `text-[14px]` are the
 *     same 14px and both shipped). Inconsistency at that scale is what a user
 *     reads as "cheap" before reading a word.
 *  4. Tailwind's default type classes (`text-sm`, `text-2xl`, …). They are a
 *     second, parallel scale — the one the named steps replaced. Leaving them
 *     legal is what lets two spellings for one size come back.
 *
 * Exemptions (real, intentional, non-themeable values):
 *   - ALLOWLIST_FILES: whole-file exemption (PWA meta colors, the studio's
 *     own reference token values).
 *   - `// token-check-ignore` on/near a line: skip that line.
 *   - `// token-check-ignore-start` … `// token-check-ignore-end`: skip the
 *     block between them (e.g. a fixed multi-color brand mark like the
 *     Google "G" logo, which must never re-theme).
 *
 * Run: npm run check:tokens   (add --report for the full per-file breakdown)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN = ['app', 'components']
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist'])

const ALLOWLIST_FILES = new Set([
  'app/layout.tsx',      // themeColor media-query pair — <meta> needs literal colors
  'app/manifest.ts',     // PWA manifest colors — no CSS vars in manifest.json
  'components/studio/StudioClient.tsx', // WORLDS = the token source of truth itself
])

// Every token/alias name from tailwind.config.ts `colors`. Kept in sync by
// hand — if you add a token there, add it here too, or this check goes blind
// to opacity-modifier misuse on the new name.
const TOKEN_NAMES = [
  'canvas', 'surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'hairline', 'scrim', 'header-bg',
  'brand', 'brand-soft', 'brand-ink', 'brand-ring', 'energy', 'energy-ink', 'energy-soft', 'track',
  'good', 'danger', 'danger-soft', 'protein', 'carbs', 'fat',
  'background', 'foreground', 'card', 'card-border', 'border', 'muted', 'secondary',
  'primary', 'accent', 'accent-soft', 'accent-ink', 'accent-line', 'accent-2',
  'success', 'warning', 'water', 'water-soft', 'water-border',
]

// Tailwind's own type scale — the parallel scale the named steps replaced.
const LEGACY_TYPE = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']

// The radius side/corner modifiers Tailwind accepts, so `rounded-tl-[14px]`
// is caught as surely as `rounded-[14px]`.
const RADIUS_SIDES = 't|r|b|l|tl|tr|br|bl|s|e|ss|se|ee|es'

const OPACITY_TARGETS = 'bg|text|border|ring|stroke|fill|from|to|via|divide|outline|decoration'

/**
 * One rule per thing that breaks the system. Each is a global regex run
 * line-by-line, plus the hint printed when it matches.
 */
const RULES = [
  {
    id: 'hex',
    label: 'raw hex color(s)',
    re: /#[0-9a-fA-F]{3,8}\b/g,
    hint: 'use a design token (bg-brand, text-ink, …) — a hex literal cannot flip between themes',
  },
  {
    id: 'opacity',
    label: 'broken opacity modifier(s) on token color(s)',
    re: new RegExp('\\b(?:' + OPACITY_TARGETS + ')-(?:' + TOKEN_NAMES.join('|') + ')/\\d{1,3}\\b', 'g'),
    hint: 'this /NN is silently dropped — use a dedicated -soft/-ring token, color-mix(), or drop the modifier',
  },
  {
    id: 'type-arbitrary',
    label: 'arbitrary font size(s)',
    re: /\btext-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
    hint: 'use a scale step: text-micro/caption/body/body-lg/title-sm/title/title-lg/display/hero/hero-lg',
  },
  {
    id: 'type-legacy',
    label: 'Tailwind default type class(es)',
    re: new RegExp('\\btext-(?:' + LEGACY_TYPE.join('|') + ')\\b', 'g'),
    hint: 'use a scale step: xs→caption, sm→body, base→body-lg, lg/xl→title-sm, 2xl→title, 3xl→title-lg, 4xl→display, 5xl→hero',
  },
  {
    id: 'radius-arbitrary',
    label: 'arbitrary border radius/radii',
    re: new RegExp('\\brounded(?:-(?:' + RADIUS_SIDES + '))?-\\[\\d+(?:\\.\\d+)?(?:px|rem|em)\\]', 'g'),
    hint: 'use a scale step: rounded-control (12) / rounded-card (20) / rounded-card-lg (24) / rounded-sheet (28) / rounded-full',
  },
  {
    id: 'tracking',
    label: 'hand-set letter-spacing',
    // `tracking-caps` and `tracking-normal` are the only two legal spellings:
    // one for letterspaced caps, one for explicitly resetting inherited caps.
    // Everything else fights the per-step tracking the type scale already sets.
    re: /\btracking-(?:\[[^\]]+\]|tighter|tight|wide|wider|widest)\b/g,
    hint: 'the type scale sets tracking per step — use tracking-caps for uppercase labels, tracking-normal to reset, nothing else',
  },
]

function walk(dir) {
  const out = []
  let entries
  try { entries = readdirSync(join(ROOT, dir)) } catch { return out }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue
    const rel = join(dir, name)
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) out.push(...walk(rel))
    else if (/\.(tsx|ts)$/.test(name)) out.push(rel)
  }
  return out
}

/** Line indices (0-based) to skip, honoring ignore comments/blocks. */
function ignoredLines(lines) {
  const skip = new Set()
  let inBlock = false
  lines.forEach((line, i) => {
    if (line.includes('token-check-ignore-start')) { inBlock = true; skip.add(i); return }
    if (line.includes('token-check-ignore-end')) { inBlock = false; skip.add(i); return }
    if (inBlock || line.includes('token-check-ignore')) skip.add(i)
  })
  return skip
}

/** → { [ruleId]: [{ line, count, sample }] } for every rule that matched. */
function scanFile(file) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const lines = text.split('\n')
  const skip = ignoredLines(lines)
  const hits = {}
  lines.forEach((line, i) => {
    if (skip.has(i)) return
    for (const rule of RULES) {
      const m = line.match(rule.re)
      if (!m) continue
      if (!hits[rule.id]) hits[rule.id] = []
      hits[rule.id].push({ line: i + 1, count: m.length, sample: m.slice(0, 3).join(' ') })
    }
  })
  return hits
}

const report = process.argv.includes('--report')
const files = SCAN.flatMap(walk)

let violations = 0
const perFile = []
const perRule = Object.fromEntries(RULES.map((r) => [r.id, 0]))

for (const f of files) {
  const rel = relative(ROOT, join(ROOT, f)).replace(/\\/g, '/')
  if (ALLOWLIST_FILES.has(rel)) continue
  const hits = scanFile(f)
  const total = (id) => (hits[id] || []).reduce((n, h) => n + h.count, 0)
  const count = RULES.reduce((n, r) => n + total(r.id), 0)
  if (count === 0) continue
  perFile.push({ rel, count })
  violations += count
  for (const rule of RULES) {
    const n = total(rule.id)
    if (!n) continue
    perRule[rule.id] += n
    console.error(`\x1b[31m✗\x1b[0m ${rel} — ${n} ${rule.label}:`)
    for (const h of hits[rule.id]) console.error(`    line ${h.line}: ${h.sample}  (${rule.hint})`)
  }
}

if (report) {
  console.log('\n── Violations by file ──')
  perFile
    .sort((a, b) => b.count - a.count)
    .forEach(({ rel, count }) => console.log(`  ${String(count).padStart(4)}  ${rel}`))
  console.log('\n── Violations by rule ──')
  for (const rule of RULES) console.log(`  ${String(perRule[rule.id]).padStart(4)}  ${rule.id}`)
}

console.log(`\nToken check: ${violations} violation(s) across ${perFile.length} file(s).`)

if (violations > 0) {
  console.error('\n\x1b[31mFAIL\x1b[0m — use design tokens and the named type/radius scale, not raw values.')
  process.exit(1)
}
console.log('\x1b[32mPASS\x1b[0m — token-clean.')
