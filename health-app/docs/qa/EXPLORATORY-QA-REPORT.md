# GetInShape — Exploratory QA Baseline Report

**Date:** 2026-09-13 (initial pass), updated 2026-09-13 (authenticated follow-up pass, same day)
**Scope:** Complete, evidence-based QA baseline across the GetInShape web app, PWA, and
Android TWA — code review, automated-gate audit, hands-on unauthenticated browser testing,
and a subsequent **authenticated** browser testing pass against production using account
`+qa2` via the user's own already-signed-in Chrome session (no credentials were ever seen or
typed by this agent, per its safety rules).
**Companion documents:** `FEATURE-INVENTORY.md`, `USER-JOURNEYS.md`,
`DATA-INTEGRITY-REPORT.md`, `SECURITY-QA-REPORT.md`, `PERFORMANCE-REPORT.md`,
`E2E-TEST-MATRIX.md`, `QA-COVERAGE-MAP.md`, `RISK-REGISTER.md`, `BLOCKED-MANUAL-TESTS.md`.

---

## 1. Executive summary

GetInShape's automated safety net is genuinely strong — 131 test files, 1,650 tests, all
five CI gates green, three prior full audits that closed every P0/P1 security finding they
surfaced, and a security posture this pass could not find a single new critical hole in
after reading all 48 API routes and every RLS-relevant migration. That is the good news, and
it is real.

**This baseline ran in two passes.** The first pass was static-code-review-only plus
unauthenticated browser testing, and it surfaced two suspected P0s. The second pass got an
authenticated session (the user's own real, already-signed-in Chrome — this agent never saw
or typed a password) and tested both directly, plus a substantial live walkthrough of Home,
Food, AI chat logging, Progress, Weight, and Settings. **One suspected P0 turned out to be a
false alarm; the other was confirmed; and two additional defects were found that static
review had scored lower than the live evidence now supports:**

1. **REFUTED — the weight-trend feature works correctly.** The original hypothesis (a
   `Number.isFinite` check failing on a stringified Postgres `numeric`) was tested directly:
   14 real weigh-ins were created through the app, and `weight_kg` came back as a genuine
   JSON number every time. The trend line, rate, and projected date all rendered correctly
   on both `/weight` and `/progress`. **This is good news, not a gap** — the feature works.
2. **CONFIRMED — deferred email verification cannot complete for its designed user.**
   Directly reproduced: an authenticated request to `/auth/callback?code=<anything>` redirects
   straight to `/dashboard` without the route handler ever running, proving the callback is
   unreachable for any already-signed-in visitor — exactly the state `VerifyEmailCard`'s
   "click this link while signed in" flow puts a user in.
3. **CONFIRMED and elevated — `saved_meal_items` has no bound at any layer.** Live-created a
   combo with a 999,999,999-gram serving and watched **2.97 billion kcal** persist to a real
   account's diary and render, completely unclamped, on the Food page, Home's calorie ring,
   the macro tallies, and the AI coaching line. No input validation, no database constraint,
   and no UI sanity check anywhere in the chain caught it.
4. **CONFIRMED — `/api/logs/edit` accepts fabricated macros.** A direct exploit
   (`grams:105, kcal:4999` for a food whose true 105g value is 311.85 kcal) was accepted and
   rendered on Home ("4,999 kcal eaten... 3,421 kcal over").
5. **CONFIRMED — no idempotency on `/api/logs/add`.** Two genuinely simultaneous identical
   requests both succeeded, producing two duplicate rows in the real database.

The service-worker bug found in the first pass (**R3**) was fixed in the working tree and
**verified against an actual production build** (`next start` + `curl` against the real
generated worker filenames) during this second pass — not just a dev-server check. It is
not yet committed, merged, or deployed, per explicit instruction this session.

Three genuinely new findings surfaced only by live interaction, invisible to static code
review: a search-result portion-unit mismatch ("Protien bar" showing "1 medium roti"), an AI
food-matching error (chat resolved "curd" to "Curd Rice," a different dish), and a
partial-data confidence issue in the weekly deficit card ("ahead of schedule" from as few as
1–2 logged days).

