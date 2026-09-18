/**
 * The one place this app names a Gemini model, and the one function that
 * calls one.
 *
 * Until 2026-09-18 the model id was a string literal duplicated across three
 * routes (camera/analyze, chat/analyze, cron/weekly-recap), so changing one
 * silently forked the other two. `tests/geminiSingleSource.test.ts` now fails
 * the moment any file outside this one names the endpoint.
 *
 * Model choice — probed live against the project's key on 2026-09-18:
 * - `gemini-2.5-flash` is already retired for new users; Google's own error
 *   text names `gemini-3.6-flash` as the replacement. `2.5-flash-lite`, what
 *   production ran until this change, is one step behind on the same track.
 * - `gemini-3.6-flash` accepted everything this module sends (a response
 *   schema with propertyOrdering + nullable, thinkingLevel, thinkingBudget,
 *   seed) and answered a warm structured call in ~2.5 s.
 * - `gemini-3.7-flash` and `3.8-flash` were 503 "high demand" or hung outright
 *   on the dev key. Newer is not safer, which is why there is a FALLBACK.
 * - Pinned versions, never the `-latest` aliases: an alias moving under a
 *   prompt tuned for one model is the fork problem again, in time instead of
 *   across files.
 */
export const GEMINI_MODEL = 'gemini-3.6-flash'

/**
 * Tried once when the primary times out, is rate-limited, 5xxs, or has been
 * retired (404). Older and cheaper on purpose: it's the one still answering
 * when the newest model is oversubscribed.
 */
export const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite'

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }

/**
 * `low` is the only "on" setting offered: on a photo it buys a visibly better
 * portion read for a few hundred tokens, while the higher levels cost seconds
 * the user is watching a spinner for. `off` is for the recap sentence, where
 * there is nothing to reason about and thinking tokens would only eat the
 * tiny output budget.
 */
export type GeminiThinking = 'off' | 'low'

export type GeminiCall = {
  /** Sent as `system_instruction`. Omitted when undefined. */
  system?: string
  parts: GeminiPart[]
  /**
   * When set, the model is constrained to JSON matching this schema
   * (`responseMimeType: application/json`). Gemini's OpenAPI-subset dialect:
   * upper-case `type`, `propertyOrdering`, `nullable`, `enum`. Removes the
   * whole class of "model returned prose / markdown fences / a numeral as a
   * string" failures the routes used to parse around.
   */
  responseSchema?: Record<string, unknown>
  /**
   * Thinking tokens count against this on Gemini, so it must leave room for
   * both the thoughts AND the answer — 1024 was enough for flash-lite with
   * thinking off and truncates a thali mid-object with it on.
   */
  maxOutputTokens: number
  temperature: number
  seed?: number
  thinking: GeminiThinking
  /** Per attempt. The fallback attempt gets the same budget again. */
  timeoutMs: number
  /** `false` never tries the fallback model. Default: try it once. */
  fallback?: boolean
}

export type GeminiSuccess = {
  ok: true
  /** Concatenated text of every non-thought part. */
  text: string
  /** Which model actually answered — record it on every analytics event so accuracy can be compared across models. */
  model: string
  attempts: number
  /** `MAX_TOKENS` here means the JSON was cut off; the caller's parse will fail and should say why. */
  finishReason?: string
}

export type GeminiFailure = {
  ok: false
  /** `timeout` = every attempt timed out, so "this one is on us" is literally true. */
  kind: 'timeout' | 'http' | 'network'
  status?: number
  /** Provider text — for Sentry, never for a toast (leaks model ids, key and quota detail). */
  message: string
  /** The last model tried. */
  model: string
  attempts: number
}

export type GeminiOutcome = GeminiSuccess | GeminiFailure

function thinkingConfig(t: GeminiThinking): Record<string, unknown> {
  // 3.x models take `thinkingLevel`; a budget of 0 is the documented way to
  // switch thinking off and both models above accepted it.
  return t === 'off' ? { thinkingBudget: 0 } : { thinkingLevel: 'low' }
}

/** The request body for one attempt. Pure, so the shape is unit-testable. */
export function buildGeminiBody(call: GeminiCall): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: call.maxOutputTokens,
    temperature: call.temperature,
    thinkingConfig: thinkingConfig(call.thinking),
  }
  if (call.seed !== undefined) generationConfig.seed = call.seed
  if (call.responseSchema) {
    generationConfig.responseMimeType = 'application/json'
    generationConfig.responseSchema = call.responseSchema
  }
  const body: Record<string, unknown> = {
    contents: [{ parts: call.parts }],
    generationConfig,
  }
  if (call.system) body.system_instruction = { parts: [{ text: call.system }] }
  return body
}

export function geminiUrl(model: string, apiKey: string): string {
  return `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`
}

/**
 * A status worth trying the fallback model on: the model is busy, gone, or
 * the provider fell over. A 400 is our request being wrong and will be wrong
 * on the fallback too; 401/403 are the key.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 404 || status === 429 || status >= 500
}

type GeminiResponseJson = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> }
    finishReason?: string
  }>
  error?: { message?: string }
}

/**
 * One call, at most two attempts: the primary model, then the fallback if the
 * primary timed out or answered with a retryable status. Never throws — the
 * routes map the outcome to user copy and decide what to report.
 *
 * `fetch` is read from the global at call time so test files can stub it.
 */
export async function callGemini(call: GeminiCall, apiKey: string): Promise<GeminiOutcome> {
  const models = call.fallback === false ? [GEMINI_MODEL] : [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]
  const body = JSON.stringify(buildGeminiBody(call))
  let last: GeminiFailure | null = null

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    const attempts = i + 1
    try {
      const res = await globalThis.fetch(geminiUrl(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        // Without a timeout a stalled Gemini holds the request until the
        // platform kills the whole function, so the user watches a spinner die
        // with no message and no way to retry cheaply.
        signal: AbortSignal.timeout(call.timeoutMs),
      })
      const json = (await res.json().catch(() => null)) as GeminiResponseJson | null
      if (!res.ok) {
        const status = typeof res.status === 'number' ? res.status : 0
        last = {
          ok: false,
          kind: 'http',
          status,
          message: json?.error?.message ?? JSON.stringify(json),
          model,
          attempts,
        }
        if (!isRetryableStatus(status)) return last
        continue
      }
      const candidate = json?.candidates?.[0]
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('')
      return { ok: true, text, model, attempts, finishReason: candidate?.finishReason }
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
      last = {
        ok: false,
        kind: timedOut ? 'timeout' : 'network',
        message: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        model,
        attempts,
      }
      continue
    }
  }
  // Unreachable in practice (the loop always sets `last` before falling out),
  // but the type system can't see that.
  return last ?? { ok: false, kind: 'network', message: 'no attempt made', model: GEMINI_MODEL, attempts: 0 }
}
