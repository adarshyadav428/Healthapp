/**
 * `readLogMeta` — how the server reads the two timing headers the browser
 * attaches to every log.
 *
 * These are untrusted input from a client, so the parsing has to be strict:
 * anything that isn't a finite, non-negative number degrades to null rather
 * than poisoning `food_logged` with NaN or a negative duration.
 *
 * The distinction the second header exists for:
 *   - `x-seconds-since-open` is measured from app load and NEVER resets, so
 *     within one session it only grows. The 5th log of a session reports a
 *     bigger number than the 1st however fast it was.
 *   - `x-seconds-to-log` is measured from the logging surface opening, so it
 *     answers "how long did this log take" — the thing that actually predicts
 *     whether someone is still tracking a month later.
 */

import { describe, it, expect } from 'vitest'
import { readLogMeta } from '../lib/posthog/server'

function req(headers: Record<string, string>): Request {
  return new Request('https://example.test/api/logs/add', { method: 'POST', headers })
}

describe('readLogMeta — method', () => {
  it('takes a known method from the header', () => {
    expect(readLogMeta(req({ 'x-log-method': 'log_again' }), 'search').method).toBe('log_again')
  })

  it('falls back when the method is unknown or absent', () => {
    expect(readLogMeta(req({ 'x-log-method': 'telepathy' }), 'search').method).toBe('search')
    expect(readLogMeta(req({}), 'quick_add').method).toBe('quick_add')
  })
})

describe('readLogMeta — the two timings are independent', () => {
  it('reads both headers separately', () => {
    const meta = readLogMeta(
      req({ 'x-log-method': 'search', 'x-seconds-since-open': '240', 'x-seconds-to-log': '9' }),
      'search'
    )
    expect(meta.seconds_since_open).toBe(240)
    expect(meta.seconds_to_log).toBe(9)
  })

  it('reports a fast log during a long session — the case the old field could not express', () => {
    // Twenty minutes into the session, a repeat log that took four seconds.
    const meta = readLogMeta(
      req({ 'x-seconds-since-open': '1200', 'x-seconds-to-log': '4' }),
      'log_again'
    )
    expect(meta.seconds_since_open).toBe(1200)
    expect(meta.seconds_to_log).toBe(4)
  })

  it('allows zero — a one-tap re-log genuinely takes no measurable time', () => {
    expect(readLogMeta(req({ 'x-seconds-to-log': '0' }), 'log_again').seconds_to_log).toBe(0)
  })

  it('nulls each timing independently when only one is sent', () => {
    expect(readLogMeta(req({ 'x-seconds-to-log': '7' }), 'search').seconds_since_open).toBeNull()
    expect(readLogMeta(req({ 'x-seconds-since-open': '7' }), 'search').seconds_to_log).toBeNull()
  })
})

describe('readLogMeta — untrusted input degrades to null', () => {
  it.each([
    ['absent', {}],
    ['empty', { 'x-seconds-to-log': '' }],
    ['not a number', { 'x-seconds-to-log': 'soon' }],
    ['negative', { 'x-seconds-to-log': '-5' }],
    ['infinite', { 'x-seconds-to-log': 'Infinity' }],
  ])('%s → null', (_label, headers) => {
    expect(readLogMeta(req(headers as Record<string, string>), 'search').seconds_to_log).toBeNull()
  })
})
