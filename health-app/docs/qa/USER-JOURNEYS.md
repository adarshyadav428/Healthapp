# GetInShape — User Journey Map

Part of the 2026-09-13 QA baseline. Structured per the original QA brief's journey
categories. Status legend: **PASS (OBSERVED)** = actually exercised in a browser this
session · **CODE-VERIFIED** = traced through source end-to-end, matches intended behavior,
not run · **PARTIALLY TESTED** = some steps observed, some code-verified only · **NOT
TESTED** = neither · **BLOCKED** = requires something this session could not obtain (see
`BLOCKED-MANUAL-TESTS.md`) · **FAIL** = a defect was found.

---

## Public / Landing

| Step | Status | Evidence |
|---|---|---|
| Landing page load, content, hero stats | **PASS (OBSERVED)** | Loaded on production, full content read, screenshot taken at 390px — no horizontal overflow |
| Navigation (Pricing/FAQ anchors, Sign in, Start free) | **PASS (OBSERVED)** | All 11 unique landing-page hrefs enumerated and confirmed to map to real routes |
| Pricing section | PARTIALLY TESTED | Anchor scroll not separately verified; INR pricing (₹299/₹1,999) confirmed correct in code |
| FAQ | NOT TESTED | Not opened this pass |
| CTA buttons (Start for free, Sign in) | **PASS (OBSERVED)** | Both link targets confirmed correct |
| Responsive (390px / 768px / desktop) | PARTIALLY TESTED | 390px confirmed clean (no overflow); 768/1280 not checked |
| Dark/light | NOT TESTED | Theme toggle is app-only (`next-themes`); landing page's own theme behavior not verified |
| Public routes (`/privacy`, `/terms`, `/refunds`, `/contact`, `/pricing`, `/studio`) | **PASS (OBSERVED)** | All loaded, titles and content confirmed correct, no console errors beyond the PWA bug (R3) |
| Broken links | **PASS (OBSERVED)** | None found on landing page |
| Browser title / metadata | **PASS (OBSERVED)** | Per-page titles confirmed distinct and correct (Privacy Policy, Terms of Service, Refund & Cancellation Policy, Contact Us, Design Studio) |
| `/foods/[slug]` SEO pages | **PASS (OBSERVED)** | Sample IFCT page (`ifct-rice-raw`) loaded with correct SEO content; nonexistent slug correctly shows a friendly 404 |
| `robots.txt` / `sitemap.xml` / `manifest.webmanifest` | **PASS (OBSERVED)** | All three fetched directly; robots correctly disallows private routes; sitemap contains 456 URLs (447 food pages, all IFCT-sourced — see `FEATURE-INVENTORY.md` PWA section for the sitemap build-time risk, F-2) |
| Console errors on every public page | **FAIL** | R3 — `Uncaught SyntaxError` on every page load (see Risk Register) |

## Authentication

| Step | Status | Evidence |
|---|---|---|
| Sign-up form load, fields, "Continue with Google" button present | **PASS (OBSERVED)** | Loaded, all fields/buttons confirmed present |
| Sign-up: empty-form validation | **PASS (OBSERVED)**, with a defect | Email field shows friendly "Invalid email"; **password field shows raw Zod string "String must contain at least 8 character(s)"** — R21 |
| Sign-up: invalid email format | **PASS (OBSERVED)** | Same validation message shown regardless of empty vs. malformed |
| Sign-up: short password | **PASS (OBSERVED)** | Confirmed reproducible — same raw Zod string |
| Sign-up: valid submission → account creation | BLOCKED | Would create a real account; not attempted without Adarsh's go-ahead per the skill's safety rules |
| Sign-in form load | **PASS (OBSERVED)** | Loaded, no autofilled credentials found (password placeholder is a literal "••••••••" string, not real autofill) |
| Sign-in: invalid credentials | CODE-VERIFIED | Supabase's own error message shown verbatim, no app-level rewriting — correct anti-enumeration behavior |
| Sign-in: missing fields | NOT TESTED | Not submitted this pass |
| Forgot-password: form load | **PASS (OBSERVED)** | Loaded correctly |
| Forgot-password: invalid email format | **PASS (OBSERVED)** | **Correctly blocked by native HTML5 validation** — no request sent, confirmed via network log inspection |
| Forgot-password: valid submission | BLOCKED (deliberately not attempted) | Submitting would send a real password-reset email; skipped to avoid an unwanted side effect |
| Reset-password: expired/invalid link | NOT TESTED | Needs a real emailed link |
| Session creation/persistence/refresh | CODE-VERIFIED | Cookie-based via `@supabase/ssr`, refreshed by middleware every navigation |
| Sign out | NOT TESTED (needs authenticated session) | Route confirmed correct by code review |
| Return to protected route after sign-in | CODE-VERIFIED, with a defect | `returnTo` correctly guards against open redirect, but **drops the query string** (R-related to Finding E, e.g. `/dashboard?scan=1` loses `scan=1`) |
| Direct protected-route access while unauthenticated | CODE-VERIFIED | Confirmed redirects to `/auth/sign-in?returnTo=<path>` for all non-public paths |
| Auth redirect for an already-signed-in user hitting `/auth/*` | **FAIL (CODE-VERIFIED, high confidence)** | This is the exact mechanism of R2/Finding A — see Risk Register |
| Expired session | CODE-VERIFIED | Middleware fails open on network failure, closed on an authoritative invalid-JWT response — both paths tested in the existing suite |
| Network failure during auth | CODE-VERIFIED | Same fail-open behavior confirmed by `tests/middleware.test.ts` |
| Duplicate/rapid submission | NOT TESTED | Not exercised this pass |
| OAuth sign-in/up (Google) | BLOCKED | Requires a real Google account round trip; button presence/target confirmed, flow itself not exercised |

