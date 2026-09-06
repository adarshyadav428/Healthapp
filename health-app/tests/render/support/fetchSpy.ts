import { expect, vi } from 'vitest'

type Call = { url: string; method: string; body: unknown }

/**
 * The path, without query string.
 *
 * Matching MUST be exact on the path. An earlier version of this file matched
 * with `url.startsWith(expected)`, which quietly made the whole helper unable
 * to detect the most obvious breakage there is: renaming `/api/logs/add` to
 * `/api/logs/added` still "matched", and the test that existed to catch
 * exactly that went on passing. Verified by sabotage — a prefix match is a
 * green test that proves nothing.
 */
const pathOf = (url: string) => url.split('?')[0]

/**
 * Replaces global fetch and records every call, so a render test can assert
 * the thing that actually matters after a restyle: *this control still POSTs
 * this body to this URL*.
 *
 * `responses` maps a URL to the JSON its handler should resolve with. Anything
 * unlisted resolves `{}` — a component that fetches something the test doesn't
 * care about should not have to be modelled.
 */
export function installFetchSpy(responses: Record<string, unknown> = {}) {
  const calls: Call[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    let body: unknown
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    }
    calls.push({ url, method, body })

    const match = Object.keys(responses).find((k) => pathOf(url) === k)
    return {
      ok: true,
      status: 200,
      json: async () => (match ? responses[match] : {}),
    } as Response
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    calls,
    /** Every URL fetched, in order — for a failure message worth reading. */
    urls: () => calls.map((c) => `${c.method} ${c.url}`),
    /** "This button POSTed this body to this URL", in one line. Exact path. */
    expectPosted(url: string, body?: unknown) {
      const call = calls.find((c) => c.method === 'POST' && pathOf(c.url) === url)
      expect(call, `no POST to ${url}. Calls were: ${calls.map((c) => `${c.method} ${c.url}`).join(', ') || '(none)'}`).toBeTruthy()
      if (body !== undefined) expect(call!.body).toEqual(body)
      return call!
    },
  }
}
