# GetInShape — adversarial real-user testing pass

**Date:** 2026-09-05 · **Branch:** `main` (clean at start; report is the only new file)
**Scope:** rapid-tap/duplicate-submit, malformed/extreme input, network-failure honesty,
session-expiry, and zero-data/inconsistent-totals — run against the six personas requested
(beginner, Indian-food user, in-a-hurry, mistake-prone, poor network, rapid-tapper). This is
**not** a repeat of the 2026-09-03/04 deep-dive audit — every P0/P1/P2 from that audit is
confirmed still fixed (spot-checked; see §5) — this pass hunts fresh regressions and scenarios
that audit didn't cover.

---

## 1. What actually got tested, and what didn't

**Tested — static (source-verified) and, where noted, live in a browser against the local dev
server:** every write-triggering UI surface for double-submit safety, every Zod schema for
unbounded/hostile input, every swallowed-Supabase-error and missing-fetch-timeout site, every
auth/session-expiry edge case, and every empty-state/zero-data code path across dashboard,
progress, weight, and deficit.

**Not tested — no live authenticated session.** I don't hold or type passwords, and creating a
new account needs your go-ahead per the audit's safety rules. Everything below the gates and the
two live checks in §4 is **CODE-REVIEWED**, not **OBSERVED**: I traced the code paths as far as
static analysis allows and I'm explicit below about what I couldn't confirm (Postgres's actual
behavior on an `Infinity` write, real bfcache paint timing, live rate-limiting). If you want the
authenticated half (rapid-tap food logging in the real UI, session-expiry mid-flow, the actual
onboarding wizard) run — sign in yourself in Chrome and I can drive/observe from there.

**Incident during this run, not an app bug:** my first `npm run build` collided with your
already-running `npm run dev` on the same worktree — the exact trap `CLAUDE.md` documents — and
broke your dev server's hydration (every JS/CSS chunk 404ing). You stopped the other session and
told me to fix it; I did (`rm -rf .next` + restart). Confirmed clean afterward: no console
errors, hydrated, interactive.

---

## 2. Gate results

| Gate | Result |
|---|---|
| `npm test` | ✅ **95 files / 1,419 tests passed** (up from the 90/1,379 `CLAUDE.md` documents — worth a doc refresh) |
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ "No ESLint warnings or errors" |
| `npm run check:tokens` | ✅ 0 violations |
| `npm run build` | ⚠️ **not run** — your dev server was live on the same worktree; running it again would just reproduce the collision above. Last clean, verified build was the 2026-09-03 audit (519 static pages, 1m59s). Re-run it when your dev server is down. |

---

## 3. Findings

Severity: **P1** damages trust, retention, money, or shows a false success message · **P2** real
but lower-frequency or narrower blast radius · **P3** minor/nice-to-fix.

