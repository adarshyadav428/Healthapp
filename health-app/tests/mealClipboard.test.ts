import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MEAL_CLIPBOARD_TTL_MS,
  canPasteOn,
  clipboardSourceLabel,
  parseMealClipboard,
  serializeMealClipboard,
  type MealClipboard,
} from '../lib/mealClipboard'

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0) // 2026-09-03

const clip = (over: Partial<MealClipboard> = {}): MealClipboard => ({
  date: '2026-09-02',
  meal: 'lunch',
  label: 'Lunch',
  emoji: '🍛',
  items: 9,
  kcal: 1429,
  copiedAt: NOW - 60_000,
  ...over,
})

describe('serialize/parse round trip', () => {
  it('returns exactly what was stored', () => {
    const c = clip()
    expect(parseMealClipboard(serializeMealClipboard(c), NOW)).toEqual(c)
  })
})

describe('parseMealClipboard rejects anything it cannot trust', () => {
  it('returns null for empty input', () => {
    expect(parseMealClipboard(null, NOW)).toBeNull()
    expect(parseMealClipboard(undefined, NOW)).toBeNull()
    expect(parseMealClipboard('', NOW)).toBeNull()
  })

  it('never throws on malformed JSON', () => {
    expect(parseMealClipboard('{not json', NOW)).toBeNull()
    expect(parseMealClipboard('"a string"', NOW)).toBeNull()
    expect(parseMealClipboard('null', NOW)).toBeNull()
    expect(parseMealClipboard('[]', NOW)).toBeNull()
  })

  it('rejects a bad date', () => {
    expect(parseMealClipboard(JSON.stringify(clip({ date: '02-09-2026' })), NOW)).toBeNull()
    expect(parseMealClipboard(JSON.stringify({ ...clip(), date: 20260902 }), NOW)).toBeNull()
  })

  it('rejects a meal slot that is not one of the four', () => {
    expect(parseMealClipboard(JSON.stringify({ ...clip(), meal: 'brunch' }), NOW)).toBeNull()
  })

  it('rejects a missing or non-numeric copiedAt', () => {
    expect(parseMealClipboard(JSON.stringify({ ...clip(), copiedAt: 'yesterday' }), NOW)).toBeNull()
    expect(parseMealClipboard(JSON.stringify({ ...clip(), copiedAt: Number.NaN }), NOW)).toBeNull()
  })

  it('expires a copy older than the TTL, and keeps one on the boundary', () => {
    expect(parseMealClipboard(JSON.stringify(clip({ copiedAt: NOW - MEAL_CLIPBOARD_TTL_MS })), NOW)).not.toBeNull()
    expect(parseMealClipboard(JSON.stringify(clip({ copiedAt: NOW - MEAL_CLIPBOARD_TTL_MS - 1 })), NOW)).toBeNull()
  })

  it('fills display-only fields rather than rejecting the entry', () => {
    // label/emoji/items/kcal are cosmetic — the server re-reads the real meal —
    // so a payload missing them must still paste.
    const parsed = parseMealClipboard(JSON.stringify({ date: '2026-09-02', meal: 'snack', copiedAt: NOW }), NOW)
    expect(parsed).toEqual({
      date: '2026-09-02', meal: 'snack', label: 'snack', emoji: '🍽️', items: 0, kcal: 0, copiedAt: NOW,
    })
  })

  it('rounds a fractional kcal', () => {
    expect(parseMealClipboard(JSON.stringify(clip({ kcal: 1428.6 })), NOW)?.kcal).toBe(1429)
  })
})

describe('canPasteOn', () => {
  it('hides the paste button on the day the meal was copied from', () => {
    expect(canPasteOn(clip({ date: '2026-09-02' }), '2026-09-02')).toBe(false)
  })

  it('shows it on any other day', () => {
    expect(canPasteOn(clip({ date: '2026-09-02' }), '2026-09-03')).toBe(true)
    expect(canPasteOn(clip({ date: '2026-09-02' }), '2026-08-30')).toBe(true)
  })

  it('is false with no clipboard', () => {
    expect(canPasteOn(null, '2026-09-03')).toBe(false)
  })
})

describe('clipboardSourceLabel', () => {
  it('names today and yesterday relatively', () => {
    expect(clipboardSourceLabel('2026-09-03', '2026-09-03')).toBe('today')
    expect(clipboardSourceLabel('2026-09-02', '2026-09-03')).toBe('yesterday')
  })

  it('crosses a month boundary correctly', () => {
    expect(clipboardSourceLabel('2026-08-31', '2026-09-01')).toBe('yesterday')
  })

  it('falls back to a short date further back', () => {
    expect(clipboardSourceLabel('2026-08-28', '2026-09-03')).toBe('Aug 28')
  })
})

/**
 * Wiring assertions, in the shape of tests/coachingWiring.test.ts: the defects
 * these guard live between the component and the route, not inside either.
 *
 *   1. Paste must write to the day being VIEWED. Omitting `date` means today,
 *      so a dropped `date: logDate` would silently file a pasted meal on today
 *      while the user was looking at last Tuesday — the exact failure the
 *      camera shipped with (see CLAUDE.md, "every logging surface threads the
 *      date it is looking at").
 *   2. The route must re-read the source meal rather than trust a payload.
 *      A clipboard is client-side storage; anything it carried into an insert
 *      would be user-editable kcal.
 */
describe('paste wiring', () => {
  const readSrc = (...parts: string[]) =>
    readFileSync(join(__dirname, '..', ...parts), 'utf8')

  const card = readSrc('components', 'log', 'PasteMealCard.tsx')
  const route = readSrc('app', 'api', 'logs', 'copy-meal', 'route.ts')

  it('sends the viewed day as the paste target', () => {
    expect(card).toMatch(/date: logDate/)
  })

  it('names the source day and meal, and nothing else, in the request', () => {
    const body = /body: JSON\.stringify\(\{[^}]*\}\)/.exec(card)?.[0]
    expect(body, 'the paste payload moved or changed shape').toBeTruthy()
    expect(body).toContain('from_date: source.date')
    expect(body).toContain('meal: source.meal')
    // No nutrition, no item list — the server re-reads the meal.
    expect(body).not.toMatch(/kcal|protein|carbs|fat|grams|items/)
  })

  it('gates the target day through resolveLoggedAtForRequest', () => {
    // Free accounts can only write inside their history window, and no account
    // may write to a future day. That check is this one function, everywhere.
    expect(route).toContain('resolveLoggedAtForRequest(supabase, userId, date)')
  })

  it('accepts no nutrition fields from the client', () => {
    const schema = /const copyMealSchema = z\.object\(\{[\s\S]*?\n\}\)/.exec(route)?.[0]
    expect(schema, 'the copy-meal schema moved or changed shape').toBeTruthy()
    expect(schema).not.toMatch(/kcal|protein|carbs|fat|grams|food_id/)
  })

  it('reads the source day as an IST calendar day', () => {
    expect(route).toContain('getIstDayRange(dateStrToUtcMidnight(from_date))')
  })
})
