/**
 * The meal clipboard — "copy this Breakfast, paste it on another day".
 *
 * Two deliberate shapes here:
 *
 * 1. **The clipboard is a reference, not a payload.** It stores only *which
 *    day and which meal* was copied, plus a few display-only numbers. The
 *    paste re-reads that meal server-side (`/api/logs/copy-meal`) and
 *    re-inserts the stored rows. Carrying the items themselves would put
 *    kcal/macros in the client's hands on the way back in, which is the one
 *    thing every logging route in this app refuses to do. It also means an
 *    edit to the source meal between copy and paste is honoured rather than
 *    silently pasting a stale snapshot — and a *deleted* source meal 404s
 *    instead of pasting nothing.
 *
 * 2. **It lives in localStorage**, because copy and paste happen on two
 *    different days and changing the day is a navigation. React state does not
 *    survive it; a reload or an app restart in between is normal.
 *
 * The TTL exists so a copy made a fortnight ago doesn't sit on the screen as a
 * paste button the user has long forgotten the meaning of.
 */
import type { Meal } from './meal'
import { istDateStr } from './dateUtils'
import { shiftDateStr } from './logDates'

export const MEAL_CLIPBOARD_KEY = 'gis:meal-clipboard:v1'

/** A copy older than this is dropped on read. */
export const MEAL_CLIPBOARD_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type MealClipboard = {
  /** The IST day the meal was copied FROM (YYYY-MM-DD). */
  date: string
  meal: Meal
  /** Display only — the section heading as it was labelled when copied. */
  label: string
  /** Display only. */
  emoji: string
  /** Display only — what the meal held at copy time. */
  items: number
  /** Display only, rounded kcal. */
  kcal: number
  copiedAt: number
}

const MEALS: readonly string[] = ['breakfast', 'lunch', 'dinner', 'snack']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function serializeMealClipboard(clip: MealClipboard): string {
  return JSON.stringify(clip)
}

/**
 * Read a clipboard back. Returns null for anything that isn't a well-formed,
 * unexpired entry — a hand-edited localStorage value, a payload from an older
 * shape, or a copy made more than MEAL_CLIPBOARD_TTL_MS ago. Never throws:
 * this runs on every /log render and a bad value must degrade to "no paste
 * button", not to a blank screen.
 */
export function parseMealClipboard(raw: string | null | undefined, now: number = Date.now()): MealClipboard | null {
  if (!raw) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null

  const c = value as Record<string, unknown>
  if (typeof c.date !== 'string' || !DATE_RE.test(c.date)) return null
  if (typeof c.meal !== 'string' || !MEALS.includes(c.meal)) return null
  if (typeof c.copiedAt !== 'number' || !Number.isFinite(c.copiedAt)) return null
  if (now - c.copiedAt > MEAL_CLIPBOARD_TTL_MS) return null

  return {
    date: c.date,
    meal: c.meal as Meal,
    label: typeof c.label === 'string' && c.label ? c.label : c.meal,
    emoji: typeof c.emoji === 'string' && c.emoji ? c.emoji : '🍽️',
    items: typeof c.items === 'number' && Number.isFinite(c.items) ? c.items : 0,
    kcal: typeof c.kcal === 'number' && Number.isFinite(c.kcal) ? Math.round(c.kcal) : 0,
    copiedAt: c.copiedAt,
  }
}

/**
 * Whether the paste affordance belongs on the day currently being viewed.
 * Pasting a meal back onto the day it came from would silently double it, and
 * the copy button for that meal is already on screen — so the source day is the
 * one day the button must not appear on.
 */
export function canPasteOn(clip: MealClipboard | null, dateStr: string): boolean {
  return clip !== null && clip.date !== dateStr
}

/** "today" / "yesterday" / "Sep 1" — how the paste card names where a meal came from. */
export function clipboardSourceLabel(dateStr: string, todayStr: string = istDateStr()): string {
  if (dateStr === todayStr) return 'today'
  if (dateStr === shiftDateStr(todayStr, -1)) return 'yesterday'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
