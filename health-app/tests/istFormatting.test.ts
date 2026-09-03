/**
 * Everything a user reads a date or a time from is IST.
 *
 * The app has defined a day as IST everywhere since `getUtcDayRange` was
 * deleted — but only in the *logic*. The display layer kept formatting in the
 * runtime's zone, which is a third definition of a day, invisible in review
 * because `new Date(iso).toLocaleTimeString('en-IN', …)` reads as if the
 * 'en-IN' already settled the question. It does not: a locale picks the
 * language and the field order, never the zone.
 *
 * Three of these survived two audits (2026-09-03: P1-8 Trends grouping, P1-9
 * the Home header, P2-4 the recent-meal clock). They are fixed here, but the
 * durable half of the fix is the ESLint rule — so this file pins the rule too.
 * Deleting `.eslintrc.json`'s guards would otherwise turn `npm run lint` green
 * and take the whole defence with it, silently.
 *
 * Every assertion below is timezone-independent on purpose: it must hold on
 * Adarsh's IST laptop and on Vercel's UTC builders alike. That is the point.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { formatIst, istDateStr, IST_TZ } from '../lib/dateUtils'
import { lastIstDateStrs } from '../lib/logDates'

// 19:30 UTC is 01:00 IST the NEXT calendar day — the window every one of these
// bugs lived in, and the window Indian users log late dinners in.
const LATE_NIGHT = '2026-09-03T19:30:00Z'
// 18:00 UTC is 23:30 IST the same day: the last half hour before the boundary.
const JUST_BEFORE = '2026-09-03T18:00:00Z'

describe('formatIst pins the zone, whatever the runtime is set to', () => {
  it('renders the clock in IST, not the runtime zone', () => {
    expect(formatIst(LATE_NIGHT, { hour: 'numeric', minute: '2-digit', hour12: true }))
      .toMatch(/^1:00\s?am$/i)
  })

  it('rolls the calendar date at IST midnight, not UTC midnight', () => {
    // The whole class of bug in one assertion: this instant is the 3rd in UTC
    // and the 4th in IST, and the app must say the 4th.
    expect(formatIst(LATE_NIGHT, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA'))
      .toBe('2026-09-04')
    expect(formatIst(JUST_BEFORE, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA'))
      .toBe('2026-09-03')
  })

  it('agrees with istDateStr, the logic layer’s definition of the same day', () => {
    // Display and logic disagreeing about which day it is *is* the defect.
    for (const iso of [LATE_NIGHT, JUST_BEFORE, '2026-01-01T00:00:00Z']) {
      expect(formatIst(iso, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA'))
        .toBe(istDateStr(new Date(iso)))
    }
  })

  it('ignores a caller-supplied timeZone rather than letting it through', () => {
    // The helper is the sanctioned door precisely because it cannot be talked
    // out of IST; a caller wanting UTC uses an explicit toLocale* call, which
    // the lint rule permits and a reviewer can see.
    expect(formatIst(LATE_NIGHT, { hour: 'numeric', hour12: false, timeZone: 'UTC' }))
      .toBe(formatIst(LATE_NIGHT, { hour: 'numeric', hour12: false }))
  })

  it('lets the caller keep choosing field order', () => {
    // en-US "Sep 3" vs en-IN "3 Sept" — a copy decision the helper must not
    // eat, or every date in the app quietly restyles the day this lands. The
    // spelling differs too ("Sept"), which is exactly why the locale stayed at
    // the call site: each converted site kept whichever one it already used.
    expect(formatIst(JUST_BEFORE, { month: 'short', day: 'numeric' }, 'en-US')).toBe('Sep 3')
    expect(formatIst(JUST_BEFORE, { month: 'short', day: 'numeric' }, 'en-IN')).toMatch(/^3 Sept?$/)
  })

  it('exports the zone as one constant', () => {
    expect(IST_TZ).toBe('Asia/Kolkata')
  })
})

describe('lastIstDateStrs walks IST days', () => {
  it('is oldest-first and ends on the given day', () => {
    expect(lastIstDateStrs(7, '2026-09-04')).toEqual([
      '2026-08-29', '2026-08-30', '2026-08-31',
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
    ])
  })

  it('crosses a month and a year boundary', () => {
    expect(lastIstDateStrs(3, '2027-01-01')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('returns exactly the requested number of days', () => {
    for (const n of [1, 5, 14, 30]) expect(lastIstDateStrs(n, '2026-09-04')).toHaveLength(n)
  })

  it('defaults to the IST today, so a chart cannot end on the wrong day', () => {
    const days = lastIstDateStrs(7)
    expect(days[days.length - 1]).toBe(istDateStr())
  })
})

/**
 * The lint rule is the part that survives us. These assertions are about the
 * config file, not about behaviour — they exist so that weakening the guard
 * costs a red test instead of nothing at all.
 */
