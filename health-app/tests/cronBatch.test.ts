import { describe, it, expect } from 'vitest'
import { processInBatches, CRON_CONCURRENCY } from '../lib/cronBatch'

describe('processInBatches', () => {
  it('reaches every item when there is time', async () => {
    const seen: number[] = []
    const out = await processInBatches([1, 2, 3, 4, 5], async (n) => { seen.push(n) })
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5])
    expect(out).toEqual({ processed: 5, remaining: 0, timedOut: false, failed: 0 })
  })

  it('handles an empty list without hanging', async () => {
    expect(await processInBatches([], async () => {}))
      .toEqual({ processed: 0, remaining: 0, timedOut: false, failed: 0 })
  })

  it('runs items concurrently rather than one at a time', async () => {
    let live = 0
    let peak = 0
    await processInBatches(Array.from({ length: 20 }, (_, i) => i), async () => {
      live += 1
      peak = Math.max(peak, live)
      await new Promise((r) => setTimeout(r, 5))
      live -= 1
    }, { concurrency: 4 })
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(4)
  })

  it('never exceeds the concurrency cap', async () => {
    let live = 0
    let peak = 0
    await processInBatches(Array.from({ length: 50 }, (_, i) => i), async () => {
      live += 1
      peak = Math.max(peak, live)
      await new Promise((r) => setTimeout(r, 1))
      live -= 1
    })
    expect(peak).toBeLessThanOrEqual(CRON_CONCURRENCY)
  })

  it('keeps going when one item throws — one bad user must not cost the rest', async () => {
    const done: number[] = []
    const out = await processInBatches([1, 2, 3, 4], async (n) => {
      if (n === 2) throw new Error('boom')
      done.push(n)
    }, { concurrency: 1 })
    expect(done).toEqual([1, 3, 4])
    expect(out.failed).toBe(1)
    expect(out.processed).toBe(4)
    expect(out.remaining).toBe(0)
  })

  it('stops at the deadline and reports what was left', async () => {
    // A clock that jumps 30s per reading blows the budget after two items.
    let t = 0
    const now = () => (t += 30_000)
    const out = await processInBatches([1, 2, 3, 4, 5], async () => {}, {
      concurrency: 1,
      deadline: 60_000,
      now,
    })
    expect(out.timedOut).toBe(true)
    expect(out.remaining).toBeGreaterThan(0)
    expect(out.processed).toBeLessThan(5)
  })

  it('does not claim a timeout when everything finished in budget', async () => {
    const out = await processInBatches([1, 2, 3], async () => {}, { now: () => 0, deadline: 1000 })
    expect(out.timedOut).toBe(false)
    expect(out.remaining).toBe(0)
  })
})
