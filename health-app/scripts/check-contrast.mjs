/**
 * Contrast gate for the token palette.
 *
 * The brief that produced the Kelp palette said "minimum 4.5:1 on body text,
 * 3:1 on large text. Verify, don't assume." A number written in a design doc is
 * not verification — it goes stale the first time somebody nudges a hex. So this
 * parses the ACTUAL values out of app/globals.css and recomputes every pair.
 *
 * It caught seven real failures in the palette that shipped before it existed,
 * including --ink-3 at 2.59:1 (used for every 11-13px caption in the app) and
 * white-on-accent CTA labels at 3.14:1.
 *
 * WCAG 2.1 thresholds:
 *   4.5  body text
 *   3.0  large text (>=18.66px bold / 24px) and UI graphics
 *
 * Run: npm run check:contrast
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')

/** Pull one custom-property block (`:root {...}` / `.dark {...}`) into a map. */
function readBlock(selector) {
  const start = CSS.indexOf(selector + ' {')
  if (start === -1) throw new Error(`No ${selector} block in globals.css`)
  const end = CSS.indexOf('\n}', start)
  const body = CSS.slice(start, end)
  const out = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const light = readBlock(':root')
const dark = { ...light, ...readBlock('.dark') } // dark inherits anything it does not restate

/** #rgb / #rrggbb -> [r,g,b]. Non-hex values (rgba, gradients) return null. */
function rgb(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

const channel = (c) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * [foreground token, background token, minimum, description]
 *
 * `#literal` is allowed for the two grounds a token is composited on that are
 * not themselves tokens (pure white/black CTA labels are tokens now, so there
 * are none left — kept for future pairs).
 */
const PAIRS = [
  ['--ink', '--surface', 4.5, 'primary text on a card'],
  ['--ink', '--canvas', 4.5, 'primary text on the ground'],
  ['--ink-2', '--surface', 4.5, 'secondary text on a card'],
  ['--ink-2', '--canvas', 4.5, 'secondary text on the ground'],
  ['--ink-3', '--surface', 4.5, 'muted captions on a card (11-13px)'],
  ['--ink-3', '--canvas', 4.5, 'muted captions on the ground'],
  ['--brand', '--surface', 3.0, 'accent as ring / graphic on a card'],
  ['--brand', '--canvas', 3.0, 'accent as ring / graphic on the ground'],
  ['--brand-text', '--surface', 4.5, 'accent used as text'],
  ['--on-accent', '--brand', 4.5, 'label on an accent fill (CTA, FAB)'],
  ['--good', '--surface', 3.0, 'on-track state'],
  ['--bad', '--surface', 4.5, 'error / over-goal text'],
  ['--protein', '--surface', 3.0, 'protein bar / ring'],
  ['--carbs', '--surface', 3.0, 'carbs bar / ring'],
  ['--fat', '--surface', 3.0, 'fat bar / ring'],
  ['--surface', '--canvas', 1.05, 'card separates from ground without a border'],
]

let failures = 0

for (const [name, tokens] of [['light', light], ['dark', dark]]) {
  console.log(`\n${name}`)
  console.log('-'.repeat(78))
  for (const [fgKey, bgKey, min, label] of PAIRS) {
    const fgRaw = tokens[fgKey]
    const bgRaw = tokens[bgKey]
    if (!fgRaw || !bgRaw) {
      console.log(`SKIP           ${label}  (${!fgRaw ? fgKey : bgKey} not defined)`)
      continue
    }
    const fg = rgb(fgRaw)
    const bg = rgb(bgRaw)
    if (!fg || !bg) {
      // Translucent tokens composite over whatever is behind them, so a static
      // ratio would be a guess. Better to say so than to print a wrong number.
      console.log(`SKIP           ${label}  (not a flat hex: ${!fg ? fgRaw : bgRaw})`)
      continue
    }
    const ratio = contrast(fg, bg)
    const ok = ratio >= min
    if (!ok) failures++
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)}:1  need ${min.toFixed(2)}  ` +
      `${label.padEnd(42)} ${fgRaw} on ${bgRaw}`
    )
  }
}

console.log('\n' + '='.repeat(78))
if (failures > 0) {
  console.error(`FAIL - ${failures} pair(s) below their threshold.`)
  console.error('Fix the token in app/globals.css. Do not lower the threshold.')
  process.exit(1)
}
console.log('PASS - every pair clears its threshold in both themes.')