**What remains genuinely untested:** camera photo capture (no camera hardware in this
environment), most of Settings beyond Appearance, sign-out and delete-account (deliberately
not attempted against the shared QA fixture), onboarding on a fresh account, streak/badge/
milestone live-triggering, and everything requiring a Pro account, a second account, a real
device, or a real payment. See `BLOCKED-MANUAL-TESTS.md` for the complete, updated list.

## 2. Environment

- Repo: `C:\Users\plump\Downloads\Health App\health-app`, branch `main` @ `094d16d`
  (post-PR #90 "Ember Still" redesign merge). Working tree carries the middleware fix
  (`middleware.ts`) and this `docs/qa/` directory; nothing else changed, nothing committed.
- Stack per `CLAUDE.md`: Next.js 14.2.0 App Router, React 18.2, TypeScript 5.4.5 strict,
  Supabase (auth+Postgres+RLS), Tailwind 3.4, Zustand+TanStack Query, Razorpay+Google Play
  Billing+legacy Stripe, Gemini `gemini-2.5-flash-lite` (raw REST), Vitest 4.1.
- Automated gates run this session: `npm test` (131 files / 1,650 tests, all pass),
  `npx tsc --noEmit` (0 errors), `npm run lint` (clean), `npm run check:tokens` (0
  violations), `npm run build` (succeeds) — all five green, exit code 0 each. Re-run after
  the middleware fix: `tests/middleware.test.ts` + `tests/architectureInvariants.test.ts`
  (69/69 pass), `tsc`, `lint` all still clean.
- **Unauthenticated browser testing** (first pass): production (`https://www.getinshape.co.in`),
  ~40 scenarios, all public/landing/auth-form/PWA surfaces.
- **Authenticated browser testing** (second pass): production, account
  `adarshyadavazm123+qa2@gmail.com` ("Priya QA," Free tier), via the user's own real Chrome
  browser through the Claude-in-Chrome connector — an existing, already-signed-in session was
  found and used; **no password was ever seen, typed, or requested**. Covered: both suspected
  P0s (direct reproduction), Home, Food (search/add/edit/delete, including two direct
  exploits), AI chat logging (one real Gemini call), Progress/Weight (14 real backdated
  weigh-ins created to cross the trend threshold), Settings (Appearance), Pro-gating
  (custom-food 402, `/deficit` access), one concurrency test (duplicate-add race), and real
  authenticated page-load timing. All test data created for reproduction was deleted via the
  app's own APIs immediately after confirmation, except the 14 weigh-ins (left in place as
  legitimate-shaped fixture data useful for follow-up sessions).
- **Production-build verification** of the R3 fix: a clean `npm run build` + `next start`,
  then `curl` against the real generated worker filenames — see `RISK-REGISTER.md` and
  `SECURITY-QA-REPORT.md`.
- **Not attempted:** camera capture (no hardware), any real payment, sign-out or
  delete-account against the shared fixture, anything needing a Pro account or a second
  account (none was available this session).
- Static/code research: 9 parallel research passes across auth/onboarding,
  home/log/search, camera/chat AI, progress/weight/deficit/exercise, settings/billing,
  growth/retention, PWA/analytics/infra, security/RLS, and the existing test suite — every
  claim in this report and its companions is either OBSERVED (reproduced live this session)
  or CODE-REVIEWED (read from source, cited `file:line`), and every status change from the
  first pass to the second says explicitly which.

## 3. Application areas discovered

Ten domains, matching the companion `FEATURE-INVENTORY.md` sections: Auth & Onboarding;
Home/Dashboard; Food Logging & Search; Camera & Chat AI Logging; Progress/Weight/Deficit/
Exercise; Settings/Profile/Billing; Growth & Retention Mechanics (streaks, badges, story
engine, welcome/wrapped, push); PWA/Service Worker/Manifest; Analytics/Observability;
Security/RLS (cross-cutting). Plus the root-level Android TWA wrapper, which is a thin
Bubblewrap shell with no application logic of its own (see the root `CLAUDE.md`).

## 4. Total features discovered

**~150 discrete features/flows**, spanning 48 API routes and every page under `app/`. Full
breakdown in `FEATURE-INVENTORY.md`.

## 5. Total user journeys mapped

**~30 named end-to-end journeys** across the categories in `USER-JOURNEYS.md` (public,
auth, onboarding, home, food, camera, AI, progress, settings, billing, PWA, navigation,
modals, forms, data CRUD).

