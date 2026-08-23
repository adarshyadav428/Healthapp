import { describe, it, expect } from 'vitest'
import { streakRestart, MIN_PREVIOUS_BEST } from '../lib/streakRestart'

describe('streakRestart', () => {
  it('says nothing while a streak is alive', () => {
    expect(streakRestart(1, 30)).toBeNull()
    expect(streakRestart(12, 30)).toBeNull()
  })

  it('says nothing to someone who never had a run', () => {
    expect(streakRestart(0, 0)).toBeNull()
    expect(streakRestart(0, MIN_PREVIOUS_BEST - 1)).toBeNull()
  })

  it('speaks once the streak is gone and there was a real run', () => {
    const copy = streakRestart(0, 12)
    expect(copy).not.toBeNull()
    expect(copy!.previousBest).toBe(12)
    expect(copy!.title).toContain('12 days')
  })

  it('scales the claim to the size of the run it invokes', () => {
    // A month-long run gets a bigger claim than a four-day one — the copy has
    // to stay true for both, so it can't be one sentence.
    const long = streakRestart(0, 30)!
    const mid = streakRestart(0, 10)!
    const short = streakRestart(0, 4)!
    expect(new Set([long.body, mid.body, short.body]).size).toBe(3)
  })

  it('never scolds — no copy blames the user for stopping', () => {
    for (const best of [3, 7, 21, 60]) {
      const { title, body } = streakRestart(0, best)!
      const text = `${title} ${body}`.toLowerCase()
      for (const word of ['lost', 'broke', 'failed', 'missed', 'don’t', 'again?']) {
        expect(text, `"${word}" in copy for best=${best}`).not.toContain(word)
      }
    }
  })
})
