import { describe, it, expect } from 'vitest'
import {
  canSendPush, pickPush, pushPriority, PUSH_KINDS,
  MAX_PUSHES_PER_DAY, IGNORED_BEFORE_BACKOFF, type PushKind,
} from '../lib/pushBudget'

const fresh = { sentToday: [] as PushKind[], consecutiveIgnored: 0 }

describe('priority order', () => {
  it('puts the streak save first — it is the one that works', () => {
    expect(PUSH_KINDS[0]).toBe('streak-save')
  })

  it('ranks the generic reminder last', () => {
    expect(PUSH_KINDS.at(-1)).toBe('daily-reminder')
  })

  it('is a total order with no ties', () => {
    const ranks = PUSH_KINDS.map(pushPriority)
    expect(new Set(ranks).size).toBe(ranks.length)
  })
})

describe('canSendPush — the daily cap', () => {
  it('allows the first push of the day', () => {
    expect(canSendPush('daily-reminder', fresh)).toEqual({ allowed: true })
  })

  it('refuses a second push of equal rank', () => {
    const state = { ...fresh, sentToday: ['weekly-recap' as PushKind] }
    expect(canSendPush('weekly-recap', state)).toEqual({ allowed: false, reason: 'daily_cap' })
  })

  it('refuses a lesser push once the cap is spent', () => {
    const state = { ...fresh, sentToday: ['weekly-recap' as PushKind] }
    expect(canSendPush('daily-reminder', state)).toEqual({ allowed: false, reason: 'outranked' })
  })

  it('lets a more important push displace a lesser one already sent', () => {
    // Sunday: the recap went out, then the user's streak is about to break.
    // Losing the streak matters more than not sending twice.
    const state = { ...fresh, sentToday: ['weekly-recap' as PushKind] }
    expect(canSendPush('streak-save', state)).toEqual({ allowed: true })
  })

  it('caps at one a day', () => {
    expect(MAX_PUSHES_PER_DAY).toBe(1)
  })
})

describe('canSendPush — back-off', () => {
  it('backs off to the single most important kind after enough are ignored', () => {
    const state = { sentToday: [] as PushKind[], consecutiveIgnored: IGNORED_BEFORE_BACKOFF }
    expect(canSendPush('daily-reminder', state)).toEqual({ allowed: false, reason: 'backoff' })
    expect(canSendPush('weekly-recap', state)).toEqual({ allowed: false, reason: 'backoff' })
    // The streak save still gets through — it's the one worth the permission.
    expect(canSendPush('streak-save', state)).toEqual({ allowed: true })
  })

  it('does not back off before the threshold', () => {
    const state = { sentToday: [] as PushKind[], consecutiveIgnored: IGNORED_BEFORE_BACKOFF - 1 }
    expect(canSendPush('daily-reminder', state)).toEqual({ allowed: true })
  })
})

describe('pickPush', () => {
  it('picks the most important candidate', () => {
    expect(pickPush(['daily-reminder', 'streak-save', 'weekly-recap'])).toBe('streak-save')
    expect(pickPush(['weekly-recap', 'monthly-wrapped'])).toBe('monthly-wrapped')
  })

  it('is null when there is nothing to send', () => {
    expect(pickPush([])).toBeNull()
  })

  it('does not mutate its input', () => {
    const input: PushKind[] = ['daily-reminder', 'streak-save']
    pickPush(input)
    expect(input).toEqual(['daily-reminder', 'streak-save'])
  })
})
