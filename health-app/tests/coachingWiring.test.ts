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

/**
 * The camera used to take no date at all: it always wrote to today, and this
 * file pinned that, with a tripwire saying today's totals stop being the right
 * context the moment a `date` is added to the payload.
 *
 * That tripwire fired. The camera is reachable from the Food tab's day nav
 * (FoodLanding and FoodSearch both pass `logDate`), so "always today" silently
 * misfiled any meal scanned while viewing an earlier day. It now back-dates
 * like useChatLog, and is held to the same contract: the day it writes to and
 * the day it talks about must be the same day.
 */
describe('useCameraScan scopes the day context to the day being logged to', () => {
  it('passes the logged date into useDailyTotals', () => {
    expect(cameraScan).toMatch(/useDailyTotals\(\s*user\?\.id \?\? null,\s*logDate \?/)
  })

  it('converts the date string with the IST-aware helper', () => {
    expect(cameraScan).toContain('dateStrToUtcMidnight(logDate)')
  })

  it('still sends that same date when it logs one detected food', () => {
    const logBody = /body: JSON\.stringify\(\{ food_id: selected\.food\.id[^}]*\}\)/.exec(
      cameraScan
    )?.[0]
    expect(logBody, 'the camera log payload moved or changed shape').toBeTruthy()
    expect(logBody).toMatch(/date: logDate/)
  })

  it('threads the date through the bulk path when a plate has several foods', () => {
    // A multi-food scan logs every item via /api/logs/add-bulk. Same contract:
    // the day it writes to must be the day the totals/coaching describe.
    const at = cameraScan.indexOf("'/api/logs/add-bulk'")
    expect(at, 'the camera must log a multi-food plate via /api/logs/add-bulk').toBeGreaterThan(-1)
    const call = cameraScan.slice(at, at + 400)
    expect(call).toMatch(/date: logDate/)
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

/**
 * Every logging surface threads the date it is looking at.
 *
 * The two hooks above are not the whole set. `FoodLanding` renders on any
 * EDITABLE day — app/log/page.tsx passes `isToday={isToday}` and mounts it
 * whenever the day can be written to, "so a missed day can be backfilled" —
 * and its "Your combos" row carried no isToday guard while `logSavedMeal` sent
 * no date. `/api/meals/log` had no `date` in its schema at all, so every combo
 * took `logged_at DEFAULT now()`: tapping a saved combo while viewing a past
 * day filed the whole meal on TODAY, silently, and the viewed day's total
 * never moved. Exactly the camera defect that made this a hard rule, on the
 * one surface nothing here covered. Found by the 2026-09-03 audit (P0-2).
 *
 * Asserted against source for the same reason as the rest of this file: the
 * defect lives in the seam between a component, a hook and a route, which is
 * where neither a unit test nor a route test looks.
 */
describe('the saved-combo path threads its date too', () => {
  const foodLanding = readFileSync(
    join(__dirname, '..', 'components', 'log', 'FoodLanding.tsx'),
    'utf8'
  )
  const foodSearchHook = readFileSync(join(HOOKS, 'useFoodSearch.ts'), 'utf8')
  const mealsLogRoute = readFileSync(
    join(__dirname, '..', 'app', 'api', 'meals', 'log', 'route.ts'),
    'utf8'
  )

  it.each([
    ['FoodLanding', foodLanding],
    ['useFoodSearch', foodSearchHook],
  ])('%s sends a date with the saved-meal log', (_name, source) => {
    const at = source.indexOf("'/api/meals/log'")
    expect(at, 'the /api/meals/log call moved or changed shape').toBeGreaterThan(-1)
    // The fetch options object that follows the URL, comments and all.
    const call = source.slice(at, at + 900)
    const body = /body: JSON\.stringify\(([\s\S]*?)\),/.exec(call)?.[1]
    expect(body, 'the /api/meals/log request body moved or changed shape').toBeTruthy()
    expect(body).toContain('date:')
  })

  it('accepts the date server-side', () => {
    expect(mealsLogRoute).toMatch(/date:\s*z\.string\(\)/)
  })

  it('resolves logged_at through the shared backfill gate', () => {
    // Not `new Date()` inline: resolveLoggedAtForRequest also enforces the
    // free-tier backfill window, so accepting a date here must not become a
    // way around the limit that logs/add, add-bulk and quick-add all apply.
    expect(mealsLogRoute).toContain('resolveLoggedAtForRequest')
    expect(mealsLogRoute).toMatch(/logged_at,/)
  })

  it('does not let the row fall back to the column default', () => {
    // The whole bug: no logged_at on the insert means DEFAULT now().
    const insertBlock = /const logRows = items[\s\S]*?\}\)\)/.exec(mealsLogRoute)?.[0]
    expect(insertBlock, 'the logRows builder moved or changed shape').toBeTruthy()
    expect(insertBlock).toContain('logged_at')
  })
})

/**
 * The coaching line must reach the surface most logs actually use.
 *
 * `coachingLine` is pure, free and needs no AI call — but it was wired only
 * into useCameraScan and useChatLog, both of which sit behind a 3-call lifetime
 * AI trial that itself requires a verified email. So a free user logging by
 * search — the overwhelming majority of all logs — never saw a coaching
 * sentence at all: the app's best retention asset was attached to the one
 * surface almost nobody can reach (audit 2026-09-03, P1-13).
 *
 * AddFoodModal is that surface. Same two rules as the hooks above apply to it:
 * scope the day context to the day being logged to, and never pass raw totals.
 */
describe('AddFoodModal speaks after a search log', () => {
  const addModal = readFileSync(
    join(__dirname, '..', 'components', 'log', 'AddFoodModal.tsx'),
    'utf8'
  )

  it('calls coachingLine', () => {
    expect(addModal).toContain('coachingLine(')
  })

  it('routes the day context through dayContextFor', () => {
    expect(addModal).toContain('dayContextFor({')
  })

  it('does not pass raw totals into coachingLine', () => {
    expect(addModal).not.toMatch(/protein:\s*dailyTotals\.protein_g/)
  })

  it('scopes the totals to the day being logged to, not always today', () => {
    // logDate is the viewed day; using `new Date()` unconditionally would
    // describe today's budget while writing to a past day.
    expect(addModal).toMatch(/logDate \? dateStrToUtcMidnight\(logDate\) : new Date\(\)/)
  })

  it('is reachable from the surfaces that have a profile', () => {
    for (const file of ['FoodLanding.tsx', 'FoodSearch.tsx']) {
      const src = readFileSync(join(__dirname, '..', 'components', 'log', file), 'utf8')
      expect(src, `${file} must forward targets to AddFoodModal`).toMatch(/targets=\{targets\}/)
    }
    const page = readFileSync(join(__dirname, '..', 'app', 'log', 'page.tsx'), 'utf8')
    expect(page).toMatch(/targets=\{\{\s*kcal:/)
  })
})