## Onboarding

BLOCKED for a live walkthrough — needs a fresh account (qa2 or a new throwaway), which
requires Adarsh's sign-in per this session's safety constraints. Everything below is
CODE-VERIFIED from the onboarding fragment's direct source reads:

- 4-screen wizard confirmed (not 6 — dead `STEP_EMOJIS` array entries are cosmetic leftovers).
- Screen 1 (activation log, skippable), 2 (name/age/sex), 3 (body & goal), 4 (lifestyle + TDEE
  preview) — field groupings confirmed to match `TESTING.md`'s documented script.
- Back/forward navigation, draft persistence and resume — confirmed via
  `hooks/useOnboardingDraft.ts`, **but the draft key is not scoped per account** (a cross-
  account bleed risk on a shared device, see Risk Register minor findings).
- Time-to-first-log-under-60-seconds claim — **not measured**, requires a live walkthrough.
- Returning-user re-entry correctly redirects to `/dashboard`.
- Plan-reveal page (`/onboarding/plan`) has a resumability safety net (redirects back to
  `/onboarding` if the submit didn't actually persist `daily_calorie_target`).

## Home

BLOCKED for live testing (needs authenticated session). CODE-VERIFIED from the home-log-
search fragment:

- Initial load is server-rendered with data already present — no loading-skeleton first
  paint, by design.
- A background refetch failure is invisible to the user (silent fallback to `initialLogs`,
  no error toast) — not necessarily wrong, but no user-visible signal of staleness exists.
- Empty-day state, calorie ring math, macro sums — all confirmed consistent with
  `TodayFoodLog`'s independent sum (both derive from the identical cache key, cannot diverge
  while both are mounted).
- Exactly one "attention card" (streak-rescue/restart/plateau) renders at a time — confirmed
  correct, though the *wiring* (as opposed to the pure ordering function) has no dedicated
  test (R9-adjacent gap).
- Search deep link (`/log?search=1`), camera FAB, chat FAB — all confirmed to route to the
  correct destination surfaces.

## Food

BLOCKED for live testing. CODE-VERIFIED from the home-log-search fragment (the single most
thoroughly reviewed domain in this baseline — see `FEATURE-INVENTORY.md` for the full
scenario list): search (success/no-results/slow/error/clear/repeated/special-characters/
misspellings/brand-names), Recent/Favourites/My-foods shelves, quantity editor edge cases,
meal-slot inference, add/edit/delete, quick-add semantics, saved combos, copy-yesterday,
copy-meal, backfill. All confirmed working as designed at the code level, with the specific
exceptions logged as R4 (unbounded saved-meal-item grams), R7 (edit trusts client macros),
R8 (no server idempotency on single-item inserts).

## Camera

BLOCKED for live testing (needs camera permission or gallery fallback + an authenticated
session). CODE-VERIFIED from the camera-chat-ai fragment: permission-denied/unavailable both
have a gallery-upload escape hatch (never dead-ended); capture/retake/cancel all confirmed;
the P0-1 "unresolved pcs item never persisted with invented numbers" fix is re-verified
intact; AI timeout/failure/malformed/empty-response all have distinct, confirmed-correct
error paths; a failed scan cannot burn a trial call (traced through both routes). **Not
verified live:** actual OS camera-permission dialogs, real barcode scanning via
`BarcodeDetector`, actual image upload latency on a real device.

