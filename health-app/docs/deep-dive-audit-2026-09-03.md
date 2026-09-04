# GetInShape — deep-dive audit

**Date:** 2026-09-03 · **HEAD:** `6a40c32` · **Branch:** `main` (clean at start and end)
**Scope:** every screen, every API route, the data plane, the test suite, and the product.

---

## 1. Executive summary

**Verdict: not launch-ready, but the gap is small and unusually well-defined — 2–3 days of
work, almost all of it in SQL and copy.** Two P0s, both of them one-file fixes.

The engineering underneath is in the best shape this codebase has been in. All five gates
are green. The suite is **1,272 tests across 88 files**, and it is *real*: six deliberate
sabotage mutations of load-bearing pure functions — the IST 7-day clamp, the TDEE 1,200 kcal
floor, the streak freeze cap, the free-tier cohort split, the deficit sign, and
`SMART_PORTIONS` precedence — were **all six caught**. Every P0 and P1 from the 2026-07-31
audit that I re-tested still holds; nothing has regressed. The catalogue is clean: **0 of 866
shipped rows** are physically implausible or internally inconsistent.

**The one thing that must be fixed before this ships is `subscriptions` RLS.**
`001_initial.sql:177-179` gives every authenticated user INSERT/UPDATE/DELETE on their own
`subscriptions` row, with no constraint on `status`. `isProStatus()` is the entire Pro gate.
So any signed-in user can POST one row to PostgREST with the public anon key and their own
session JWT and hold Pro forever — invisible to Razorpay, Play and Stripe. This is the exact
shape of the 2026-07-31 P0-1 that migration `034` closed on `foods`, on the money table
instead of the catalogue. **The fix is to drop three policies and nothing else**: every write
to `subscriptions` in the entire tree uses the service-role client, and every session-client
access is a read, so those policies grant privileges no code has ever used. `profiles` has
the same shape one notch down (P1) — a user can rewrite their own `created_at` and
`email_verified_at`, which are the free-tier cohort key and the AI-trial unlock.

The second P0 is a wrong-data write. **Tapping a saved combo while viewing a past day files
the meal on today, silently.** `app/log/page.tsx` deliberately renders `FoodLanding` on any
editable day so a missed day can be backfilled, but the "Your combos" block there carries no
`isToday` guard, `logSavedMeal` sends no `date`, and `/api/meals/log` has no `date` in its
schema at all — so the row takes `logged_at DEFAULT now()`. Its sibling `FoodSearch` gates the
identical block correctly, with a comment explaining why. This is the last hole in the hard
rule "every logging surface threads the date it is looking at", and it is the same failure
the camera had before it was fixed.

Everything else clusters into three themes: **stale free-tier numbers in paywall copy** (the
cohort machinery is threaded correctly, but the sentences explaining each gate still say 7
days and 30 weigh-ins when new accounts get 5 and 14); **three timezone leaks** where the
runtime's local zone quietly substitutes for IST, including the Home header the previous P0
was about; and **a recurrence of the swallowed-error class** in the two places the same files
elsewhere fail loudly on purpose.

---

## 1a. Fix status — every finding fixed (2026-09-03 → 2026-09-04)

