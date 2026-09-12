/**
 * The camera result's "Was this right?" — accurate / not sure / off.
 *
 * useCameraScan is stateful React over media APIs (see
 * useCameraScanUnresolved.test.ts for why it is pinned by source rather than
 * rendered), so this checks the two things a redesign could silently drop:
 * the event is a sanctioned name in the catalogue, and the hook fires it
 * from the one place a verdict is recorded — at the tap, not folded into the
 * log write, so a verdict on a result the user then abandons still counts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENTS } from '../lib/posthog/events'

const source = readFileSync(join(__dirname, '..', 'hooks', 'useCameraScan.ts'), 'utf8')

describe('camera result feedback', () => {
  it('is a catalogued event', () => {
    expect(EVENTS.AI_RESULT_FEEDBACK).toBe('ai_result_feedback')
  })

  it('is fired by rateResult with the verdict, not by logFood', () => {
    const at = source.indexOf('const rateResult')
    expect(at, 'useCameraScan must expose rateResult').toBeGreaterThan(-1)
    const body = source.slice(at, source.indexOf('const logFood'))
    expect(body).toContain('captureEvent(EVENTS.AI_RESULT_FEEDBACK')
    expect(body).toMatch(/rating:\s*next/)
    expect(body).toMatch(/type:\s*'camera'/)
  })

  it('does not fold the verdict into the correction event', () => {
    const at = source.indexOf("captureEvent('ai_estimate_corrected'")
    const call = source.slice(at, at + 500)
    expect(call).not.toMatch(/rating|feedback/)
  })
})
