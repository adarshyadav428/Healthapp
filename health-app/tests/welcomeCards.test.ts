import { describe, it, expect } from 'vitest'
import { buildWelcomeCards } from '../lib/welcomeCards'
import type { WrappedStats } from '../lib/wrappedStats'

const blank: WrappedStats = {
  daysLogged: 0,
  totalMeals: 0,
  avgKcal: 0,
  topFood: null,
  longestStreakDays: 0,
  currentStreakDays: 0,
  proteinDaysHit: 0,
  weightDeltaKg: null,
  bestDay: null,
  aiScans: 0,
  hasStory: false,
}

const lived: WrappedStats = {
  ...blank,
  daysLogged: 31,
  totalMeals: 412,
  avgKcal: 1780,
  topFood: { name: 'Dal Tadka', count: 27 },
  longestStreakDays: 12,
  currentStreakDays: 12,
  weightDeltaKg: -2.4,
  hasStory: true,
}

const ids = (s: WrappedStats, extra = {}) => buildWelcomeCards({ stats: s, ...extra }).map((c) => c.id)

describe('buildWelcomeCards — shape', () => {
  it('always opens on the moment and closes on an action', () => {
    for (const stats of [blank, lived]) {
      const cards = buildWelcomeCards({ stats })
      expect(cards[0].id).toBe('welcome-hello')
      expect(cards[0].tone).toBe('ember')
      expect(cards[cards.length - 1].id).toBe('welcome-go')
      expect(cards[cards.length - 1].tone).toBe('ember')
    }
  })

  it('always explains what changed, story or not', () => {
    expect(ids(blank)).toContain('welcome-unlocked')
    expect(ids(lived)).toContain('welcome-unlocked')
  })

  it('gives every card a unique id, so the engine keys are safe', () => {
    const all = ids(lived)
    expect(new Set(all).size).toBe(all.length)
  })

  it('produces only serializable cards — no functions cross the boundary', () => {
    const cards = buildWelcomeCards({ stats: lived })
    expect(JSON.parse(JSON.stringify(cards))).toEqual(cards)
  })
})

describe('buildWelcomeCards — the day-one upgrader', () => {
  it('shows a day-one card instead of a screen of zeroes', () => {
    const got = ids(blank)
    expect(got).toContain('welcome-day-one')
    expect(got).not.toContain('welcome-days')
    expect(got).not.toContain('welcome-meals')
  })

  it('never renders a proud zero anywhere in the sequence', () => {
    const cards = buildWelcomeCards({ stats: blank })
    for (const card of cards) {
      expect(card.value ?? '').not.toBe('0')
    }
  })

  it('promises the screen will fill up rather than apologising', () => {
    const dayOne = buildWelcomeCards({ stats: blank }).find((c) => c.id === 'welcome-day-one')!
    expect(dayOne.body).toMatch(/fills up/i)
  })
})

describe('buildWelcomeCards — earning a card', () => {
  it('includes a stat only when its number means something', () => {
    // One day in: the day counter is worth showing, the rest are not.
    const thin: WrappedStats = { ...blank, daysLogged: 1, totalMeals: 2, hasStory: true }
    const got = ids(thin)
    expect(got).toContain('welcome-days')
    expect(got).not.toContain('welcome-meals')   // under 10
    expect(got).not.toContain('welcome-streak')  // under 3
    expect(got).not.toContain('welcome-weight')  // no weigh-ins
  })

  it('singularises a single day', () => {
    const one = buildWelcomeCards({ stats: { ...blank, daysLogged: 1, hasStory: true } })
    expect(one.find((c) => c.id === 'welcome-days')!.label).toBe('day logged')
    const many = buildWelcomeCards({ stats: lived })
    expect(many.find((c) => c.id === 'welcome-days')!.label).toBe('days logged')
  })

  it('skips a top dish that is a coincidence rather than a habit', () => {
    const twice: WrappedStats = { ...lived, topFood: { name: 'Idli', count: 2 } }
    expect(ids(twice)).not.toContain('welcome-top-food')
    const thrice: WrappedStats = { ...lived, topFood: { name: 'Idli', count: 3 } }
    expect(ids(thrice)).toContain('welcome-top-food')
  })

  it('leads the top-dish card with the count and the dish name', () => {
    const card = buildWelcomeCards({ stats: lived }).find((c) => c.id === 'welcome-top-food')!
    expect(card.value).toBe('27×')
    expect(card.label).toBe('Dal Tadka')
  })
})

