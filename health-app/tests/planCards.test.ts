import { describe, it, expect } from 'vitest'
import { buildPlanCards, type PlanCardArgs } from '../lib/planCards'

const NOW = new Date('2026-07-29T00:00:00.000Z')

const base: PlanCardArgs = {
  firstName: null,
  dailyCalorieTarget: 1850,
  proteinTargetG: 138,
  goal: 'lose',
  currentWeightKg: 82,
  targetWeightKg: 74,
  paceKgPerWeek: 0.5,
  now: NOW,
}

const ids = (over: Partial<PlanCardArgs> = {}) =>
  buildPlanCards({ ...base, ...over }).map((c) => c.id)

describe('buildPlanCards — shape', () => {
  it('opens on the result and closes on the first action', () => {
    const cards = buildPlanCards(base)
    expect(cards[0].id).toBe('plan-hello')
    expect(cards[0].tone).toBe('ember')
    expect(cards[cards.length - 1].id).toBe('plan-go')
    expect(cards[cards.length - 1].tone).toBe('ember')
  })

  it('gives every card a unique id', () => {
    const all = ids()
    expect(new Set(all).size).toBe(all.length)
  })

  it('stays serializable across the server boundary', () => {
    const cards = buildPlanCards(base)
    expect(JSON.parse(JSON.stringify(cards))).toEqual(cards)
  })

  it('asks for one meal, not a whole day — the smallest possible next step', () => {
    const last = buildPlanCards(base).at(-1)!
    expect(last.body).toMatch(/next thing you eat/i)
  })
})

describe('buildPlanCards — the numbers', () => {
  it('leads with the calorie target', () => {
    const card = buildPlanCards(base).find((c) => c.id === 'plan-calories')!
    expect(card.value).toBe('1,850')
    expect(card.label).toBe('calories a day')
  })

  it('gives protein a card and the other macros none', () => {
    const got = ids()
    expect(got).toContain('plan-protein')
    expect(got).not.toContain('plan-carbs')
    expect(got).not.toContain('plan-fat')
  })

  it('rounds protein rather than showing a fractional gram', () => {
    const card = buildPlanCards({ ...base, proteinTargetG: 137.6 })
      .find((c) => c.id === 'plan-protein')!
    expect(card.value).toBe('138g')
  })

  it('skips a target that was never computed instead of showing zero', () => {
    expect(ids({ dailyCalorieTarget: 0 })).not.toContain('plan-calories')
    expect(ids({ proteinTargetG: 0 })).not.toContain('plan-protein')
  })
})

describe('buildPlanCards — the projected goal date', () => {
  it('projects the date from the chosen pace', () => {
    // 8 kg at 0.5 kg/week = 16 weeks = 112 days from 29 Jul 2026.
    const card = buildPlanCards(base).find((c) => c.id === 'plan-goal-date')!
    expect(card.value).toBe('18 Nov 2026')
    expect(card.label).toBe('when you reach 74 kg')
  })

  it('works for a gain goal too, not just weight loss', () => {
    expect(
      ids({ goal: 'gain', currentWeightKg: 58, targetWeightKg: 64 })
    ).toContain('plan-goal-date')
  })

  it('says nothing when maintaining — there is no date to reach', () => {
    expect(ids({ goal: 'maintain' })).not.toContain('plan-goal-date')
  })

  it('says nothing without a pace, rather than inventing one', () => {
    expect(ids({ paceKgPerWeek: null })).not.toContain('plan-goal-date')
    expect(ids({ paceKgPerWeek: 0 })).not.toContain('plan-goal-date')
  })

  it('says nothing when the goal is already met', () => {
    expect(ids({ currentWeightKg: 74, targetWeightKg: 74 })).not.toContain('plan-goal-date')
  })

  it('still produces a usable story when every optional card drops out', () => {
    const cards = buildPlanCards({
      ...base, dailyCalorieTarget: 0, proteinTargetG: 0, goal: 'maintain',
    })
    expect(cards.map((c) => c.id)).toEqual(['plan-hello', 'plan-go'])
  })
})

describe('buildPlanCards — names', () => {
  it('greets by first name when there is one', () => {
    expect(buildPlanCards({ ...base, firstName: 'Adarsh' })[0].title)
      .toBe('Here’s your plan, Adarsh.')
  })

  it('falls back cleanly for anonymous accounts', () => {
    for (const firstName of [null, undefined, '  ']) {
      expect(buildPlanCards({ ...base, firstName })[0].title).toBe('Here’s your plan.')
    }
  })
})

describe('buildPlanCards — personalisation (migration 039)', () => {
  it('answers the obstacle the user named', () => {
    const card = buildPlanCards({ ...base, obstacles: ['late_night'] })
      .find((c) => c.id === 'plan-obstacle')!
    expect(card).toBeDefined()
    expect(card.body).toMatch(/log dinner before you sit down/i)
  })

  it('still closes on the action card, with the obstacle card before it', () => {
    // The whole surface exists to produce one log. A personalisation card is
    // never allowed to become the last thing the user sees.
    const cards = buildPlanCards({ ...base, obstacles: ['sweets'] })
    expect(cards.at(-1)!.id).toBe('plan-go')
    expect(cards.at(-2)!.id).toBe('plan-obstacle')
  })

  it('shows no obstacle card when the question was skipped', () => {
    // Optional means optional: skipping must not leave a card saying nothing.
    for (const skipped of [undefined, null, []]) {
      expect(ids({ obstacles: skipped })).not.toContain('plan-obstacle')
    }
  })

  it('opens differently for someone who has tried and stopped', () => {
    const tried = buildPlanCards({ ...base, trackingExperience: 'tried' })[0]
    const never = buildPlanCards({ ...base, trackingExperience: 'never' })[0]
    expect(tried.body).not.toBe(never.body)
    expect(tried.body).toMatch(/done this before/i)
  })

  it('reads identically well for an account that predates the questions', () => {
    // Every existing user has NULL in both columns. The story must not
    // degrade, and must never claim something they did not say.
    const legacy = buildPlanCards(base)
    const explicitlyNull = buildPlanCards({ ...base, obstacles: null, trackingExperience: null })
    expect(explicitlyNull).toEqual(legacy)
    expect(legacy[0].body).toMatch(/height, weight, age/i)
  })

  it('ignores an obstacle id that is no longer offered', () => {
    expect(ids({ obstacles: ['retired_option'] })).not.toContain('plan-obstacle')
  })

  it('keeps ids unique and serializable with every option answered', () => {
    const cards = buildPlanCards({
      ...base,
      obstacles: ['portions', 'sweets', 'weekends'],
      trackingExperience: 'current',
    })
    const all = cards.map((c) => c.id)
    expect(new Set(all).size).toBe(all.length)
    expect(JSON.parse(JSON.stringify(cards))).toEqual(cards)
  })
})
