/**
 * The plateau response.
 *
 * The risk in this feature is not a wrong branch — it is the right branch
 * saying something untrue. A flat scale has several causes and only one of them
 * is physiology, so the reassuring "this is normal" message must be earned by
 * the logs, not handed out because the scale stopped moving. Most of what
 * follows exists to keep that door shut.
 */

import { describe, expect, it } from 'vitest'
import {
  detectPlateau,
  intakeSummary,
  plateauCopy,
  MIN_LOGGED_DAYS_TO_JUDGE_INTAKE,
  OVER_TARGET_KCAL,
  PLATEAU_KG_PER_WEEK,
  PLATEAU_MIN_DAYS,
  type PlateauInput,
} from '../lib/plateau'

/** Four flat weeks, logged consistently, eating on target. */
const HOLDING: PlateauInput = {
  trendKgPerWeek: -0.02,
  trendSpanDays: 28,
  daysLogged: 26,
  avgKcal: 1850,
  dailyTarget: 1900,
  goal: 'lose',
}

describe('detectPlateau — when there is a plateau at all', () => {
  it('reports a plateau after three flat weeks of consistent logging', () => {
    expect(detectPlateau(HOLDING)).toEqual({ kind: 'holding', weeks: 4 })
  })

  it('says nothing before there is a trend to read', () => {
    expect(detectPlateau({ ...HOLDING, trendKgPerWeek: null })).toEqual({
      kind: 'none',
      reason: 'no-trend',
    })
  })

  it('says nothing about two flat weeks', () => {
    // Two flat weeks mid-diet are ordinary. Calling that a plateau would teach
    // people to panic on schedule, which is the opposite of the point.
    const result = detectPlateau({ ...HOLDING, trendSpanDays: PLATEAU_MIN_DAYS - 1 })
    expect(result).toEqual({ kind: 'none', reason: 'too-soon' })
  })

  it('says nothing while the scale is actually moving', () => {
    const result = detectPlateau({ ...HOLDING, trendKgPerWeek: -0.4 })
    expect(result).toEqual({ kind: 'none', reason: 'moving' })
  })

  it('treats movement toward a gain goal as movement, not a stall', () => {
    const result = detectPlateau({ ...HOLDING, goal: 'gain', trendKgPerWeek: 0.3 })
    expect(result).toEqual({ kind: 'none', reason: 'moving' })
  })

  it('never fires while maintaining, where flat is the goal', () => {
    expect(detectPlateau({ ...HOLDING, goal: 'maintain' })).toEqual({
      kind: 'none',
      reason: 'maintaining',
    })
  })

  it('treats a rate just under the threshold as flat and just over as moving', () => {
    const justFlat = detectPlateau({ ...HOLDING, trendKgPerWeek: -(PLATEAU_KG_PER_WEEK - 0.001) })
    const justMoving = detectPlateau({ ...HOLDING, trendKgPerWeek: -PLATEAU_KG_PER_WEEK })
    expect(justFlat.kind).toBe('holding')
    expect(justMoving).toEqual({ kind: 'none', reason: 'moving' })
  })

  it('counts whole weeks only', () => {
    const result = detectPlateau({ ...HOLDING, trendSpanDays: 27 })
    expect(result).toEqual({ kind: 'holding', weeks: 3 })
  })
})

describe('detectPlateau — why it is flat', () => {
  /**
   * The rule. Someone eating 400 over target has not hit a metabolic wall, and
   * telling them they have costs them the month.
   */
  it('blames intake, not physiology, when the logs explain the stall', () => {
    const result = detectPlateau({ ...HOLDING, avgKcal: 2300, dailyTarget: 1900 })
    expect(result).toEqual({ kind: 'intake', weeks: 4, avgKcal: 2300, overBy: 400 })
  })

  it('does not blame intake for a trivial overage', () => {
    // Being a little over is inside the noise of portion estimation; calling it
    // the cause would be false precision.
    const result = detectPlateau({
      ...HOLDING,
      avgKcal: 1900 + OVER_TARGET_KCAL - 1,
      dailyTarget: 1900,
    })
    expect(result.kind).toBe('holding')
  })

  it('mirrors the logic for a gain goal that is undereating', () => {
    const result = detectPlateau({
      ...HOLDING,
      goal: 'gain',
      avgKcal: 2000,
      dailyTarget: 2500,
    })
    expect(result.kind).toBe('intake')
    if (result.kind === 'intake') expect(result.overBy).toBe(-500)
  })

  it('does not blame a losing user for eating UNDER target', () => {
    // Under-eating and stalled is a real and different situation — it is not
    // "you ate too much", so the intake message must not fire.
    const result = detectPlateau({ ...HOLDING, avgKcal: 1400, dailyTarget: 1900 })
    expect(result.kind).toBe('holding')
  })

  it('declines to explain a stall it cannot see the cause of', () => {
    const result = detectPlateau({
      ...HOLDING,
      daysLogged: MIN_LOGGED_DAYS_TO_JUDGE_INTAKE - 1,
    })
    expect(result).toEqual({ kind: 'unknown', weeks: 4 })
  })

  it('declines to explain when nothing was logged at all', () => {
    const result = detectPlateau({ ...HOLDING, daysLogged: 0, avgKcal: null })
    expect(result.kind).toBe('unknown')
  })

  it('never claims physiology on sparse logs, however flat the scale', () => {
    // The failure mode this guards: sparse logs → avgKcal looks fine → we
    // reassure someone whose real problem is the days they didn't log.
    const result = detectPlateau({ ...HOLDING, daysLogged: 3, avgKcal: 1850 })
    expect(result.kind).not.toBe('holding')
  })
})

