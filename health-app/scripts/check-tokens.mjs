#!/usr/bin/env node
/**
 * Design-token guard for the Ember theme system (Porcelain light / Onyx dark).
 *
 * Every color routes through CSS custom properties defined once in
 * app/globals.css (`:root` = Porcelain, `.dark` = Onyx) and mapped to
 * Tailwind class names in tailwind.config.ts. Two things break that:
 *
 *  1. Raw hex/rgba color literals in components — they render identically in
 *     both themes instead of flipping with `--token`.
 *  2. Tailwind's `/NN` opacity modifier on our token color classes (e.g.
 *     `bg-surface/60`) — tailwind.config.ts defines every token as a plain
 *     `var(--x)` string, not the `rgb(var(--x) / <alpha-value>)` pattern
 *     opacity modifiers need, so `/NN` on a token is a silent no-op: Tailwind
 *     drops the modifier and renders full-strength. Found repeatedly during
 *     the Ember rollout (P3–P5) — this guard exists so it doesn't recur.
 *
 * Exemptions (real, intentional, non-themeable colors):
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
  'app/opengraph-image.tsx', // Satori can't read CSS tokens — Ember palette inlined
  'components/studio/StudioClient.tsx', // WORLDS = the token source of truth itself
])

// Hex colors like #FFF / #16191C / #16191CAA.
const HEX = /#[0-9a-fA-F]{3,8}\b/g

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
const OPACITY_MODIFIER = new RegExp(
  `\\b(?:bg|text|border|ring|stroke|fill|from|to|via|divide|outline|decoration)-(?:${TOKEN_NAMES.join('|')})/\\d{1,3}\\b`,
  'g'
)

// Arbitrary spacing values — `mt-[3px]`, `px-[18px]`, `gap-[18px]`, `p-[22px]`.
// The Ember system has a 4px/8px scale; a hardcoded value opts out of it and
// drifts. Deliberately margin / padding / gap only — NOT h-/w-/max-w-, where
// an arbitrary value is often the only option. This is ADVISORY + a ratchet:
// it prints violations and fails only if the count rises above the baseline
// below, so it ships green today and stops new ones without forcing a sweep.
const ARB_SPACING = /\b(?:m[trblxy]?|p[trblxy]?|gap(?:-[xy])?|space-[xy])-\[[^\]]+\]/g
const SPACING_BASELINE = 53

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

function scanFile(file) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const lines = text.split('\n')
  const skip = ignoredLines(lines)
  const hexHits = []
  const opacityHits = []
  const spacingHits = []
  lines.forEach((line, i) => {
    if (skip.has(i)) return
    const hex = line.match(HEX)
    if (hex) hexHits.push({ line: i + 1, count: hex.length, sample: hex.slice(0, 3).join(' ') })
    const opacity = line.match(OPACITY_MODIFIER)
    if (opacity) opacityHits.push({ line: i + 1, count: opacity.length, sample: opacity.slice(0, 3).join(' ') })
    const spacing = line.match(ARB_SPACING)
    if (spacing) spacingHits.push({ line: i + 1, count: spacing.length, sample: spacing.slice(0, 3).join(' ') })
  })
  return { hexHits, opacityHits, spacingHits }
}

const report = process.argv.includes('--report')
const files = SCAN.flatMap(walk)

let violations = 0
let spacingTotal = 0
const perFile = []
const spacingPerFile = []

for (const f of files) {
  const rel = relative(ROOT, join(ROOT, f)).replace(/\\/g, '/')
  if (ALLOWLIST_FILES.has(rel)) continue
  const { hexHits, opacityHits, spacingHits } = scanFile(f)
  const spacingCount = spacingHits.reduce((n, h) => n + h.count, 0)
  if (spacingCount > 0) {
    spacingTotal += spacingCount
    spacingPerFile.push({ rel, count: spacingCount, spacingHits })
  }
  const count = hexHits.reduce((n, h) => n + h.count, 0) + opacityHits.reduce((n, h) => n + h.count, 0)
  if (count === 0) continue
  perFile.push({ rel, count, hexHits, opacityHits })
  violations += count
  if (hexHits.length) {
    console.error(`\x1b[31m✗\x1b[0m ${rel} — ${hexHits.reduce((n, h) => n + h.count, 0)} raw hex color(s):`)
    for (const h of hexHits) console.error(`    line ${h.line}: ${h.sample}`)
  }
  if (opacityHits.length) {
    console.error(`\x1b[31m✗\x1b[0m ${rel} — ${opacityHits.reduce((n, h) => n + h.count, 0)} broken opacity modifier(s) on token color(s):`)
    for (const h of opacityHits) console.error(`    line ${h.line}: ${h.sample}  (this /NN is silently dropped — use a dedicated -soft/-ring token, color-mix(), or drop the modifier)`)
  }
}

if (report) {
  console.log('\n── Violations by file ──')
  perFile
    .sort((a, b) => b.count - a.count)
    .forEach(({ rel, count }) => console.log(`  ${String(count).padStart(3)}  ${rel}`))
}

console.log(`\nToken check: ${violations} violation(s) across ${perFile.length} file(s).`)

// ── Spacing (advisory + ratchet) ────────────────────────────────────────────
if (spacingTotal > 0 || report) {
  console.log(
    `\nSpacing (advisory): ${spacingTotal} arbitrary m/p/gap value(s) across ${spacingPerFile.length} file(s); baseline ${SPACING_BASELINE}.`
  )
  if (report) {
    for (const { rel, spacingHits } of spacingPerFile.sort((a, b) => b.count - a.count)) {
      console.log(`  ${rel}`)
      for (const h of spacingHits) console.log(`    line ${h.line}: ${h.sample}`)
    }
  }
}
const spacingRegressed = spacingTotal > SPACING_BASELINE

if (violations > 0) {
  console.error('\n\x1b[31mFAIL\x1b[0m — use design tokens, not raw hex; and no opacity modifiers on token colors.')
  process.exit(1)
}
if (spacingRegressed) {
  console.error(
    `\n\x1b[31mFAIL\x1b[0m — arbitrary spacing values rose to ${spacingTotal} (baseline ${SPACING_BASELINE}). ` +
      `Use the 4px/8px scale, or run with --report to see the new ones. ` +
      `If a new arbitrary value is genuinely unavoidable, add a '// token-check-ignore' and bump SPACING_BASELINE.`
  )
  process.exit(1)
}
console.log('\x1b[32mPASS\x1b[0m — token-clean.')