| ID | Sev | Finding | Repro | file:line | Type | Conf |
|---|---|---|---|---|---|---|
| **F1** | **P1** | **Account deletion can silently skip cancelling a live Razorpay/Stripe subscription, then reports success anyway.** The subscription-status read before the cancel-or-block branch drops `error`; on a transient read failure the `if (sub && ACTIVE.has(...))` guard is skipped entirely, the account is deleted, and the route returns `{ok:true}`. The user is told their account and billing are gone; Razorpay/Stripe keeps charging a card attached to an account that no longer exists to manage it from — and Razorpay has no self-serve cancel portal (the route's own comment says so). | Force `subscriptions` read to fail during `POST /api/account/delete` on a Pro account. | `app/api/account/delete/route.ts:25` (`const { data: sub } = await admin.from('subscriptions')...`, no `error` checked) | CODE-REVIEWED | high |
| **F2** | **P1** | **A transient DB read failure makes a paying Pro user get treated as free, for that request.** `getIsPro`/`isProStatus`'s canonical helper — and ~9 inline copies of the identical pattern across routes — drop the Supabase read's `error` and feed `data?.status` straight into `isProStatus`, so a failed read and "genuinely not Pro" look identical (`undefined` → `false`). | Force the `subscriptions` read to fail while a Pro user hits camera/chat analyze, streak rescue, or history/weight/exercise reads. | `lib/subscription.ts:19-24` (canonical); same shape at `app/api/chat/analyze/route.ts:36`, `app/api/camera/analyze/route.ts:92`, `app/api/foods/custom/route.ts:17`, `app/api/foods/suggest/route.ts:58` (comment claims "not swallowed" about two *other* reads two lines below this one), `app/api/streak/rescue/route.ts:30`, `app/api/weight/logs/route.ts:24`, `app/api/exercise/logs/route.ts:19`, `app/api/logs/route.ts:28`, `lib/backfill.ts:63` | CODE-REVIEWED | high |
| **F3** | **P1** | **Rapid double-tap on "Save weight" or the exercise logger's submit creates a duplicate row**, with no defense on either side. The client guard is `useState`-only (`setIsSubmitting(true)` inside the async handler, `disabled={isSubmitting}` on the button) — two clicks landing in the same event-loop tick both read the pre-update `isSubmitting === false`. There is no `useRef` guard (the pattern `AddFoodModal.tsx` already uses correctly via `inFlightRef`) and no DB uniqueness constraint on `(user_id, measured_at)` for weight or on `exercise_logs` to catch a race that gets past the client. | Fast double-tap "Save weight" (or the exercise save button) before the disabled state visually applies — plausible on a touchscreen, and exactly the "rapid-tap" persona this pass targets. | `components/weight/WeightLogModal.tsx:55-58,183`; `components/log/ExerciseLogger.tsx:39,180` (no top-of-function guard on either `handleSubmit`) | CODE-REVIEWED | high |
| **F4** | **P1** | **`/api/logs/copy-yesterday` is still not idempotent** — confirmed still true, not from the 2026-09-03 audit but from `docs/refactor-safety-contract.md`'s own documented accepted gap. Same `useState`-only client guard as F3, no server-side existing-rows check before the insert. A double-tap duplicates every one of yesterday's logs onto today. | Fast double-tap "Copy yesterday" on the Food tab. | `app/api/logs/copy-yesterday/route.ts:57`; client guard at `components/log/FoodLanding.tsx:267-282` | CODE-REVIEWED | high |
| **F5** | P2 | **Same unbounded-number bug class as the already-fixed height/weight P2-14, in a sibling path that sweep missed.** `saved_meal_items.grams`/`.servings` are `z.number().positive()` with no `.max()` — `Infinity` is `typeof 'number'` and `> 0`, so it's accepted. That row is later read back (untouched) by `/api/meals/log`, which calls `scaleMacros(food, item.grams, item.servings)` and writes the result straight into a real `food_logs` row — so an astronomical saved-combo portion becomes an `Infinity`-kcal diary entry with no server-side recompute catching it. Not reachable through the normal slider UI (which is bounded), but reachable through the same `POST /api/meals/saved` any signed-in client can call directly. | `POST /api/meals/saved` with `{"name":"x","items":[{"food_id":"<uuid>","grams":1e300,"servings":1}]}`, then tap the resulting combo. | `app/api/meals/saved/route.ts:11-16` (schema); `app/api/meals/log/route.ts:80` (`scaleMacros(item.food!, item.grams, ...)`, no bound) | CODE-REVIEWED | high |
| **F6** | P2 | **Search silently drops packaged (Open Food Facts) results on a transient DB blip, with no user-visible error.** If the existing-rows check fails, every OFF candidate is (re-)inserted; that insert then collides with the `(source, source_id)` unique constraint and fails wholesale; the failure is dropped, so those foods are filtered out of the response with nothing to indicate anything went wrong. The user searches for a real packaged product, gets no result, and has no reason to retry. | Force the `foods` select or insert inside `persistExternalFoods` to fail during a search that would otherwise return OFF rows. | `app/api/foods/search/route.ts:130,139` (`const { data: existing }`, `const { data: inserted }` — neither checks `error`) | CODE-REVIEWED | medium |
| **F7** | P2 | **Razorpay SDK calls have no request timeout** — same missing-timeout class already fixed for Gemini and the Play OAuth token mint, not yet applied here. The SDK wraps a bare axios instance with no `timeout` set (axios default: never). Checkout creation, cancel, and delete-then-cancel can all hang until Vercel's platform-level function kill, producing a bare 504 instead of the graceful, actionable timeout message the rest of the app standardizes on. | Razorpay's API stalls during `POST /api/razorpay/create-subscription`, `/cancel`, or the cancel-then-delete path. | `lib/razorpay/client.ts:12` (`new Razorpay({ key_id, key_secret })`, no timeout) | CODE-REVIEWED | high |
| **F8** | P2 | **`/api/logs`'s `end` query param has zero validation, unlike its sibling `start`** (which was hardened in the 2026-09-03 fix for this exact class — parse before use, never string-compare). `end` is passed raw into `.lt('logged_at', end)`. Not a paywall bypass (only `start` gates history), but a malformed value reaches PostgREST unvalidated, and this route's generic catch surfaces the raw Postgres error string on failure — inconsistent with the "never compare an untrusted timestamp as a string" rule one line above it. | `GET /api/logs?end=not-a-date` | `app/api/logs/route.ts` (`start` clamped via `clampHistoryStart`; `end` used as-is) | CODE-REVIEWED | medium |
| **F9** | P2 | **No protected page sets `Cache-Control: no-store`**, so a signed-out user pressing Back (browser, or Android hardware Back in the TWA) is architecturally exposed to a bfcache-restored flash of the previously authenticated page before any client re-check runs. `next.config.js`'s only `headers()` entries are for two static assets. **Could not verify live** — bfcache paint timing needs a real browser/device, which this pass didn't have; noting that the code has no defense either way, not that the flash is confirmed. | Sign out, then press Back, on a real device. | `next.config.js:53-58` (headers() covers only `assetlinks.json`/manifest) | CODE-REVIEWED (unverified live) | medium |
| **F10** | P2 | **Signing out in one tab doesn't stop another tab's still-valid access token from writing food logs.** `middleware.ts` explicitly skips every `/api/*` route for its session-refresh/revocation check; each API route instead calls `getApiUser()`, which only verifies the JWT's local signature+expiry (`getClaims()`), never a live revocation check. Not a cross-user leak — RLS still scopes every write to the token's own `auth.uid()` — but "signed out" doesn't actually stop writes from a second tab/device holding the same (still-unexpired, ~1hr TTL) access token. | Sign out in Tab A; Tab B (same access token, not yet expired) can still `POST /api/logs/add`. | `middleware.ts:31-36` ("Let them through untouched" for `/api/*`); `lib/supabase/server.ts:56-68` (`getApiUser` doc comment says middleware is "the real gate," which is false for API routes) | CODE-REVIEWED | medium |
| **F11** | P3 | **A double-opened magic link's second tab lands on a plain sign-in page with zero explanation.** `/auth/callback`'s failure path redirects to `/auth/sign-in?error=oauth_callback_failed` (correct — the code was already consumed by the first tab), but the sign-in page never reads or displays that query param. | Open the same magic link in two tabs; click it in both. | `app/auth/callback/route.ts:56` (sets the param); `app/auth/sign-in/page.tsx` (never reads it) | CODE-REVIEWED | medium |
| **F12** | P3 | **A second deficit-calculation implementation lives outside the documented single source of truth.** `CLAUDE.md` says "deficit has exactly one definition... never re-derive it," specifically because Trends and `/deficit` disagreeing by ~1,200 kcal was already a P1 once. `/deficit`'s "All time" total hand-rolls the same `maintenance − eaten` loop instead of calling `cumulativeSeries()`/`calculatePeriodDeficit` from `lib/deficit-calculator.ts`. **Currently numerically correct** (same formula, right sign) and doesn't crash on zero data (`totalDeficit` stays `0`) — flagged as a drift risk, not a live wrong number: a future edit to either copy can silently diverge them again. | Read the loop against `lib/deficit-calculator.ts`'s exports. | `app/deficit/page.tsx:118-125` | CODE-REVIEWED | medium |
| **F13** | P3 | **`/auth/forgot-password` redirects to `/auth/reset-password`, not `/auth/callback`** — a second, undocumented session-establishing path outside the one route `CLAUDE.md` names as authoritative. It doesn't currently break (middleware never bounces `/auth/*` regardless of session state, so the specific failure mode the hard rule warns about can't occur here), but worth a one-line confirmation that this is a deliberate password-recovery exception rather than an oversight. | Read `app/auth/forgot-password/page.tsx:23-24` against the hard rule. | `app/auth/forgot-password/page.tsx:23-24` | CODE-REVIEWED | low |

