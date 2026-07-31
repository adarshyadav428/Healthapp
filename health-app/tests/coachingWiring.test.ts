/**
 * How the coaching line gets its day context.
 *
 * `coachingLine` and `dayContextFor` are pure and tested in coaching.test.ts.
 * The two defects this file guards were not in either of them — they were in
 * the wiring, which is exactly the seam that had no coverage:
 *
 *   1. `useChatLog` can log to a PAST date (the Food tab's day nav passes
 *      `logDate`), but it fed the line TODAY's totals. Back-filling yesterday's
 *      dinner produced "that puts you 400 kcal over for today" — computed from
 *      a different day's eating, stated as fact.
 *   2. Both hooks passed `dailyTotals` straight through, ignoring `isLoading`
 *      and `error`. `useDailyTotals` returns zeros in both cases, which is
 *      indistinguishable from an untouched day, so a failed read promised a
 *      full budget to someone who had none left.
 *
 * Asserted against the hook sources because the bug lives between the hook and
 * the function, and a renderHook test would need a testing-library dependency
 * and a jsdom environment this repo does not have — a heavy way to check two
 * lines of derivation. These are coupling assertions, deliberately narrow.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HOOKS = join(__dirname, '..', 'hooks')

const chatLog = readFileSync(join(HOOKS, 'useChatLog.ts'), 'utf8')
const cameraScan = readFileSync(join(HOOKS, 'useCameraScan.ts'), 'utf8')

describe('useChatLog scopes the day context to the day being logged to', () => {
  it('passes the logged date into useDailyTotals', () => {
    // Not `useDailyTotals(user?.id ?? null)` — that is always today.
    expect(chatLog).toMatch(/useDailyTotals\(\s*user\?\.id \?\? null,\s*logDate \?/)
  })

  it('converts the date string with the IST-aware helper', () => {
    // logDate is a YYYY-MM-DD IST date string. dateStrToUtcMidnight exists for
    // exactly this; `new Date(logDate)` would land on the wrong IST day for
    // anyone the far side of midnight UTC.
    expect(chatLog).toContain('dateStrToUtcMidnight(logDate)')
  })

  it('still sends that same date when it logs the meal', () => {
    // If the log payload and the totals ever disagree about which day this is,
    // the sentence describes a different day than the one being written to.
    expect(chatLog).toMatch(/date: logDate/)
  })
})

describe('useCameraScan uses today, because that is the day it writes to', () => {
  it('takes no date argument', () => {
    expect(cameraScan).toMatch(/useDailyTotals\(user\?\.id \?\? null\)/)
  })

  /**
   * The above is only correct while the camera has no back-dating. If a `date`
   * is ever added to its log payload, today's totals become the wrong context
   * and this test should fail rather than let the mismatch ship quietly.
   */
  it('does not back-date its log, which is what makes today correct', () => {
    const logBody = /body: JSON\.stringify\(\{ food_id: selected\.food\.id[^}]*\}\)/.exec(
      cameraScan
    )?.[0]
    expect(logBody, 'the camera log payload moved or changed shape').toBeTruthy()
    expect(logBody).not.toMatch(/\bdate\b/)
  })
})

describe('neither hook builds the day context by hand', () => {
  it.each([
    ['useChatLog', chatLog],
    ['useCameraScan', cameraScan],
  ])('%s routes through dayContextFor', (_name, source) => {
    expect(source).toContain('dayContextFor({')
  })

  it.each([
    ['useChatLog', chatLog],
    ['useCameraScan', cameraScan],
  ])('%s does not pass raw totals into coachingLine', (_name, source) => {
    // The original bug shape: `{ kcal: dailyTotals.kcal, protein: dailyTotals.protein_g }`
    // inline at the call site, which cannot express "we do not know yet".
    expect(source).not.toMatch(/protein:\s*dailyTotals\.protein_g/)
  })
})
