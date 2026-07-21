import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TtlCache } from '../lib/searchCache'

/**
 * The food-search cache is keyed by query alone, so every entry is shared by
 * every user. These tests pin the two properties that makes safe: entries do
 * expire, and a short TTL really is short — that's what stops one user's failed
 * Open Food Facts lookup hiding a food from everyone else.
 */
describe('TtlCache', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns a value before its TTL and forgets it after', () => {
    const cache = new TtlCache<string[]>(10)
    cache.set('cola', ['Coca-Cola'], 120_000)

    vi.advanceTimersByTime(119_000)
    expect(cache.get('cola')).toEqual(['Coca-Cola'])

    vi.advanceTimersByTime(2_000)
    expect(cache.get('cola')).toBeNull()
  })

  it('expires a degraded entry long before a healthy one would have', () => {
    const cache = new TtlCache<string[]>(10)
    cache.set('healthy', ['a'], 120_000)
    cache.set('degraded', [], 10_000)

    vi.advanceTimersByTime(11_000)
    expect(cache.get('degraded')).toBeNull()
    expect(cache.get('healthy')).toEqual(['a'])
  })

  it('drops an expired entry from the map rather than leaking it', () => {
    const cache = new TtlCache<string[]>(10)
    cache.set('cola', ['Coca-Cola'], 1_000)
    vi.advanceTimersByTime(2_000)

    cache.get('cola')
    expect(cache.size).toBe(0)
  })

  it('never grows past its maximum', () => {
    const cache = new TtlCache<number[]>(3)
    for (let i = 0; i < 10; i++) cache.set(`q${i}`, [i], 60_000)
    expect(cache.size).toBe(3)
  })

  it('evicts the least recently used entry, not the oldest written', () => {
    const cache = new TtlCache<number[]>(3)
    cache.set('a', [1], 60_000)
    cache.set('b', [2], 60_000)
    cache.set('c', [3], 60_000)

    cache.get('a') // 'a' is now the most recently used, 'b' the least
    cache.set('d', [4], 60_000)

    expect(cache.get('a')).toEqual([1])
    expect(cache.get('b')).toBeNull()
  })

  it('overwrites in place instead of double-counting a repeated query', () => {
    const cache = new TtlCache<string[]>(3)
    cache.set('cola', [], 10_000)
    cache.set('cola', ['Coca-Cola'], 120_000)

    expect(cache.size).toBe(1)
    expect(cache.get('cola')).toEqual(['Coca-Cola'])
  })
})
