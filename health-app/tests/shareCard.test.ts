import { describe, it, expect } from 'vitest'
import { buildShareCardOptions, buildDayCardData, kgLostFrom, MAX_ITEM_LINES, type ShareCardInput, type DayCardLog } from '../lib/shareCard'

const NOTHING: ShareCardInput = { streakDays: 0, kgLost: null, deficit: null }
const input = (over: Partial<ShareCardInput> = {}): ShareCardInput => ({ ...NOTHING, ...over })
const topics = (over: Partial<ShareCardInput> = {}) =>
  buildShareCardOptions(input(over)).map((o) => o.topic)

describe('kgLostFrom', () => {
  it('subtracts current from start', () => {
    expect(kgLostFrom(82, 78.8)).toBeCloseTo(3.2)
  })

  it('is null when either end is unknown', () => {
    expect(kgLostFrom(null, 78)).toBeNull()
    expect(kgLostFrom(82, null)).toBeNull()
  })

  it('reports a gain as negative rather than hiding it — the caller decides', () => {
    expect(kgLostFrom(70, 71.5)).toBeCloseTo(-1.5)
  })
})

describe('buildShareCardOptions', () => {
  it('returns nothing to share when there is nothing to brag about', () => {
    expect(buildShareCardOptions(NOTHING)).toEqual([])
    expect(buildShareCardOptions(input({ kgLost: 0 }))).toEqual([])
  })

  it('never brags about the wrong direction', () => {
    expect(topics({ kgLost: -1.5 })).toEqual([])
  })

  it('ignores sub-0.1kg scale noise', () => {
    expect(topics({ kgLost: 0.05 })).toEqual([])
  })

  // The bug this rewrite exists to fix: the old builder made the streak the
  // hero whenever it was >= 1, so 8 kg down with a 2-day streak posted "2".
  it('puts a kilo or more ahead of any streak', () => {
    expect(topics({ kgLost: 8, streakDays: 2 })).toEqual(['weight', 'streak'])
    expect(topics({ kgLost: 8, streakDays: 400 })).toEqual(['weight', 'streak'])
  })

  it('puts a week-long streak ahead of a smaller loss', () => {
    expect(topics({ kgLost: 0.4, streakDays: 12 })).toEqual(['streak', 'weight'])
  })

  it('keeps a short streak behind a small loss', () => {
    expect(topics({ kgLost: 0.4, streakDays: 2 })).toEqual(['weight', 'streak'])
  })

  it('always ranks the deficit last — it is the least legible number to a friend', () => {
    expect(
      topics({ kgLost: 8, streakDays: 30, deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })
    ).toEqual(['weight', 'streak', 'deficit'])
  })

  it('offers the deficit on its own when it is all the user has', () => {
    expect(topics({ deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })).toEqual(['deficit'])
  })

  it('leads the weight card with the kilos and carries the streak underneath', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 3.24, streakDays: 12 }))
    expect(weight.data).toEqual({
      hero: { value: '3.2 kg', label: 'down since I started' },
      subline: '12 day logging streak',
    })
  })

  it('leaves the weight card sublineless when there is no streak', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 3.2 }))
    expect(weight.data.subline).toBeNull()
  })

  it('leads the streak card with the day count and the loss underneath', () => {
    const [streak] = buildShareCardOptions(input({ streakDays: 12, kgLost: 0.4 }))
    expect(streak.data).toEqual({
      hero: { value: '12', label: 'day streak' },
      subline: '▼ 0.4 kg down since I started',
    })
  })

  it('streak card has no subline with no weight data', () => {
    const [streak] = buildShareCardOptions(input({ streakDays: 5 }))
    expect(streak.data).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  // CLAUDE.md: anything comparing a day to a benchmark must say which benchmark.
  // "3,240 kcal" is a miss against a 1,600 eat-goal and a win against maintenance.
  it('names maintenance as the benchmark on the deficit card', () => {
    const [deficit] = buildShareCardOptions(
      input({ deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })
    )
    expect(deficit.data.hero.label).toBe('kcal under maintenance')
    expect(deficit.data.hero.value).toBe('3,240')
    expect(deficit.data.subline).toBe('This week · 6 days logged · 0.42 kg of fat')
  })

  it('labels the month period distinctly, so the two deficits can never be confused', () => {
    const [deficit] = buildShareCardOptions(
      input({ deficit: { kcal: 14200, period: 'month', daysLogged: 24, fatKg: 1.84 } })
    )
    expect(deficit.label).toBe("This month's deficit")
    expect(deficit.data.subline).toContain('This month')
  })

  it('singularises a one-day deficit', () => {
    const [deficit] = buildShareCardOptions(
      input({ deficit: { kcal: 500, period: 'week', daysLogged: 1, fatKg: 0.06 } })
    )
    expect(deficit.data.subline).toBe('This week · 1 day logged · 0.06 kg of fat')
  })

  // A surplus is not a brag, and a period with no completed days has no number.
  it('drops a deficit that is a surplus or has no logged days', () => {
    expect(topics({ deficit: { kcal: -800, period: 'week', daysLogged: 5, fatKg: -0.1 } })).toEqual([])
    expect(topics({ deficit: { kcal: 3240, period: 'week', daysLogged: 0, fatKg: 0.42 } })).toEqual([])
  })

  // The monthly Wrapped shares a card built from one month's snapshot. Left on
  // the default it would claim a lifetime total for a month's loss.
  it('scopes the weight copy to the period the caller names', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 1.8, sinceLabel: 'in August' }))
    expect(weight.data.hero.label).toBe('down in August')
  })

  it('scopes the streak subline to the same period', () => {
    const [streak] = buildShareCardOptions(
      input({ streakDays: 20, kgLost: 0.4, sinceLabel: 'in August' })
    )
    expect(streak.data.subline).toBe('▼ 0.4 kg down in August')
  })

  it('defaults to the lifetime wording when no period is named', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 1.8 }))
    expect(weight.data.hero.label).toBe('down since I started')
  })

  it('gives every option a chooser label', () => {
    const options = buildShareCardOptions(
      input({ kgLost: 3, streakDays: 12, deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })
    )
    expect(options.map((o) => o.label)).toEqual(['Weight lost', 'Streak', "This week's deficit"])
  })
})