**2 P0s, 13 P1s, 14 P2s: all closed.** Gates after the changes: **90 files / 1,379 tests** pass
(+107 over the audit's starting 1,272), tsc clean, lint clean, tokens clean, build clean — and the
build no longer dirties the tree. `044` was applied to production by Adarsh on 2026-09-03.

| ID | Status | How |
|---|---|---|
| **P0-1** `subscriptions` self-grantable Pro | **Fixed — applied to production 2026-09-03** | `supabase/migrations/044_subscriptions_rls_lockdown.sql` drops `subs_insert`, `subs_update` and `subs_delete`, keeping `subs_select`. No application code changed, because nothing user-scoped ever wrote that table. `tests/rlsPolicies.test.ts` gains a positive assertion that `subscriptions` has **no** user write policy, and the wrong entry that hid this — which claimed `subscriptions` needed an UPDATE policy "for `app/api/razorpay/cancel`", a route that uses the admin client — was removed. **Not live until you run the migration.** |
| **P1-1** `?start=epoch` defeats the history clamp | **Fixed** | New pure helper `clampHistoryStart` (`lib/dateUtils.ts`) compares **parsed instants**, not strings, and returns `null` for anything that is not a real timestamp. Both `/api/logs` and `/api/exercise/logs` now 400 an unparseable `start` for **every** tier before the clamp, then bound through the helper. Pinned twice — `tests/dateUtils.test.ts` for the function, `tests/routeEntitlements.test.ts` for each of the six literals against the real route — and each defence fails independently under sabotage. |
| **P0-2** saved combo files on today | **Fixed** | `/api/meals/log` now accepts an optional `date` and resolves it through `resolveLoggedAtForRequest` (`lib/backfill.ts`), so the row carries an explicit `logged_at` instead of falling back to `DEFAULT now()` — and the free-tier backfill window is enforced, so accepting a date did not open a new bypass. `FoodLanding` and `useFoodSearch` both send `date`. The streak analytics for the log now describe the day it landed on rather than "now". |

| **P1-4** push budget fails open | **Fixed** | Both `push_sends` reads now destructure `error` and fail **closed** with a new `skipped: 'budget_unreadable'`. The insert stays deliberately swallowed — that exception is about bookkeeping, not about the cap. |
| **P1-5** push-reminders mass mis-send | **Fixed** | The batched `food_logs` / `streak_rescues` reads now 500 the run, matching the two reads above them that already did. |
| **P1-6** recap Gemini untimed | **Fixed** | `AbortSignal.timeout(20_000)`, matching camera and chat. The existing `catch` already falls back to `recapFallbackMessage`, so a timeout costs the AI sentence and nothing else. |
| **P1-7** Play OAuth token mint untimed | **Fixed** | `Promise.race` against a 10 s timer — `google-auth-library`'s `getAccessToken()` accepts no `AbortSignal`. Matches the 10 s already on both `verify.ts` calls. |
| **P1-10** `/api/deficit/weekly` ungated + orphaned | **Fixed** | Route deleted. Re-confirmed zero callers repo-wide first. |
| **P1-11** admin route re-creates `water_logs` | **Fixed** | The `water_logs` DDL, probe and response field are gone; the route is now honest that it applies nothing. Dead `WaterLog` / `MeasurementLog` types removed from `types/index.ts` in the same pass. |
| **P1-3** stale cohort numbers in copy | **Fixed** | `DayDiary` takes `freeHistoryDays`, `WeightClient` takes `freeWeightRows` — both now state the account's **real** number. `/upgrade` metadata and `lib/welcomeCards.ts` made cohort-neutral. New guard in `tests/planFeatures.test.ts` fails on the banned literals, scanning shipped strings with comments stripped. |
| **P1-12** `PRO_FEATURES` wrong both ways | **Fixed** | Dropped "No ads, ever"; added streak rescue, the month deficit and unlimited suggestions. |
| **P1-13** coaching line unreachable on free | **Fixed** | `AddFoodModal` now fires `coachingLine`, taking the day's `targets` as an optional prop from `app/log/page.tsx` via `FoodLanding`/`FoodSearch`. Totals are scoped to `logDate`, not "today", and routed through `dayContextFor`. Surfaces without a profile pass nothing and correctly get no line. |
| **P2-11** protein coach overclaims | **Fixed** | `coachingLine`'s sibling now only says "covers it" when the portion covers ≥70% of the gap; otherwise it names what the portion actually contributes ("a katori of dal gets you 9g of that"). |

Every fix is **sabotage-checked** where the assertion could plausibly be vacuous: reverting the
migration, the client `date`, the server `logged_at`, the clamp helper, the route guard or the copy
each turns a specific test red. Two checks were themselves wrong on the first attempt and were redone
rather than trusted — a CRLF file that made a `\n` patch silently no-op, and a copy guard that fired
on its own explanatory comments.

### The three timezone leaks — P1-8, P1-9, P2-4 (fixed 2026-09-03, with the rule)

Grouped on purpose, because the three fixes were never the point: both leaking constructs *read as
correct*, so a reviewer will keep missing them. The durable half is a lint rule, and it exists now.

| Piece | What |
|---|---|
| **The helper** | **`formatIst(value, options, locale)`** (`lib/dateUtils.ts`) — the one sanctioned way to turn an instant into text. Built on `Intl.DateTimeFormat`, **not** the `Date` methods, so the file needs no exemption from the rule it exists to satisfy: the ban has zero holes to imitate. `locale` stays per-call because it decides field *order* ("Sep 3" vs "3 Sept") — a copy decision, not a timezone one. |
| **The rule** | `.eslintrc.json` `no-restricted-syntax` bans bare `toLocaleDateString` / `toLocaleTimeString`, `new Date(…).toLocaleString`, and `new Intl.DateTimeFormat` — each unless the call names a `timeZone`. `no-restricted-imports` bans **`date-fns`** outright. Number formatting is untouched: `kcal.toLocaleString('en-IN')` is not a date, and a probe confirmed it stays clean. |
| **The reach** | `next lint` covers `app`/`components`/`lib` by default. `hooks/` and `store/` were **never linted** — and `hooks/useChatLog.ts` was one of the leaks. `next.config.js` now sets `eslint.dirs` to include them. |
| **The proof** | The rule was verified by sabotage, not by a green run: a probe file with all four violations plus four legal forms produced exactly four errors in each of `components/`, `hooks/` and `store/`, and `npm run lint` exited 1. |
| **The pin** | `tests/istFormatting.test.ts` (21 cases) pins `formatIst`'s zone behaviour against a 19:30 UTC / 01:00 IST instant, pins `lastIstDateStrs`, pins the rule's presence and the lint dirs, and sweeps the shipped tree for both constructs *and* for the `eslint-disable` comment that would quietly re-open the hole. The sweep was itself sabotaged — reintroducing the `RecentMealCard` leak turned it red and named the file. |

**Seven call sites were leaking, not three.** The rule found four the audit had not:

| Site | Was |
|---|---|
| `components/progress/ProgressClient.tsx` | date-fns local-day grouping + labels (**P1-8**). Now IST throughout: `istDate` delegates to `istDateStr`, the day list comes from the new `lastIstDateStrs`, and the exercise window compares **parsed instants** against `istDaysAgoStart` rather than date-fns intervals. |
| `components/dashboard/DashboardClient.tsx:111` | Home's header in device-local time (**P1-9**). |
| `components/home/RecentMealCard.tsx:15` | recent-meal clock in device-local time (**P2-4**). |
| `components/home/MealGroup.tsx:14` | *the same clock bug on the diary's own list* — the file P2-4 was copied from or to. |
| `components/weight/WeightClient.tsx:127` | a `timestamptz` weigh-in read back in the device's zone: a 00:30 IST entry listed under the previous date. |
| `components/weight/WeightChart.tsx` | date-fns `format` on the same column, for the axis and the tooltip. |
| `hooks/useChatLog.ts:92` | the clock sent to Gemini to infer a meal type. An NRI's 9pm dinner arrived as 06:30 and came back tagged **breakfast** — a wrong *value*, not just a wrong label. |
| `lib/projection.ts:30` | the projected goal date. Fixing it also made `tests/projection.test.ts` deterministic, so its `toMatch(/Dec 2026/)` — an assertion that could not fail for the reason it was written — was tightened to the exact day. |

`date-fns` is now unused in the shipped tree; the dependency is left in `package.json` deliberately
(removing it is lockfile churn with no runtime effect), but the import is a lint error.

### The remaining P2s — all closed 2026-09-04

| ID | How |
|---|---|
| **P2-1** recap padlock over real data | `app/dashboard/page.tsx` now builds the recap row only `if (isPro)`. The card still renders its `ProLock` as the free empty state — but the padlock is no longer the gate, matching `/progress` and `lib/monthlyWrapped.ts`. Pinned in `tests/serverGating.test.ts`, including the ordering (`isPro` must be decided before the recap, or the gate reads `undefined` and passes everything). |
| **P2-2** unordered candidate pool | Two ordered reads: the measured tier in full, `curated` filling only what is left. One query cannot express it — PostgREST has no `ORDER BY CASE` and `source` sorts alphabetically, putting `curated` above `ifct`. Tiers defined by **exclusion** (`NOT IN ('curated','estimate')`), because an allow-list of source names would silently drop any source added later. The swallowed `const { data: foods }` now 500s instead of returning a plausible-looking empty list. |
| **P2-3** `water_target_ml` dead and load-bearing | Removed from all six sites — `/log`'s select, both components, the Zod schema, the payload and the update route's named error-recovery branch. The column remains and nothing writes it, so a `DROP COLUMN` is now safe whenever. |
| **P2-5** duplicate meal inference | `useChatLog`'s private `inferMeal` deleted; it now calls `mealForTime`. The local `Meal` type is re-exported from `lib/meal.ts` rather than redeclared — the structural copy is what made the private rule look like it belonged there. **`mealForTime` also moved to the IST hour**: it read `getHours()`, so the meal came from the device's clock while the day came from IST. `tests/meal.test.ts`'s helper built *local* dates, so both halves moved together and the suite asserted nothing about the clock — it would have passed on an IST laptop and failed on a UTC runner. |
| **P2-6** `/refunds` sells free features | §1 now names the actual Pro gates and states that logging by search is free and never capped. Guarded, since this is what a payment aggregator reads. |
| **P2-7** latent UTC day in the deficit module | `istDateStr()`. Tested behaviourally, plus a narrow source assertion for `new Date().toISOString().slice(` — narrow because `weekStartOf` and `addDayKey` end the same way and are correct: they parse a date key as UTC midnight and format back, which never drifts. |
| **P2-8** stepper ceiling overflows | `floor2q` instead of `round2q` for `max` only. A ceiling that rounds up is not a ceiling. Tested across every integer portion weight 1–500 g (226 of the first 500 overflowed before) and the observed 6 g case. |
| **P2-9** doc rot ×5 | All five corrected. The self-verification grep is the interesting one: it documented "0 writes in `components/`/`hooks/`" and now returns **2**, both `URLSearchParams.delete()`. The invariant never broke — the grep was imprecise — so the fix documents the precise command *and* the two known non-matches, because a stale "0" invites the reader to conclude the rule broke. |
| **P2-10** build dirties `sw.js` | The generated worker files are gitignored and untracked. Carried from the 2026-07-31 audit; the build now leaves the tree clean, which is what makes "run the five gates" a check rather than a diff. |
| **P2-12** "three suggestions a day" | Copy corrected on both surfaces — there is no daily counter, and the number is cohort-keyed anyway. Added to the banned-copy guard. |
| **P2-13** "500+ Indian dishes" | Now 850+, matching the landing page. Added to the banned-copy guard. |
| **P2-14** unbounded body measurements | Shared `HEIGHT_CM` / `WEIGHT_KG` constants across all three schemas that write the column. `display_name` bounded at 80 while there. |

**Two extras the fixes surfaced.** `components/home/MealGroup.tsx` carried the same clock bug as
P2-4 on the diary's own list, and the ESLint rule was extended to ban local `Date` getters
(`getHours`, `getDay`, …) — banning `toLocaleTimeString` while leaving `getHours()` would only have
moved the leak. The /progress month calendar moved to `Date.UTC` arithmetic so that ban has zero
exceptions.

**Everything in this report is now fixed.**

---

## 2. Gate results

Real numbers from the terminal, not from the docs.

| Gate | Result | Note |
|---|---|---|
| `npm test` | ✅ **88 files / 1,272 tests passed** | 43.75 s. Matches `CLAUDE.md`. `TESTING.md` (917) and `docs/refactor-safety-contract.md` (67 files / 917) are both stale. |
| `npx tsc --noEmit` | ✅ clean, exit 0 | Run *after* the build, per the stale-`.next/types` trap. |
| `npm run lint` | ✅ "No ESLint warnings or errors" | |
| `npm run check:tokens` | ✅ `0 violation(s) across 0 file(s)` | Spacing advisory 53 across 20 files, at baseline 53. |
| `npm run build` | ✅ clean | **1 m 59 s**, **519 static pages** (445 of them `/foods/[slug]`). |

**Build warnings — both benign, listed as asked:**

1. `Module not found: ESM packages (@apm-js-collab/tracing-hooks/hook-sync.mjs) need to be
   imported` — inside `node_modules/@sentry/server-utils`, reached via `@sentry/nextjs@^10.66.0`
   from `app/api/camera/analyze/route.ts`. Third-party, not actionable in this repo; it is
   noise on every build.
2. `Using edge runtime on a page currently disables static generation for that page` —
   applies only to `app/opengraph-image.tsx:8`, which declares `runtime = 'edge'` because OG
   image generation requires it. Correct as-is.

**Known carry-over:** `npm run build` still dirties the committed `public/sw.js` (2026-07-31
P2-9, unfixed). Restored by hand at the end of this audit.

---

## 3. Findings

Severity: **P0** blocks launch (broken, data-loss, security, money, or a false public claim) ·
**P1** damages trust, retention or conversion · **P2** polish.

Every finding below was **verified by me against the source**, not taken on a reviewer's word.
Several reviewer claims were killed in that step and appear in §9 instead.

| ID | Sev | Finding | Repro | Evidence | file:line | Conf |
|---|---|---|---|---|---|---|
| **P0-1** | **P0** | **Any authenticated user can grant themselves Pro, permanently and for free.** `subscriptions` carries user-scoped INSERT/UPDATE/DELETE policies with no constraint on `status`, and `isProStatus(subscriptions.status)` is the entire Pro gate. Unlocks unlimited AI camera+chat, full history, custom foods, streak rescue, unlimited suggestions, the month deficit and Wrapped. Nothing checks `current_period_end`, so it never expires. Same class as the 2026-07-31 P0-1 on `foods`, on the billing table. | Sign in normally, then `POST https://<ref>.supabase.co/rest/v1/subscriptions` with the **public** `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in the JS bundle) + your own session JWT, body `{"user_id":"<own uid>","status":"active"}`. `WITH CHECK (auth.uid() = user_id)` passes. **Not executed — writing to prod is forbidden by this audit's rules.** | Policy text quoted below. **Verified case-insensitively that only `001_initial.sql` ever touches these policies** — no later migration revisits them. **Verified that nothing needs them:** every write to `subscriptions` in the tree uses `createAdminClient()` (`razorpay/verify:47`, `razorpay/cancel:41`, `razorpay/webhook:55`, `play/verify:66`, `play/rtdn:70`, `stripe/webhook:48,74,91`); every session-client access is a `.select()`. Found independently by two reviewers. | `supabase/migrations/001_initial.sql:177-179`; gate `lib/subscription.ts:9-11` | **high** |
| **P0-2** | **P0** | **Logging a saved combo on a past day silently files it on today.** `FoodLanding`'s "Your combos" block has no `isToday` guard, `logSavedMeal` sends no `date`, and `/api/meals/log`'s Zod schema accepts only `{meal_id, meal_type}` — the insert sets no `logged_at`, so the row takes `DEFAULT now()`. Violates the hard rule "Every logging surface threads the date it is looking at"; the same bug the camera had. | Open `/log?date=<2 days ago>`. `app/log/page.tsx:206` renders `FoodLanding` because the day is editable ("so a missed day can be backfilled"), passing `isToday={false}`. Tap a saved combo. Toast confirms; the viewed day's total does not move; **today's** total silently gains the calories. | The sibling surface gates the identical block correctly: `FoodSearch.tsx:129` reads `{isToday && !isSearching && savedMeals.length > 0 && (` with the comment *"logging targets today, so hide on past-day views"*. Sibling payloads at `FoodLanding.tsx:196,244` both send `date: logDate`; the combo one does not. `tests/coachingWiring.test.ts` pins only `useChatLog` and `useCameraScan` — the saved-meal path is not covered. | `components/log/FoodLanding.tsx:363` (missing guard), `:126-129` (payload); `app/api/meals/log/route.ts:9-12,43-57`; `app/log/page.tsx:206,214` | **high** |
| **P1-1** | P1 | **`?start=epoch` defeats the free-tier history window through the app's own API.** `start` is read raw from the query string with no validation, then clamped by a **lexicographic string** comparison against an ISO cutoff. `'epoch' > '2026-…'` so it survives, and Postgres parses `epoch` as 1970-01-01. A free account gets its complete history. Same line in both routes. | `curl -H "Cookie: <free session>" 'https://www.getinshape.co.in/api/logs?start=epoch'` | **OBSERVED** (the comparison): of `epoch`/`today`/`now`/`yesterday`/`infinity`/`allballs`, **all six survive** the clamp; only strings sorting below `'2'` clamp. The route's own comment says *"ISO-8601 UTC strings compare correctly as strings"* — true, but nothing enforces that `start` **is** an ISO string. `tests/routeEntitlements.test.ts` pins only a crafted *ISO* start. | `app/api/logs/route.ts:21,36`; `app/api/exercise/logs/route.ts:16,26` | **high** |
| **P1-2** | P1 | **`profiles` UPDATE is row-scoped but not column-scoped, so two entitlement inputs are client-forgeable.** `created_at` selects the free-tier cohort; `email_verified_at` is the AI-trial unlock that `lib/aiTrial.ts` says exists because "without this the trial is farmable to infinity". | `PATCH /rest/v1/profiles?id=eq.<own uid>` with the anon key + own JWT: `{"created_at":"2020-01-01T00:00:00Z"}` → `limitsForSignupDate` returns `LEGACY_LIMITS`; `{"email_verified_at":"2026-01-01T00:00:00Z"}` → `checkAiTrial` stops returning `block:'unverified'`. | **Bounded, and I verified the bound:** the *count* half is safe — `camera_photo_logs` and `chat_logs` have SELECT+INSERT policies and **no DELETE**, so the 3-call lifetime pool genuinely cannot be reset. Only the verification gate and the cohort are soft. | policy `supabase/migrations/001_initial.sql:138`; `lib/aiTrialServer.ts:53-62`; `lib/freeTier.ts:80-85` | **high** |
| **P1-3** | P1 | **Paywall copy hardcodes the legacy free-tier numbers, which are wrong for every account created since 2026-08-31.** The cohort machinery is threaded correctly end to end; only the sentences explaining each gate are stale. A post-cutoff user is served 5 days and told 7, served 14 weigh-ins and told 30 — at the exact moment they hit the gate. | Sign up after the cutoff, open a day 6 back on `/progress`: the lock card fires (correctly, at 5) and reads "Free shows the last 7 days in full." Hit the weight cap: 14 rows served, caption says 30. | `app/progress/page.tsx:161` resolves `limitsForSignupDate(profile.created_at)`, passes `freeHistoryDays` (`:250`) → `ProgressClient.tsx:106` computes the cutoff → `:424` gates `DayDiary` — all correct; `DayDiary` never receives the number. The cohort commit `65c0ad8` ("cohort-neutral copy") **touched neither file**, and its own message says "P-A now names the cap in the UI so it sells" while the named cap still reads 30. `/upgrade/page.tsx:21` was done correctly ("Free shows your recent diary"). | `components/progress/DayDiary.tsx:109`; `components/weight/WeightClient.tsx:96`; `app/upgrade/layout.tsx:8`; `components/studio/StudioClient.tsx:149,397`; `lib/welcomeCards.ts:58` | **high** |
| **P1-4** | P1 | **The one-push-per-day budget fails OPEN.** Both `push_sends` reads destructure `data` only. On a read error `sentToday` is `[]` (cap lifted) and `consecutiveIgnored` is 0 (back-off cleared) — so a DB blip pushes every subscribed user regardless of a send already made that day, including users at 5+ ignored. Violates the hard rule "the one-push-per-day budget only works if nothing bypasses it". | Force a `push_sends` read error during the 20:30 IST catch-all. | The file's own comment sanctions swallowing only the **insert** (`:64-70`), not the reads. `tests/pushSend.test.ts` covers `push_subscriptions` errors and the `push_sends` **insert** error, but never a `push_sends` **select** error. | `lib/push/budgetedSend.ts:36-44` | **high** |
| **P1-5** | P1 | **The push-reminders cron's batched reads swallow their errors — a mass mis-send.** A failed `food_logs` read leaves `loggedTodayIds` empty, so **every** subscribed user is classified "hasn't logged today" and nudged, including people who logged an hour ago. A failed `streak_rescues` read corrupts every streak number in the copy. | Force either read to fail on a cron tick. | Damning in context: the two reads **immediately above** both check `error` and return 500, and `:58-60` carries the comment *"Failing loudly rather than defaulting: … a mass mis-timed send dressed as a no-op."* Twenty lines later the batch drops the error on exactly that read. Not the item §8 of the last audit refuted — that was `push_subscriptions` at `:52`, which still checks. | `app/api/cron/push-reminders/route.ts:82-85` | **high** |
| **P1-6** | P1 | **The weekly-recap Gemini call has no timeout** — the one the 2026-07-31 remediation named alongside camera and chat, which both got theirs. It runs per Pro user inside `processInBatches` (concurrency 8), which only checks its deadline *between* items, so a hung socket bypasses the 50 s budget entirely and Vercel kills the function at 60 s with nothing written. Monthly Wrapped rides in the same run. | Gemini accepts the connection and never responds for one Pro user. | `camera/analyze:165` and `chat/analyze:91` both pass `signal: AbortSignal.timeout(...)`; this `fetch` has no `signal` key at all. | `app/api/cron/weekly-recap/route.ts:267-282` | **high** |
| **P1-7** | P1 | **The Play OAuth token mint has no timeout**, so every Play path still blocks on it. `lib/play/verify.ts` got its two timeouts; the token fetch they both call first did not — and it was named in the original P1-5 evidence. | Google's OAuth endpoint stalls. TWA user taps Buy → `PaymentRequest` succeeds → `/api/play/verify` hangs → function killed → "Verification failed". Money taken, Pro not granted. | `const { token } = await client.getAccessToken()` — no `AbortSignal`, no `Promise.race`. | `lib/play/google-auth.ts:48` | **high** |
| **P1-8** | P1 | **The Trends chart groups logs by the runtime's LOCAL day, while the same file's calendar uses IST.** Two definitions of a day on one screen. On Vercel's SSR pass (UTC) and permanently on any device not set to IST, a log made between 00:00 and 05:30 IST is drawn on the previous day, and this feeds `completeDays`, the macro averages and `daysLoggedCount`. Tapping a bar opens `DayDiary` on the **IST** day of that key, so bar and drawer disagree. | A log at `2026-09-02T19:00:00Z` (00:30 IST, 3 Sep) keys to `2026-09-03` under `TZ=Asia/Kolkata` but `2026-09-02` under `TZ=UTC`. | `format(startOfDay(parseISO(log.logged_at)), 'yyyy-MM-dd')` is local midnight — exactly the construct `lib/dateUtils.ts:61` warns against. The correct helper is defined **in the same file** at `:56` (`toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'})`) and used by the month calendar. | `components/progress/ProgressClient.tsx:124` (and `:119,135,137,531`) vs `:56` | **high** |
| **P1-9** | P1 | **The Home header renders the day in device-local time, not IST** — a direct hit on "the diary's day boundary is IST, everywhere, **including the header**", the rule the previous P0 created. Between 00:00 and 05:30 IST the header shows yesterday while the totals underneath are today's. | `new Date().toLocaleDateString('en-US', {...})` with **no `timeZone`**. On an IST device hydration corrects it; off IST it never does. | The correct pattern is two files away — `components/log/ShareDayButton.tsx:38` passes `timeZone: 'Asia/Kolkata'` citing this exact rule. | `components/dashboard/DashboardClient.tsx:111` | **high** |
| **P1-10** | P1 | **`/api/deficit/weekly` is ungated and orphaned.** Zero Pro checks, zero history clamp, and **zero callers anywhere in the repo**. It returns `tdee`, `eat_target`, `actual_weekly_target`, `implied_pace_kg`, `target_weight_kg` and **28 days of per-day calorie totals** to any authenticated user — precisely the payload `/deficit` refuses to build for a locked free account, and 5× the post-cutoff free window. | `curl -H "Cookie: <free session>" .../api/deficit/weekly` | `grep -c "isPro\|isProStatus\|deficitAccess\|subscriptions"` on the route → **0**. Repo-wide grep for `deficit/weekly` → no callers. Contrast `app/deficit/page.tsx:50-73`, which returns the lock card and no numbers. | `app/api/deficit/weekly/route.ts:10-72` | **high** |
| **P1-11** | P1 | **`/api/admin/run-migrations` hands an operator SQL that re-creates `water_logs`** — one of the four tables `019_drop_deprecated_tables.sql` deliberately dropped, and which `CLAUDE.md` makes a hard-rule violation to reference. It probes the table, reports it `MISSING`, and returns the `CREATE TABLE` + RLS policies for a human to paste. | Call the endpoint with a valid `SEED_SECRET`; read the 202 body. | Guarded and fails closed (403 when `SEED_SECRET` is unset), so this is an operator-footgun rather than an exposure — but the documented "apply migrations" path actively instructs undoing migration 019. | `app/api/admin/run-migrations/route.ts:42-56,73,84,93` | **high** |
| **P1-12** | P1 | **`PRO_FEATURES` — the list `/upgrade` and `/pricing` sell from — is wrong in both directions.** It advertises **"No ads, ever"**, which is not a Pro feature because the free tier has no ads either; and it **omits three things Pro genuinely delivers**: streak rescue, the month deficit, and unlimited meal suggestions. So the paywall sells an absence the user already has while hiding three real benefits. | Read `lib/planFeatures.ts:42-50` against what the gates actually enforce. | `PRO_FEATURES` contains `'No ads, ever'` at `:49`. Grep the free tier for any ad code: there is none. Streak rescue (`app/api/streak/rescue/route.ts:35`), month deficit (`app/progress/page.tsx:217`) and suggestions (`app/api/foods/suggest/route.ts:77`) are all enforced Pro and appear nowhere in the list. | `lib/planFeatures.ts:42-50` | **high** |
| **P1-13** | P1 | **The coaching sentence — the app's single best free retention asset — is wired only to the two surfaces a free user can barely reach.** `coachingLine` is a pure function needing no AI, but it is called only from `useCameraScan` and `useChatLog`, both gated behind a 3-call lifetime AI trial that itself requires email verification. **A free user logging by search — the overwhelming majority of all logs — never sees a coaching sentence in their life.** | Log a food by search on a free account. The number moves; nothing speaks. | `grep -rn "coachingLine"` across `app/ components/ hooks/ lib/` returns exactly two call sites: `hooks/useCameraScan.ts:344` and `hooks/useChatLog.ts:203`. The search, quick-add, combo, copy-yesterday and barcode paths all have the meal totals and day context the function needs. | `hooks/useCameraScan.ts:344`; `hooks/useChatLog.ts:203`; `lib/coaching.ts` | **high** |
| **P2-1** | P2 | **The weekly recap is a CSS padlock over real data.** `app/dashboard/page.tsx:169-176` builds `weeklyRecap` unconditionally and passes it to the client at `:197`; the card hides it with `isPro`. This is the shape `CLAUDE.md` forbids for the month deficit ("a free client never receives numbers a padlock is merely covering"). | Read the RSC flight payload on `/dashboard` as a free user. | **Impact is genuinely limited and I checked:** the cron writes free users `recapFallbackMessage`, not the Gemini sentence, so the *AI* half does not leak; the stats are the user's own. A downgraded ex-Pro is the one case where an AI message could sit in the payload. Contrast the two correct implementations: `app/progress/page.tsx:217-219` and `lib/monthlyWrapped.ts:121-132`. | `app/dashboard/page.tsx:169-176,197`; `components/dashboard/WeeklyRecapCard.tsx:33` | **high** |
| **P2-2** | P2 | **The meal-suggestion candidate pool is unordered, and its comment says otherwise.** The comment reads *"Ordered by the measured sources first and capped, because the ranking is in-memory: a tight unordered slice would hand back an arbitrary subset of the catalogue, the same trap the food search hit."* There is **no `.order()` anywhere in the file**. Postgres applies LIMIT before any sort, so `suggestMeals` ranks an arbitrary 400 rows and measured IFCT rows can be absent entirely. | Suggestions change for no reason as `foods` grows or after a `VACUUM`. | `grep -c "\.order(" app/api/foods/suggest/route.ts` → **0**. | `app/api/foods/suggest/route.ts:68-73` | **high** |
| **P2-3** | P2 | **`profiles.water_target_ml` is dead *and* load-bearing** — the worst combination. Nothing renders a water target and `water_logs` is gone, but the column is carried in `/log`'s hot-path select, echoed back by two components, validated in Zod, and has a bespoke error-recovery branch keyed on its own name. Deleting it would 500 the profile update until five sites go first. | Grep for water in `components/` returns only this round-trip. | | `app/log/page.tsx:70`; `app/api/profile/update/route.ts:76,87-90`; `components/settings/SettingsClient.tsx:92,174`; `components/dashboard/AdaptiveTargetCard.tsx:77`; `lib/validations.ts:107` | **high** |
| **P2-4** | P2 | **Home's recent-meal timestamps are local time dressed as IST.** `toLocaleTimeString('en-IN', …)` sets the *locale*, not the timezone. A 00:30 IST meal is labelled "7:00 pm" on the SSR pass. | Same instant as P1-9. | Same class as P1-8/P1-9; no `timeZone` option. | `components/home/RecentMealCard.tsx:15` | **high** |
| **P2-5** | P2 | **`useChatLog`'s meal fallback contradicts `lib/meal.ts` in both directions, and its explaining comment is factually wrong.** A chat-logged meal at 21:30 with no AI-supplied meal lands in **Snack** where every other surface files Dinner — the exact behaviour `lib/meal.ts` says was deliberately removed ("Late night stays dinner rather than flipping back to snack"). Fires only when `data.meal` is absent. | 17:00–18:00 → `lib/meal` says snack, this says dinner. 20:00–23:00 → `lib/meal` says dinner, this says snack. | `lib/meal.ts` exists precisely to kill "the six copies that had drifted apart"; this is a seventh. Its comment claims the only difference is "`<20` here, unlike `mealForTime` (`<21`)" — `mealForTime` has no 21 boundary. | `hooks/useChatLog.ts:40-48` vs `lib/meal.ts:22-38` | **high** |
| **P2-6** | P2 | **`/refunds` §1 sells Pro as unlocking "unlimited food logging"**, which is already free — and "free is never capped on logging" is a hard rule. On the page a payment aggregator reads to understand what is being sold. | Read the page. | `/` and `/pricing` correctly describe Free as "a complete tracker, not a trial". | `app/refunds/page.tsx` §1 | **high** |
| **P2-7** | P2 | **A latent UTC day fallback inside the one deficit module.** `period_start` falls back to `new Date().toISOString().slice(0,10)`; between 00:00 and 05:30 IST that is yesterday. All three current callers pass a start, so it is unreachable today — but it is a live UTC day helper in the module `CLAUDE.md` says has none left. | Latent. | The file imports `istDateStr` at `:34` and uses it elsewhere. | `lib/deficit-calculator.ts:334` | **high** |
| **P2-8** | P2 | **`quantityBounds`' `max` can exceed `MAX_LOG_GRAMS`**, against its own comment ("the stepper physically cannot build a payload the server would reject"). `round2q` can round up: a 6 g portion yields `max = 1666.67` → 10,000.02 g. **226 of the first 500** integer per-unit sizes overflow. Only reachable by logging ~10 kg of one food, so the practical impact is close to nil. | Type the max quantity on such a food → 400 "Grams cannot exceed 10,000" over a field showing a legal-looking number. | Arithmetic **OBSERVED**. | `lib/portion-units.ts:977-981`; `lib/validations.ts:37` | **med** |
| **P2-9** | P2 | **Doc rot, five instances**, all in files `CLAUDE.md` designates as read-before-you-touch. | Read each. | (a) `CLAUDE.md:59` says migration `040_body_focus.sql` "is not in `main`" — **it is** (PR #46, commit `3c7f28d`), and `CLAUDE.md:235` already depends on it. (b) `TESTING.md:14` says 917 tests; real is 1,272. (c) `docs/refactor-safety-contract.md:100` says 67 files / 917 tests. (d) the same file says `015_chat_logs.sql` is unapplied and the limit is "10/day" — both superseded 2026-07-18. (e) its own self-verification grep now returns **2**, not the 0 it documents (both are `URLSearchParams.delete()`, not Supabase writes — see §9). | as listed | **high** |
| **P2-10** | P2 | **`npm run build` still dirties the committed `public/sw.js`** (2026-07-31 P2-9, carried). | Run the build; `git status`. | | `public/sw.js` | **high** |
| **P2-11** | P2 | **The protein coach states arithmetic that is false, to the users furthest from their target.** `bestSuggestion` picks the *nearest* source by absolute distance with **no ceiling** — the largest option is soya chunks at 26 g — and the copy then asserts it "covers it". A 100 g gap renders *"100g of protein to go — about 50g of soya chunks covers it."* That is 26 g. | Log a low-protein day on a high-target profile. | `bestSuggestion` minimises `Math.abs(s.grams - gap)` with no cap (`:37-49`); the template at `:79` is unconditional. This is the free tier's **only** coaching line, so it is also the only one most users ever see. | `lib/proteinCoach.ts:37-49,79` | **high** |
| **P2-12** | P2 | **"Free gives you three suggestions a day" is not what the code does** — the cap is three **per response**, with no daily counter, so dismissing and refreshing yields more. The copy overstates the restriction, i.e. it undersells the free tier. | Refresh the suggestion row repeatedly. | `app/api/foods/suggest/route.ts:77` passes `limit:` into `suggestMeals` — a per-request slice. No `istDay`, no count of suggestions served today, anywhere in the route. | copy at `app/upgrade/page.tsx:40` and `components/log/FoodLanding.tsx:358`; enforcement at `app/api/foods/suggest/route.ts:77` | **high** |
| **P2-14** | P2 | **`height_cm` and the three `*_weight_kg` fields are unbounded above and accept `Infinity`.** `z.number().positive()` with no `.max()` and no finiteness check, in both `onboardingSchema` and `profileUpdateSchema` — and the server *recomputes and stores* the targets from them, so the nonsense is server-generated, not a client display bug. `age` (13–120) and `pace_kg_per_week` (0–2) *are* bounded, and `customFoodSchema` bounds everything properly with a `superRefine` — so this is an oversight, not a policy. | **OBSERVED** via `calculateTDEE`: weight **5000 kg → `daily_calorie_target` 78,421**, protein 8,000 g. Weight `1e9` → target **15,500,000,921**. Height `Infinity` → target **`Infinity`**, carbs `Infinity`. Height 3 cm → target floors to 1,200 (the floor saves it). | Fuzzed every exported schema with 16 hostile values per field. `addFoodSchema` **rejected every one** — the gap is specific to these fields. No prototype pollution in any schema (`__proto__`/`constructor` never survive `safeParse`). `display_name` separately accepts 10,000 characters, HTML and RTL marks — React escapes the HTML, so it is a layout problem, not XSS. | `lib/validations.ts:18-20,81,99-101` | **high** |
| **P2-13** | P2 | **The search empty state still says "Includes 500+ Indian dishes"**, contradicting the landing page's 850+ — and "500+" is the exact string the 2026-07-31 audit made a P0. Not false, but the in-app number and the marketing number disagree, and this is the one the user sees while searching. | Open the Food tab search with no query. | Landing (`app/page.tsx`) says "850+ Indian foods"; this says 500+. | `components/log/FoodSearch.tsx:273` | **high** |

**P0-1, the policy text in full** (`supabase/migrations/001_initial.sql:176-179`):

```sql
CREATE POLICY subs_select ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY subs_insert ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY subs_update ON subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY subs_delete ON subscriptions FOR DELETE USING (auth.uid() = user_id);
```

`subs_select` is correct and must stay. The other three should be dropped. **The lesson of
`034` was never table-specific: a row being yours does not mean every column of it is yours
to assert.**

> **One caveat you must carry on P0-1 and P1-2.** Both are read from the migration files, not
> from the live database — the same limitation `tests/rlsPolicies.test.ts:16-22` names about
> itself. If table-level `GRANT`s to `authenticated` were ever revoked by hand in the
> dashboard, PostgREST would refuse the write before RLS was consulted. **Check this yourself
> before doing anything else:** Supabase → your project → Authentication → Policies → table
> `subscriptions`. If `subs_insert` / `subs_update` / `subs_delete` are present as written
> above, P0-1 is live in production.

---

## 4. Regression check — the 2026-07-31 audit's findings

Its four P0s plus five P1s sampled across the riskiest areas.

| Prev. ID | Finding then | Verdict now | Evidence |
|---|---|---|---|
| **P0-1** | `foods` UPDATE/DELETE open to any authenticated user | ✅ **FIXED and holding.** `034_foods_rls_ownership.sql` present, `owns_custom_food()` intact, all three write policies reference it, and `tests/rlsPolicies.test.ts` fails if they stop. `camera/barcode` is still correctly on the admin client. | `supabase/migrations/034_foods_rls_ownership.sql:64-85` |
| **P0-2** | "500+ Indian foods from IFCT 2017" was false | ✅ **FIXED and verified.** Landing now reads "850+ … with 225 staples measured from IFCT 2017". I re-counted: **225** IFCT seed rows, ~505 curated after filtering, plus ~375 across migrations `018`/`041`/`013`/`016`/`017`. Both numbers are defensible. | `app/page.tsx`, rendered; counts re-derived |
| **P0-3** | Paywall sold Pro "full weight history"; nobody got it | ✅ **FIXED.** `.limit()` is now free-only and cohort-keyed in **both** read paths; Pro is uncapped. | `app/api/weight/logs/route.ts:36`; `app/weight/page.tsx:34` |
| **P0-4** | Estimated `curated` rows outranked measured IFCT on `rice`/`dal`/`chai` | ✅ **FIXED and now pinned.** `tests/foodSynonyms.test.ts` has an explicit regression test — *"ranks the measured row above the estimate for plain one-word queries"* — covering `rice`, `dal`, `daal`, `chai`. Green. | `tests/foodSynonyms.test.ts` |
| **P1-0** | `/upgrade` never checked subscription status | ✅ **FIXED.** Reads the entitlement at `:135` and renders "You're already on Pro" at `:170,183`. | `app/upgrade/page.tsx` |
| **P1-3** | `sendPushToUser` treated a DB error as "no devices" | ✅ **FIXED and holding.** Destructures `error` and throws; pinned by `tests/pushSend.test.ts`. | `lib/push/send.ts:40-45` |
| **P1-4** | Swallowed Supabase errors in cron/RTDN | ⚠️ **Holds where fixed; recurred in newer code.** The four weekly-recap reads and both RTDN writes still check. But **P1-4 and P1-5 above** are the same class in code added since. | see P1-4, P1-5 |
| **P1-5** | No timeout on any Gemini or Play call | ⚠️ **PARTIAL.** Camera ✅, chat ✅, both `lib/play/verify.ts` calls ✅. **The recap Gemini call and the Play OAuth token mint — both named in the original evidence — are still untimed.** | see P1-6, P1-7 |
| **P1-13** | Razorpay webhook did not 500 on a failed write | ✅ **FIXED and holding.** All three writes go through `applyStatus()`, which raises; the catch returns 500 so Razorpay retries. | `app/api/razorpay/webhook/route.ts:52-64` |

**Nothing that was fixed has regressed.** The two partials (P1-4, P1-5) are not regressions —
they are the same bug class appearing in code written after the fix, which is the more useful
signal: this codebase's characteristic defect is the swallowed `{ data }` destructure and the
missing `AbortSignal`, and both keep reappearing because nothing mechanical stops them.

---

## 5. Coverage gaps

**The suite is honest.** Six sabotage mutations, six failures — this is not a decorative
suite:

| Mutation | File | Result |
|---|---|---|
| `istDaysAgoStart` off-by-one (`d - (days-1)` → `d - days`) | `lib/dateUtils.ts` | 🔴 caught |
| TDEE 1,200 kcal floor → 1,000 | `lib/tdee.ts` | 🔴 caught |
| Streak freeze cap removed | `lib/streak.ts` | 🔴 caught |
| Free-tier cohort inverted | `lib/freeTier.ts` | 🔴 caught |
| Deficit sign flipped | `lib/deficit-calculator.ts` | 🔴 caught |
| `SMART_PORTIONS` precedence reversed | `lib/portion-units.ts` | 🔴 caught |

**`lib/` modules with no test importer — 14, ranked by whether the gap matters:**

| Module | Lines | Does the gap matter? |
|---|---|---|
| `lib/logActivation.ts` | 108 | **Yes.** Runs on *every* log; resolves `paywallThreshold` per cohort and builds the streak-event input. Untested. |
| `lib/merchant.ts` | 72 | **Yes, cheaply.** Single source of the merchant identity a payment aggregator verifies; a drift here is a rejected application. One snapshot test would do. |
| `lib/verifyPromptStore.ts` | 39 | Moderate — gates the email-verification nudge cadence. |
| `lib/chat-prompt.ts` | 38 | Moderate — shapes what Gemini is asked; a regression is silent. |
| `lib/foodVisual.ts`, `lib/indian-portions.ts` | 51, 41 | Low — presentational/lookup. |
| `lib/utils.ts` | 6 | No. |
| `lib/play/google-auth.ts` | 55 | Low as a unit; the real gap is the missing timeout (P1-7). |
| `lib/posthog/client.ts`, `push/client.ts`, `razorpay/client.ts`, `razorpay/plans.ts`, `stripe/client.ts`, `supabase/client.ts` | — | No — thin SDK constructors and config. |

**What remains genuinely untested, ranked by risk — the tests I would write first:**

1. **A test that fails if any logging surface omits its date.** `tests/coachingWiring.test.ts`
   pins `useChatLog` and `useCameraScan` only; extending it to the saved-meal path would have
   caught **P0-2**. This is the single highest-value test in the list.
2. **A `push_sends` *select*-error test** — would have caught **P1-4**.
3. **A lint rule or coupling assertion banning `toLocaleDateString`/`toLocaleTimeString`
   without an explicit `timeZone`, and date-fns `format`/`startOfDay`/`parseISO` in `app/` and
   `components/`.** Would have caught **P1-8, P1-9, P2-4** at once. Both constructs read as
   correct; a human reviewer will keep missing them.
4. **A non-ISO `start` param test** — would have caught **P1-1**.
5. **A test asserting every `fetch` to an external host carries a `signal`.** Would have
   caught **P1-6, P1-7**.
6. **Live-Postgres RLS tests** (`supabase start` + two real users asserting 42501). The
   existing `tests/rlsPolicies.test.ts` is static analysis of the migration files and
   **passes cleanly over P0-1**, because it encodes *ownership* as the invariant and P0-1 is a
   correct ownership predicate that is simply broader than any code needs. This is the only
   test class that would have caught it. Needs Docker/CI, which is why it must not be the only test.
7. **A cohort-copy assertion** — that no user-facing string hardcodes a `FreeTierLimits` value.
   Would have caught **P1-3**.

**Untested by construction:** API route handlers are covered only through extracted pure
functions and static assertions; the service worker (`worker/index.js`) has no tests; nothing
exercises a real browser.

---

## 6. Product review — the four tables

Judged against HealthifyMe, MyFitnessPal, Cal AI, Fitelo and a notebook, for an Indian user at
₹299/mo. **Competitor comparisons are model knowledge, not verified in this session.** No
analytics were available — nothing here is a measured user number.

**What changed since the 2026-07-31 product review.** The last review's #1 recommendation —
the post-scan coaching line — was built, and built better than asked: `lib/coaching.ts`
computes locally with no Gemini round-trip and refuses to state a budget it could not compute.
`lib/plateau.ts` is the best-reasoned module in the app: it checks intake *before* offering a
reassuring explanation, and declines to explain when it cannot tell. Seasons were cut, the
suggestion deck became a row, `/deficit` was demoted behind one card, and `dashboardMoments`
now enforces one attention card. Against that: **meal context tags were expanded rather than
cut**, and the coaching line was wired only to the AI paths — so the app built its best
retention asset and attached it to the one surface almost nobody can use.

### Table 1 — Necessary and working

| Feature | Why it's core | vs. best competitor |
|---|---|---|
| **IFCT-measured catalogue + household portions** (`lib/portion-units.ts`) | The whole reason to exist. Katori/roti defaults and the `SMART_PORTIONS` ordering discipline are what MyFitnessPal structurally cannot do. | **5** — nobody else uses measured IFCT as the primary source. This is the moat. |
| **Search ranking + duplicate collapse** (`lib/mergeSearchResults.ts`) | `collapseDuplicateFoods` electing one row per cluster removed the "three boiled eggs at three kcal" problem — the worst UX in Indian food search. | **4.5** — ahead on home food, behind on packaged breadth. |
| **Repeat-logging speed** (`components/log/shortcuts.tsx`) | Retention lives here. Routine dinner in one tap. | **5** |
| **Plateau card** (`lib/plateau.ts`) | Speaks at the exact week people quit, and refuses to lie about the cause. | **5** — genuinely category-leading; competitors sell you a coach at this moment. |
| **Projected goal date** (`lib/projection.ts`) | The only thing that makes "1,621 kcal" mean something on day 1. | **4** — parity with Cal AI. |
| **Streaks with free freezes** (`lib/streak.ts`) | Never paywalling a freeze is the right and humane call. | **4** |
| **Honest INR pricing + real refund policy** | Cancel from Settings, plain refund terms, no dark patterns. | **5** — the refund page reads like a person wrote it. |

### Table 2 — Necessary but weak

| Feature | What is specifically wrong | What "good" looks like |
|---|---|---|
| **The coaching sentence** | Wired only to the two AI surfaces (**P1-13**). A free user logging by search never sees it. The function needs no AI and costs nothing to run. | Fire it after **every** log, from every surface. It is a pure function of meal + targets + day context, and the search path already holds all three. |
| **Protein coach arithmetic** | Says "covers it" about a third of the gap (**P2-11**). | Cap the claim. Above ~30 g, name multiples or say "you're a long way off". Never assert closure it cannot deliver. |
| **Free-tier disclosure** | 5 days of history and 14 weight rows appear **nowhere public**, while `/pricing` calls Free "a complete tracker, not a trial". The user learns on day 6. | Say it: "Free: your last 5 days". A stated limit converts; a discovered one refunds. |
| **Weight cap is row-based, not day-based** | `.limit(14)` punishes the exact behaviour the app asks for — the Trends card says "weigh in at the same time each morning". Weigh daily and your free trend dies in a fortnight; weigh weekly and it lasts three months. | Cap by *days* (last 60), or downsample. Never build a limit that penalises adherence. |
| **Onboarding step 1** | Offers exactly two paths — photo and chat — **both of which 403 for every brand-new account**, because AI needs a verified email. There is no search tile. `lib/aiGateRedirect.ts` handles it gracefully, but the user still snaps their dinner and is told to come back later. | Add "Search for it" as the third and default tile. The step's job is a successful first log, not a demo of a locked feature. |
| **Home screen density** | Home can render 13 things. `dashboardMoments` coordinates three of them; the four self-gating asks (install, rate, notifications, verify email) stack freely. | Fold all four into the same priority queue. One ask per day, maximum. |

### Table 3 — Not necessary: cut, hide or merge

| Feature | Maintenance cost it imposes | Recommendation |
|---|---|---|
| **Meal context tags** (`lib/mealContext.ts`, both modals, a Pattern card, a column, a Zod field) | Four pills in the modal a user opens twenty times a week — in an app whose headline claim is "Log in 5 seconds". The insight needs 4 qualifying days *with* context and 4 *without*; an optional field nobody taps will structurally never get there. A tax on every log to power a card that will almost never render. | **CUT.** The last review said cut; it was expanded instead. This is the clearest single way to make the app feel simpler. |
| **`/wrapped`** (a table, two lib modules, a cron branch, a story surface, a share path) | **It has no in-app door.** The only entry is a push notification. Deny notifications — as most Indian Android users do — and the feature does not exist for you. | **Give it a row on Trends, or delete the surface and keep the table.** One line either way. |
| **`/deficit` as a full page** | Correctly demoted already, but "cumulative deficit against maintenance" is the most inside-baseball idea in the product and a first-time tracker will not read it. | **Keep the Trends card; shrink the page to one screen.** |
| **Badge shelf** (`lib/badges.ts`, `BadgeShelf`, the Home whisper) | Lives on a tab the code's own comment says people rarely open, and four of the ten badges *are* the streak. | **Merge into the streak.** Keep `first_kilo`/`five_down` as one-off celebrations; drop the shelf. |
| **Body-type silhouettes** | The one sanctioned image exception, for a shortcut into a control sitting right below it. | **Keep** — shipped, cheap, and the one warm moment in a form. Not worth reversing. |

### Table 4 — Missing

**(a) Table stakes — the user bounces or refunds without it**

| Gap | Effort | Depends on | Tier |
|---|---|---|---|
| Free-tier limits disclosed before signup (5 days / 14 rows on `/` and `/pricing`) | **S** | `lib/planFeatures.ts` | — |
| A search tile on onboarding step 1 so the first log can actually succeed | **S** | nothing | free |
| Protein-coach claim capped so it stops asserting falsehoods | **S** | nothing | free |
| Reconcile "500+" in-app with "850+" on the landing page | **S** | nothing | — |
| Offline logging queue — deliberately absent, but "you'll need an internet connection" is a hard bounce on a Mumbai local or in a basement | **L** | service worker + write queue | free |

**(b) Retention — moves week-4**

| Gap | Effort | Depends on | Tier |
|---|---|---|---|
| **Coaching line on every log, not just AI logs** | **S** | `lib/coaching.ts` (already built) | **free** |
| Weekly "what actually happened" digest **in-app**, not push-only | **S** | `weekly_recaps` (built) | free preview / Pro full |
| Day-based free history window instead of a 14-row weight cap | **S** | `lib/freeTier.ts` | free |
| One ask per day on Home — a priority queue over install/rate/verify/notification | **M** | lifting each card's browser probe out | — |
| A reason to open the app in the *morning*. Every current hook is evening-shaped. | **M** | reminder slots (built) | free |

**(c) Differentiation — nothing in India has this**

| Gap | Effort | Depends on | Tier |
|---|---|---|---|
| **Household-measure-first input** — type "2 roti 1 katori dal" and get three logs, not one search result. The portion data already exists; only the parser is missing. | **M** | `lib/portion-units.ts`, search | **free** — this is the acquisition story |
| Festival / fast modes (Navratri, Ekadashi, Ramzan) with pre-built food sets | **M** | catalogue | free |
| Family / thali logging — one plate, several eaters, split portions | **L** | food logging | Pro |
| Regional cuisine packs with measured data (Bengali, Malayali, Marathi) | **L** | IFCT extension | free |

*(All four unchanged from the last review; none started. That is fine — the interval was spent on correctness and retention, which was the right trade.)*

---

## 7. The six direct answers

**1. Is Pro worth ₹299/month today?**
A paying user gets, exactly: unlimited AI photo + chat logging; history beyond 5/7 days;
unlimited weight rows; custom foods and recipes; streak rescue (1/month); unlimited meal
suggestions; the month deficit view; the weekly AI recap; Wrapped unlocked.

*For:* ₹299 undercuts every credible competitor, AI logging is the best experience in the app,
and the refund policy is honest. *Against:* it is **one new capability and eight walls coming
down** — `lib/mealSuggest.ts` says as much in its own comment. And the sold list is wrong in
both directions (**P1-12**): it advertises "No ads, ever", which free also has, while hiding
streak rescue, the month deficit and unlimited suggestions.

**Verdict: not yet — but it is one change away.** Today Pro reads as "pay ₹299 to stop being
restricted," which is a tax, not a product. **The cheapest fix:** fire the coaching line on
every log for free, and sell the *weekly pattern* built from those sentences as Pro — "you run
400 kcal over on Fridays; your protein collapses on days you eat out." That converts Pro from
"restrictions lifted" to "a coach that noticed something", needs no new AI spend (the data is
already in `food_logs`), and is what competitors charge thousands for.

**2. Why won't a new user come back?**
- **Day 2 — the first log failed or felt like a demo of something they can't have.** Onboarding
  step 1 offers only photo and chat, both of which 403 for a brand-new account.
- **Day 7 — nothing has told them anything they didn't already know.** Calories, macros, a
  streak, and a projection they saw on day 1. The one card that would say something new never
  fires on their logging path (**P1-13**).
- **Week 4 — the free wall arrives exactly when the data gets interesting.** At day 21+ the
  plateau card can finally speak and the weight trend finally has a shape — which is precisely
  when a daily weigher hits the 14-row cap and the 5-day window. The app spends three weeks
  earning the right to say something useful, then charges for the screen where it would say it.
  Brilliant conversion design or a refund; with no analytics, neither of us can tell which.

**3. The one feature to build next.**
**Fire `coachingLine` after every log, from every surface.** It is already written, already
tested, already honest about what it doesn't know, and costs nothing to run — and it is
currently attached to two surfaces a free user can touch three times in their life. Moving it
is hours of wiring. It is the only change that gives a free user a reason to open the app
tomorrow *and* creates the raw material for the Pro feature that fixes the pricing problem.
Every other candidate starts at zero; this one starts at "the best thing in the app, finally
visible."

**4. What to cut entirely.**
**Meal context tags, the badge shelf, and `/wrapped`'s current form.** All three are things the
app *has* rather than things the app *does*. Cutting them removes roughly 500 lines, one modal
section, one tab section and one route — and no user notices anything except that adding a food
got faster.

**5. Where the app lies to the user.**
Six places, all verified: `/pricing`'s "a complete tracker, not a trial" over an undisclosed
5-day window; "No ads, ever" sold as Pro (**P1-12**); the protein coach's "covers it"
(**P2-11**); "three suggestions a day" with no daily counter (**P2-12**); "500+ Indian dishes"
against the landing page's 850+ (**P2-13**); and `/upgrade`'s "Founder pricing — lock in
₹1,999/year while we're new," which has no locking mechanism behind it. To the app's credit,
the two biggest lies from the last audit — Pro's weight history and the food count — were both
fixed **honestly** rather than reworded.

**6. First run, as a 32-year-old in Pune who has never tracked calories.**
The landing page is genuinely strong — "Dal, roti, biryani, dosa" tells him in three words this
is for him, and the Azamgarh founder story persuades harder than any feature grid. Sign-up is
one step with no inbox trip. **Then step 1 breaks it:** two big tiles, photo and chat. He taps
photo — it's why he came — snaps his dinner, waits, and is told to confirm his email and search
on the next screen instead. He has been handed a chore thirty seconds in, and there was no
third tile that would have worked. Steps 2–4 recover well, and the live TDEE preview
("1,621 kcal… you'll reach 65 kg by ~14 December") is the real wow moment. `/onboarding/plan`
is the best screen in the product, ending on *"Start with one meal. Not the whole day, not
tomorrow."* Then he searches "dal", taps +, it works — and **nothing happens**. No sentence, no
reaction, just a number moving. He quits on day 2 because day 1 ended with a number and no
voice, or in week 3 when the padlocks land on the screens that had just become interesting.

---

## 8. Top 10, ranked — the order I would do these in

| # | Do this | Why now | Effort |
|---|---|---|---|
| **1** | **Check the live `subscriptions` policies in the Supabase dashboard**, then add a migration dropping `subs_insert`/`subs_update`/`subs_delete` (keep `subs_select`). | **P0-1.** Anyone with an account can hold Pro for free, permanently, invisibly to all three billing providers. Nothing in `app/` changes — every write to that table already uses the service-role client. This must not ship to Play without it. | **S** (1 h + verification) |
| **2** | **Add `isToday` to `FoodLanding`'s combos block and thread `date` through `/api/meals/log`** — schema, insert and payload — then extend `tests/coachingWiring.test.ts` to cover the saved-meal path. | **P0-2.** A silent wrong-day write, the last hole in a hard rule, and the test extension stops it coming back a third time. | **S** (2 h) |
| **3** | **Validate `start`** in `/api/logs` and `/api/exercise/logs` as an ISO date before the clamp (parse it, don't string-compare it). | **P1-1.** `?start=epoch` hands a free account its entire history through the app's own API. One-line fix in two files. | **S** (1 h) |
| **4** | **Fix the free-tier copy**: thread the cohort number into `DayDiary` and `WeightClient`, correct `app/upgrade/layout.tsx`, and disclose the real limits on `/` and `/pricing`. Fix `PRO_FEATURES` in the same pass — add streak rescue, month deficit and unlimited suggestions; delete "No ads, ever". | **P1-3 + P1-12.** Everything a Play reviewer and every paying user reads. A stated limit converts; a discovered one one-stars. | **S** (3 h) |
| **5** | **Fire `coachingLine` on every logging surface**, and cap the protein-coach "covers it" claim in the same pass. | **P1-13 + P2-11.** The single highest-value *product* change available, and it is wiring, not building. Fixes day-2 retention and creates the raw material for #10. | **S** (half day) |
| **6** | **Stop the two swallowed reads**: `lib/push/budgetedSend.ts:36` and `app/api/cron/push-reminders/route.ts:82`. Add a `push_sends` select-error test. | **P1-4 + P1-5.** The push budget currently fails open, and a failed read nudges every user who already logged. This is the bug class that has now recurred three audits running. | **S** (2 h) |
| **7** | **Add the two missing timeouts** — the recap Gemini call and `lib/play/google-auth.ts:48` — and a test asserting every external `fetch` carries a `signal`. | **P1-6 + P1-7.** Both were named in the last audit's evidence and missed in its fix. The Play one can take money without granting Pro. | **S** (2 h) |
| **8** | **Kill the three timezone leaks** — `ProgressClient`'s date-fns grouping, the Home header, the recent-meal times — and add a lint rule banning `toLocale*` without an explicit `timeZone` and date-fns day helpers in `app/`/`components/`. | **P1-8, P1-9, P2-4.** The rule matters more than the three fixes: both constructs read as correct, so a human reviewer will keep missing them. | **M** (half day) |
| **9** | **Delete `/api/deficit/weekly`** (ungated, orphaned, zero callers) and **remove the `water_logs` DDL** from `/api/admin/run-migrations`. | **P1-10 + P1-11.** One is a free Pro-data leak with no reason to exist; the other actively instructs an operator to undo migration `019`. Both are deletions. | **S** (1 h) |
| **10** | **Build the Pro weekly pattern** from `food_logs` and sell *that* as Pro's headline. | The only change that makes ₹299 a purchase rather than a tax. Depends on #5 shipping first. No new AI spend. | **M** (2–3 days) |

Fold in as ten-minute jobs alongside any of the above: the doc fixes (**P2-9**), the "500+"
string (**P2-13**), the suggestions-per-day copy (**P2-12**), and `/refunds` §1 (**P2-6**).

**Two things to leave alone:** the plateau card and the story engine's no-auto-advance /
no-image rules. Both are better than anything I would propose to replace them.

---

## 9. False alarms discarded

Recording these because a report that only accumulates findings is a report nobody checked.
Six of my own and my reviewers' leads died here.

| Claimed | Verdict | Why it was wrong |
|---|---|---|
| **The shipped catalogue ships the same dish twice at wildly different energies** — 37 clusters disagreeing by >25%, up to **294%** (`rasam` 30 vs 118 kcal, `kheer` 105 vs 407, `coconut water` 19 vs 64). I found this myself and it looked like a P0. | **False positive — killed by me.** | My probe loaded the **raw** `data/indian-foods.json`. `lib/curated-foods-data.ts:33` filters that file at import, dropping every curated row whose `foodClusterKey` collides with a measured IFCT row (~137 of them). `CURATED_FOODS` — what actually ships and seeds — contains **none** of the 37. `tests/foodDataQuality.test.ts` pins the invariant independently, and I confirmed no product code imports the raw JSON. |
| **Curated estimate rows get public `/foods/[slug]` pages claiming "IFCT 2017 data"** — a false provenance claim on 445 SEO-indexed pages. | **Refuted.** | The route hardcodes `.eq('source', 'ifct')` in **both** `getFood` and `generateStaticParams`, with `dynamicParams = false`, and the file's own comment explains why. Only measured rows get pages; the claim is true on every one. A non-existent slug 404s (**OBSERVED**). |
| **The refactor safety contract's "zero writes in `components/`" invariant has broken** — its own documented grep now returns **2**. | **Refuted as a bug; kept as doc rot.** | Both hits are `URLSearchParams.delete()` — `components/log/FoodLanding.tsx:159` and `components/layout/BottomNav.tsx:56`. Not Supabase writes. The invariant holds; only the doc's re-derivation command is now imprecise, which is P2-9(e). |
| **`chat_logs` has no RLS policies at all**, so any user could read or delete another's AI counter. | **Refuted — my own grep was at fault.** | I grepped case-sensitively for `POLICY`; the file uses lowercase `create policy` with CRLF endings. `015_chat_logs.sql:16-24` enables RLS with SELECT+INSERT and no DELETE. I then re-ran the **P0-1** check case-insensitively for the same reason — it survived. |
| **`season-deadline` push is declared but never sent** (the previous audit's P2-1). | **Resolved, not re-reported.** | It is no longer in `PUSH_KINDS` at all — removed when Seasons was cut. All four remaining kinds have ≥1 `sendBudgetedPush` site. `CLAUDE.md`'s ladder already matches. |
| **The "850+ Indian foods" claim is inflated** — seeds only give 225 + ~505 = 730. | **Refuted.** | Migrations `018` (61), `041` (43), `013` (67), `016` (55) and `017` (149) add ~375 more, before any Open Food Facts row. 850+ is defensible. |
| **`current_period_end` is written by five paths and read by none.** | **Half-refuted; kept only as the real point.** | It *is* read — `hooks/useSubscription.ts:32` maps it to `expiresAt`. But `expiresAt` has no consumer anywhere, and `isProStatus` checks `status` alone, so the substantive claim stands: **expiry is never enforced**, which is what makes P0-1 permanent rather than temporary. Reported that way rather than as "unread column". |
| Story engine: auto-advance / image downloads / ignored reduced-motion. | **Refuted.** | Zero timers in `components/story/`, zero `<img>`/`next/image`/`background-image`/`url(`, and `prefers-reduced-motion` handled at `app/globals.css:262`. All three hard rules hold. |
| **`/api/foods/search` returns `200 []` and `/api/camera/barcode` returns `400` to an unauthenticated caller** — auth appears to run after the work. | **Refuted.** | Both are pre-auth early returns on a *missing or malformed parameter*, exposing no data and spending nothing. With real parameters both return **401** (verified: `?q=rice` → 401, `?code=8901058851298` → 401). `barcode` checks auth at `:14`, before the Open Food Facts fetch at `:28` and the admin upsert at `:81`. No unauthenticated cost or abuse vector. |
| Prototype pollution or injection through the Zod schemas. | **Refuted.** | 16 hostile values × every field of all six body schemas: `__proto__` and `constructor` never survive `safeParse`, no global was polluted, and `addFoodSchema` — the highest-frequency write in the app — rejected **every** hostile value. The one real gap is the missing upper bound (P2-14). |

---

## 10. What I could not test, and what I need from you

I never type passwords, so every authenticated flow is out of reach until you sign in.

| Untested | What I need |
|---|---|
| **P0-1 against the live database** | **Do this first, yourself:** Supabase → Authentication → Policies → `subscriptions`. Confirm whether `subs_insert`/`subs_update`/`subs_delete` exist as written. This decides whether P0-1 is live. |
| **P0-2 end to end** | A session. Open `/log?date=<2 days ago>`, tap a combo, then check which day it landed on. I am confident from source; it deserves one runtime confirmation. |
| Food-search quality matrix (18 queries) | A session — `/api/foods/search` returns 401 unauthenticated (correct). I verified the P0-4 *regression guard* statically instead. |
| Day-boundary behaviour at 23:55 / 00:05 IST, and in `America/New_York` / `Asia/Tokyo` | A session + clock control. This is where P1-8/P1-9 become visible. |
| Streaks, freezes, rescue, milestone overlays, badge shelf | A session on `+qa1` (needs history). |
| Every logging method, edit/delete, totals agreement | A session. |
| Growth surfaces — `/welcome`, `/wrapped`, story keyboard nav, suggestion row | A session. |
| Paywall runtime — Razorpay widget, dismissed-checkout copy, TWA disabled state | A session; the TWA needs a real device. |
| Delete account, subscription management | A throwaway account and your go-ahead. |
| Push end to end, cron partial runs, Monthly Wrapped firing | Ability to invoke the crons with `CRON_SECRET`. |
| Analytics funnel (`TESTING.md` §0) | PostHog access. |
| PWA install, SW update, `/api/foods/search` never cached | A real Android device. |
| Whether Razorpay env vars are set in production | Vercel dashboard — yours. |
| Animation feel, real-device rendering, contrast in the wild | Out of reach of this tooling by nature. |

**What I did verify at runtime, unauthenticated:** every public page returns 200 and every
protected page redirects to `/auth/sign-in?returnTo=…` (26 routes swept); **all 48 API routes
swept with no cookie — every one returns 401 or 405, none leaks a stack trace, a Postgres
string or a constraint name**; `/foods/[slug]` renders correct IFCT data with no console
errors; a non-existent slug 404s; no horizontal overflow at 375 px; dark mode renders
correctly (`#0f0e0c` ground, `#f5f2ec` ink); the merchant pages are consistent and complete.
All six Zod body schemas were fuzzed with 16 hostile values per field.

**Phase 5 (adversarial) is partial and I want to be explicit about which half.** The
input-validation, unauthenticated-surface and abuse-path work is **done** and produced P2-14.
What is **not** done, because it all needs a session: spending the AI trial past its allowance
and confirming the 403; proving the lifetime pool survives sign-out, cleared storage and a
second device; replaying a Razorpay webhook and a Play RTDN; sending a Play token already bound
to another account; logging 200 foods in a day; killing the network mid-log and mid-checkout;
and the screen-reader / keyboard-only pass. Two of my parallel reviewers (the public-claims
sweep and the adversarial pass) were killed mid-run by an API rate limit; I completed both
myself afterwards.

**The dead-code and drift sweep came back clean, and that is worth recording:**

- **Zero dead components.** Every `.tsx` under `components/` has at least one importer. (The
  three the 2026-07-31 audit found were deleted and no new ones have accumulated.)
- **Zero declared-but-never-fired analytics events.** All **55** constants in the frozen
  `lib/posthog/events.ts` catalog have a live emit site — checked by script against both
  `EVENTS.KEY` references and the raw string in either quote style. This is the specific
  failure `CLAUDE.md` calls "worse than absence", and it is genuinely absent. `story_completed`
  and `story_cta_clicked` are emitted from two separate sites (`components/story/StorySurface.tsx:85`
  and `:94`) and are not collapsed.
- **Env vars are accurately documented.** 29 read in code; **zero** documented-but-unread; the
  only two read-but-undocumented are `NEXT_PHASE` and `NEXT_RUNTIME`, which are Next.js
  built-ins rather than app configuration.

Two of my own sweeps here produced obviously wrong answers before I got them right (a shell
loop consuming its own stdin, and a grep that searched for string literals when the codebase
correctly emits via typed constants). I mention it because the corrected result — "everything
is wired" — is the kind of clean answer that deserves to say how it was reached.