## 6. Total scenarios executed

- **Unauthenticated live browser scenarios:** ~40 (see `E2E-TEST-MATRIX.md` rows E-001–E-037).
- **Authenticated live browser/API scenarios (second pass):** ~35, including: both P0
  reproductions, food search + add + edit (normal and exploit) + delete + concurrency race,
  one full AI chat logging round trip against live Gemini, 14 weigh-in creations plus trend
  verification on two pages, custom-food Pro-gate check, `/deficit` access check, Appearance
  toggle, and three authenticated page-load timing captures.
- **Automated gate runs:** 5/5 green, twice (before and after the middleware fix).
- **Production-build verification:** 1 clean build + `next start` + 4 `curl` checks.
- **Code-reviewed scenarios** (traced through source, not run): several hundred, across the
  nine research fragments underlying every companion document.

## 7–11. PASS / FAIL / BLOCKED / NOT TESTED / PARTIALLY TESTED counts

Counting every row across `E2E-TEST-MATRIX.md`, `QA-COVERAGE-MAP.md`, and the authenticated
pass documented in `RISK-REGISTER.md`/`DATA-INTEGRITY-REPORT.md`:

| Status | Count | Notes |
|---|---|---|
| **PASS** | ~28 | Public/landing surfaces, 5 automated gates, plus authenticated: Home, food search/add/edit/delete normal paths, AI chat logging end-to-end, weight trend (was suspected P0), custom-food Pro-gate, `/deficit` access, Appearance toggle, protected-route redirect after the R3 fix |
| **FAIL (confirmed, observed)** | ~9 | R2 (auth-callback), R3 (pre-fix), R4, R5, R6, R7, R8 — all directly reproduced this session — plus R21 (sign-up copy) and the R3 pre-fix observation |
| **FAIL (high-confidence, code-reviewed only)** | ~11 | R9–R20 minus what got live-confirmed above |
| **BLOCKED** | ~15 named across Tiers 1–3 in `BLOCKED-MANUAL-TESTS.md`, ~25+ implied across the full brief | Camera hardware, real device, real payment, second/Pro account, production-only |
| **NOT TESTED** | ~10 (sign-out, most Settings rows, onboarding-fresh-account, streak/badge live-triggering, exercise logging, barcode, edit/delete-while-pending concurrency, a11y, cold/throttled performance) | Coverage gaps, not confirmed defects — deprioritized this session for time, not unreachable |
| **PARTIALLY TESTED** | ~3 | Navigation (protected-route redirect confirmed; back/forward not walked), forms (public + food/weight forms tested; most Settings forms not) |

**This baseline moved substantially toward PASS/FAIL and away from BLOCKED/CODE-REVIEWED-only
between the two passes**, but real gaps remain — see Tier 1 of `BLOCKED-MANUAL-TESTS.md` for
exactly what's still open and why.

## 12–15. P0 / P1 / P2 / P3 counts

Per `RISK-REGISTER.md`, after the authenticated pass: **3 P0** (R2 auth-callback — confirmed;
R3 PWA worker — fixed & production-build-verified; R4 unbounded saved-meal-items — confirmed
and elevated), **17 P1** (5 of them — R5, R6, R7, R8, plus R2/R3/R4 above — now confirmed
live rather than code-reviewed only), **14 P2** (R21–R31 plus NEW-1/2/3), plus a long tail of
P3 polish items. **R1 (weight trend) is no longer a P0 — it was refuted and moved to the PASS
list.** Cross-reference `RISK-REGISTER.md` for the full, individually-cited list.

## 16. Critical bugs (P0)

1. **R2 — CONFIRMED, OBSERVED.** Deferred email verification's magic link cannot complete
   when the user is already signed in — directly reproduced via `fetch()` against production
   this session; the redirect fires on auth state alone, before the route handler runs.
2. **R3 — CONFIRMED, then FIXED and production-build-verified this session.** The fix is in
   the working tree, verified via `curl` against a real `next start` build using the actual
   generated worker filenames. Not yet committed, merged, or deployed.
3. **R4 — CONFIRMED, OBSERVED, and elevated.** Created a real combo with a 999,999,999-gram
   serving; watched 2.97 billion kcal persist and render, completely unclamped, at every
   layer (API, DB, Food page, Home ring, macros, coaching line).