const log = (over: Partial<DayCardLog> = {}): DayCardLog => ({
  meal: 'lunch', name: 'Dal Tadka', kcal: 180, proteinG: 9, carbsG: 24, fatG: 5, ...over,
})

describe('buildDayCardData', () => {
  it('returns null for a day with nothing logged, so the button stays hidden', () => {
    expect(buildDayCardData({ dateLabel: 'Tue, 26 August', logs: [] })).toBeNull()
  })

  it('orders meals through the day, never by when they were logged', () => {
    const data = buildDayCardData({
      dateLabel: 'Tue, 26 August',
      // Deliberately reversed: a snack logged first must not head the menu.
      logs: [log({ meal: 'snack' }), log({ meal: 'dinner' }), log({ meal: 'breakfast' })],
    })!
    expect(data.meals.map((m) => m.slot)).toEqual(['breakfast', 'dinner', 'snack'])
  })

  it('omits meals with nothing in them rather than printing empty headings', () => {
    const data = buildDayCardData({ dateLabel: 'Tue', logs: [log({ meal: 'lunch' })] })!
    expect(data.meals.map((m) => m.slot)).toEqual(['lunch'])
  })

  it('totals each meal and the day, and builds the macro line', () => {
    const data = buildDayCardData({
      dateLabel: 'Tue',
      logs: [
        log({ meal: 'breakfast', kcal: 300, proteinG: 12, carbsG: 40, fatG: 8 }),
        log({ meal: 'lunch', kcal: 520, proteinG: 20, carbsG: 70, fatG: 15 }),
        log({ meal: 'lunch', kcal: 180, proteinG: 9, carbsG: 24, fatG: 5 }),
      ],
    })!
    expect(data.meals.find((m) => m.slot === 'lunch')!.kcal).toBe(700)
    expect(data.totalKcal).toBe(1000)
    expect(data.macroLine).toBe('P 41g · C 134g · F 28g')
  })

  it('drops the macro line when nothing carries macros', () => {
    const data = buildDayCardData({
      dateLabel: 'Tue',
      logs: [log({ proteinG: 0, carbsG: 0, fatG: 0 })],
    })!
    expect(data.macroLine).toBeNull()
  })

  it('names a quick-add rather than printing an empty row', () => {
    const data = buildDayCardData({ dateLabel: 'Tue', logs: [log({ name: null })] })!
    expect(data.meals[0].items[0].name).toBe('Quick add')
    expect(buildDayCardData({ dateLabel: 'Tue', logs: [log({ name: '   ' })] })!.meals[0].items[0].name)
      .toBe('Quick add')
  })

  it('keeps a normal day whole', () => {
    const logs = Array.from({ length: 8 }, (_, i) => log({ name: `Dish ${i}` }))
    const data = buildDayCardData({ dateLabel: 'Tue', logs })!
    expect(data.meals[0].items).toHaveLength(8)
    expect(data.meals[0].hiddenItems).toBe(0)
  })

  // A card can only hold so many lines before the type shrinks past readable.
  it('clamps a very long day to the line budget', () => {
    const logs = Array.from({ length: 20 }, (_, i) => log({ name: `Dish ${i}` }))
    const data = buildDayCardData({ dateLabel: 'Tue', logs })!
    const shown = data.meals.reduce((s, m) => s + m.items.length, 0)
    expect(shown).toBe(12)
    expect(data.meals[0].hiddenItems).toBe(8)
  })

  it('trims the longest meal first, so a one-item meal is never emptied', () => {
    const logs = [
      log({ meal: 'breakfast', name: 'Poha' }),
      log({ meal: 'snack', name: 'Chai' }),
      ...Array.from({ length: 14 }, (_, i) => log({ meal: 'lunch', name: `Dish ${i}` })),
    ]
    const data = buildDayCardData({ dateLabel: 'Tue', logs })!
    const bySlot = Object.fromEntries(data.meals.map((m) => [m.slot, m]))
    expect(bySlot.breakfast.items.map((i) => i.name)).toEqual(['Poha'])
    expect(bySlot.snack.items.map((i) => i.name)).toEqual(['Chai'])
    expect(bySlot.lunch.hiddenItems).toBe(4)
  })

  // Silently dropping a dish is a lie about what someone ate.
  it('always accounts for what it left off', () => {
    const logs = Array.from({ length: 20 }, (_, i) => log({ name: `Dish ${i}` }))
    const data = buildDayCardData({ dateLabel: 'Tue', logs })!
    const shown = data.meals.reduce((s, m) => s + m.items.length, 0)
    const hidden = data.meals.reduce((s, m) => s + m.hiddenItems, 0)
    expect(shown + hidden).toBe(20)
  })

  // The total is the day's real total, not the sum of what survived the clamp.
  it('totals the whole day even when items are hidden', () => {
    const logs = Array.from({ length: 20 }, () => log({ kcal: 100 }))
    expect(buildDayCardData({ dateLabel: 'Tue', logs })!.totalKcal).toBe(2000)
  })

  // A square has about half a story's vertical room once the plate and the
  // footer band are paid for; one budget for both ran the menu into the band.
  it('honours a tighter budget for the square format', () => {
    const logs = Array.from({ length: 20 }, (_, i) => log({ name: `Dish ${i}` }))
    const square = buildDayCardData({ dateLabel: 'Tue', logs, maxItemLines: MAX_ITEM_LINES.square })!
    expect(square.meals.reduce((s, m) => s + m.items.length, 0)).toBe(MAX_ITEM_LINES.square)
    expect(MAX_ITEM_LINES.square).toBeLessThan(MAX_ITEM_LINES.story)
  })

  it('still accounts for everything it dropped under the tighter budget', () => {
    const logs = Array.from({ length: 20 }, (_, i) => log({ name: `Dish ${i}` }))
    const square = buildDayCardData({ dateLabel: 'Tue', logs, maxItemLines: MAX_ITEM_LINES.square })!
    const shown = square.meals.reduce((s, m) => s + m.items.length, 0)
    const hidden = square.meals.reduce((s, m) => s + m.hiddenItems, 0)
    expect(shown + hidden).toBe(20)
  })
})
