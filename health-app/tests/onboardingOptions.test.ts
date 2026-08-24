import { describe, it, expect } from 'vitest'
import {
  OBSTACLES,
  OBSTACLE_IDS,
  MAX_OBSTACLES,
  TRACKING_EXPERIENCES,
  DEFAULT_PLAN_INTRO,
  isObstacleId,
  isTrackingExperienceId,
  planIntroFor,
  obstaclePlanLine,
  obstacleLabel,
  normaliseObstacles,
} from '../lib/onboardingOptions'

describe('the option lists', () => {
  it('keeps every id unique — ids are stored in the database', () => {
    expect(new Set(OBSTACLE_IDS).size).toBe(OBSTACLE_IDS.length)
    const t = TRACKING_EXPERIENCES.map((x) => x.id)
    expect(new Set(t).size).toBe(t.length)
  })

  it('gives every option a label, an emoji and a plan sentence', () => {
    for (const o of [...OBSTACLES, ...TRACKING_EXPERIENCES]) {
      expect(o.label.length).toBeGreaterThan(0)
      expect(o.emoji.length).toBeGreaterThan(0)
      expect(o.plan.length).toBeGreaterThan(0)
    }
  })

  it('keeps every plan sentence to one sentence', () => {
    // StoryCard.body is documented as "One supporting sentence. Keep it to one."
    // A second sentence renders as a wall on a 375px card.
    for (const o of [...OBSTACLES, ...TRACKING_EXPERIENCES]) {
      const sentenceEnders = o.plan.match(/[.!?](\s|$)/g) ?? []
      expect(sentenceEnders.length, `"${o.plan}"`).toBe(1)
    }
  })

  it('stays short enough to fit a story card', () => {
    for (const o of [...OBSTACLES, ...TRACKING_EXPERIENCES]) {
      expect(o.plan.length, `"${o.plan}"`).toBeLessThanOrEqual(170)
    }
  })

  it('offers few enough obstacles to be read in one glance', () => {
    // The array CHECK in migration 039 allows 6. Growing this list past that
    // needs the migration changed too, so the test names the coupling.
    expect(OBSTACLES.length).toBeLessThanOrEqual(6)
  })
})

describe('isObstacleId / isTrackingExperienceId', () => {
  it('accepts real ids', () => {
    expect(isObstacleId('late_night')).toBe(true)
    expect(isTrackingExperienceId('tried')).toBe(true)
  })

  it('rejects everything else, including near-misses and non-strings', () => {
    for (const bad of ['Late_night', 'latenight', '', null, undefined, 3, {}, []]) {
      expect(isObstacleId(bad)).toBe(false)
      expect(isTrackingExperienceId(bad)).toBe(false)
    }
  })
})

describe('planIntroFor', () => {
  it('speaks to each experience differently', () => {
    const lines = TRACKING_EXPERIENCES.map((t) => planIntroFor(t.id))
    expect(new Set(lines).size).toBe(TRACKING_EXPERIENCES.length)
  })

  it('falls back to the generic line rather than inventing an answer', () => {
    // Every account that onboarded before this question existed has NULL here.
    // Guessing would have the plan tell someone something they never said.
    for (const missing of [null, undefined, '', 'sometimes']) {
      expect(planIntroFor(missing)).toBe(DEFAULT_PLAN_INTRO)
    }
  })
})

describe('obstaclePlanLine', () => {
  it('returns the sentence for the chosen obstacle', () => {
    expect(obstaclePlanLine(['sweets'])).toBe(
      OBSTACLES.find((o) => o.id === 'sweets')!.plan
    )
  })

  it('uses only the first obstacle even when three were chosen', () => {
    // One card, one sentence. Three stacked pieces of advice is the shape of
    // a page nobody reads; the rest stay stored for coaching.
    const line = obstaclePlanLine(['portions', 'sweets', 'weekends'])
    expect(line).toBe(OBSTACLES.find((o) => o.id === 'portions')!.plan)
  })

  it('skips unknown ids and uses the first one it recognises', () => {
    expect(obstaclePlanLine(['retired_option', 'no_time'])).toBe(
      OBSTACLES.find((o) => o.id === 'no_time')!.plan
    )
  })

  it('says nothing rather than something generic when there is no answer', () => {
    for (const empty of [null, undefined, [], ['nonsense']]) {
      expect(obstaclePlanLine(empty)).toBeNull()
    }
  })
})

describe('obstacleLabel', () => {
  it('round-trips a stored id back to its label', () => {
    expect(obstacleLabel('weekends')).toBe('Weekends undo the week')
  })

  it('returns null for an id no longer offered', () => {
    expect(obstacleLabel('retired_option')).toBeNull()
  })
})

describe('normaliseObstacles', () => {
  it('drops ids that are no longer offered', () => {
    expect(normaliseObstacles(['late_night', 'retired_option'])).toEqual(['late_night'])
  })

  it('drops duplicates', () => {
    expect(normaliseObstacles(['sweets', 'sweets', 'sweets'])).toEqual(['sweets'])
  })

  it('caps at MAX_OBSTACLES even if more arrive', () => {
    const all = normaliseObstacles(OBSTACLE_IDS)
    expect(all).toHaveLength(MAX_OBSTACLES)
  })

  it('never exceeds the length the migration CHECK allows', () => {
    // profiles_obstacles_len_check allows 6. If MAX_OBSTACLES ever grows past
    // it, the insert fails at runtime rather than here — so pin it.
    expect(MAX_OBSTACLES).toBeLessThanOrEqual(6)
  })

  it('returns an empty array for nothing, never null', () => {
    for (const empty of [null, undefined, [], ['nope']]) {
      expect(normaliseObstacles(empty)).toEqual([])
    }
  })
})