describe('buildWelcomeCards — weight is only ever good news here', () => {
  it('celebrates a loss', () => {
    const card = buildWelcomeCards({ stats: lived }).find((c) => c.id === 'welcome-weight')!
    expect(card.value).toBe('2.4 kg')
    expect(card.label).toMatch(/down/i)
  })

  it('says nothing about a gain — this screen is not where you learn that', () => {
    expect(ids({ ...lived, weightDeltaKg: 1.5 })).not.toContain('welcome-weight')
  })

  it('says nothing about noise around zero', () => {
    expect(ids({ ...lived, weightDeltaKg: 0 })).not.toContain('welcome-weight')
    expect(ids({ ...lived, weightDeltaKg: -0.05 })).not.toContain('welcome-weight')
  })

  it('says nothing when there are too few weigh-ins to know', () => {
    expect(ids({ ...lived, weightDeltaKg: null })).not.toContain('welcome-weight')
  })
})

describe('buildWelcomeCards — the unlock card', () => {
  it('names the scans actually spent, to make the wall concrete', () => {
    const card = buildWelcomeCards({ stats: lived, aiTrialUsed: 3 })
      .find((c) => c.id === 'welcome-unlocked')!
    expect(card.swaps![0].before).toBe('3 of 3 AI scans used')
    expect(card.swaps![0].after).toBe('Unlimited')
  })

  it('frames the allowance rather than scolding someone who never used one', () => {
    const card = buildWelcomeCards({ stats: lived, aiTrialUsed: 0 })
      .find((c) => c.id === 'welcome-unlocked')!
    expect(card.swaps![0].before).toBe('3 free AI scans')
    expect(card.swaps![0].before).not.toMatch(/0 of/)
  })

  it('never claims more scans were spent than exist', () => {
    // Pro users keep scanning, so the lifetime count runs past the allowance.
    const card = buildWelcomeCards({ stats: lived, aiTrialUsed: 91 })
      .find((c) => c.id === 'welcome-unlocked')!
    expect(card.swaps![0].before).toBe('3 of 3 AI scans used')
  })
})

describe('buildWelcomeCards — names', () => {
  it('uses a first name when there is one', () => {
    const cards = buildWelcomeCards({ stats: lived, firstName: 'Adarsh' })
    expect(cards[0].title).toBe("You're Pro, Adarsh.")
  })

  it('falls back cleanly for anonymous accounts', () => {
    // Migration 026 allows NULL-email users; they must not produce "You're Pro, ."
    expect(buildWelcomeCards({ stats: lived }).at(0)!.title).toBe("You're Pro.")
    expect(buildWelcomeCards({ stats: lived, firstName: null }).at(0)!.title).toBe("You're Pro.")
    expect(buildWelcomeCards({ stats: lived, firstName: '   ' }).at(0)!.title).toBe("You're Pro.")
  })
})

describe('buildWelcomeCards — the Pro object', () => {
  it('hands over a Streak Rescue, story or not', () => {
    expect(ids(lived)).toContain('welcome-rescue')
    expect(ids(blank)).toContain('welcome-rescue')
  })

  it('places it last before the CTA — everything above is history or a wall coming down', () => {
    const cards = buildWelcomeCards({ stats: lived })
    expect(cards.at(-2)!.id).toBe('welcome-rescue')
    expect(cards.at(-1)!.id).toBe('welcome-go')
  })
})