---

## 4. Live checks (OBSERVED, not just code-reviewed)

- **Sign-up form correctly blocks a malformed email before any request fires.** Typed
  `not-an-email` + a 2-character password, then rapid-triple-clicked "Create account." The
  browser's native `type="email"` constraint validation caught it first ("Please include an '@'
  in the email address") — **zero network requests were recorded** across all three clicks, so
  there's no duplicate-submission risk on this specific path even before Zod/React-Hook-Form get
  involved. Verified via network log, not just the UI.
- **Landing page and auth pages render and hydrate correctly** after the dev-server recovery — no
  console errors, all links resolve, no horizontal overflow observed at desktop width.
- Did **not** attempt a real sign-up (creating an account needs your go-ahead per this audit's
  safety rules) or any authenticated flow — see §1.

---

## 5. Spot-check: does the 2026-09-03/04 audit still hold?

Sampled the two P0s and three P1s most relevant to this pass's themes:

| Finding | Verdict |
|---|---|
| P0-1 `subscriptions` self-grantable Pro (write policies dropped) | Not re-checked this pass (would need live DB access) — no code regression found that would reopen it |
| P0-2 saved combo backfill date threading | ✅ still holds — `app/api/meals/log/route.ts:22` still resolves `date` through `resolveLoggedAtForRequest`, confirmed while reading this route for F5 |
| P1-1 `?start=epoch` history bypass | ✅ still holds — `clampHistoryStart` still gates `start` in `/api/logs/route.ts`, confirmed while finding F8 |
| P1-4/P1-5 push-budget/reminder swallowed errors | ✅ still holds — excluded by name from this pass's swallowed-error sweep, confirmed fixed |
| P2-14 unbounded height/weight | ✅ still holds — but see **F5**, the sibling path it didn't cover |