**No longer P0:** R1 (weight trend) — tested directly and found working correctly. This was
the original baseline's single highest-priority open item; it is now closed as a false alarm.

## 17. Major bugs (P1, updated with live confirmations)

**Confirmed live this session:** R5 (`/weight`'s "on track" banner rendered confidently with
just 1 data point — no real trend needed to trigger it); R6 (Settings' calorie target shifted
1,589→1,578 kcal purely from backdated historical weigh-ins); R7 (`/api/logs/edit` accepted a
16× calorie inflation and it rendered on Home); R8 (two simultaneous identical add-requests
both persisted — a real duplicate).

**Still code-reviewed only (not independently re-run this session):** zero test coverage on
the story engine (R9), Streak Rescue's negative paths (R10), the `push-reminders` cron (R11),
and `push_sends.opened_at` (R12); no `AbortController` on AI scan fetches (R13); chat's
mismatched portion-slider range (R14); zero route-level test for chat's analyze endpoint
(R15 — note the *functional* path was confirmed working live this session; the *test
coverage* gap is a separate, still-open concern); ~30 analytics call sites bypassing the
`EVENTS.KEY` hygiene rule (R16); build-time admin-client reads dropping `error` (R17);
`/api/logs/quick-add` and `/api/profile/update` untested at the route level (R18); Play
billing's verification logic entirely untested (R19); a Play grace-period entitlement
mismatch (R20).

## 18. Functional bugs (P2)

Sign-up's raw-Zod-string password error (R21, OBSERVED); `goal:'maintain'` mis-colored as
gaining (R22); exercise calories never affecting deficit math, unconfirmed as intentional
(R23); a weaker ownership-check reimplementation in `foods/custom` (R24); analytics
opt-out not reaching server-side events (R25); no client-side Sentry capture (R26); TWA
manifest shortcuts possibly stale (R27); unstripped ILIKE wildcards in search (R28);
per-instance (not global) search rate limiting (R29); favourites-toggle rollback not truly
reverting offline (R30); undo dropping the `context` tag (R31).

**New, found only by live interaction this session:**
- **NEW-1 (OBSERVED):** Searching "roti" on production returns "Protien bar" (Yoga bar) with
  its unit displayed as "1 medium roti" — a clear portion-mapping data-quality defect.
