# GetInShape — Risk Register

Part of the 2026-09-13 QA baseline, updated 2026-09-13 (continuation session) after
authenticated browser testing against production with account `+qa2` (Priya QA, Free tier,
via the user's real, already-signed-in Chrome session — no credentials were ever seen or
typed). Every item cites its evidence; **OBSERVED** = reproduced against a running instance
(production or a local production build) in this pass, **CODE-REVIEWED** = verified by
reading source, not by running it. Items whose status changed this session say so
explicitly — nothing was silently upgraded from CODE-REVIEWED to OBSERVED without an actual
reproduction in this pass. See `EXPLORATORY-QA-REPORT.md` for the full narrative and
`BLOCKED-MANUAL-TESTS.md` for what still needs a live/device pass.

## Verified this session (authenticated pass) — headline changes

- **R1 (weight trend) — REFUTED.** Built 14 real backdated weigh-ins via the actual app
  (one through the real "Log weight" UI, the rest via the app's own `/api/weight/add`
  endpoint under the same authenticated session) and confirmed `weight_kg` arrives as a
  genuine JSON **number** (`69.5`, not a string) from `/api/weight/logs` — for all 14 rows.
  The trend line, rate ("~5w at 1.02 kg/week" / "Down 0.64 kg a week on a 4-week average"),
  and projected date rendered correctly on **both** `/weight` and `/progress` once the
  14-distinct-day threshold was crossed. **This was a false alarm in the original static
  review** — moved out of P0 entirely, see the PASS entry below.
