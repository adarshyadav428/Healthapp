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
    expect(cards.map((c) => c.id)).toEqual(['plan-hello', 'plan-pro', 'plan-go'])
  })
})

describe('buildPlanCards — the Pro mention', () => {
  it('sits between the goal-date card and the closer', () => {
    const got = ids()
    expect(got.indexOf('plan-pro')).toBeGreaterThan(got.indexOf('plan-goal-date'))
    expect(got.indexOf('plan-pro')).toBe(got.indexOf('plan-go') - 1)
  })

  it('names the monthly price and restates that the plan is free', () => {
    const card = buildPlanCards(base).find((c) => c.id === 'plan-pro')!
    expect(card.body).toMatch(/₹299/)
    expect(card.body).toMatch(/free/i)
    expect(card.title).toMatch(/free forever/i)
  })

  it('carries no trial copy (trial is Play-only, this runs server-side)', () => {
    const card = buildPlanCards(base).find((c) => c.id === 'plan-pro')!
    expect(`${card.title} ${card.body}`).not.toMatch(/trial|free trial|3.day/i)
  })

  it('shows even when every number card drops out', () => {
    expect(ids({ dailyCalorieTarget: 0, proteinTargetG: 0, goal: 'maintain' })).toContain('plan-pro')
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
