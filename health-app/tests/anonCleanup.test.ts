import { describe, it, expect } from 'vitest'
import { selectAbandonedAnonUsers, ANON_RETENTION_DAYS, type AnonCandidate } from '../lib/anonCleanup'

const NOW = new Date('2026-08-01T00:00:00.000Z')

/** Days before NOW, as an ISO string. */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString()
}

function candidate(over: Partial<AnonCandidate> = {}): AnonCandidate {
  return {
    id: 'u1',
    created_at: daysAgo(ANON_RETENTION_DAYS + 1),
    email: null,
    logCount: 0,
    ...over,
  }
}

describe('selectAbandonedAnonUsers', () => {
  it('selects an old anonymous account with no logs', () => {
    expect(selectAbandonedAnonUsers([candidate()], NOW)).toEqual(['u1'])
  })

  it('never selects a registered user, however old and empty', () => {
    const registered = candidate({ email: 'someone@example.com', created_at: daysAgo(3650) })
    expect(selectAbandonedAnonUsers([registered], NOW)).toEqual([])
  })

  it('never selects an anonymous user who has logged food', () => {
    expect(selectAbandonedAnonUsers([candidate({ logCount: 1 })], NOW)).toEqual([])
  })

  it('keeps an anonymous user who logged food even when very old', () => {
    const old = candidate({ created_at: daysAgo(3650), logCount: 42 })
    expect(selectAbandonedAnonUsers([old], NOW)).toEqual([])
  })

  it('keeps anonymous accounts inside the retention window', () => {
    const fresh = candidate({ created_at: daysAgo(ANON_RETENTION_DAYS - 1) })
    expect(selectAbandonedAnonUsers([fresh], NOW)).toEqual([])
  })

  it('does not select an account exactly at the retention boundary', () => {
    const boundary = candidate({ created_at: daysAgo(ANON_RETENTION_DAYS) })
    expect(selectAbandonedAnonUsers([boundary], NOW)).toEqual([])
  })

  it('keeps a row whose created_at is unparseable rather than guessing', () => {
    expect(selectAbandonedAnonUsers([candidate({ created_at: 'not-a-date' })], NOW)).toEqual([])
  })

  it('picks only the eligible rows out of a mixed batch', () => {
    const rows: AnonCandidate[] = [
      candidate({ id: 'sweep-1' }),
      candidate({ id: 'sweep-2', created_at: daysAgo(90) }),
      candidate({ id: 'keep-registered', email: 'a@b.com' }),
      candidate({ id: 'keep-has-logs', logCount: 3 }),
      candidate({ id: 'keep-recent', created_at: daysAgo(1) }),
    ]
    expect(selectAbandonedAnonUsers(rows, NOW)).toEqual(['sweep-1', 'sweep-2'])
  })

  it('returns nothing for an empty batch', () => {
    expect(selectAbandonedAnonUsers([], NOW)).toEqual([])
  })
})
