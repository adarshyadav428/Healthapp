#!/usr/bin/env node
/**
 * Design-token guard.
 *
 * The Peacock & Marigold rebrand routes every color through CSS variables /
 * Tailwind tokens. This script enforces that in migrated areas and tracks
 * progress everywhere else.
 *
 *  - GUARDED dirs must contain zero raw hex colors → exits 1 if any appear.
 *    Expand this list as each rebrand phase finishes.
 *  - The rest of app/ + components/ is reported as a remaining-hex count so we
 *    can watch the number fall to zero across phases.
 *
 * Run: npm run check:tokens   (add --report for the full per-file breakdown)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const GUARDED = ['components/ui', 'components/layout']
const SCAN = ['app', 'components']
const IGNORE = new Set(['node_modules', '.next', 'dist'])

// Hex colors like #FFF / #16191C / #16191CAA. The token files legitimately
// define these; everything else should reference them by name.
const HEX = /#[0-9a-fA-F]{3,8}\b/g

function walk(dir) {
  const out = []
  let entries
  try { entries = readdirSync(join(ROOT, dir)) } catch { return out }
  for (const name of entries) {
    if (IGNORE.has(name)) continue
    const rel = join(dir, name)
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) out.push(...walk(rel))
    else if (/\.(tsx|ts)$/.test(name)) out.push(rel)
  }
  return out
}

function hexHits(file) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const hits = []
  text.split('\n').forEach((line, i) => {
    // Skip SVG path fills and data — those are graphics, not theme surfaces.
    const m = line.match(HEX)
    if (m) hits.push({ line: i + 1, count: m.length, sample: m.slice(0, 3).join(' ') })
  })
  return hits
}

const report = process.argv.includes('--report')
const files = SCAN.flatMap(walk)

let guardedViolations = 0
let totalRemaining = 0
const perFile = []

for (const f of files) {
  const rel = relative(ROOT, join(ROOT, f)).replace(/\\/g, '/')
  const guarded = GUARDED.some((g) => rel.startsWith(g))
  const hits = hexHits(f)
  const count = hits.reduce((n, h) => n + h.count, 0)
  if (count === 0) continue
  totalRemaining += count
  perFile.push({ rel, count, hits, guarded })
  if (guarded) {
    guardedViolations += count
    console.error(`\x1b[31m✗ GUARDED\x1b[0m ${rel} — ${count} raw hex color(s):`)
    for (const h of hits) console.error(`    line ${h.line}: ${h.sample}`)
  }
}

if (report) {
  console.log('\n── Remaining raw hex by file (migration tracker) ──')
  perFile
    .sort((a, b) => b.count - a.count)
    .forEach(({ rel, count, guarded }) =>
      console.log(`  ${String(count).padStart(3)}  ${rel}${guarded ? '  ⚠ GUARDED' : ''}`)
    )
}

console.log(
  `\nToken check: ${totalRemaining} raw hex remaining across ${perFile.length} file(s); ` +
    `${guardedViolations} in guarded dirs (${GUARDED.join(', ')}).`
)

if (guardedViolations > 0) {
  console.error('\n\x1b[31mFAIL\x1b[0m — guarded directories must use design tokens, not raw hex.')
  process.exit(1)
}
console.log('\x1b[32mPASS\x1b[0m — guarded directories are token-clean.')
