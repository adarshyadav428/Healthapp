# GetInShape — Performance Report

Part of the 2026-09-13 QA baseline, **updated with real authenticated navigation timings**
captured against production during a follow-up session (account `+qa2`, via the user's own
already-signed-in Chrome). What follows is (1) real, measured build-output evidence, (2) real
Navigation Timing API measurements from authenticated page loads, and (3) static-code
findings predicting specific perceived- or actual-latency problems, each marked with a
confidence level. **The authenticated timings below are warm-navigation measurements on a
fast connection** (this session's browser, not a throttled mobile network or a cold cache) —
they establish a rough floor, not a worst-case, and should not be read as representative of
the app's stated target market (mid-range Android on Indian mobile networks). No Lighthouse
run, DevTools trace, or throttled-network test was performed — see Section 6.

## 1. Build output — real, measured evidence

From this session's clean `npm run build` (exit 0, 2026-09-13):

| Route | Own bundle | First Load JS |
|---|---|---|
| **`/progress`** | **118 kB** | **410 kB** |
| `/settings` | 16.8 kB | 313 kB |
| `/log` | 13.6 kB | 305 kB |
| `/dashboard` | 15.5 kB | 303 kB |
| `/upgrade` | 7.36 kB | 266 kB |
| `/auth/sign-up` | 10.2 kB | 278 kB |
| `/onboarding` | 14.9 kB | 209 kB |
| `/auth/sign-in` | 7.21 kB | 205 kB |
| `/weight` | 5.89 kB | 197 kB |
| `/recipes` | 4.24 kB | 187 kB |
| `/deficit` | 6.87 kB | 177 kB |
| Shared baseline (every page) | — | 90.1 kB |
| Middleware | — | 88.5 kB (runs on every non-static request) |

## 1.5 Authenticated navigation timing — real, measured (this session, warm cache)

Captured via `performance.getEntriesByType('navigation')[0]` on real page loads against
production, authenticated as `+qa2`:

| Route | TTFB | DOMContentLoaded | Load event | Transfer size (HTML doc) |
|---|---|---|---|---|
| `/dashboard` | 177 ms | 801 ms | 909 ms | 43.6 KB |
| `/settings` | 290 ms | 1,231 ms | 1,345 ms | 43.2 KB |
| `/progress` | 295 ms | 1,093 ms | 1,252 ms | 49.3 KB |

**Caveats, stated plainly:** these are warm navigations (this session had already visited
each page multiple times, so JS chunks were likely served from the browser's HTTP cache, not
downloaded fresh) on whatever network this sandboxed browser sits behind — not a cold load,
not a throttled connection, not a real mobile device. They do **not** confirm or refute the
`/progress` bundle-size concern from Section 1 (a cold load on a slow connection would show
the 410 kB First Load JS cost much more plainly than a warm 1.25s load event does here).
What they do establish: none of the three pages exhibits a gross, order-of-magnitude
rendering pathology (e.g., a multi-second TTFB or a load event 10x the others) under
favorable conditions — the concern remains specifically about the *cold, throttled, real
mobile device* case, which this data cannot speak to.

**Finding P-1 (confidence: high — this is a direct build measurement, not a code-review
inference).** `/progress`'s own bundle (118 kB) is **7×** the next-largest page's own bundle
(`/settings` at 16.8 kB) and its First Load JS (410 kB) is the single largest page load in
the entire app — nearly 100 kB more than `/dashboard`, `/log`, or `/settings`, which are
themselves already the app's heaviest interactive surfaces. `/progress` composes Recharts
(`recharts` is a known heavy dependency), a month calendar, a weight trend chart, a
cumulative-deficit chart, a badge shelf, and an exercise section all in one client bundle.
Recommend checking whether every chart component on this page is genuinely
`next/dynamic`-loaded (one fragment noted `TrendBarChart` specifically **is** dynamic,
but the page's overall bundle size suggests not everything is) — this is the single most
actionable, evidence-backed performance lead in this baseline, and unlike everything else in
this report it requires no live session to investigate further: a bundle analyzer run
(`ANALYZE=true npm run build` if configured, or manually inspecting the `.next` output) would
localize exactly which import is heavy.

**Finding P-2 (informational).** Middleware itself is an 88.5 kB bundle that runs on every
single non-static, non-API request (`middleware.ts`'s matcher). It does one network round
trip to Supabase Auth (`getUser()`, capped at a 5s timeout) per navigation. This is
architecturally necessary for the auth model chosen, but it means every page navigation has
an auth-server round trip in its critical path (not true for `/api/*`, which self-authenticate
without going through middleware, specifically to avoid this exact duplicate latency per
CLAUDE.md's own documented reasoning).

## 2. Load-time architecture — what the code implies, not measured

- **`app/dashboard/page.tsx` and most protected pages are `force-dynamic` SSR** — no static
  shell, no client-side loading skeleton for the *first* paint (confirmed for Home: the first
  paint already has data, because the whole page waits on the server round trip). This trades
  a slower Time-to-First-Byte for a data-complete first paint. Whether this trade reads as
  "fast" or "slow" to a real user depends entirely on Vercel `bom1` region latency to the
  Supabase project's region — **not verifiable without a live network trace**.
- **`AddFoodModal`/search results use TanStack Query's `keepPreviousData`** — a fast typist
  mostly never sees a loading skeleton because the previous result list stays visible during
  a refined query. This is a genuine, code-confirmed perceived-latency optimization.
- **Search debounces 300ms** before firing, and only once the query is >1 character — both
  reduce redundant network calls, at the cost of ~300ms of perceived lag on the very first
  keystroke past the threshold. Reasonable, standard trade-off.
- **The result cache (`lib/searchCache.ts`) is a shared, query-keyed TTL cache** — 120s
  normal, 10s when assembled with a degraded upstream (Open Food Facts down/slow). This means
  the *first* user to search a given term pays the full multi-source merge cost; every
  subsequent identical search within the TTL is served from memory. Real-world effectiveness
  depends on query diversity, which cannot be assessed from code alone.

## 3. Interaction-latency risks found by code review (not measured)

| Risk | Where | Confidence | Likely user-visible symptom |
|---|---|---|---|
| No `AbortController` on camera/chat analyze fetch | `hooks/useCameraScan.ts`, `hooks/useChatLog.ts` | High (code-confirmed) | Closing a scan modal doesn't free the in-flight request; a slow/hung Gemini call keeps running in the background even after the user has moved on — wasted network/battery, not a visible slowness, until the delayed response causes an unexpected navigation (R13) |
| Both AI routes' 20s server-side timeout means a slow Gemini response can leave a user staring at "Analyzing..." for up to 20 full seconds before a clean timeout message | `app/api/camera/analyze/route.ts`, `app/api/chat/analyze/route.ts` | High (code-confirmed timeout value) | No distinct "this is taking a while" intermediate state was found — the cycling `AnalyzingState` copy runs the whole time regardless of elapsed duration |
| Rate limiter is a per-serverless-instance in-memory `Map`, not a global/shared store | `app/api/foods/search/route.ts:28` | High (code-confirmed) | Under real concurrent load across multiple cold-started instances, the advertised "30 req/60s" cap does not hold as a global guarantee — could mask or fail to catch abusive traffic patterns, a correctness-of-the-limit issue more than a perceived-slowness one |
| `foods/custom`, `camera/analyze`, `chat/analyze` all write to a shared `foods` catalogue non-atomically (sequential/`Promise.all` per item) | Multiple routes | Medium (code-confirmed shape; benign in practice due to deterministic idempotent keys) | Not user-visible under normal operation; a partial failure produces stray inert rows, not lag |
| `/progress`'s exercise section, badge shelf, weight hero, deficit card, and calendar all appear to be part of one Server Component render with no independent Suspense boundaries noted in the fragments reviewed | `app/progress/page.tsx` | Low (not independently traced boundary-by-boundary in this pass) | If true, one slow sub-query (e.g. the exercise or badge count scan) could delay the whole page's first paint rather than streaming in independently — **needs a direct read of the page's Suspense structure to confirm**, flagged here only because the bundle-size finding (P-1) already points at this page as the one to investigate first |

## 4. Network-condition testing

**Not performed — requires a real device or browser network-throttling session against a
live, authenticated app.** Nothing in this pass simulated slow-3G, high-latency, or
connection-loss conditions against a running instance. The code-level behavior that *would*
matter under those conditions:

- `next-pwa`'s default `NetworkFirst` caching for `pages` means a page navigation under a
  slow connection will wait for the network before falling back to cache (bounded by
  Workbox's own timeout, not independently verified here).
- `/api/foods/search` and `/auth/callback` are explicitly `NetworkOnly` (confirmed correct —
  see `SECURITY-QA-REPORT.md`/PWA findings) — meaning these two specifically have **no**
  offline/cache fallback at all, by design; a slow network shows the app's own loading state
  for as long as the request takes, with no stale-cache fallback masking the wait.
- No retry/backoff logic was found on the client side of any fetch in the domains reviewed
  (camera, chat, search) beyond TanStack Query's default retry behavior for queries (disabled
  in the render-test harness, not verified for the real app's `QueryClient` config in this
  pass).

## 5. Perceived vs. actual latency — what could be assessed

| Interaction | Actual-latency risk (code-confirmed) | Perceived-latency risk (code-confirmed) |
|---|---|---|
| Search-as-you-type | 300ms debounce + up to ~10s cache-degraded / 120s cache-fresh TTL | `keepPreviousData` genuinely reduces perceived lag; skeleton only shows on first keystroke |
| Camera/chat AI scan | Up to 20s server timeout, no user network round-trip savings possible (external Gemini call) | Cycling "Analyzing..." copy has no distinct "still working, hang tight" escalation for a scan approaching the timeout — a 3-second and an 18-second wait look identical to the user |
| Log add/edit | **Confirmed fast and correct this session** — add, edit, and delete were all exercised live against production with immediate UI reflection after each call, no visible lag on any of them; the exact server round-trip time was not individually timed | Felt immediate in interactive use; matches the targeted-cache-write pattern predicted in `DATA-INTEGRITY-REPORT.md` §1 |
| AI chat logging | **Confirmed working within a tolerable wait this session** — one real `/api/chat/analyze` call against the live Gemini API completed successfully (well under the 20s server timeout, though not precisely timed); the screenshot tool timed out once during the "Analyzing" state, consistent with a CPU/animation-heavy loading UI rather than a genuine hang | Matches the predicted risk above: no escalating "still working" feedback was observed during the wait, though the wait itself was short enough in this one trial not to matter |
| Progress page load | **P-1 above — the heaviest bundle in the app** | Not measured; a 410 kB First Load JS on a real mid-range Android device over Indian mobile networks (the app's stated target market) is the single most plausible real "this feels slow" complaint in the whole app, and is the only performance finding in this report backed by a hard number rather than an inference |

## 6. What this report could still not do, even after the authenticated pass

An authenticated session was obtained this session and used to capture real navigation
timing (Section 1.5) and to confirm add/edit/chat interactions feel responsive in normal use
— but the following remain undone, and still require either a real device or dedicated
profiling tooling this session did not have:

1. **No Lighthouse run, no WebPageTest run, no Chrome DevTools Performance trace.** The
   `/progress` bundle-size concern (Section 1, P-1) was not localized to a specific import —
   this is still the single highest-value next step.
2. **No cold-load or throttled-network measurement.** Every timing in Section 1.5 is a warm
   navigation on this sandbox's own network — not representative of a first visit or of the
   app's stated target market (mid-range Android on Indian mobile networks).
3. **No real-device camera scan timing** — camera capture was blocked this session (no
   hardware); only the chat AI path's latency was informally observed.
4. **No precise millisecond timing for the AI chat call** — confirmed to complete
   successfully and well within the 20s timeout, but not instrumented precisely.

**Recommended next step, in order:** (1) a Lighthouse/DevTools trace of `/progress` on a
real or emulated mobile device with network throttling, since that's the one finding backed
by a hard build-time number; (2) a real camera scan timed end-to-end on an actual Android
device; (3) a cold-cache `/dashboard` load timed from tap to interactive on a throttled
connection.