---

## 6. False alarms discarded this pass

| Claimed | Verdict | Why it was wrong |
|---|---|---|
| **`editFoodLogSchema`'s `kcal`/`protein_g`/`carbs_g`/`fat_g` are unbounded**, same class as the fixed height/weight bug — flagged by one of the review passes. | **Refuted.** | Read `lib/validations.ts:102-118` directly: all four fields already carry explicit `.max()` bounds (kcal ≤5,000, protein/fat ≤500g, carbs ≤1,000g), and the surrounding comment documents this was fixed as **P2-2 in the 2026-09-04 audit**. The reviewer that raised it was looking at a stale mental model of the file, not its current contents. |

## What was checked and found genuinely safe (worth recording, not just findings)

- **Idempotent by design, confirmed correct:** streak rescue (`unique(user_id, rescued_date)`,
  duplicate insert degrades to `ok:true` rather than double-spending the monthly allowance),
  food favourites (23505 explicitly ignored), all delete routes (a second delete on an
  already-gone row is a clean no-op, not a 500), Razorpay `verify`/`cancel` (upsert/idempotent
  update), and the billing unique indexes on `razorpay_subscription_id` /
  `play_purchase_token` (still present and enforced — "one token/subscription = one account"
  holds).
- **Empty-state handling is genuinely thorough.** No `.reduce()` without an initial value was
  found anywhere in `components/dashboard`, `lib/`, or the progress/weight/deficit charts.
  Every retention module (`plateau.ts`, `adaptiveTarget.ts`, `streak.ts`,
  `deficit-calculator.ts`, `projection.ts`, `goalProjection.ts`, `weightTrend.ts`) has an
  explicit early-return for zero or single-data-point input. Charts gate on `length > 1`/`> 2`
  before rendering trend lines. This is the one area where the codebase's own discipline (each
  `lib/` module pinned by a test) clearly paid off.