## AI / Gemini (camera + chat, treated as unreliable)

CODE-VERIFIED, not run against the live Gemini API in this pass (every test in the repo
stubs Gemini's response — see `QA-COVERAGE-MAP.md`). Confirmed correct: plausibility
guardrails clamp every value before any catalogue write; the model is never trusted for
arithmetic (camera's label-scaling fix, chat's `rebalanceChatItems` subtraction); the shared
3-call lifetime trial pool sums camera+chat correctly and fails closed on a read error. **Not
verified:** actual model drift, a real malformed response from the live API, stale-request
ordering under real network jitter (chat structurally prevents overlapping requests from one
modal instance, but this wasn't exercised with a real slow-then-fast pair of requests).

## Progress

BLOCKED for live testing. CODE-VERIFIED: chart date ranges, month calendar navigation,
badge shelf, deficit calendar-vs-rolling window split, streak/milestone interplay — all
confirmed correct. **One confirmed-by-inference, not-yet-runtime-confirmed defect**: the
weight-trend line on this page may never render real data for any user (R1) — this is the
single most important item to check first with a live session.

## Profile / Settings

BLOCKED for live testing. CODE-VERIFIED: every settings row's route/API mapping (profile
edit + TDEE recompute, appearance, analytics opt-out, CSV export correctly free/unwindowed,
delete account's careful ordering of provider-cancel-before-user-delete). **Not verified
live:** actual sign-out behavior, actual delete-account destructive flow (deliberately not
attempted against any real account in this pass).

## Subscriptions / Billing

BLOCKED for a real purchase (explicitly prohibited). CODE-VERIFIED: full entitlement matrix
across Razorpay/Play/Stripe-legacy (see `FEATURE-INVENTORY.md`), signature verification on
both webhooks (genuine HMAC in the existing test suite, not re-derived here), the
`subscriptions` RLS lockdown holding. **Highest-value untested path:** `lib/play/verify.ts`
and `lib/play/google-auth.ts` have zero test coverage of any kind (R19) — this is the
provider with the least safety net despite being one of two live payment methods.

## PWA

**PASS (OBSERVED) with a confirmed defect.** Manifest, robots, sitemap all fetched and
inspected directly. Service-worker registration, precache manifest content, and the
redirect-to-sign-in bug (R3) were all directly observed via `fetch()` and
`navigator.serviceWorker.getRegistrations()` in the browser console against production —
this is the most thoroughly *runtime*-tested domain in this entire baseline, precisely
because it's one of the few that doesn't require authentication. A2HS install, standalone
launch, and TWA-specific behavior remain BLOCKED (need a real Android device).

## Navigation

PARTIALLY TESTED. Every public route's navigation confirmed working; every protected
route's middleware-gating confirmed correct by code review (10-entry `isPublic` list,
matches tests exactly). **Not tested live:** browser back/forward through authenticated
pages, navigation during a pending mutation or AI scan (code review found no
`AbortController` anywhere that would make this unsafe, but the actual UX of it — a stale
response arriving after navigation — was not observed).

## Modals / Sheets / Dialogs

CODE-VERIFIED only. Every overlay in the app uses `useScrollLock()` + `useBackDismiss()`
consistently (both module-level counters, correctly handling nesting per CLAUDE.md's
documented rules); `SheetContent` is swipe-dismissible via its grabber. **Cannot be verified
live in this session's automation browser even with an authenticated session**, per
CLAUDE.md's own documented constraint: `requestAnimationFrame` is frozen in these tabs, so
rAF-coalesced effects (keyboard inset, drag transforms) never actually run — this specific
class of check needs a real device, always, regardless of who is testing it.

## Forms / Inputs

PARTIALLY TESTED (public forms only). Sign-up and forgot-password forms both had their
client-side and native-browser validation exercised directly (see Authentication section
above). Every other form in the app (quantity editors, profile edit, weight log, custom
food) is CODE-VERIFIED only — see `FEATURE-INVENTORY.md`'s per-feature validation notes
(e.g. quantity editor's decimal/zero/huge/invalid handling, all confirmed bounded on both
client and server sides).

## Data CRUD

See `DATA-INTEGRITY-REPORT.md` for the full cross-cutting analysis. Summary: CREATE/READ
confirmed correctly scoped to `user_id` everywhere; UPDATE has one confirmed trust-boundary
gap (`/api/logs/edit`, R7) and one confirmed-by-code-but-not-yet-live-tested risk
(backdated weigh-in overwriting live profile targets, R6); DELETE confirmed correctly
scoped everywhere reviewed, with undo round-trips confirmed to drop the `context` tag
(R31, minor).
