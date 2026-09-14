# GetInShape — QA Coverage Map

Part of the 2026-09-13 QA baseline, **updated after an authenticated pass** against
production with account `+qa2` (Priya QA, Free tier) via the user's own already-signed-in
Chrome session. For each domain: what's actually been proven, and by what. "✅" means real
evidence exists (a passing test that asserts the real thing, or a direct observation this
session); "⚠️" means partial/indirect; "❌" means no coverage found; "🚫 N/A" means not
applicable to that domain. **No entry in this document should be read as "working in
production"** unless the Runtime/Browser-tested column is ✅ — everything else is either a
unit-test claim or a static-code claim, both bounded by the caveats in
`EXPLORATORY-QA-REPORT.md`. Rows changed this session are marked **UPDATED**; nothing was
upgraded to ✅ without an actual reproduction in this pass.

| Domain | Discovered? | Unit test? | Integration/route test? | Render test? | Browser-tested (this pass)? | Responsive-tested? | A11y-tested? | Error-path tested? | Perf-tested? | Security-tested? | Data-integrity-tested? | Device/production-tested? | Current result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Auth: sign-up** | ✅ | ⚠️ (pure validation only) | ❌ | ❌ | ✅ (public form, validation) | ⚠️ (one width) | ❌ | ✅ (found the raw-Zod-string bug) | ❌ | ⚠️ (code-reviewed) | 🚫 N/A | ❌ | **PARTIALLY TESTED** — form works, copy bug found |
| **Auth: sign-in** | ✅ | ❌ | ❌ | ❌ | ✅ (unauthenticated form only) | ❌ | ❌ | ⚠️ (native browser validation confirmed correct) | ❌ | ✅ (code-reviewed, no live bypass found) | 🚫 N/A | ❌ | PARTIALLY TESTED |
| **Auth: OAuth callback / deferred email verification** | ✅ | ⚠️ (pure logic, 20 tests) | ❌ | ❌ | ✅ **UPDATED — confirmed live, authenticated `fetch()` reproduction** | ❌ | ❌ | ❌ | ❌ | ✅ (found P0 — Finding A) | ❌ | ❌ | **FAIL, CONFIRMED** (was high-confidence code-reviewed, now OBSERVED) |
| **Auth: password reset** | ✅ | ❌ | ❌ | ❌ | ⚠️ (form loads, validation confirmed; did not submit to avoid sending a real email) | ❌ | ❌ | ⚠️ | ❌ | ✅ (shares Finding A mechanism) | 🚫 N/A | ❌ | PARTIALLY TESTED |
| **Middleware / route protection** | ✅ | ✅ (`tests/middleware.test.ts`, behavioral) | 🚫 N/A | 🚫 N/A | ✅ (10-entry isPublic list, confirmed matches) | 🚫 N/A | 🚫 N/A | ✅ (fail-open/closed both tested) | 🚫 N/A | ✅ | 🚫 N/A | ❌ | Solid, **except the two matcher gaps found this pass** |
| **Onboarding wizard** | ✅ | ✅ (`routeOnboarding.test.ts`) | ✅ | ✅ (`onboardingForm.test.tsx`) | ❌ (needs a fresh account) | ❌ | ❌ | ⚠️ | ❌ | ✅ | ⚠️ | ❌ | NOT RUNTIME TESTED this pass |
| **Home / Dashboard** | ✅ | ⚠️ | ❌ | ❌ | ✅ **UPDATED** — ring, macros, today's meals, add/edit/delete cross-checked against the DB live | ❌ | ❌ | ⚠️ | ❌ | ✅ | ✅ (confirmed live — corrupted values from R4/R7 propagate straight to the ring) | ❌ | **PASS** on normal path; **FAIL** propagation confirmed for R4/R7 |
| **Food search (SEARCH-*)** | ✅ | ✅ (5+ files, very thorough) | ❌ | ✅ (`foodSearch.test.tsx`) | ✅ **UPDATED** — live search on production confirmed correct ranking (measured IFCT beats branded on "roti") | ❌ | ❌ | ✅ (unit level) | ⚠️ (rate-limiter design flaw found) | ✅ | ✅ | ❌ | **PASS** on ranking; **new data-quality bug found live** (NEW-1, "Protien bar" shows unit "1 medium roti") |
| **Food logging (LOG-*)** | ✅ | ✅ (portion units, last portions) | ⚠️ (copy-yesterday/copy-meal only) | ⚠️ (search only, not Add/Edit modals) | ✅ **UPDATED** — add/edit/delete all exercised live with DB verification after each mutation | ❌ | ❌ | ✅ (zero-quantity edge case confirmed correct) | ❌ | ✅ | ✅ (confirmed both correct sync AND a confirmed exploit, R7) | ❌ | **PASS** on normal path; **FAIL confirmed** on the edit trust-boundary (R7) and concurrent-add idempotency (R8) |
| **Camera scan** | ✅ | ✅ (thorough, incl. P0-1 pin) | ✅ (`routeCameraAnalyze.test.ts`) | ✅ (`cameraModal.test.tsx`) | ❌ **BLOCKED this session — no camera hardware available; gallery-upload fallback also not exercised (no practical file-input injection in this remote browser)** | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ (needs real device camera) | Best-tested AI surface by unit tests; **runtime still unverified** — genuinely blocked, not skipped |
| **Chat AI logging** | ✅ | ✅ (nutrition math, prompt) | **❌ — zero route test** | ❌ | ✅ **UPDATED — confirmed working end-to-end against the real, live Gemini API**: free-text → parsed items → confirm screen → logged → persisted rows matched displayed values exactly | ❌ | ❌ | ⚠️ (unit only for error paths) | ❌ | ✅ | ✅ (persisted values matched exactly) | ❌ | **PASS functionally**; still **zero automated regression coverage** (R15 stands) — plus a new AI-matching quality bug found (NEW-2, "curd"→"Curd Rice") |
| **Progress page** | ✅ | ✅ (deficit-calculator, weightTrend) | ❌ | ❌ | ✅ **UPDATED — R1 REFUTED live**: trend line, rate, and projected date all rendered correctly once 14 distinct days of real data existed | ❌ | ❌ | ⚠️ | ❌ | ✅ | ✅ (R1 refuted; NEW-3 deficit-confidence issue found) | ❌ | **PASS** (weight trend); NEW-3 (partial-data pace confidence) flagged as a new finding |
| **Weight tracking** | ✅ | ⚠️ (`formatWeight.test.ts` only) | ⚠️ (idempotency only) | ✅ (`weightHero.test.tsx`, but numeric fixtures only) | ✅ **UPDATED — R1 REFUTED live** (see Progress page); R5 and R6 both confirmed live | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ (R1 refuted, R5 & R6 confirmed) | ❌ | **PASS** (trend line, was the suspected P0); **FAIL confirmed** on R5 (naive projection banner) and R6 (backdate overwrite) |
| **Deficit page** | ✅ | ✅ (very thorough) | ⚠️ | ❌ | ✅ **UPDATED** — loaded live for a Free account; confirmed as grandfathered/taste-window per code, not independently pinned which | ❌ | ❌ | ⚠️ | ❌ | ✅ | ✅ | ❌ | **PASS** — access gate behaves as documented |
| **Exercise logging** | ✅ | ⚠️ | ✅ (idempotency) | ❌ | ❌ **NOT TESTED this session** — time budget prioritized food/weight/chat | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ (confirmed no deficit interaction, code-reviewed) | ❌ | NOT RUNTIME TESTED |
| **Settings / Profile** | ✅ | ⚠️ | **❌ — no `/api/profile/update` route test** | ✅ (`settingsClient.test.tsx`, thorough) | ⚠️ **UPDATED — Appearance toggle tested live (PASS, persists across reload)**; Reminders/analytics-opt-out/export/sign-out/delete-account all still NOT TESTED this session | ❌ | ❌ | ⚠️ | ❌ | ✅ | ⚠️ | ❌ | Appearance **PASS**; rest of Settings still NOT RUNTIME TESTED |
| **Billing — Razorpay** | ✅ | ✅ (HMAC signature, genuine crypto) | ⚠️ (webhook yes, several routes no) | 🚫 N/A | ❌ (no live payment attempted, correctly) | 🚫 N/A | 🚫 N/A | ⚠️ | ❌ | ✅ | ✅ | ❌ **BLOCKED — real payment** | Strong webhook coverage; checkout-route gaps |
| **Billing — Google Play** | ✅ | ⚠️ | ⚠️ (`playBilling.test.ts`, but `verify.ts`/`google-auth.ts` mocked away entirely) | 🚫 N/A | ❌ | 🚫 N/A | 🚫 N/A | ⚠️ | ❌ | ✅ | ⚠️ (grace-period gap found) | ❌ **BLOCKED — Android device + Play purchase** | **Highest-value coverage gap in billing domain** |
| **Billing — Stripe (legacy)** | ✅ | ✅ (`routeStripeWebhook.test.ts`) | ✅ | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | ✅ | 🚫 N/A | ✅ | ✅ | 🚫 N/A frozen surface | Solid, low-risk (frozen) |
| **Streak / freezes** | ✅ | ✅ (very thorough) | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | Strong unit coverage; zero runtime |
| **Streak Rescue (Pro)** | ✅ | ✅ (quota logic) | **⚠️ — only 401 + 1 happy path** | ❌ | ❌ | ❌ | ❌ | **❌ — 4 negative branches untested** | ❌ | ✅ | ✅ | ❌ | Route wiring is the gap, not the logic |
| **Milestones / badges** | ✅ | ✅ (decision logic) | 🚫 N/A | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | 🚫 N/A | ✅ | ❌ | **Zero DOM-level test on the most interaction-heavy overlay in the app** |
| **Story engine** | ✅ | **❌ — zero coverage of any kind** | 🚫 N/A | **❌** | ❌ | ❌ | ❌ | ❌ | ❌ | 🚫 N/A | 🚫 N/A | ❌ | **Weakest-tested UI surface in the app** given its reuse |
| **`/welcome`, `/wrapped`** | ✅ | ✅ (card-building logic) | ❌ (no page-level test) | 🚫 N/A | ❌ | ❌ | ❌ | ⚠️ | ❌ | ✅ | ✅ (0/NaN/undefined guards confirmed) | ❌ | Logic solid; page wiring unpinned |
| **Meal suggestions** | ✅ | ✅ (ranking) | ⚠️ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ✅ | ✅ (ordered-read fix confirmed) | ❌ | NOT RUNTIME TESTED |
| **Share cards** | ✅ | ✅ | 🚫 N/A | 🚫 N/A | ❌ | ❌ | ❌ | ⚠️ (AbortError handling confirmed correct) | ❌ | 🚫 N/A | 🚫 N/A | ❌ **BLOCKED — real share sheet, real phone** | Code correct; device behavior unverified |
| **Push notifications** | ✅ | ✅ (budget logic, send-source pin) | ❌ (`/api/push/opened` has no test) | 🚫 N/A | ❌ | 🚫 N/A | 🚫 N/A | ⚠️ | ❌ | ✅ | ✅ (no bypass found) | ❌ **BLOCKED — OS permission, real device** | Logic solid; the one route that regressed once has no regression test |
| **Reminders / crons** | ✅ | ✅ (schedule math) | ⚠️ (weekly-recap yes, push-reminders **no**) | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | ⚠️ | ❌ | ✅ | ✅ | ❌ **BLOCKED — needs a real cron trigger** | Asymmetric coverage between the two crons |
| **PWA (manifest, SW, install)** | ✅ | ⚠️ | 🚫 N/A | 🚫 N/A | **✅ — found live P0 bug (R3), then fixed and re-verified against a real production build via `curl`** | ❌ | ❌ | ⚠️ | ❌ | ⚠️ | 🚫 N/A | ❌ **BLOCKED — A2HS on a real device, TWA install; SW-registration re-check hit a sandbox-tunnel-specific error, not attributable to the fix** | **Bug confirmed, fix confirmed working against a production build. Not yet deployed.** |
| **Analytics (PostHog)** | ✅ | ⚠️ | ⚠️ | 🚫 N/A | ❌ | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | ✅ | ⚠️ (opt-out server-side gap found) | ❌ **BLOCKED — needs a live PostHog stream to watch** | Catalog coverage good; hygiene rule violated at ~30 sites |
| **Sentry / observability** | ✅ | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | ✅ | 🚫 N/A | ❌ | **Client-side capture gap found** — real, not yet decided-on |
| **Public pages (landing, pricing, privacy, terms, refunds, contact, studio)** | ✅ | 🚫 N/A | 🚫 N/A | 🚫 N/A | **✅ — all loaded and read this pass** | ✅ (390px checked, no overflow) | ❌ | ✅ | ❌ | 🚫 N/A | 🚫 N/A | 🚫 N/A | **PASS** on content/links/responsive; console errors present (R3) |
| **Food SEO pages (`/foods/[slug]`)** | ✅ | ⚠️ | ❌ | 🚫 N/A | **✅ — sample page + 404 page both loaded and read** | ❌ | ❌ | ✅ (404 confirmed friendly) | ❌ | ✅ | ⚠️ (F-2 build-time error-swallow found) | 🚫 N/A | **PASS** on the pages themselves; build-time risk noted |
| **RLS / API authorization (cross-cutting)** | ✅ | ✅ (`rlsPolicies.test.ts` — SQL-parsed, not executed) | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | ✅ (48/48 routes read) | ✅ | ❌ **the SQL-parsing test explicitly cannot see live-DB drift** | Strong static coverage; live-DB drift is a blind spot no test in the repo can see |
| **Architecture invariants** | ✅ | ✅ (source-text, self-checking) | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | ✅ | 🚫 N/A | 🚫 N/A | Solid |
| **Accessibility (a11y)** | ⚠️ | 🚫 N/A | 🚫 N/A | ⚠️ (render tests query by role, an a11y proxy) | ❌ | ❌ | **❌ — no dedicated a11y pass performed this session (blocked pending authenticated UI access)** | 🚫 N/A | 🚫 N/A | 🚫 N/A | 🚫 N/A | ❌ | **NOT TESTED** — see Phase 5 gap in the master report |
| **Performance (real device/network)** | ⚠️ | 🚫 N/A | 🚫 N/A | 🚫 N/A | ⚠️ (build bundle sizes only) | 🚫 N/A | 🚫 N/A | 🚫 N/A | ⚠️ (static findings only — no AbortController, non-atomic writes) | 🚫 N/A | 🚫 N/A | ❌ | **NOT TESTED** — see `PERFORMANCE-REPORT.md` |