- **Search-as-you-type race condition: reviewed clean.** TanStack Query keys the results cache
  by the debounced query string itself, so a slow "ric" response can never overwrite a faster
  "rice" response's cache entry — no stale-wins bug.
- **`app/api/export` (CSV):** checks both read errors explicitly and throws to a clean 500 —
  no silent partial export.
- **Onboarding gate:** all 8 documented protected-page sites still present; no regression from
  recent work (chat sheet rebuild, camera multi-food, mobile UX PRs #64-#72).

---

## 7. What I couldn't test, and what I'd need from you

| Untested | What I need |
|---|---|
| Every authenticated runtime scenario — rapid-tap food logging in the real UI, session-expiry mid-log, the actual onboarding wizard, streak/freeze behavior, real double-submit timing on a touchscreen | A session — sign in yourself in Chrome (I never type passwords) and I can drive/observe from there |
| `npm run build` | Your dev server needs to be down first — last clean run was 2026-09-03 |
| Live-DB verification of F1/F2/F5/F6/F8 (does Postgres actually accept an `Infinity` write? does a forced read error behave as traced?) | Would need a throwaway/test Supabase environment or your go-ahead to sabotage a read against `+qa1`/`+qa2` |
| F9's bfcache flash | A real device/browser Back-button test after sign-out |
| F3/F4's double-tap timing in practice (vs. the theoretical same-tick race described) | A real touchscreen device — automation can't reliably reproduce sub-16ms double-taps |

---

## If I gave this app to 1,000 real users tomorrow, ranked by expected complaint volume

1. **Duplicate weight/exercise entries (F3) and duplicate "copy yesterday" logs (F4).** These are
   the highest-frequency real-world trigger in this whole list — a fast double-tap on a phone is
   completely ordinary, especially for the "in a hurry" and "rapid-tapper" personas this pass
   targeted, and both surfaces have *zero* defense (not even the client-side `useRef` guard
   `AddFoodModal` already uses correctly). The damage is visible every time the user checks their
   own weight trend or diary — a phantom duplicate entry undermines the exact trust the whole
   product depends on ("does this number mean anything").
2. **"I paid for Pro and it's telling me to upgrade" (F2).** Low frequency (needs an actual DB
   blip) but the single worst trust hit on this list when it fires — a paying customer being
   told to pay again, or denied a rescue/history they already bought, is a one-star-review and a
   support-ticket generator, not a shrug-and-retry.
3. **Foods that silently don't show up in search (F6).** Moderate frequency, low visibility — the
   user doesn't get an error, they just conclude "this app doesn't have Maggi noodles" and either
   re-search differently or quietly decide the catalogue is thin. This is a silent-churn risk
   more than a loud complaint.
4. **"Why am I still being charged after I deleted my account" (F1).** The rarest trigger on this
   list (needs account deletion to coincide with a DB blip) but the worst possible outcome when
   it happens — this is a refund-request-and-bad-review issue, not a shrug.
5. **Everything else (F7-F13)** — genuinely edge-case for a real Indian mobile user in the
   short term: timeouts and session-expiry nuances that need unusual conditions (a stalling
   Razorpay API, a signed-out-elsewhere second tab, a double-opened magic link) to ever surface
   at all.

**The honest caveat:** this list is a prediction from source review, not from analytics — the
2026-09-03 audit made the same caveat and it still holds. The one thing I'd bet on without
hedging: **F3 and F4 will happen to real users on day one**, because "double-tap a save button"
needs no bad luck at all, just a phone and a hurry.