- **R2 (auth-callback) — CONFIRMED FAIL, OBSERVED.** `fetch('/auth/callback?code=fake&next=/dashboard')` while authenticated returned `redirected:true, finalUrl:.../dashboard` — the route handler never ran, confirmed independent of code validity. Same result for `/auth/reset-password?code=fake`. This is airtight: the redirect fires on auth state alone, before the handler inspects the code param.
- **R3 (PWA middleware) — FIXED, verified against an actual production build.** Ran a clean `npm run build`, started `next start`, found the *real* generated filenames (`worker-ea0ccb4e26f790e0.js`, `swe-worker-5c72df51bb1f6ee0.js`), and confirmed via `curl` that both now return `200 application/javascript` (not redirected), while `/dashboard` still correctly redirects to sign-in. See the dedicated verification note below.
- **R4 (unbounded `saved_meal_items`) — CONFIRMED OBSERVED, and worse than previously scored.** Created a real saved combo with `grams: 999999999` via the actual API (200 OK, no rejection), logged it, and watched **2,969,999,997 kcal** (`78,000,000 g` protein) get written to the real `food_logs` table and render, unclamped, on the Food page, Home's calorie ring, macro tallies, and the coaching line ("Protein target hit — 78000000g today"). No layer — API, DB, or any UI surface — applies any sanity bound. **Elevated in severity given the complete absence of any downstream guard**, not just the missing input bound.
- **R7 (`/api/logs/edit` trusts client macros) — CONFIRMED OBSERVED via direct exploit.** PATCHed a real log entry to `grams:105, kcal:4999` (the food's true kcal for 105g is 311.85) — accepted with 200, persisted verbatim, and propagated to Home's ring ("4,999 kcal eaten... 3,421 kcal over").
- **R8 (no idempotency on single-item inserts) — CONFIRMED OBSERVED.** Fired two genuinely simultaneous (`Promise.all`) identical `POST /api/logs/add` requests; both returned 200 and **both rows were persisted** — a real, reproduced duplicate.
- **R6 (backdated weigh-in overwrites live targets) — OBSERVED.** After posting the 14 backdated weigh-ins in chronological order, Settings' calorie target changed from 1,589 → 1,578 kcal/day purely from historical entries, consistent with the predicted mechanism (an intermediate backdated entry, not the true latest weigh-in, drove the last profile overwrite).
- Three genuinely **new** findings surfaced only by live interaction (not visible to static review) — see NEW-1 through NEW-3 below.
- All test data created for these reproductions (log entries, the saved combo, the 14 weigh-ins) was inspected and then **deleted via the app's own delete APIs** immediately after confirmation, except the 14 weigh-ins, which were left in place since they are legitimate-shaped QA fixture data (not corrupted) and are useful for any follow-up session testing `/weight` or `/progress`.

## PASS — confirmed working correctly this session (moved out of the risk list)

- **Weight trend line, rate, and projected-date** on both `/weight` and `/progress` (was R1).
- Food search ranking (measured IFCT beats branded/estimate on a generic query, e.g. "roti").
- Food add (search result → AddFoodModal → persist), including the zero-quantity edge case, which correctly floors to the unit's minimum (0.25 roti) rather than blocking or logging zero.
- Food edit (normal path) and delete, both with correct persistence and immediate cross-screen consistency (Food page ↔ Home ↔ database, verified via direct API reads after each mutation).
- AI chat logging (`CHAT-1`) end-to-end against the **real, live Gemini API**: free-text parse → itemized confirm screen → log → persisted rows matching the displayed values exactly.
- Custom food creation correctly returns `402 {error:"Pro required"}` for this Free account.
- Appearance (dark/light/system) toggle applies immediately and persists across a full page reload.
- `middleware.ts`'s public/protected boundary: a protected route still redirects unauthenticated visitors correctly after the R3 fix (no over-broadening).

## P0 — data loss / security / app unusable / core-feature-invisible

| # | Risk | Evidence | Blast radius | Status |
|---|---|---|---|---|
| R2 | **Deferred email verification cannot complete for its designed, common-case user.** `middleware.ts:131-134` redirects *any* authenticated visitor away from all of `/auth/*`, with no carve-out for `/auth/callback`. `VerifyEmailCard`'s whole premise is clicking the link while already signed in — the callback never runs, `email_verified_at` never stamps. | **CONFIRMED, OBSERVED this session** — direct `fetch()` reproduction against production while authenticated as `+qa2` (see above); the account's own verification-card visibility wasn't checked (not currently shown for this account), but the redirect mechanism itself is proven independent of that | Blocks AUTH-06, AUTH-10, AUTH-11 (AI trial gate reads the same column); secondarily `/auth/reset-password` for a signed-in user (Finding C) | Open, confirmed |
| R3 | **PWA service-worker precache was broken for every anonymous visitor.** `middleware.ts:144`'s matcher excluded `sw.js`/`workbox-*` but not `worker-*.js`/`swe-worker-*.js`. Anonymous requests for these two generated worker chunks were redirected to `/auth/sign-in`, returning HTML where JS was expected. | **OBSERVED on production**, then **fixed and re-verified against a real production build** this session — `curl` against `next start` output confirmed the exact generated filenames (`worker-ea0ccb4e26f790e0.js`, `swe-worker-5c72df51bb1f6ee0.js`) now 200 as `application/javascript`, not redirected; `/dashboard` still correctly redirects. Actual `navigator.serviceWorker.register()` could not be independently re-verified in this sandbox's localhost-tunnel environment (a "fetching the script" error reproduces there independent of this fix — see the dedicated note below); real-domain SW registration was separately confirmed working at the top of this session. | Every first-time/signed-out visitor's service-worker registration | **FIXED, production-build-verified. Not yet committed, merged, or deployed per instruction** — production still serves the old, broken middleware until this ships. |
| R4 | **`saved_meal_items.grams`/`servings` unbounded — confirmed exploitable end-to-end with no guard at any layer.** `z.number().positive()`, no `.max()`, reaching `food_logs.kcal`/macros with zero re-validation. | **CONFIRMED OBSERVED this session** — created a combo with `grams:999999999`, logged it, watched `2,969,999,997 kcal` persist and render unclamped on Food, Home, and the coaching line. Self-scoped (can only corrupt the attacker's own diary) but reachable by any signed-in user with zero special access. | Attacker's own deficit/streak/Trends/weekly-recap/Wrapped numbers; not cross-user | **Elevated to P0** — the original P1 scoring assumed *some* downstream guard existed; live testing found none |

## P1 — major user journey broken or high-confidence functional defect

| # | Risk | Evidence | Notes |
|---|---|---|---|
| R5 | `/weight`'s "🎯 On track for X kg by ~date" banner uses the direction-agnostic `lib/projection.ts` instead of the honest `lib/goalProjection.ts` gate every sibling surface uses — can tell a plateaued or wrong-direction user they're on track. | **OBSERVED this session** — with only 1 weigh-in on record (before any trend was even computable), `/weight` already confidently rendered "🎯 On track for 65.0 kg by ~15 Nov 2026 · At 0.5 kg/week · about 9 weeks to go" — proving the banner needs no real trend at all, just the stated pace and a target, exactly as the code predicts | The exact failure mode `goalProjection.ts`'s own docstring was written to prevent, unguarded on the one page whose job is showing the truth |
| R6 | Backdating a weigh-in ≥0.5kg different from current can silently overwrite live `current_weight_kg` and recompute calorie/macro targets from stale historical data — no recency check. | **OBSERVED this session** — after posting 14 backdated weigh-ins in chronological order, Settings' daily calorie target shifted from 1,589 → 1,578 kcal, protein 112→111g, carbs 159→158g, purely from historical (non-latest) entries | `weightLogSchema` validates date format only, no ordering constraint |
| R7 | `/api/logs/edit` trusts client-computed `kcal`/`protein_g`/`carbs_g`/`fat_g` verbatim with no server-side recompute from `food_id`+`grams` — a client arithmetic bug persists silently, bounded only by a raw ceiling. | **CONFIRMED OBSERVED this session** — PATCHed a real log to `grams:105, kcal:4999` (true value 311.85) with the exact same food; server accepted it (200) and Home's ring showed "4,999 kcal eaten... 3,421 kcal over" | Self-scoped only (RLS still enforces `user_id`) |
| R8 | No server-side idempotency on single-item log inserts (`/api/logs/add`, `/quick-add`, `/add-bulk`, `/api/meals/log`) — a network retry after timeout (not just a same-tick double-tap) can duplicate a food log and inflate a day's totals. | **CONFIRMED OBSERVED this session** — two genuinely simultaneous identical `POST /api/logs/add` calls both returned 200 and both rows persisted (verified via a direct DB read immediately after) | Named scope boundary in CLAUDE.md (only weight/exercise/copy routes got idempotency treatment) — but the live reproduction shows the risk is not theoretical |
| R9 | **Story engine (`components/story/`) has zero automated test coverage of any kind** — the most-reused (welcome/wrapped/onboarding-plan), most motion/interaction-heavy surface in the growth stack. | CODE-REVIEWED (growth-retention, finding 6) | No unit test, no render test exists anywhere |
| R10 | Streak Rescue route: 4 of 5 negative-path branches (403 free, 409 exhausted, 409 no-break, 500 read-failure, 200-idempotent-retry) have zero route-level test — only the pure quota logic and one happy path are pinned. | CODE-REVIEWED (growth-retention, finding 5) | Same wiring-drift bug class CLAUDE.md's own audit history repeatedly finds |
| R11 | `push-reminders` cron lacks the route-level test its sibling `weekly-recap` has, despite sharing the identical fail-loud doctrine and having previously shipped the exact "mass mis-timed send" bug class. | CODE-REVIEWED (growth-retention, finding 7) | Asymmetric coverage between two crons with identical risk profiles |
| R12 | `push_sends.opened_at` stamping (`worker/index.js` + `/api/push/opened`) has zero automated test, despite being the exact mechanism that has already regressed once in production history (opened_at NULL for weeks, migration 033). | CODE-REVIEWED (growth-retention, finding 3) | Currently correct; no regression net |
| R13 | No `AbortController` on either camera or chat analyze fetch — closing the modal mid-scan doesn't cancel the request; a late 403 can fire an unconditional `router.push('/upgrade')` on whatever screen the user has since navigated to. | CODE-REVIEWED (camera-chat-ai, new finding 1) | Rare trigger condition, non-destructive but jarring |
| R14 | Chat's quantity slider is hardcoded 10–600g (no numeric entry) vs. camera's 10–1500g; a legitimate >600g chat-parsed item (the app's own docs cite a 750g example) silently clamps down the instant the user touches the slider. | CODE-REVIEWED (camera-chat-ai, new finding 2) | Easily reproduced: describe "1kg chicken curry," try to nudge the slider |
| R15 | `/api/chat/analyze` has **zero route-level integration test** (auth, 500, 403, timeout, malformed-JSON, partial-failure paths) — unlike its camera sibling, which has thorough coverage of the identical shape. | CODE-REVIEWED (camera-chat-ai + test-suite-audit, cross-confirmed) | — |
| R16 | ~30 PostHog call sites use bare string literals instead of `EVENTS.KEY`, including the core habit-loop events (`food_logged`, `first_food_logged`) and all four streak-lifecycle events — a documented hard rule, confirmed **growing, not shrinking**, since the 2026-09-04 audit first flagged it (P2-6). | CODE-REVIEWED (pwa-analytics-infra §3.4) | A future rename in `lib/posthog/events.ts` would silently fork from what's actually sent, with no type error and no test catching it |
| R17 | `app/sitemap.ts` and `app/foods/[slug]/page.tsx`'s `generateStaticParams` both drop `error` on their build-time admin-client reads — a reachable-but-failing Supabase silently ships a build with zero food detail pages and zero sitemap entries, defeating the documented "fail loudly" guarantee. | CODE-REVIEWED (security-rls F-2, cross-confirmed by pwa-analytics-infra) | Content/SEO regression, not security — but silent and build-passing |
| R18 | `/api/logs/quick-add` and `/api/profile/update` — both named load-bearing in CLAUDE.md's hard rules — have **no route-level test**, only client-side POST-body assertions. | CODE-REVIEWED (test-suite-audit) | — |
| R19 | `lib/play/verify.ts` and `lib/play/google-auth.ts` (the code that actually calls the Google Play Developer API and authenticates to it) have **zero test coverage** — every billing test mocks Play verification wholesale. | CODE-REVIEWED (test-suite-audit) | Highest-value test gap in the billing domain per that fragment's own ranking |
| R20 | Play's `SUBSCRIPTION_STATE_IN_GRACE_PERIOD` maps to `{status:'past_due', entitled:true}` at the provider level, but the shared `isProStatus` gate only allows `active`/`trialing` — a paying Android user in grace period reads as **not Pro** through all ~20 gate surfaces before Play itself would cut them off. | CODE-REVIEWED (settings-billing §3.7) | Needs a product decision — flagged as a candidate bug, not asserted outright |

## P2 — meaningful functional or UX defect

| # | Risk | Evidence |
|---|---|---|
| R21 | Sign-up form shows a raw Zod validation string ("String must contain at least 8 character(s)") for a short/empty password, instead of human copy (the email field correctly shows "Invalid email"). | **OBSERVED** this session on production sign-up form |
| R22 | `goal:'maintain'` shares `'gain'`'s progress-bar/delta-colour direction logic — a maintain-goal user with a below-current target sees gaining rendered as "good." | CODE-REVIEWED (progress-weight-deficit, Finding 4) |
| R23 | Exercise calories are logged/displayed but never factor into deficit or TDEE math anywhere in `lib/` — plausibly deliberate, undocumented as such. | CODE-REVIEWED (progress-weight-deficit, Finding 5) — needs a one-line product confirmation |
| R24 | `foods/custom` PATCH/DELETE reimplements ownership with `.includes(user.id)` (substring) instead of the canonical `isFoodReferenceableBy`/`owns_custom_food()` prefix predicate — not exploitable today (RLS backstops it, UUID collision is astronomically unlikely) but a third divergent reimplementation of a rule the codebase's own P0-2 postmortem warns against. | CODE-REVIEWED (security-rls F-3, cross-confirmed by home-log-search S-4) |
| R25 | Analytics opt-out is client-side only (`posthog.opt_out_capturing()`) and cannot silence server-side `captureServerEvent` calls — a user who opts out still generates a full server-side event stream (food_logged, billing, AI events) tied to their user id. | CODE-REVIEWED (pwa-analytics-infra §3.5) — potential privacy-copy accuracy risk if `/privacy` claims otherwise (not checked in this pass) |
| R26 | Sentry has **no client-side (browser) error capture at all** — no `sentry.client.config.ts`, no `app/global-error.tsx`. Every Client Component crash (camera, chat, every modal/sheet) throws into the void from Sentry's perspective. | CODE-REVIEWED (pwa-analytics-infra §3.6) |
| R27 | Root `twa-manifest.json`'s `"shortcuts": []` vs. the web manifest's 3 real shortcuts — plausibly a dead/always-empty Bubblewrap field, or a genuine drift where the Android app's long-press quick actions don't exist on real devices. | CODE-REVIEWED (pwa-analytics-infra §3.7) — **needs a device/build check**, cannot be resolved from source alone |
| R28 | `%` and `_` (SQL ILIKE wildcards) are not stripped from a search query before it's interpolated into an ILIKE pattern — not an injection risk, but a literal `%`/`_` in a query produces unexpected wildcard matching instead of a literal match. | CODE-REVIEWED (home-log-search S-6) |
| R29 | Search rate limiter (`app/api/foods/search/route.ts`) is a module-level `Map`, scoped per warm serverless instance, not global — the stated "30 req/60s" cap is enforced per-instance under real concurrent load, not as advertised. | CODE-REVIEWED (home-log-search S-8) |
| R30 | Favourites-toggle rollback on failure re-fetches rather than truly reverting — an offline user who fails a toggle sees the wrong optimistic state persist until the network returns and a refetch is triggered. | CODE-REVIEWED (home-log-search S-7) |
| R31 | Undo of a quick-add-type deleted log always drops its `context` tag, regardless of what the original row carried. | CODE-REVIEWED (home-log-search S-5) |
| NEW-1 | Searching "roti" returns "Protien bar" (Yoga bar) with its unit displayed as **"1 medium roti"** — a clear portion-unit/data-quality mismatch (a protein bar has no business being measured in rotis, and arguably shouldn't rank for a "roti" query at all). | **OBSERVED this session** — live search on production, `GET /api/foods/search?q=roti`, item ~18 of the result list | Root cause not diagnosed (likely an over-broad `SMART_PORTIONS` pattern or a synonym/tag data error on that specific branded row) — same failure *shape* CLAUDE.md documents for other overly-broad portion patterns (`lassi`/`cola`/`fanta`), just not yet found in this specific row |
| NEW-2 | AI chat logging misresolved a plain condiment to the wrong dish: describing "2 paratha with curd and achar" matched "curd" to **"Curd Rice (Thayir Sadam)"** (a rice dish) instead of plain curd/dahi — a semantically wrong food for what was actually described. | **OBSERVED this session** — live call to the real Gemini API via `/api/chat/analyze`, logged and confirmed in `food_logs` (`source:'ifct'`, 120g, 129.6kcal under the wrong name) | Could be a Gemini interpretation issue or a food-matching/synonym gap on the server side; not root-caused in this pass |
| NEW-3 | The weekly Energy-balance card can confidently declare "You are ahead of schedule — 1.54 kg of fat loss per week at this pace" while explicitly also stating "2 of 7 days logged · 5 not logged" — the pace is extrapolated from as few as 1–2 logged days with no minimum-sample caveat in the copy. `lib/deficit-calculator.ts:274-275` computes `avgDailyDeficit` over `daysLogged` only (correctly excluding unlogged days from the sum) but then unconditionally multiplies by 7 for the headline claim. | **OBSERVED this session** on `/progress`, `+qa2` account | Not necessarily wrong arithmetic, but a confidence-vs-sample-size honesty gap of the same *class* CLAUDE.md's `goalProjection.ts` rule exists to prevent elsewhere — worth a product decision on whether a minimum `daysLogged` should gate the "ahead of schedule" framing |

## P3 — minor / polish (representative sample; see individual fragments for the full list)

- Dead `STEP_EMOJIS` array entries in `OnboardingForm.tsx` (cosmetic, unreachable indices).
- `ONBOARDING_STARTED` can double-fire for a genuine returner still on step 1.
- Onboarding draft `localStorage` key is not scoped per account (unlike the sibling `verifyPromptStore`) — cross-account bleed on a shared device if a wizard is abandoned mid-way.
- Sign-in never renders `?error=oauth_callback_failed` (documented audit F11, still open).
- `WeightChart` tooltip renders raw `weight_kg` without `formatKg()` — risks a long-precision-string display.
- Weight milestone can fire from a backdated entry inserted out of chronological order.
- `sitemap.ts` recomputes `lastModified: new Date()` on every request for static marketing pages instead of a fixed content date.
- Thali share card was shipped per the 2026-07-29 plan doc then reverted in code — the reversal isn't reflected in CLAUDE.md's growth-mechanics section, so the plan doc could mislead a future reader.
- Non-constant-time secret comparison on the two `SEED_SECRET`-gated admin routes.

---

## Prioritization for the founder

**Fix first (all four confirmed by direct reproduction, not just code review):**
1. **R4** — `saved_meal_items` bound is the most urgent: confirmed a real account can write a
   2.97-billion-kcal log with zero friction at any layer. One-line fix (`MAX_LOG_GRAMS`,
   99-servings cap), open since 2026-09-05.
2. **R7** — `/api/logs/edit` needs a server-side recompute from `food_id`+`grams`, or at minimum
   a plausibility check against the linked food — confirmed a 16× calorie inflation is
   trivially achievable and silently corrupts Home/deficit/streak numbers.
3. **R3** — fixed in the working tree and verified against a production build; commit, PR, and
   merge it. Closes a bug affecting 100% of anonymous visitors today.
4. **R2** — decide the intended fix for the auth-callback middleware gap (exempt
   `/auth/callback` and `/auth/reset-password` from the authenticated bounce) — confirmed this
   session that the deferred-email-verification flow cannot complete for a signed-in user.
5. **R8** — add idempotency to `/api/logs/add` and its siblings (the same treatment weight/
   exercise/copy routes already got) — confirmed a genuine concurrent duplicate in one test.
6. **R6** — add a recency check before `/api/weight/add` overwrites live profile targets from
   a backdated entry.
7. **R5** — gate `/weight`'s "on track" banner behind the same `lib/goalProjection.ts` honesty
   check `/dashboard` and `/api/paywall/projection` already use.

**Investigate next (real, observed, but not yet root-caused):** NEW-1 (Protien bar / "1 medium
roti" unit), NEW-2 (chat AI matching "curd" to "Curd Rice"), NEW-3 (deficit pace confidence vs.
sample size — needs a product decision, not necessarily a code fix).

**Automate next (highest test-coverage ROI):** R9 (story engine), R15 (chat route — now that
CHAT-1's happy path is confirmed working live, a regression suite is what protects it), R19
(Play verify), R10/R11/R12 (growth-mechanics route tests), R18 (quick-add/profile-update
routes).

**Can safely wait:** everything in P3, R16 (analytics hygiene — real but slow-burn), R26
(Sentry client scope — a product/observability call, not urgent), R20 (Play grace period —
needs a real subscription in that state to even evaluate further).

**No longer a concern:** R1 (weight trend) — confirmed working correctly this session; the
original static-review hypothesis was a false alarm.