describe('plateauCopy', () => {
  it('reassures without mysticism and names what the user controls', () => {
    const copy = plateauCopy({ kind: 'holding', weeks: 4 }, 'lose')!
    expect(copy.headline).toContain('4 weeks')
    expect(copy.headline).toMatch(/normal part/)
    // Real mechanisms, not "your metabolism is confused".
    expect(copy.body).toMatch(/water/i)
    // The reason to still be here next week.
    expect(copy.body).toMatch(/doing the work/i)
  })

  it('gives the intake message a number rather than an adjective', () => {
    const copy = plateauCopy(
      { kind: 'intake', weeks: 4, avgKcal: 2300, overBy: 400 },
      'lose'
    )!
    expect(copy.body).toContain('2,300')
    expect(copy.body).toContain('400')
    expect(copy.body).toContain('above')
  })

  it('states the intake case plainly and never shames', () => {
    const copy = plateauCopy({ kind: 'intake', weeks: 4, avgKcal: 2300, overBy: 400 }, 'lose')!
    const text = `${copy.headline} ${copy.body}`.toLowerCase()
    for (const word of ['fail', 'cheat', 'lazy', 'bad', 'should have', 'discipline', 'excuse']) {
      expect(text, `copy should not contain "${word}"`).not.toContain(word)
    }
  })

  it('does not offer the reassurance in the intake case', () => {
    // The whole point of the split: "this is the normal part" must not appear
    // when the logs say the cause is intake.
    const copy = plateauCopy({ kind: 'intake', weeks: 4, avgKcal: 2300, overBy: 400 }, 'lose')!
    expect(copy.headline).not.toMatch(/normal part/)
    expect(copy.body).not.toMatch(/water/i)
  })

  it('asks for data rather than guessing when the cause is unknown', () => {
    const copy = plateauCopy({ kind: 'unknown', weeks: 3 }, 'lose')!
    expect(copy.body).toMatch(/too few logged days/i)
    // No explanation offered, in either direction.
    expect(copy.body).not.toMatch(/water/i)
    expect(copy.body).not.toMatch(/above your target/i)
  })

  it('says nothing when there is no plateau', () => {
    expect(plateauCopy({ kind: 'none', reason: 'moving' }, 'lose')).toBeNull()
  })

  it('flips the direction word for a gain goal', () => {
    const copy = plateauCopy({ kind: 'intake', weeks: 4, avgKcal: 2000, overBy: -500 }, 'gain')!
    expect(copy.body).toContain('below')
    expect(copy.body).toContain('500')
  })
})

describe('intakeSummary', () => {
  const now = new Date('2026-07-31T12:00:00Z')
  /** Stand-in for istDateStr — the real one is tested in dateUtils.test.ts. */
  const istDay = (iso: string) =>
    new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)

  function log(iso: string, kcal: number) {
    return { logged_at: iso, kcal }
  }

  it('sums each day and averages across the days that were logged', () => {
    const result = intakeSummary(
      [
        log('2026-07-30T06:00:00Z', 400),
        log('2026-07-30T14:00:00Z', 600), // same day → 1000
        log('2026-07-29T06:00:00Z', 2000),
      ],
      istDay,
      now
    )
    expect(result).toEqual({ daysLogged: 2, avgKcal: 1500 })
  })

  /**
   * The trap this function exists to avoid: averaging over the WINDOW rather
   * than over logged days turns anyone who logs half the time into a model
   * dieter, and the plateau card would then reassure exactly the person who
   * needs the other message.
   */
  it('does not dilute the average with days that were never logged', () => {
    const result = intakeSummary([log('2026-07-30T06:00:00Z', 2400)], istDay, now)
    expect(result.avgKcal).toBe(2400)
    expect(result.daysLogged).toBe(1)
  })

  it('ignores logs older than the window', () => {
    const result = intakeSummary(
      [log('2026-07-30T06:00:00Z', 1800), log('2026-05-01T06:00:00Z', 9000)],
      istDay,
      now
    )
    expect(result).toEqual({ daysLogged: 1, avgKcal: 1800 })
  })

  it('reports no average when nothing is in range', () => {
    expect(intakeSummary([], istDay, now)).toEqual({ daysLogged: 0, avgKcal: null })
  })

  it('skips unparseable rows rather than poisoning the mean with NaN', () => {
    const result = intakeSummary(
      [log('not-a-date', 500), log('2026-07-30T06:00:00Z', 1800), log('2026-07-29T06:00:00Z', NaN)],
      istDay,
      now
    )
    expect(result).toEqual({ daysLogged: 1, avgKcal: 1800 })
  })

  it('groups by IST day, not UTC day', () => {
    // 20:00 UTC on the 30th is 01:30 IST on the 31st — one IST day, and the
    // same boundary the streak and the daily totals use.
    const result = intakeSummary(
      [log('2026-07-30T20:00:00Z', 500), log('2026-07-30T21:00:00Z', 500)],
      istDay,
      now
    )
    expect(result.daysLogged).toBe(1)
    expect(result.avgKcal).toBe(1000)
  })
})