describe('the lint rule that keeps this from coming back', () => {
  const eslintrc = JSON.parse(
    readFileSync(join(__dirname, '..', '.eslintrc.json'), 'utf8')
  ) as { rules?: Record<string, unknown> }

  const restrictedSyntax = JSON.stringify(eslintrc.rules?.['no-restricted-syntax'] ?? null)
  const restrictedImports = JSON.stringify(eslintrc.rules?.['no-restricted-imports'] ?? null)

  it.each([
    ['toLocaleDateString / toLocaleTimeString', 'toLocale(Date|Time)String'],
    ['new Date(...).toLocaleString', "callee.property.name='toLocaleString'"],
    ['bare Intl.DateTimeFormat', "callee.property.name='DateTimeFormat'"],
  ])('still bans %s', (_label, needle) => {
    expect(restrictedSyntax).toContain(needle)
  })

  it('lets an explicit timeZone through', () => {
    // Without this exemption the rule is unusable and would be turned off:
    // /wrapped, the streak-rescue card and the diary header all format a
    // synthetic UTC-midnight date and say so.
    expect(restrictedSyntax).toContain('timeZone')
  })

  it('still bans date-fns', () => {
    expect(restrictedImports).toContain('date-fns')
  })

  it('lints the directories the leaks were actually found in', () => {
    // `next lint` covers app/components/lib by default. hooks/ and store/ are
    // not in that default set, and useChatLog — one of the leaks — is in hooks/.
    const nextConfig = readFileSync(join(__dirname, '..', 'next.config.js'), 'utf8')
    const dirs = /dirs:\s*\[([^\]]*)\]/.exec(nextConfig)?.[1] ?? ''
    for (const dir of ['app', 'components', 'hooks', 'lib', 'store']) {
      expect(dirs, `next.config.js must lint ${dir}/`).toContain(`'${dir}'`)
    }
  })
})

/**
 * A source sweep, because the lint rule cannot see two things: a file the lint
 * dirs miss, and the eslint-disable comment someone reaches for at 1am.
 */
describe('no shipped source formats a date in the runtime zone', () => {
  const ROOT = join(__dirname, '..')
  const DIRS = ['app', 'components', 'hooks', 'lib', 'store']

  const sources: { path: string; src: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry)) sources.push({ path: full.slice(ROOT.length + 1), src: readFileSync(full, 'utf8') })
    }
  }
  for (const d of DIRS) walk(join(ROOT, d))

  it('found the source tree', () => {
    expect(sources.length).toBeGreaterThan(100)
  })

  it.each([
    ['toLocaleDateString', /\.toLocaleDateString\(/g],
    ['toLocaleTimeString', /\.toLocaleTimeString\(/g],
  ])('every %s call names its timeZone', (_label, pattern) => {
    const offenders: string[] = []
    for (const { path, src } of sources) {
      for (const match of src.matchAll(pattern)) {
        // The options object is the rest of the call. Whichever zone it names,
        // it has to name one — that is the entire contract.
        const tail = src.slice(match.index ?? 0, (match.index ?? 0) + 400)
        const call = /\(([\s\S]*?)\)\s*(?:[;,)\n}]|$)/.exec(tail)?.[1] ?? tail
        if (!call.includes('timeZone')) offenders.push(`${path}: ${tail.split('\n')[0].trim()}`)
      }
    }
    expect(offenders, 'use formatIst() from lib/dateUtils').toEqual([])
  })

  it('nobody disables the rule with a comment', () => {
    const disabled = sources
      .filter(({ src }) => /eslint-disable[^\n]*no-restricted-(syntax|imports)/.test(src))
      .map(({ path }) => path)
    expect(disabled, 'a disable comment here re-opens the timezone hole').toEqual([])
  })

  it('date-fns is gone from the shipped tree', () => {
    // It only ever appeared in two files, and both walked local days. Leaving
    // the import legal is what let the second one copy the first.
    const importers = sources.filter(({ src }) => /from ['"]date-fns['"]/.test(src)).map(({ path }) => path)
    expect(importers).toEqual([])
  })
})