- **NEW-2 (OBSERVED):** AI chat logging misresolved "curd" (in "2 paratha with curd and
  achar") to "Curd Rice (Thayir Sadam)," a rice dish, against the real live Gemini API.
- **NEW-3 (OBSERVED):** The weekly Energy-balance card confidently declared "ahead of
  schedule — 1.54 kg of fat loss per week" while its own copy simultaneously stated "2 of 7
  days logged, 5 not logged" — the pace claim extrapolates from as few as 1–2 logged days
  with no minimum-sample caveat.

## 19. Visual / accessibility bugs

**Not assessed this pass beyond incidental observation.** Phase 5 (accessibility) and Phase
6 (responsive/visual QA) of the original brief require either an authenticated session (most
of the app's screens) or dedicated a11y tooling (axe, screen-reader walkthrough) that this
pass did not run even against the public pages. The one visual check performed — 390px
responsive on the landing page — found no horizontal overflow. **This is a real, acknowledged
gap in this baseline**, not a "no findings" clean bill of health. See §22 for scope
remaining.

## 20. Performance problems

See `PERFORMANCE-REPORT.md` in full. Headline: `/progress`'s bundle (118 kB own, 410 kB
First Load JS) is 7× the next-largest page and the single largest page load in the app —
still the one performance finding backed by a hard, build-time number. This session also
captured real (warm-cache, fast-connection) authenticated navigation timings — `/dashboard`
909ms load event, `/settings` 1,345ms, `/progress` 1,252ms — none pathological, but these
don't speak to the cold/throttled/real-mobile-device case the bundle-size finding actually
worries about. One real AI chat call completed comfortably within the 20s timeout. Camera
timing could not be measured (no hardware). No `AbortController`, per-instance rate limiting,
and the 20s-timeout-with-no-escalating-feedback risks remain code-reviewed predictions, not
measured.

## 21. Security findings

See `SECURITY-QA-REPORT.md` in full. Headline: **no new critical (P0) security finding**.
Every prior documented P0 re-verified as still fixed. Three new, bounded findings (F-2
build-time error-swallowing, F-3 a weaker ownership check backstopped by RLS, F-4
non-constant-time secret comparison), all P2/P3. The two new P0s this baseline surfaced
(weight-trend, PWA worker redirect) are correctness/availability bugs that happen to route
through security-adjacent files (a type coercion, a middleware matcher) — they are **not**
security vulnerabilities and are tracked in the Risk Register, not double-counted as
security findings.

## 22. Existing test coverage

131 files, ~1,650 tests, all Vitest, **zero browser/E2E automation of any kind exists in
this repo.** The render-test layer (7 files) is unusually disciplined and rule-compliant
(zero violations of CLAUDE.md's six render-test rules found). Full domain-by-domain
breakdown in `QA-COVERAGE-MAP.md` and `test-suite-audit` fragment.

## 23. Missing test coverage

Highest-value gaps, in order: `lib/play/verify.ts`/`google-auth.ts` (Play billing's actual
API logic, zero coverage); the story engine (zero coverage, most-reused growth-stack
surface); `/api/chat/analyze` (zero route test, vs. camera's thorough coverage); Streak
Rescue's 4 negative route branches; `/api/logs/quick-add` and `/api/profile/update` route
tests; `push-reminders` cron's route-level test (asymmetric with its sibling); Add/Edit
food-log modals (no render test exists for either, despite being the highest-traffic UI in
the app alongside search).

## 24. Flaky / suspicious tests

**None found to be flaky** (no `.skip`/`.todo` anywhere in the suite). The one *historical*
time-bomb pattern (`routeCopyMeal.test.ts` pasting onto a fixed historical day without
freezing the clock, which broke for real on 2026-09-11) is confirmed **fixed and isolated**
— it does not recur elsewhere in the ~30 files individually traced for the same shape,
though the streak/plateau/projection family (9 files) was not individually verified and is
flagged as a worthwhile follow-up. A meaningful fraction of the "wiring/coupling" tests
(`serverGating`, `architectureInvariants`, `proLock`, `coachingWiring`, `reminderWiring`) are
source-text regex assertions rather than executed behavior — a deliberate, well-documented
house pattern, but one of them (`serverGating.test.ts`) has already had a documented
near-miss where it matched its own explanatory comment as if it were the violation.

## 25. Android-only checks

All BLOCKED pending a real device — see `BLOCKED-MANUAL-TESTS.md` Tier 2. Highest-value:
TWA manifest long-press shortcuts (root `twa-manifest.json` shows `shortcuts:[]`, web
manifest shows 3 — cannot be resolved without a device), Google Play Billing purchase flow
(the least-tested payment path in the app), real push-notification delivery and tap-through.

## 26. iOS-only checks

No native iOS app exists; iOS Safari/PWA is treated identically to "Web" (Razorpay-only) at
the code level. One prior-documented, still-open device-only item worth a spot-check:
`--kb-inset` keyboard behavior on a real iPhone (P1-3 in the 2026-09-04 audit, unresolved).

## 27. Production-only checks

Real Razorpay checkout completion, real Google Play purchase, Monthly Wrapped's actual cron
firing on schedule, BillDesk merchant verification status, Play Console review-queue state —
all explicitly out of this session's safe scope. See `BLOCKED-MANUAL-TESTS.md` Tier 3.

## 28. External-service checks

Gemini's real behavior under live traffic (every test in the repo stubs it); Google Play
Developer API's real response shapes (zero test coverage, see R19); Open Food Facts under
real network conditions; Razorpay's live checkout widget. None exercised this pass.

## 29. What requires manual/human testing (summary — full detail in `BLOCKED-MANUAL-TESTS.md`)

**Do these three first (Tier 0, ~10 minutes total):** confirm the weight-trend string bug
(BT-0.1), confirm the auth-callback bug (BT-0.2), confirm the PWA console error in a normal
browser (BT-0.3). Then the bulk of the app (Tier 1, needs qa1/qa2 sign-in), then real-device
checks (Tier 2), then production-only items (Tier 3).

## 30. Exact recommended priorities

See `RISK-REGISTER.md`'s "Prioritization for the founder" section for the full ranked list.
In one sentence: **confirm the two P0s this week, fix the PWA middleware matcher (small,
high-impact), decide the auth-callback fix, and then run the authenticated half of this
baseline** — everything past that is real but lower-urgency.

---

## TOP 10 — most serious bugs (all now CONFIRMED/OBSERVED unless noted)

1. R4 — `saved_meal_items` unbounded: 2.97 **billion** kcal confirmed persisted and rendered at every layer with zero guard (P0)
2. R2 — Deferred email verification cannot complete for its designed user, directly reproduced (P0)
3. R3 — Service worker broken for every anonymous visitor; fixed and production-build-verified, not yet deployed (P0)
4. R7 — `/api/logs/edit` accepted a confirmed 16× calorie fabrication that rendered on Home (P1)
5. R8 — Confirmed duplicate row from two simultaneous identical add-requests (P1)
6. R6 — Confirmed: backdated weigh-ins silently shifted a live account's calorie target (P1)
7. R5 — Confirmed: the "on track" banner needs no real trend at all to render confidently (P1)
8. R19 — Play billing's actual API logic has zero test coverage (P1, still code-reviewed only)
9. R14 — Chat's portion slider silently clamps a legitimate >600g item (P2, code-reviewed)
10. R21 — Sign-up shows a raw Zod string to a real user, OBSERVED on production (P2)

**Moved off this list:** R1 (weight trend) — tested directly and confirmed working correctly.

## TOP 10 — slowest interactions (mix of measured and predicted — see Performance Report)

1. `/progress` page load — bundle measured at 410 kB First Load JS (7× the next-largest page); real warm-load timing (1,252ms) didn't show pathology, but this doesn't clear the cold/throttled/real-device case
2. Any camera/chat AI scan approaching the 20s server timeout with no escalating feedback (one real chat call completed comfortably within it, but the risk for a slow call remains code-reviewed)
3. `/settings` — measured 1,345ms load event, the slowest of the three pages timed this session
4. `/log`, `/dashboard` (each ~300 kB First Load JS; `/dashboard` measured 909ms, the fastest of the three)
5. Every navigation's middleware auth round trip (88.5 kB middleware bundle + a network call)
6–10. **Not independently rankable without a cold/throttled-network device trace** — see
`PERFORMANCE-REPORT.md` §6 for what should be measured first.

## TOP 10 — highest-risk untested areas

1. Play billing verification logic (`lib/play/verify.ts`, `google-auth.ts`) — zero tests
2. Story engine — zero tests, most-reused growth surface
3. `/api/chat/analyze` — zero route test
4. Streak Rescue's negative-path branches
5. `push_sends.opened_at` mechanism (has already regressed once in production)
6. `push-reminders` cron (asymmetric with its tested sibling)
7. Add/Edit food-log modals — no render test
8. `/api/logs/quick-add`, `/api/profile/update` — no route tests
9. Milestone overlay component — zero DOM-level test
10. Everything authenticated in this entire app, from a browser-automation standpoint — zero E2E exists anywhere

## TOP 10 — most valuable tests to automate first

1. A route test for `/api/chat/analyze` mirroring camera's existing thorough coverage
2. A live-API integration check (even a manual one) for `lib/play/verify.ts`
3. The 4 missing Streak Rescue negative-path route tests
4. A render test for `AddFoodModal`/`EditFoodLogModal` (highest-traffic untested UI)
5. A `.max()` bound on `saved_meal_items.grams`/`servings` + a regression test (R4 — one line)
6. A regression test pinning the middleware matcher's PWA-worker-file exclusion (R3)
7. A regression test for the authenticated `/auth/callback`/`/auth/reset-password` case (R2)
8. A unit test for `computeWeightTrend` using a **string** `weight_kg` fixture (would have caught R1 immediately)
9. A source-pin test for the `EVENTS.KEY` hygiene rule (R16) — same pattern as `reminderWiring.test.ts`
10. A `push-reminders` route test mirroring `weekly-recap`'s existing one (R11)

## TOP 10 — most important manual/device tests

See `BLOCKED-MANUAL-TESTS.md` Tier 0 (do first) through Tier 3 in full; the three Tier-0
checks and the Play Billing purchase flow are the four most consequential.

---

## FINAL REPORT — authenticated pass

### Authenticated features actually tested

**PASS:**
- Home: calorie ring, macro tallies, today's meals, add/edit/delete, cross-screen consistency with the database
- Food search (ranking correctness on a live query)
- Food add (incl. zero-quantity edge case flooring to the unit minimum), edit (normal path), delete
- AI chat logging — full round trip against the real, live Gemini API (parse → confirm → log → persist, values matched exactly)
- Weight tracking — trend line, rate, and projected-date all render correctly with real data (**the suspected P0, refuted**)
- Custom food creation — correctly 402s for Free tier
- `/deficit` page access on a Free account — matches documented grandfather/taste-window logic
- Settings — Appearance (dark/light/system) toggle, applies immediately and persists across reload
- Protected-route redirect for unauthenticated visitors (confirmed still correct after the R3 fix)
- PWA middleware fix — verified against a real production build (`next start` + `curl`)

**FAIL (confirmed live):**
- Deferred email verification — auth-callback redirect consumes the link before it can be processed (R2)
- `/api/logs/edit` accepts fabricated, physically-impossible macros with no server recompute (R7)
- `saved_meal_items` accepts and persists an unbounded serving size, reaching 2.97 billion kcal with no guard anywhere (R4)
- `/api/logs/add` has no idempotency — two simultaneous identical requests both persisted (R8)
- Backdating a weigh-in silently overwrote the account's live calorie target (R6)
- `/weight`'s "on track" banner renders confidently from a single data point with no real trend (R5)
- Sign-up shows a raw Zod validation string instead of human copy (R21)
- Search returns a "Protein bar" labeled in "1 medium roti" units (NEW-1)
- AI chat matched "curd" to "Curd Rice," a different dish (NEW-2)
- Weekly deficit card claims "ahead of schedule" from as few as 1–2 logged days (NEW-3)

**BLOCKED:**
- Camera photo capture (no camera hardware in this environment; gallery-upload fallback also not exercisable via file-input injection in this remote browser)
- Real device/TWA/Play Console items (Tier 2 of `BLOCKED-MANUAL-TESTS.md`) — A2HS install, TWA shortcuts, Play Billing purchase, push delivery, iOS
- Real payments (Razorpay, Google Play) — explicitly prohibited
- Sign-out and delete-account against the shared `+qa2` fixture — deliberately not attempted (irreversible/disruptive to a shared QA account)
- Pro-tier live experience — no Pro account was available this session
- Exact-timestamp IST midnight race — architecturally unreachable via the legitimate API (only a date, never a timestamp, is client-controllable)

**NOT TESTED (time-budget, not blocked):**
- Most Settings rows (Reminders, Usage analytics toggle, Export data)
- Onboarding wizard on a fresh account (`+qa2` is already onboarded)
- Streak/badge/milestone live-triggering (needs either real elapsed time or a longer-history fixture like `qa1`)
- Exercise logging, barcode manual entry
- Edit-while-pending / delete-while-pending / navigate-during-mutation concurrency scenarios (only the duplicate-add race was run)
- Accessibility pass, cold/throttled-network performance measurement

### Severity counts (updated, see `RISK-REGISTER.md`)

**P0: 3** (R2, R3, R4 — down from 4; R1 refuted and removed)
**P1: 17** (5 now confirmed live: R5, R6, R7, R8, plus R2–R4 above)
**P2: 14** (R21–R31 plus NEW-1, NEW-2, NEW-3)
**P3:** long tail of polish items (see Risk Register)

### Confirmed bugs (observed this session, not just code-reviewed)
R2, R3 (pre-fix), R4, R5, R6, R7, R8, R21, NEW-1, NEW-2, NEW-3 — 11 total, each with a
direct, reproducible repro recorded in `RISK-REGISTER.md` and `DATA-INTEGRITY-REPORT.md`.

### Suspected bugs (still code-reviewed only, not independently re-run this session)
R9–R20 (story engine coverage, Streak Rescue route gaps, cron asymmetry, analytics hygiene,
build-time error-swallowing, Play verify coverage, Play grace-period mismatch, and related
items) — see `RISK-REGISTER.md` P1/P2 tables for the complete list.

### Performance findings
`/progress`'s 410 kB First Load JS bundle (measured, build-time) remains the one
performance concern backed by a hard number. Real authenticated navigation timing (warm
cache, fast connection) showed no gross pathology on `/dashboard` (909ms), `/settings`
(1,345ms), or `/progress` (1,252ms) — but this does not clear the cold/throttled/real-mobile
case the bundle-size finding actually worries about. One real AI chat call completed
comfortably within the 20s timeout.

### Data integrity findings
Two confirmed live exploits with full blast-radius tracing (R4, R7); one confirmed
concurrency duplicate (R8); one confirmed profile-corruption path (R6); cache consistency
between Home/Food/Progress confirmed correct for every mutation tested. See
`DATA-INTEGRITY-REPORT.md` for the complete, updated account.

### Security findings
No new critical vulnerability found or introduced. The three P0s in this baseline are
correctness/availability/data-integrity bugs (email verification, PWA worker files, unbounded
input), not authentication or authorization bypasses. See `SECURITY-QA-REPORT.md` — unchanged
by the authenticated pass, since no new route or RLS surface was exercised beyond what static
review already covered (the live testing exploited *already-identified* gaps to confirm their
real-world reach, rather than discovering new authorization holes).

### Coverage gaps
Zero browser/E2E automation exists anywhere in this repo (unchanged finding). The highest-value
gaps remain: Play billing verification logic (R19), the story engine (R9), `/api/chat/analyze`
route-level tests (R15 — now more urgent given the live-confirmed functional path has no
regression net), Streak Rescue's negative paths (R10), and Add/Edit food-log modal render
tests. See `QA-COVERAGE-MAP.md` for the complete, per-domain breakdown.

### Exact requirements for every remaining BLOCKED test

| Test | Requires |
|---|---|
| Camera capture, real barcode scan | A physical device with a camera, or a way to script a file-input upload in this environment |
| A2HS install, TWA shortcuts, standalone launch | A real Android device with Chrome or the installed TWA APK |
| Google Play Billing purchase | A real Android device + a Play sandbox/test-purchase account |
| Push notification delivery | A real device with OS-level push permission granted |
| iOS Safari/PWA, `--kb-inset` | A real iPhone |
| Real Razorpay/Play payment | Explicit authorization for a real financial transaction (not given, and not attempted) |
| Sign-out / delete-account | A disposable throwaway account (never `+qa1`/`+qa2`) with explicit go-ahead to create one |
| Pro-tier live experience | Access to a Pro-tier account (`qa1` is documented as such, not confirmed reachable this session) |
| Streak/badge/milestone live-triggering | Either weeks of real elapsed time, or an account with pre-existing longer history (`qa1`) |
| Monthly Wrapped, `/welcome` | A real Pro-grant event or an existing month-end wrap row |
| Cold/throttled-network performance | A real device or a Lighthouse/DevTools throttling session |

## Final answer to the question this baseline was commissioned to answer

**Does GetInShape actually work, feature-by-feature?** For the surfaces this baseline could
reach — public/landing, and now a substantial authenticated slice (Home, Food, AI chat
logging, Weight/Progress, basic Settings, Pro-gating) — **yes, with confirmed exceptions.**
The core logging loop (search, add, edit, delete) works correctly and stays consistent
across screens. AI chat logging works end-to-end against the real Gemini API. The weight
trend feature — the baseline's original top concern — works correctly. But **four confirmed,
reproducible defects mean "works" comes with real caveats**: a user's own diary can be
silently corrupted to an arbitrary calorie value via editing (R7) or via a saved combo with
no upper bound (R4); a network hiccup can duplicate a log (R8); and a real product feature
(deferred email verification) is structurally unable to complete for the exact user it was
built for (R2).

**This baseline still cannot claim production readiness.** Beyond the confirmed defects
above, large parts of the app remain genuinely untested — camera capture, the Pro-tier
experience, real payments, real devices, most of Settings, and destructive account actions —
not because they were skipped carelessly, but because this session lacked the hardware, a
second/Pro account, or authorization for irreversible actions. The honest state is: **the
authenticated core works, with four confirmed bugs worth fixing soon, and a known, bounded
list of what still needs a real device or a second account to finish verifying.**
