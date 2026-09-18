/**
 * lib/gemini.ts — the one Gemini call site.
 *
 * Two things are pinned: the request body every AI route now sends (schema
 * mode, thinking config, seed, system instruction) and the fallback rule —
 * which failures earn a second attempt on the fallback model, and which
 * don't. The rule matters because a fallback on a 400 would double the cost
 * of every malformed request while never succeeding, and a missing fallback
 * on a 503 is the outage this module exists to absorb.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildGeminiBody,
  callGemini,
  geminiUrl,
  isRetryableStatus,
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  type GeminiCall,
} from '../lib/gemini'

const BASE: GeminiCall = {
  parts: [{ text: 'hello' }],
  maxOutputTokens: 100,
  temperature: 0,
  thinking: 'low',
  timeoutMs: 1000,
}

function ok(text: string, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP', ...extra }] }),
  } as unknown as Response
}

function fail(status: number, message = 'nope') {
  return { ok: false, status, json: async () => ({ error: { message } }) } as unknown as Response
}

function timeout() {
  const e = new Error('The operation was aborted due to timeout')
  e.name = 'TimeoutError'
  return e
}

describe('buildGeminiBody', () => {
  it('turns a response schema into JSON mode and keeps the schema verbatim', () => {
    const schema = { type: 'OBJECT', properties: { a: { type: 'STRING' } } }
    const body = buildGeminiBody({ ...BASE, responseSchema: schema }) as { generationConfig: Record<string, unknown> }
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toBe(schema)
  })

  it('omits JSON mode entirely when there is no schema', () => {
    const body = buildGeminiBody(BASE) as { generationConfig: Record<string, unknown> }
    expect(body.generationConfig).not.toHaveProperty('responseMimeType')
    expect(body.generationConfig).not.toHaveProperty('responseSchema')
  })

  it("maps thinking 'off' to a zero budget and 'low' to the low level", () => {
    const off = buildGeminiBody({ ...BASE, thinking: 'off' }) as { generationConfig: { thinkingConfig: unknown } }
    const low = buildGeminiBody({ ...BASE, thinking: 'low' }) as { generationConfig: { thinkingConfig: unknown } }
    expect(off.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })
    expect(low.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' })
  })

  it('sends the seed only when one is given', () => {
    const withSeed = buildGeminiBody({ ...BASE, seed: 42 }) as { generationConfig: Record<string, unknown> }
    const without = buildGeminiBody(BASE) as { generationConfig: Record<string, unknown> }
    expect(withSeed.generationConfig.seed).toBe(42)
    expect(without.generationConfig).not.toHaveProperty('seed')
  })

  it('sends a system prompt as system_instruction and the parts as one user turn', () => {
    const body = buildGeminiBody({ ...BASE, system: 'be brief' }) as Record<string, unknown>
    expect(body.system_instruction).toEqual({ parts: [{ text: 'be brief' }] })
    expect(body.contents).toEqual([{ parts: [{ text: 'hello' }] }])
    expect(buildGeminiBody(BASE)).not.toHaveProperty('system_instruction')
  })
})

describe('geminiUrl / isRetryableStatus', () => {
  it('addresses generateContent on the named model', () => {
    expect(geminiUrl('m-1', 'k')).toBe('https://generativelanguage.googleapis.com/v1beta/models/m-1:generateContent?key=k')
  })

  it('retries on busy, gone and provider-error statuses, never on our own bad request or a bad key', () => {
    expect([404, 429, 500, 502, 503, 504].every(isRetryableStatus)).toBe(true)
    expect([400, 401, 403, 422].some(isRetryableStatus)).toBe(false)
  })
})

describe('callGemini', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  function modelOfCall(n: number): string {
    const url = fetchMock.mock.calls[n][0] as string
    return url.split('/models/')[1].split(':')[0]
  }

  it('answers from the primary model on success and does not touch the fallback', async () => {
    fetchMock.mockResolvedValueOnce(ok('{"a":1}'))
    const out = await callGemini(BASE, 'k')
    expect(out).toMatchObject({ ok: true, text: '{"a":1}', model: GEMINI_MODEL, attempts: 1, finishReason: 'STOP' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(modelOfCall(0)).toBe(GEMINI_MODEL)
  })

  it('falls back once on a 503 and reports which model actually answered', async () => {
    fetchMock.mockResolvedValueOnce(fail(503, 'high demand')).mockResolvedValueOnce(ok('{"b":2}'))
    const out = await callGemini(BASE, 'k')
    expect(out).toMatchObject({ ok: true, text: '{"b":2}', model: GEMINI_FALLBACK_MODEL, attempts: 2 })
    expect(modelOfCall(0)).toBe(GEMINI_MODEL)
    expect(modelOfCall(1)).toBe(GEMINI_FALLBACK_MODEL)
  })

  it('falls back on a retired primary model (404) — the deprecation case', async () => {
    fetchMock.mockResolvedValueOnce(fail(404, 'no longer available')).mockResolvedValueOnce(ok('x'))
    const out = await callGemini(BASE, 'k')
    expect(out).toMatchObject({ ok: true, model: GEMINI_FALLBACK_MODEL })
  })

  it('falls back on a timeout, and reports `timeout` only when every attempt timed out', async () => {
    fetchMock.mockRejectedValueOnce(timeout()).mockRejectedValueOnce(timeout())
    const out = await callGemini(BASE, 'k')
    expect(out).toMatchObject({ ok: false, kind: 'timeout', model: GEMINI_FALLBACK_MODEL, attempts: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockReset()
    fetchMock.mockRejectedValueOnce(timeout()).mockResolvedValueOnce(fail(500))
    const mixed = await callGemini(BASE, 'k')
    expect(mixed).toMatchObject({ ok: false, kind: 'http', status: 500 })
  })

  it('never falls back on a 400: a bad request is ours and would fail on both', async () => {
    fetchMock.mockResolvedValueOnce(fail(400, 'Invalid JSON payload'))
    const out = await callGemini(BASE, 'k')
    expect(out).toMatchObject({ ok: false, kind: 'http', status: 400, message: 'Invalid JSON payload', attempts: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('honours fallback: false — one attempt, then the failure', async () => {
    fetchMock.mockResolvedValueOnce(fail(503))
    const out = await callGemini({ ...BASE, fallback: false }, 'k')
    expect(out).toMatchObject({ ok: false, status: 503, model: GEMINI_MODEL, attempts: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('drops thought parts and joins the rest, so a thinking model never leaks its reasoning into the JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'let me think', thought: true }, { text: '{"a":' }, { text: '1}' }] } }],
      }),
    } as unknown as Response)
    const out = await callGemini(BASE, 'k')
    expect(out).toMatchObject({ ok: true, text: '{"a":1}' })
  })

  it('sends the timeout as an AbortSignal on every attempt', async () => {
    fetchMock.mockResolvedValueOnce(ok('x'))
    await callGemini(BASE, 'k')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.method).toBe('POST')
  })
})