## Cross-cutting observations

1. **There is no browser/E2E automation anywhere in this repo.** Every "unit test" or
   "route test" ✅ above is a Vitest run against mocked Supabase and mocked `fetch` — never a
   real click, a real database write, or a real network call. This is not a criticism of the
   existing suite (it is unusually disciplined for what it is — see `test-suite-audit`
   findings folded into `EXPLORATORY-QA-REPORT.md`) but it is the single largest structural
   gap in "does the product actually work."
2. **A follow-up session obtained a real authenticated browser session** (the user's own,
   already-signed-in Chrome — no credentials were ever seen or typed) and ran a substantial
   authenticated pass: both suspected P0s resolved (one refuted, one confirmed), Home/Food/
   Chat-AI/Progress/Weight all exercised live with database verification after each mutation,
   two additional confirmed-live exploits found (R7, R8) beyond what static review predicted,
   and three genuinely new findings surfaced only by live interaction (NEW-1/2/3). Camera
   capture remains blocked (no hardware in this environment); several Settings rows, sign-out,
   onboarding-on-a-fresh-account, and streak/milestone live-triggering remain untested this
   pass for time-budget reasons, not because they're unreachable — see `BLOCKED-MANUAL-TESTS.md`
   Tier 1 for the current, updated per-area status.
3. **The render-test layer (7 files) is the highest-quality test code in the repo** and
   should be the template for closing the Add/Edit-modal, story-engine, and milestone-overlay
   gaps identified above.
4. **Coverage is not evenly distributed with risk.** The two highest-risk-per-the-app's-own-
   documentation AI routes (camera, chat) have asymmetric coverage (camera thorough, chat
   zero at the route level) despite equal blast radius. The same asymmetry recurs in the two
   crons (weekly-recap tested, push-reminders not) and the two Streak Rescue test layers
   (pure logic thorough, route wiring thin).
