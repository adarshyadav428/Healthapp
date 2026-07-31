# GetInShape — deep-dive audit

**Date:** 2026-07-31 · **Commit:** `6df93fb` · **Auditor:** Claude (QA · security · PM · first-time user)
**Scope:** static review of the whole repo + gates + local dev server (`localhost:3000`) public surfaces.
**Not covered:** authenticated runtime testing (Phase 4 flows), the adversarial pass (Phase 5), and
anything needing a real device or a real payment. See §10 for exactly what that leaves open and why.

> **Evidence convention.** Every finding is marked **OBSERVED** (I saw it happen) or
> **CODE-REVIEWED** (reasoned from source). Nothing here is from vibes. Findings that
> came from parallel review agents were re-derived by me against the source before
> being admitted; two agent P0s were killed this way and are recorded in §9.

---

## 1. Executive summary

**Verdict: not launch-ready.** Four P0s: a live data-destruction hole in the production
database, two false public claims of the exact class that has already bitten this app
once, and — found at runtime — estimated food data outranking measured IFCT data on the
three most common queries in the Indian market. None is deep. The gap is **2–4 days of
focused work**, almost all of it in SQL, copy and one synonym list, plus the runtime
flows this audit still could not reach.

The search finding deserves the top billing it doesn't usually get. `rice`, `dal` and
`chai` each return a 📊 Estimated row above the measured IFCT row, which contradicts a
stated hard constraint and undermines the single thing this app claims as its advantage.
The ranking code is not at fault — the comparator picks the measured row every time when
given the typed word. The synonym groups feed it dish names (`"steamed rice"`,
`"dal fry"`, `"masala chai"`) that happen to be the exact names of curated estimate rows,
and the synonym tier outranks source trust. It is a one-file fix with a real trap in it,
described at §7 item 1b.

The engineering underneath is in good shape and has visibly improved since the
2026-07-16 audit. All five gates are green. The test suite is **605 tests**, and it is
real: six deliberate sabotage mutations of load-bearing pure functions all produced
failures, so the suite is pinning behaviour rather than decorating it. The systemic
"two definitions of a day" bug that produced a shipped wrong-data defect is genuinely
dead — `getUtcDayRange` now has zero call sites in shipped code. Every previous-audit
P0 I re-tested is fixed. The AI-trial counter, which is the descendant of the bug that
silently disabled a paid limit for weeks, correctly **fails closed**.

The problems cluster in two places, and they are different in kind from last time.

**First, the data plane does not enforce what the application plane assumes.** The
`foods` table's RLS policies for UPDATE and DELETE check only that the caller is logged
in. Ownership of a custom food is enforced only in JavaScript, on a session-scoped
client, so PostgREST is an open door. Because four tables cascade-delete from `foods`,
one crafted request from any signed-up account silently destroys every user's diary
entries for that food. This is the same failure mode your own safety rules describe as
having nearly destroyed 87 real entries — except it is reachable by a stranger, not
only by an operator slip. It is a one-migration fix and it should be the next thing
anyone does.

**Second, the marketing copy has drifted ahead of the code again.** The landing page
claims "500+ Indian foods from IFCT 2017" in five places; only 225 entries are IFCT.
The number is only reachable by counting the 645 `curated` rows, which this codebase
itself defines as estimates and deliberately badges as such. Separately, `/upgrade`
sells Pro "full weight history" while both read paths hard-cap at 30 and 60 rows with
no Pro branch. These are Play-listing and refund risks, not nits.

Everything else is P1 polish, doc rot, and three dead components left behind by the
Ember Air rebuild.

---

## 1a. Fix status (updated 2026-07-31, branch `fix/audit-2026-07-31`)

Everything below was fixed in the same session the audit was written. Gates after
the changes: **610 tests / 54 files pass**, tsc clean, lint clean, tokens clean,
build clean at 515 pages.

| ID | Status | How |
|---|---|---|
| P0-1 `foods` RLS | **Fixed — needs applying** | `034_foods_rls_ownership.sql` restricts INSERT/UPDATE/DELETE to a user's own `source='user'` rows via `owns_custom_food()`. `camera/barcode` moved to the admin client first, since it was the one session-client catalogue writer and would otherwise have broken. **Not live until you run the migration — see §7.** |
| P0-2 food-count claims | **Fixed & verified** | All five sites now read "850+ … 225 measured from IFCT 2017"; FAQ explains the estimated long tail and the 📊 badge. Verified in the rendered page: zero `500+` remaining. |
| P0-3 Pro weight history | **Fixed** | The 30-row API cap and 60-row page cap are now free-tier only; Pro is uncapped, which is what `/upgrade` sells. |
| P0-4 estimates outranking IFCT | **Fixed & verified live** | Dish-shaped terms removed from the `chawal`, `dal`, `chai` and `sambar` synonym groups. `rice`, `dal`, `chai` now all lead with the measured IFCT row; `bhutta`, `biryani`, `roti` unchanged. Pinned by a new test. |
| P1-0 `/upgrade` sells to subscribers | **Fixed & verified live** | Reads the entitlement, renders an "already on Pro" state, and renders nothing until the query resolves so the plan buttons can't flash. |
| P1-1 / P1-10 missing UPDATE policies | **Fixed — needs applying** | `035_missing_update_policies.sql` adds UPDATE on `push_subscriptions` (unblocks the re-subscribe upsert) and `saved_meal_items`. |
| P1-2 `/api/export` | **Fixed** | Now ungated and complete — export is data portability, not a Pro feature. The false "with Pro" paywall copy is gone. |
| P1-3 swallowed push error | **Fixed** | `sendPushToUser` throws on a failed subscription read; `cronBatch` already surfaces it as `failed` rather than killing the run. |
| P1-4 swallowed cron/RTDN errors | **Fixed** | The four weekly-recap reads now fail the run loudly; both RTDN writes raise and report to Sentry while still answering 200. |
| P1-5 no AI/Play timeouts | **Fixed** | 20 s on both Gemini calls, 10 s on both Play API calls. |
| P1-6 raw error strings | **Fixed** | New `lib/apiError.ts`: relay a 4xx (written for the user), never a 5xx (written for us). Applied in Settings and the deck; Gemini/provider text now goes to Sentry behind friendly copy. |
| P1-7 README | **Fixed** | Rewritten — it described "CalTrack", a USDA integration and Stripe-only billing. |
| P1-8 `SEED_SECRET` | **Fixed** | Documented in `.env.local.example` and `CLAUDE.md`. |
| P1-9 dead components | **Fixed** | `FoodLogItem`, `CalorieRing`, `DateNav` deleted. |
| P1-11 hero renders `0` | **Fixed & verified live** | `useCountUp` has a safety timeout; hero read 1,650 in a tab where rAF never fires. |
| P2-1 `season-deadline` never sent | **Fixed** | Wired into the existing push-reminders cron (no third cron) at the documented priority, gated to the last 3 days, skipping users who already completed. |
| P2-2 `food_logs.context` never set | **Fixed & verified live** | `/api/logs/add` accepts it and `AddFoodModal` offers optional Where? chips. Confirmed a log persisting `context: "restaurant"` end to end. |
| P2-3 `getUtcDayRange` | **Fixed** | Deleted, with a note recording why it must not come back. |
| P2-4 deck double-submit | **Fixed** | Per-card guard plus `e.repeat` so a held arrow is one decision. |
| P2-5 share-card overflow | **Fixed** | Hero text measures and shrinks to fit the plate. |
| P2-8 Pro history copy | **Fixed** | Landing now matches `/upgrade`. |
| P1-2 (old) / P2-6 docs | **Fixed** | `TESTING.md` and `refactor-safety-contract.md` now describe the real 3-lifetime-call AI trial and the real 610-test count. |
| P2-7 secret in RTDN URL | **Not fixed** | Changing it means reconfiguring the Pub/Sub push endpoint in GCP, which is yours to do. Left documented. |
| P2-9 build dirties `sw.js` | **Not fixed** | Cosmetic; would need a build-output or gitignore decision. |

## 1b. Test-coverage work, and the two bugs it found (2026-07-31, later the same day)

All seven of §5's "tests I would write first" are now written, plus the remaining
High-priority module gap (`lib/usageCounter.ts`). Suite: **606 → 811 tests / 62 files**.
Every new file was sabotage-checked — the mutation is described in each commit — so
these pin behaviour rather than decorate it.

| §5 item | Where | Notes |
|---|---|---|
| 1. RLS policy tests | `lib/rlsPolicies.ts` + `tests/rlsPolicies.test.ts` | Static analysis of the migration set, not a live Postgres — see the limits below. |
| 2. `aiTrialServer` fail-closed | `tests/aiTrialServer.test.ts` | Every read-failure path denies and reports no allowance. |
| 3. Route-handler entitlement tests | `tests/routeEntitlements.test.ts`, `tests/routeAiGate.test.ts` | `/api/logs` clamp, custom-food 402, `/api/export`, streak rescue, camera + chat 403. |
| 4. Webhook signature tests | `tests/webhookSignatures.test.ts` | Real HMAC-SHA256, including a valid signature on a different body. |
| 5. `sendBudgetedPush` tests | `tests/pushSend.test.ts` | Includes the P1-3 DB-error path and the full priority ladder. |
| 6. `sendPushToUser` call-site guard | `tests/pushSend.test.ts` | Fails if anything outside `lib/push` imports it. |
| 7. Middleware redirect tests | `tests/middleware.test.ts` | Fail-open vs fail-closed, `returnTo`, public/protected split. |

**Two live bugs found, both fixed in the same pass.**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| **P1-12** | P1 | **`food_dismissals` upsert could 500 on the second swipe.** The table has select/insert/delete and no UPDATE policy, but `app/api/foods/suggest` upserts on the *user-scoped* client. supabase-js `upsert` without `ignoreDuplicates` compiles to `ON CONFLICT DO UPDATE`, which RLS denies — so re-dismissing a dish answered 500 for what the code's own comment calls a no-op. Same shape as P1-1. | `ignoreDuplicates: true` moves it to `DO NOTHING`, which needs only INSERT. No policy granted: nothing in the row is worth rewriting. |
| **P1-13** | P1 | **The Razorpay webhook did not 500 on a failed write**, despite its own comment and `CLAUDE.md` both saying it did. supabase-js *resolves* with `{ error }` rather than throwing, so awaiting the update inside the `try` was not enough — the `catch` never fired and the route answered 200. Razorpay treats 200 as handled and never retries, so the row keeps its old status: a cancelled subscriber silently keeps Pro, a renewed one looks expired. Money either way. Same class as P1-4, which was fixed in the RTDN route and missed here. | The three writes now go through one `applyStatus()` that raises on `error`, so the documented behaviour is the real one. |

**What the RLS tests still do not prove.** They are static analysis of the migration
SQL. They cannot prove Postgres enforces the policies as written, and they cannot
prove the live database matches these files — a policy hand-edited in the dashboard,
or a migration never applied, is invisible to them. **Migrations 034 and 035 remain
unapplied as of this writing, so a green suite says nothing about production.** The
stronger test needs Docker (`supabase start`, two real users, assert 42501 from B's
JWT against A's rows); no Docker, Supabase CLI or psql is installed on the dev
machine, and it would need a CI service container, which is why it must not be the
only test.

---

## 2. Gate results

All five green. Real numbers from the terminal, not from the docs.

| Gate | Result | Note |
|---|---|---|
| `npm test` | **605 tests / 53 files, all pass** — 5.91s | Docs claim 239 (`TESTING.md:11`) and 299 (`refactor-safety-contract.md:50`); memory said 293. All three understate. |
| `npx tsc --noEmit` | Clean, exit 0 | |
| `npm run lint` | No ESLint warnings or errors | |
| `npm run check:tokens` | `0 violation(s) across 0 file(s)` — PASS | |
| `npm run build` | Clean, **515 static pages** (447 `/foods/[slug]`) | One warning, triaged below |

**Build warning, triaged.** `@sentry/server-utils/.../register.js` pulls an ESM-only
module (`@apm-js-collab/tracing-hooks/hook-sync.mjs`) through a CJS require path.
Import trace: `lib/usageCounter.ts` → `app/api/camera/analyze/route.ts`. It is a vendor
packaging problem, not yours, and does not affect the emitted bundle. **Triage: ignore,
or pin/upgrade `@sentry/nextjs` when convenient.** It is the only warning in the build.

**Bundle sizes** are healthy for the market: shared JS 90 kB, landing 97.4 kB first
load, the heaviest authenticated page is `/settings` at 303 kB. The three story
surfaces (`/welcome`, `/wrapped`, `/onboarding/plan`) are 147–148 B of page code each,
which confirms the JSX-free serializable-card design is doing what CLAUDE.md says.

**Note:** `npm run build` rewrites the committed file `public/sw.js`. Running the gates
therefore dirties the working tree. Minor, but worth knowing before a release checklist
tells someone the tree should be clean.

---

## 3. Findings

Severity-ordered. **P0** blocks launch (broken, data-loss, security, money, or a false
public claim). **P1** damages trust, retention or conversion. **P2** is polish.

| ID | Sev | Finding | Repro | Evidence | Location | Conf. |
|---|---|---|---|---|---|---|
| **P0-1** | P0 | **Any authenticated user can UPDATE or DELETE any row in the shared `foods` catalogue.** RLS policies check only `auth.uid() IS NOT NULL` — no ownership predicate. Ownership is enforced only in JS, on a *session-scoped* client, so PostgREST bypasses it. Four tables cascade from `foods` (`food_logs`, `food_favourites`, `saved_meal_items`, `food_dismissals`), so one DELETE silently wipes **every user's** diary entries for that food, with no error. | `DELETE /rest/v1/foods?id=eq.<any>` with an ordinary anon key + any valid session JWT. *(Not executed — a delete probe against prod is forbidden by the session's safety rules. The migration text is conclusive.)* | Policy text quoted below table; cascades at `001_initial.sql:54`, `004_favourites_saved_meals_measurements.sql:10,32`, `030_food_dismissals.sql:11`. App-layer check is `existing.source_id?.includes(user.id)` on `createServerClient()`, not admin. | `supabase/migrations/001_initial.sql:148-149`; `app/api/foods/custom/route.ts:92,126` | **CODE-REVIEWED**, high |
| **P0-2** | P0 | **"500+ Indian foods from IFCT 2017" is false**, in five places including the founder story and the FAQ. Real counts: **225** IFCT entries, **645** `curated`. "500+" is only reachable by counting curated rows, which `CLAUDE.md:11` defines as *"category-baseline estimates"* — explicitly not measurements, explicitly not IFCT. Play-listing and refund risk. | Read the page; count the data files. | `grep -c "name:" lib/indian-foods-data.ts` → 225. `grep -c '"name"' data/indian-foods.json` → 645, every row `"source": "curated"`. | `app/page.tsx:32,122,150,187,240` | **OBSERVED** (page) + **CODE-REVIEWED** (counts), high |
| **P0-3** | P0 | **Paywall sells Pro "full weight history"; nobody gets it.** Both read paths hard-cap with no Pro branch — the API at 30 rows, the page shell at 60. A daily weigher hits the cap in two months and Pro delivers nothing extra than free. | Log >60 weights; chart truncates identically on both tiers. *(Not runtime-verified — needs an account.)* | `.limit(30)` and `.limit(60)`, no `isPro` anywhere in either file. | claim `app/upgrade/page.tsx:80`; `app/api/weight/logs/route.ts:20`; `app/weight/page.tsx:24` | **CODE-REVIEWED**, high |
| **P0-4** | P0 | **Estimated `curated` rows outrank measured IFCT rows on the most common Indian queries** — `rice`, `dal` and `chai` all return a 📊 Estimated row first. This violates the hard constraint in `CLAUDE.md:11` ("a measured row always wins a name collision"). **Root cause:** the synonym groups contain *full dish names* that are themselves the names of curated rows — `rice` expands to include `"steamed rice"`, `dal` to `"dal fry"`, `chai` to `"masala chai"`. Those rows score an exact **synonym** match, and the synonym tiers rank **above** `SOURCE_RANK`, so source trust never gets to decide. The comparator itself is correct — it picks the IFCT row every time when given the typed word alone. | `GET /api/foods/search?q=rice` → `Steamed Rice [curated]` above `Cooked Rice (Chawal) [ifct]`. Isolated repro below. | **Live API** (see §4a) and reproduced against the pure functions: with `["rice"]` the winner is `Cooked Rice (Chawal) [ifct]`; with the real expansion `["rice","chawal","boiled rice","steamed rice",…]` the winner flips to `Steamed Rice [curated]`. Same for `dal` and `chai`. | `lib/food-synonyms.ts` (the dish-name terms); tier order at `lib/searchRanking.ts:186-190`; sorted at `app/api/foods/search/route.ts:232` | **OBSERVED** + isolated repro, high |
| **P1-0** | P1 | **`/upgrade` never checks subscription status.** No `isProStatus`, no `isPro`, no `subscriptions` read anywhere in the file — it renders the full sales page unconditionally, including to an active Pro subscriber, who can start a second checkout. | Open `/upgrade` on a Pro account → "Upgrade to Pro" + founder-pricing CTA, no "you're already Pro" state. | `grep -n "isProStatus\|subscription\|isPro" app/upgrade/page.tsx` → **no matches**. Confirmed live on an `active` account. | `app/upgrade/page.tsx` | **OBSERVED**, high |
| **P1-11** | P1 | **The calorie hero renders `0` when `requestAnimationFrame` doesn't run.** `useCountUp` starts at 0 and has no non-rAF fallback, so in battery-saver, a background tab, or any rAF-suppressed context the user sees "**0 kcal eaten**" while the same screen says "50 kcal over". This is the previous audit's P2-6, still unfixed — and this time I have direct evidence rather than a suspicion. | Suppress rAF; load `/dashboard`. | In a tab where `requestAnimationFrame` never fired (`rafOk: false`), the hero read `0` after 2.5 s while `/api/logs` returned **1,650 kcal** for the day and the sub-line read "50 kcal over" against a 1,600 goal. | `components/home/CalorieHeroCard.tsx` (`useCountUp`) | **OBSERVED**, high |
| **P1-1** | P1 | **`push_subscriptions` has no UPDATE policy**, but the subscribe route upserts `onConflict: 'endpoint'` on the session client. Re-subscribing an existing endpoint — the normal browser-renewal path — resolves to an UPDATE that no policy permits. Silent push loss for returning users is the worst case, and push is the app's only re-engagement channel. | Subscribe, then subscribe again with the same endpoint. *(Runtime unverified.)* | `020_push_subscriptions.sql:17-24` creates select/insert/delete only. | `supabase/migrations/020_push_subscriptions.sql:17-24`; `app/api/push/subscribe/route.ts:30` | **CODE-REVIEWED**, med-high |
| **P1-2** | P1 | **`/api/export` has no Pro gate and returns 90 days** to a free user, against a documented 7-day free-tier limit that every other read path enforces. Known and listed as an open decision in `refactor-safety-contract.md:63` — but "7 days of history" is a public claim. | `GET /api/export` on a free account. | No `subscriptions` read, no `isProStatus`, no `istDaysAgoStart` clamp anywhere in the file. Contrast `app/api/logs/route.ts:32-36`. | `app/api/export/route.ts:10-34` | **CODE-REVIEWED**, high |
| **P1-3** | P1 | **`sendPushToUser` treats a DB error as "user has no devices."** The `push_subscriptions` read discards `error`; on failure `subs` is null and the function returns `{sent:0}` — indistinguishable from a user with no subscription. This return feeds the budget accounting, so a DB blip looks like a legitimate no-op. Same class as the swallowed count that disabled the chat limit. | Code review. | `const { data: subs } = await admin.from(...)` — no `error` destructured; `if (!subs || subs.length===0) return`. | `lib/push/send.ts:34,39`; consumed at `lib/push/budgetedSend.ts:66` | **CODE-REVIEWED**, high |
| **P1-4** | P1 | **Swallowed Supabase errors in the newest cron code.** The weekly-recap cron destructures `{ data }` only for `profiles`, `weight_logs`, `subscriptions`, `weekly_recaps`. A failed `subscriptions` read makes **every user look non-Pro** — everyone silently gets the fallback message instead of the AI one, with no error and no log. The Play RTDN route discards `error` on both the lookup and the final `.update()`, then returns 200, so Play never retries a failed write and the subscription status goes stale. | Code review. | Listed lines destructure data without error. | `app/api/cron/weekly-recap/route.ts:54-61`; `app/api/play/rtdn/route.ts:43-47,52-55`; `app/api/camera/analyze/route.ts:188` | **CODE-REVIEWED**, high |
| **P1-5** | P1 | **No timeout on any Gemini or Google Play call.** Camera and chat analyze have no `AbortController` and no fallback — a slow Gemini burns the whole Vercel function budget and the user gets nothing. Compare `lib/open-food-facts.ts:93-94`, which has a deliberate 5 s timeout and a comment explaining why. Play API calls are likewise untimed. | Code review. | No `signal`/`AbortController` in the cited files. | `app/api/camera/analyze/route.ts:126`; `app/api/chat/analyze/route.ts`; `lib/play/verify.ts:74,108`; `lib/play/google-auth.ts:48` | **CODE-REVIEWED**, high |
| **P1-6** | P1 | **Internal error strings reach users verbatim** in several paths, which is precisely what `lib/checkoutErrors.ts` exists to prevent (and does prevent, correctly, on the checkout path). Provider and DB text can surface in a toast. | Force a DB error on profile update. *(Runtime unverified.)* | `catch` returns `{ error: (err as Error).message }`; client toasts `body.error`. | `app/api/razorpay/verify/route.ts:64`; `app/api/play/verify/route.ts:83`; `app/api/camera/analyze/route.ts:148,162,230,274`; `components/settings/SettingsClient.tsx:111,125,142`; `components/log/MealSuggestDeck.tsx:63` | **CODE-REVIEWED**, high |
| **P1-7** | P1 | **`README.md` describes a different product.** Names the app "**CalTrack**", documents a "**USDA Food search API**" and a `USDA_API_KEY` setup step, and presents Stripe as the billing provider with no mention of Razorpay or Google Play. `CLAUDE.md:10` makes "no USDA" a hard constraint — the README actively instructs a new contributor to re-add the one integration that is permanently banned. | Read the file. | Line 1: `# CalTrack — Weight Loss & Calorie Tracking MVP`; line 3 names USDA and Stripe. | `README.md:1-3` | **OBSERVED**, high |
| **P1-8** | P1 | **`SEED_SECRET` is undocumented.** It gates the two most dangerous admin routes but appears in neither `.env.local.example` nor `CLAUDE.md`'s required-keys list. A deploy following the docs leaves both endpoints permanently disabled. Fails closed, so not a hole — but it is exactly the kind of drift that produces a 3 a.m. mystery. | `grep -c SEED_SECRET .env.local.example CLAUDE.md` → 0, 0. | | `app/api/admin/run-migrations/route.ts:61`; `app/api/admin/seed-indian-foods/route.ts:12` | **OBSERVED**, high |
| **P1-9** | P1 | **Three dead components** left by the Ember Air rebuild, each a complete typed component with real markup and zero importers: `FoodLogItem`, `CalorieRing`, `DateNav`. Superseded by inline markup, `CalorieHeroCard` and `SwipeDayNav` respectively. Risk is a contributor rewiring stale UI by mistake. | `grep -rl` each name → only its own file. | | `components/dashboard/FoodLogItem.tsx`; `components/home/CalorieRing.tsx`; `components/log/DateNav.tsx` | **OBSERVED**, high |
| **P1-10** | P1 | **`saved_meal_items` has no UPDATE policy.** Nothing updates it today, so this is latent — but the first "edit a combo's quantity" feature will silently no-op under RLS rather than erroring loudly. | Code review. | `004_favourites_saved_meals_measurements.sql:36-48` creates select/insert/delete only. | `supabase/migrations/004_favourites_saved_meals_measurements.sql:36-48` | **CODE-REVIEWED**, med |
| **P2-1** | P2 | **`season-deadline` push is defined but never sent.** It sits second in the documented priority ladder and `CLAUDE.md` describes it as live, but there are zero `sendBudgetedPush(..., 'season-deadline', ...)` call sites. Inert, so harmless — but the doctrine overstates what ships, and Seasons lose their deadline pressure. | `grep -r "season-deadline"` → only the kind definition and tests. | | `lib/pushBudget.ts:22`; `CLAUDE.md:172` | **CODE-REVIEWED**, high |
| **P2-2** | P2 | **`food_logs.context` is write-only-on-edit.** The meal-context column is set by the edit route alone; none of the six creation paths (`add`, `add-bulk`, `quick-add`, camera, chat, `meals/log`) set it. Every log is born `NULL` and needs a manual edit to acquire a tag, so the context insight will stay near-empty in practice. | Code review. | Only `app/api/logs/edit/route.ts:18` sets `context`. | `supabase/migrations/032_meal_context.sql`; the six insert routes | **CODE-REVIEWED**, high |
| **P2-3** | P2 | **`getUtcDayRange` is dead but still exported** — a loaded gun for the next contributor, given it is the function that caused the previous audit's P0-4. Deprecate or delete. | `grep -r getUtcDayRange` → definition, tests, docs only. | | `lib/dateUtils.ts:5-13` | **OBSERVED**, high |
| **P2-4** | P2 | **`MealSuggestDeck` accept/dismiss has no in-flight guard**, and is bound to both buttons and window `ArrowLeft`/`ArrowRight`. A held key or double-tap fires duplicate POSTs for the same card. Every other mutating modal in the codebase uses a `useRef` guard; this one is the outlier. | Hold ArrowRight on the deck. *(Runtime unverified.)* | | `components/log/MealSuggestDeck.tsx:91-97,233-243` | **CODE-REVIEWED**, med |
| **P2-5** | P2 | **Share-card hero text has no width clamp.** Fixed 200px font at a fixed centre on the 1080×1080 canvas, no `measureText`. Three digits fit (≈360px inside a 548px plate); four digits have no margin. Surfaces only after ~2.7 years of unbroken streak. | Code review. | | `lib/shareCard.ts:218-219` | **CODE-REVIEWED**, med |
| **P2-6** | P2 | **`food_dismissals.food_id` cascades from `foods`** — a fourth cascade beyond the three documented ones. Low blast radius on its own (a dismissed dish reappears), but it widens P0-1's damage. | Code review. | | `supabase/migrations/030_food_dismissals.sql:11` | **CODE-REVIEWED**, high |
| **P2-7** | P2 | **Admin and RTDN secrets compared non-constant-time**, and `PLAY_RTDN_SECRET` travels as a **URL query parameter** (`?secret=`), so it can land in access, proxy and CDN logs. Server-to-server only, which limits exposure. | Code review. | | `app/api/play/rtdn/route.ts:20`; `app/api/admin/*/route.ts` | **CODE-REVIEWED**, med |
| **P2-8** | P2 | **Pro history copy undersells.** `app/page.tsx:213` says "Full nutrition history (30+ days)"; the actual Pro entitlement is unlimited. Harmless direction, but inconsistent with `/upgrade`'s "Full history — beyond the last 7 days". | Read both pages. | | `app/page.tsx:213` | **OBSERVED**, high |
| **P2-9** | P2 | **`npm run build` dirties the tree** by rewriting the committed `public/sw.js`. | Run the build; `git status`. | | `public/sw.js` | **OBSERVED**, high |

**P0-1, the policy text in full** (`supabase/migrations/001_initial.sql:146-149`):

```sql
CREATE POLICY foods_select ON foods FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY foods_insert ON foods FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY foods_update ON foods FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY foods_delete ON foods FOR DELETE USING (auth.uid() IS NOT NULL);
```

No later migration revisits these (grepped all 34 files). SELECT and INSERT being open
is defensible — the catalogue is shared and OFF rows are persisted for everyone.
UPDATE and DELETE are not.

---

## 4a. Runtime: the food-search matrix

**OBSERVED** against the live search API on an authenticated Pro session, dev server on
`localhost:3000`. 18 queries. Cold first query 8.4 s (compile); warm queries 0.7–2.4 s.

| Query | Top 3 | Verdict |
|---|---|---|
| `rice` | Steamed Rice **[curated]** · Cooked Rice (Chawal) [ifct] · Raw Rice [ifct] | ❌ **P0-4** — estimate above measured |
| `dal` | Dal Fry **[curated]** · Masoor Dal [ifct] · Chana Dal [ifct] | ❌ **P0-4** |
| `chai` | Masala Chai **[curated]** · Cutting Chai [curated] · Black Tea / Kadha Chai [ifct] | ❌ **P0-4** |
| `milk` | Turmeric milk (haldi doodh) [ifct] · Toned Milk [ifct] · Milk Barfi [ifct] | ⚠️ a dish outranks the plain food — same synonym-tier cause, but both rows measured, so lower impact |
| `roti` | Roti / Chapati (Wheat) **[ifct]** · Phulka Roti [off] · Jowar Roti [ifct] | ✅ |
| `chicken biryani` | Chicken Biryani **[ifct]** · CHICKEN BIRYANI MIX [off] · Kolkata Chicken Biryani [curated] | ✅ |
| `biryani chicken` | **identical to `chicken biryani`** | ✅ word-order fix confirmed |
| `bhutta` | Bhutta (Roasted Corn) **[curated]** · Sweet Corn (Makkai) [ifct] · Baby Corn [ifct] | ✅ the documented "Cornflakes" regression is fixed |
| `anjeer` | Fig [curated] · Figs (Dry) [curated] · protein bar [off] | ✅ the OFF protein bar no longer wins |
| `poha` | Poha / Flattened Rice (raw) **[ifct]** · Poha (curated) · Poha (cooked) [ifct] | ✅ |
| `bhindi` | Bhindi [off] · Bhindi / Okra (Raw) **[ifct]** · Dry bhindi [off] | ⚠️ OFF above IFCT at 35 kcal both — cosmetic |
| `maggi` | Maggi Noodles (cooked) **[ifct]** · 2× OFF | ✅ |
| `amul butter` | Amul Butter [off] 724 · Butter (Amul) [ifct] 720 · Amul Unsalted [ifct] | ✅ |
| `britannia` | britannia [off] · Britannia 50-50 [ifct] · Britannia Whole Wheat [branded] | ✅ |
| `chapathi` | Roti / Chapati (Wheat) **[ifct]** | ✅ previous **P1-6 fixed** |
| `r` (1 char) | Rabri · Rasam · Rasgulla — 20 results | ✅ |
| `` (empty) | 0 results, 168 ms | ✅ |
| `50% off, rice (a)%` | Steamed Rice · Raw Rice · Cooked Rice — no error | ✅ **injection guard holds** — `%`, `,`, `(` sanitized |

**Data-quality checks across all 18 queries:** zero physically-impossible rows (no
>100 g macros/100 g, no 0-kcal-with-macros) — `isPlausibleFood` is doing its job. Zero
`source='estimate'` leakage into shared results; the one estimate row seen on `maggi`
was my own account's prior AI scan, which `route.ts:267-270` appends deliberately and
only for its creator.

**Summary:** 14 of 18 queries return the food the user meant. The search work of the
last month clearly landed — every documented regression (`bhutta`→Cornflakes,
`anjeer`→protein bar, `biryani chicken`→nothing, `chapathi`→nothing) is fixed. The one
serious defect is P0-4, and it is confined to plain one-word queries whose synonym group
contains a dish name.

---

## 4. Regression check — the previous audit's findings

The 2026-07-16 audit's four P0s, plus five P1s sampled across its riskiest areas.

| Prev. ID | Finding then | Verdict now | Evidence |
|---|---|---|---|
| **P0-1** | Web payments dead in prod (missing Razorpay env) | **Cannot verify** — needs Vercel env inspection, out of scope for this session. Code path is intact and `lib/pricing.ts` matches ₹299/₹1,999. | — |
| **P0-2** | 10/day AI-chat limit silently unenforced (`chat_logs` missing, count error swallowed) | **FIXED, and better than asked.** The rule itself changed to 3 lifetime calls; the counter now explicitly checks `error`, reports to Sentry, returns `null`, and every caller treats `null` as deny. **Fails closed.** | `lib/aiTrialServer.ts:23-43,59`; `lib/aiTrial.ts:50` |
| **P0-3** | Paywall sold "AI Weekly Insights" and streak milestones that didn't exist | **FIXED.** Weekly recap is real and genuinely calls Gemini; milestone overlays exist at 3/7/14/21/30/50/100. *(New, different false claims have appeared — P0-2 and P0-3 above.)* | `app/api/cron/weekly-recap/route.ts:235-248`; `lib/badges.ts` |
| **P0-4** | Trends day-diary showed the previous day's meals | **FIXED, at the root.** Not patched locally — the whole UTC day-definition was removed. `getUtcDayRange` has zero call sites in shipped code. | `lib/dateUtils.ts:5`; repo-wide grep |
| **P1-1** | Two competing definitions of "a day" (systemic) | **FIXED.** Every live day computation goes through `getIstDayRange`/`istDateStr`/`istDaysAgoStart`. The UTC helper survives only as dead code (P2-3). | repo-wide grep |
| **P1-13** | `/deficit` and `/recipes` orphaned; `/weight` buried | **FIXED.** All three linked. | `ProgressClient.tsx:310`; `SettingsClient.tsx:394,385` |
| **P1-14** | Protein pinned at 2 g/kg — unrealistic on an Indian diet | **FIXED.** Now 1.6 g/kg, and the FAQ states the basis. | `app/page.tsx` FAQ; `lib/tdee.ts` |
| **P1-19** | "Works offline" overstated on landing + FAQ | **FIXED, honestly.** FAQ now reads *"You'll need an internet connection to log and sync your data."* | **OBSERVED** at `localhost:3000` |
| **P2-4** | CSV export timestamps UTC and unlabelled | **FIXED.** Rendered in IST with "(IST)" column headers and an explanatory comment. | `app/api/export/route.ts:42-47` |
| **P2-11** | RLS doesn't enforce the 7-day rule at the data plane | **Still open**, as accepted. Note this is the *milder sibling* of P0-1 — the same "app plane enforces, data plane doesn't" gap, and P0-1 shows why that gap is worth closing properly. | — |

**Nothing that was fixed has regressed.** The fixes were made at the root rather than
patched at the symptom, which is why the day-boundary class of bug is gone rather than
relocated. That is the single most encouraging signal in this audit.

---

## 5. Coverage gaps

**The suite is real.** Six sabotage mutations of load-bearing pure functions, run in a
throwaway copy of `lib/` + `tests/` + `types/`, all produced failures:

| Mutation | Result |
|---|---|
| `aiTrial.ts` trial cap `remaining <= 0` → `< 0` (lets a 4th call through) | **3 failed** ✅ |
| `dateUtils.ts` IST offset 5.5h → 5h | **6 failed** ✅ |
| `tdee.ts` male BMR constant `+5` → `+6` | **3 failed** ✅ |
| `pushBudget.ts` `MAX_PUSHES_PER_DAY` 1 → 2 | **3 failed** ✅ |
| `searchRanking.ts` `DOMINANT_COVERAGE` 0.5 → 0.9 | **1 failed** ✅ |
| `streak.ts` `MAX_FREEZES_BANKED` 2 → 3 | **1 failed** ✅ |

None stayed green. Two caveats worth acting on: `searchRanking` and `streak` each died
on a **single** assertion, so their margin is thin — a subtler mutation might well slip
through the most-tuned and most-emotionally-important logic in the app.

**`lib/` modules with no test file, ranked by whether the gap matters:**

| Module | Matters? | Why |
|---|---|---|
| `lib/aiTrialServer.ts` | **High** | The DB half of the fail-closed gate. The pure half (`aiTrial.ts`) is well tested; the half that actually talks to Postgres and decides whether an error means "deny" is not. This is the descendant of the bug that cost real money. |
| `lib/push/send.ts`, `lib/push/budgetedSend.ts` | **High** | The "nothing bypasses the budget" invariant is doctrine, and P1-3 lives here. `pushBudget.ts` (pure) is tested; the sender is not. |
| `lib/usageCounter.ts` | **High** | Write path for the trial counter. |
| `lib/seasonServer.ts` | Medium | Server half of Seasons; the pure half is tested. |
| `lib/play/verify.ts`, `google-auth.ts`, `products.ts` | Medium | Money. `playBilling.ts` covers the client feature-detect only. |
| `lib/razorpay/client.ts`, `plans.ts` | Medium | Money, but thin wrappers. |
| `lib/chat-prompt.ts` | Medium | Shapes every chat AI call. |
| `lib/indian-portions.ts`, `foodPageCopy.ts`, `foodVisual.ts`, `logActivation.ts` | Low | Presentation and static data. |
| `lib/supabase/*`, `lib/posthog/*`, `lib/stripe/client.ts`, `lib/utils.ts` | Low | Thin adapters. |
| `lib/indian-foods-data.ts`, `curated-foods-data.ts` | Low | Data, and `curatedFoods.test.ts` already guards the generated catalogue. |

**Completely untested categories:** every API route handler (46 of them), all RLS
policies, middleware redirects, webhook signature verification, and the service worker.
The route handlers matter most: they are where auth, entitlements and validation
actually live, and the refactor-safety contract explicitly leans on them.

**RLS being untested is now a demonstrated cost, not a theoretical one** — P0-1 is a
policy bug that no amount of application-level testing could have caught.

**The tests I would write first, in order:**

1. **RLS policy tests** against a local Supabase, asserting that user B cannot
   UPDATE/DELETE a `foods` row, and cannot read or write any of A's per-user rows.
   This one test class would have caught P0-1.
2. **`aiTrialServer` fail-closed test** — mock a Supabase error on each of the two
   counting queries and assert `checkAiTrial` denies.
3. **Route-handler integration tests** for the entitlement gates: camera, chat, custom
   foods, `/api/logs` 7-day clamp, `/api/export`, streak rescue — each asserting the
   status code a *crafted* request gets, not what the UI does.
4. **Webhook signature tests** — valid, invalid, missing, and replayed, for Razorpay
   and Play RTDN.
5. **`sendBudgetedPush` tests** covering the DB-error path (P1-3) and asserting the
   priority ladder end to end.
6. **A `sendPushToUser` call-site guard** — a test that fails if anything but
   `budgetedSend.ts` imports it.
7. **Middleware redirect tests** — unauthenticated deep links, onboarded users hitting
   `/onboarding`, `returnTo` round-trip.

---

## 6. Product review

Judged against HealthifyMe, Cal AI, MyFitnessPal, Yazio, Fitelo and a notebook, for an
Indian user at ₹299/month. Blunt, as asked. This section is a product judgement built
on the code and the previous audit's competitor work — I could not re-walk competitor
apps in this session, so treat competitor scores as directional.

### Table 1 — Necessary and working

| Feature | Why it's core | vs. best competitor (1–5) |
|---|---|---|
| **IFCT-measured Indian food data with household portions** | The entire reason to exist. Katori/roti portions and Hindi synonyms are what every global app gets wrong. | **5** — nobody else has measured IFCT data as the *primary* source. This is the moat. |
| **Food search ranking** | The heart of the app, and the most carefully reasoned code in it. Plain-form-beats-dish, complete-word-over-prefix, gloss-stripped coverage, OFF dominance cap — every one of those is a real bug someone found and fixed. | **4** — better than MFP for Indian home food, still behind on packaged breadth. |
| **Repeat-logging speed** (log again, copy yesterday, combos, frequent foods) | Retention lives here. Routine dinner in 1–2 taps genuinely beats MFP and HealthifyMe search flows. | **5** |
| **TDEE / macro math** | Hand-verified correct in the previous audit; protein now sane at 1.6 g/kg. | **4** — correct and honest, not differentiated. |
| **Streaks with free freezes** | Freezes never paywalled is the right call and the humane one. | **4** |
| **Honest INR pricing** | ₹299/₹1,999 flat, no dark patterns, cancel from Settings. Cheapest credible option in the market. | **5** — a real, defensible position. |
| **Design system** | One accent, two real themes, token-guarded by CI. Genuinely nice, and cheap to maintain because the guard is automated. | **4** |

### Table 2 — Necessary but weak

| Feature | What's specifically wrong | What "good" looks like |
|---|---|---|
| **AI photo scan** | It's the wow moment and the headline Pro benefit, but it has **no timeout and no fallback** (P1-5). A slow Gemini gives the user a dead screen at the exact moment they're deciding whether the app is magic. | 10 s timeout, a partial-result path, and one coaching sentence appended to the result — the thing HealthifyMe's Snap does that makes it feel like a coach rather than a calculator. |
| **Weight tracking** | Capped at 30/60 rows for everyone while Pro is sold "full weight history" (P0-3). The chart silently truncates. | Remove the cap for Pro, paginate for free, and make the projection line the hero. |
| **Push notifications** | Well-architected (one/day, priority ladder, back-off) but the renewal path may be broken by a missing RLS policy (P1-1), one ladder rung is never fired (P2-1), and a DB error is indistinguishable from "no devices" (P1-3). The best-built retention system in the app is the one I trust least to actually fire. | Fix all three, then instrument delivery so you can *see* sends vs. intended sends. |
| **Meal context tags** | A column that only the edit screen writes (P2-2). Nobody edits a log to tag it, so the data will be ~empty and the insight built on it will be noise. | Set context at creation from a cheap heuristic (time + day-of-week), let the user correct it. Or cut it — see Table 3. |
| **Email verification nudge** | Gates the AI trial, which is the conversion moment — and per its own doc has **never been exercised end to end**. | Walk it once, then instrument it. Until then the trial gate is an untested dependency of the funnel. |
| **Onboarding** | Much improved (4 screens, prefilled, resumable, plan payoff). But the target of <60 s to first log is unmeasured, and the projection moment now exists in `lib/projection.ts` — I could not confirm it is surfaced where it converts. | Measure the real number. Put the projected date on the plan card, the weight page and the paywall. |

### Table 3 — Not necessary: cut, hide or merge

| Feature | Maintenance cost it imposes | Recommendation |
|---|---|---|
| **Seasons** | A migration, three lib modules, a route, badge collection, and a push rung that never fires (P2-1). It's a 30-day competitive frame for an app whose core loop is already a streak. It duplicates the streak's job with more surface. | **Cut or shelve.** This is the clearest example of a growth mechanic that hasn't earned its keep. If kept, it must at minimum fire its deadline push, or it has no mechanism at all. |
| **Meal context tags** | A migration, a lib module, UI, and a column that is structurally almost always NULL (P2-2). | **Cut.** It is a tracker in denial, and CLAUDE.md's own reasoning for dropping the wellness tables applies to it. |
| **Meal suggestion deck** | A migration, a lib module, a route, a component with a double-submit bug (P2-4). Sold as a Pro capability but its "3/day free" isn't backed by a counter. | **Merge** into the Food tab's existing "Log again" surface as a single suggested row. The deck interaction is more app than the job needs. |
| **`/deficit` as a separate page** | A whole page for a number that Trends already shows, historically with *different math* for the same word. | **Merge** into Trends. |
| **Three dead components** (P1-9) | Bundle weight and a rewiring hazard. | **Delete.** |
| **`/studio`** | Cheap and genuinely useful as the token source of truth. | **Keep** — it earns its place as documentation. |

### Table 4 — Missing

**(a) Table stakes — a user bounces or refunds without it**

| Gap | Effort | Depends on | Tier |
|---|---|---|---|
| Pro actually delivering unbounded weight history (P0-3) | **S** | nothing | Pro |
| Honest food-count copy (P0-2) | **S** | nothing | — |
| A timeout + failure state on AI scan (P1-5) | **S** | nothing | both |
| Verified push delivery — the renewal path (P1-1) | **S** | one migration | free |

**(b) Retention — moves week-4**

| Gap | Effort | Depends on | Tier |
|---|---|---|---|
| **Projected-date moment**, surfaced in three places ("you'll hit 75 kg by ~5 Dec") | **S** | `lib/projection.ts` exists | free |
| **Post-scan coaching line** — one Gemini sentence after every scan | **S** | Gemini already in loop | Pro |
| **Meal-time reminder slots** (user picks the hour) rather than one fixed evening nudge | **M** | push budget (built) | free |
| **Plateau response** — the app currently says nothing when the weight stalls, which is the exact week people quit | **M** | weight trend (built) | free |

**(c) Differentiation — nobody in India has this**

| Gap | Effort | Depends on | Tier |
|---|---|---|---|
| **Household-measure-first logging** ("2 roti, 1 katori dal") as the *primary* input, not a portion modifier | **M** | portions data (built) | free |
| **Family/thali logging** — one plate, several people, split portions. Nobody has built for how Indian families actually eat. | **L** | food logging | Pro |
| **Festival & fast modes** (Navratri, Ekadashi, Ramzan) — pre-built food sets and a fasting-aware target | **M** | food catalogue | free |
| **Regional cuisine packs** with measured data (Bengali, Malayali, Marathi) | **L** | IFCT extension | free |

### The six direct answers

**Is Pro worth ₹299/month today?** — **No, not quite.** A paying user gets: unlimited
AI photo and chat logging, history beyond 7 days, custom foods and the recipe builder,
streak rescue, unlimited meal suggestions, and a weekly AI recap. *For it:* the AI
logging is genuinely the best experience in the app, the recap is real and personalised,
and ₹299 undercuts everyone credible. *Against it:* one of the six headline bullets is
false today (full weight history), history-beyond-7-days is a restriction lifted rather
than a feature delivered, and custom foods are table stakes that MFP gives away. Strip
the false one and you are selling **one** feature — AI logging — plus the removal of an
artificial limit. **The cheapest change that makes it a yes:** fix P0-3, then add the
post-scan coaching line. That converts "AI that counts" into "AI that advises", which
is the difference between a utility and a coach, and it is hours of work because Gemini
is already in the request.

**Biggest reason a user doesn't return on day 2?** — Nothing happened on day 1 that
they want to come back *to*. They logged a meal and saw a number. The projection moment
("you'll hit 75 kg by 5 December") is the cheapest possible fix and the data already
exists.

**Day 7?** — The streak is the only hook, and if push doesn't fire (P1-1/P1-3), there
is no hook at all. Everything depends on a notification path I can't currently verify
works.

**Week 4?** — The plateau. Weight loss stalls around week 3–4 for almost everyone, and
this app says nothing when it happens. The user concludes the app isn't working and
stops. A single honest, well-timed "plateaus are normal, here's what's actually
happening" moment would outperform every growth mechanic currently in the codebase.

**The one feature to build next?** — **The post-scan coaching line.** One sentence from
Gemini after every photo and chat log: *"Solid protein — that's ~40% of your day. Light
on fibre; a salad at dinner covers it."* It costs hours, not days. It makes the single
Pro feature that justifies ₹299 feel like the thing users actually want (advice), it
differentiates against Cal AI (which only counts), it attacks HealthifyMe where they're
strongest, and it is the only change that improves the *value* of Pro rather than
merely correcting a claim about it.

**What would I cut to make the app simpler?** — **Seasons, meal context tags, and the
suggestion deck as a separate surface.** All three shipped on 2026-07-29, all three add
a migration and a lib module each, and none of them is load-bearing for the core loop of
*log food → see number → keep streak*. Seasons in particular duplicates the streak's
psychological job with more machinery. Cutting all three removes three migrations' worth
of surface and loses nothing a user would miss.

**Where does the app lie to the user?** — Four places, all evidenced above.
(1) "500+ Indian foods from IFCT 2017" — 225 are (P0-2).
(2) Pro "full weight history" — nobody gets it (P0-3).
(3) The documented push priority ladder claims a `season-deadline` rung that never
fires (P2-1).
(4) The free tier's 7-day history limit is silently 90 days via `/api/export` — a lie
in the user's *favour*, which is still a lie about what the tier is (P1-2).
To the app's credit, the previous audit's two big lies (offline support, AI Weekly
Insights) were both fixed honestly rather than quietly reworded.

**First-run as a 32-year-old in Pune who has never tracked calories.** The landing page
is genuinely good — "Dal, roti, biryani, dosa" tells them instantly this is for them,
and the founder story from Azamgarh is more credible than any feature list. Sign-up is
now one step with no inbox round-trip. The wizard is four screens, everything prefilled,
and it ends by teaching the core action rather than dumping them on a dashboard. **Where
they get confused:** the calorie number arrives without a story — 1,621 means nothing to
someone who has never counted, and nothing tells them what it will *do* for them or by
when. **Where they quit:** day 2, because nothing pulled them back; or week 3, at the
plateau, because the app has no response to the most predictable event in weight loss.
The macro rings will also read as three ways to fail every day until the app explains
that protein is the only one worth chasing.

---

## 7. Top 10, ranked

Ordered to do in sequence. Effort is my estimate for someone who knows this codebase.

| # | Do this | Why now | Effort |
|---|---|---|---|
| **1** | **Add a migration restricting `foods` UPDATE/DELETE to owned custom rows.** Something like `USING (source = 'user' AND source_id LIKE 'user_' \|\| auth.uid() \|\| '%')`. Never rewrite `001`; add `034_foods_rls_ownership.sql`. | P0-1 is a live data-destruction hole reachable by any signed-up account, and it cascades to four tables. Nothing else matters more. | **S** (1–2 h incl. verification) |
| **1b** | **Remove full dish names from the synonym groups** in `lib/food-synonyms.ts` — `"steamed rice"`, `"cooked rice"`, `"boiled rice"`, `"dal fry"`, `"dal soup"`, `"masala chai"`, `"cutting chai"`, `"milk tea"`. Those are dishes, not synonyms of the plain food, and `isPlainForm` exists precisely to demote them. Do **not** simply move `SOURCE_RANK` above the synonym tiers — `CLAUDE.md:96` documents that the tier order is load-bearing in both directions, and that change would reintroduce the "anjeer returns a protein bar" bug. Add a test pinning `rice`/`dal`/`chai` to a measured row. | P0-4. Estimates beating measured data on `rice`, `dal` and `chai` attacks the exact thing the app claims as its moat, on the three most-typed queries in the market. | **S** (1–2 h) |
| **2** | **Fix the food-count copy** in all five places on `app/page.tsx`. "870+ Indian foods, 225 measured from IFCT 2017" is both honest and a *better* claim. | P0-2. Play listing review is the deadline, and this app has failed a claims check before. | **S** (30 min) |
| **3** | **Make Pro's weight history real** — remove `.limit(30)`/`.limit(60)` for Pro in both read paths, or change the bullet. | P0-3. A false claim on a paid tier is refund and policy risk. | **S** (1 h) |
| **4** | **Add the missing UPDATE policy on `push_subscriptions`** (and `saved_meal_items` while you're in there), then re-subscribe a real browser twice to confirm. | P1-1/P1-10. Push is your only re-engagement channel; a silently broken renewal path is invisible until retention is already lost. | **S** (1 h) |
| **5** | **Stop swallowing errors**: destructure and check `error` in `lib/push/send.ts:34`, the four weekly-recap reads, and both RTDN writes. | P1-3/P1-4. This is the exact bug class that cost real money for weeks, and it has recurred in the newest code. | **S** (2 h) |
| **6** | **Add timeouts** to Gemini (camera, chat, recap) and the Play API, with an honest user-facing failure. Copy the pattern already in `lib/open-food-facts.ts:93`. | P1-5. The AI scan is the wow moment and the paid feature; it currently has no failure story. | **S** (2 h) |
| **7** | **Write the RLS test class** from §5 — user B cannot touch A's rows, nor the shared catalogue. | It is the only kind of test that would have caught #1, and the data plane is now a demonstrated blind spot. | **M** (half day) |
| **8** | **Build the post-scan coaching line.** | The single highest-value *product* change available, and the cheapest way to make ₹299 defensible. See §6. | **S** (half day) |
| **9** | **Fix the docs that lie to contributors**: rewrite `README.md` (it still says CalTrack/USDA/Stripe), correct the test counts and stale AI limits in `TESTING.md` and `refactor-safety-contract.md`, add `SEED_SECRET` to `.env.local.example` and `CLAUDE.md`. | P1-7/P1-8. `README.md` actively instructs someone to re-add USDA, which is a hard constraint violation waiting to happen. | **S** (2 h) |
| **10** | **Decide on Seasons, meal context and the suggestion deck** — ship them properly (fire the deadline push, set context at creation) or cut them. | P2-1/P2-2. Right now they are half-built surface area, which is the worst of both worlds. | **M** (a day either way) |

Deleting the three dead components and deprecating `getUtcDayRange` are ten-minute jobs
to fold into any of the above.

---

## 8. False alarms discarded

Recording these because a report that only accumulates findings is a report that hasn't
been checked. All four came from parallel review agents and were killed by me against
the source.

| Claimed | Verdict | Why it was wrong |
|---|---|---|
| **P0: "recipe builder" sold as Pro but ungated** — `/api/meals/saved` has no Pro check while the paywall sells "Custom foods & recipes". | **False positive.** | Two different features were conflated. The paywall bullet maps to `RecipeBuilder`, which saves via `components/recipes/RecipeBuilder.tsx:109` → `/api/foods/custom` → correctly 402-gated at `app/api/foods/custom/route.ts:20-23`. `/api/meals/saved` is the *combos* feature, used by `FoodLanding`/`TodayFoodLog`, and it is **deliberately free** — exactly what the previous audit recommended (its P1-7a). It is never sold as Pro anywhere. |
| **`lib/checkoutErrors.ts` may be dead code**, so Play's raw `RESULT_CANCELED` could still reach a user. | **Refuted.** | It is wired at `hooks/useCheckout.ts:10` (import) and `:175` (`isCheckoutCancellation(message)`). The agent's grep pattern missed the hook. The dismissed-checkout copy fix from commit `babf5d5` is intact. |
| **The "500+ foods" claim is just the documented curated catalogue and shouldn't be reported.** | **Rejected — the finding stands (P0-2).** | The documented decision is that curated rows *exist* and are *badged as estimates*. That licenses shipping them; it does not license calling them "from IFCT 2017" on the landing page. Engaging the stated reason is what the rule asks for, and the stated reason cuts the other way here. |
| **NaN/Infinity in the `/welcome` and `/wrapped` stat cards.** | **Refuted.** | Every division is guarded: `lib/wrappedStats.ts:90` (`daysLogged ? … : 0`), `lib/mealContext.ts:89` (length-guarded), `lib/badges.ts:46` (`goal<=0` guarded), `lib/projection.ts:10` (pace guarded). |
| **Optimistic updates with no rollback** across the log/weight modals. | **Refuted.** | There is no optimistic-update pattern in this codebase. `AddFoodModal`, `EditFoodLogModal`, `TodayFoodLog`, `WeightClient` and `DayDiary` all call `queryClient.setQueryData` **only after** `res.ok`. State is never advanced speculatively, so there is nothing to roll back. |
| **Seasons' 30-day windows are off-by-one in 31-day months.** | **Refuted.** | Seasons are deliberately authored as fixed 30-day runs in code (`lib/seasons.ts`), and `daysRemaining` derives from `startsOn`/`endsOn` directly. Intentional, documented in the file. |
| **`push-reminders` cron swallows its subscription read error** (same class as P1-3). | **Refuted.** | `app/api/cron/push-reminders/route.ts:29-30` does check `subError` and returns 500. Only the *weekly-recap* cron has the swallowing problem. |
| **P0: "0 kcal eaten" on a dashboard showing "50 kcal over".** | **Refuted as an app bug** — but see P1-11. | `requestAnimationFrame` never fired in the audit tab (`rafOk: false`), so `useCountUp` sat at its initial 0. The real total was 1,650 kcal, matching the sub-line exactly. The *app* is right; the *count-up* has no non-rAF fallback, which is the real (smaller) finding. This is the same false positive the previous audit caught, and it caught me too. |
| **P0: free-tier 7-day history bypassed** — `/api/logs` returned 36 distinct days back to 2026-05-07, and `/upgrade` showed an "Upgrade to Pro" CTA suggesting a free account. | **Refuted.** | The account is genuinely Pro: a read-only service-role query returned `{status: "active", provider: "stripe"}`. The `/upgrade` CTA proved nothing because that page never checks subscription status at all (which is P1-0). The clamp at `app/api/logs/route.ts:32-36` is correct **and fails closed** — an errored `subscriptions` read leaves `sub` null, `isProStatus(undefined)` is false, and the cutoff applies. |
| **`source='estimate'` rows leaking into search results** (seen on `maggi`). | **Refuted.** | `app/api/foods/search/route.ts:211` excludes estimates from the shared query with `.neq('source','estimate')`; lines 267-270 then deliberately append **the current user's own** estimate foods. The row I saw was my own prior scan, visible only to me — exactly what `CLAUDE.md:106` specifies. |
| **`compareFoodsForQuery` is broken** (because curated beat IFCT live). | **Refuted — the comparator is correct.** | Given the typed word alone it picks the IFCT row in all four test cases. The defect is in the *inputs*: `lib/food-synonyms.ts` feeds it dish names as synonyms. Reported accurately as P0-4 rather than blamed on the ranking code. |
| **`/studio` and `/delete-account` are orphan pages.** | **Refuted.** | Both are deliberately unlinked — `/studio` per `CLAUDE.md:212`, `/delete-account` because the Play Data-safety form requires a standalone unauthenticated URL (comment in-file). |

---

## 9. What I could not test, and what I need

**Everything requiring an authenticated session.** I have no password for `+qa1` or
`+qa2`, and the session's rules forbid creating an account without asking. That leaves
the whole of Phase 4 and most of Phase 5 unexecuted:

| Untested | What I need |
|---|---|
| ~~Food search quality~~ | **Now done** — see §4a. Ran on an authenticated session; produced P0-4. Still untested: the 📊 badge rendering in the UI (I tested the API payload, not the pixels) and a 200-char query. |
| Day-boundary behaviour at 23:55 / 00:05 IST, and in `America/New_York` / `Asia/Tokyo` | A session + clock control |
| Streaks, freezes, rescue, milestone overlays, badge shelf | A session on `+qa1` (needs history) |
| All logging methods, edit/delete, totals agreement | A session |
| Growth surfaces — `/welcome` cards, `/wrapped`, seasons, suggestion deck, story engine keyboard nav and reduced motion | A session |
| Paywall runtime — Razorpay widget, dismissed-checkout copy, TWA disabled state | A session; TWA needs a real device |
| Delete account, subscription management | A throwaway account and your go-ahead |
| Push end-to-end, cron partial runs, Monthly Wrapped firing | Ability to invoke crons with `CRON_SECRET` |
| Analytics funnel (`TESTING.md` §0) | PostHog access |
| PWA install, SW update, `/api/foods/search` never cached | A real Android device |
| Whether Razorpay env vars are set in production (prev. P0-1) | Vercel dashboard — yours to check |
| Anything visual: animation feel, contrast, real-device rendering | Out of reach of this tooling by nature |

**To unblock the rest, sign in as `+qa2`** (confirmed free — no `subscriptions` row, 0
food logs) in the shared browser pane, and I can run the whole entitlement and
adversarial pass: the 7-day clamp against a genuinely free account, the AI-trial 403s,
the custom-food 402, and the `/api/export` 90-day bypass (P1-2) as an *observed* result
rather than a reasoned one. `+qa1` (Pro, `active`/stripe, 98 logs) covers the
history-dependent flows: streaks, freezes, Trends, day-diary.

**A note on method:** I do not type passwords into login forms, so the sign-in step is
always yours. Everything after it I can drive.

**One thing I recommend you check yourself, today**, because it needs a dashboard I
must not touch: whether the `foods` RLS policies in the live database match
`001_initial.sql`. Supabase → your project → **Authentication** → **Policies** → find
the **`foods`** table → read the `foods_update` and `foods_delete` rows. If their
`USING` expression reads `(auth.uid() IS NOT NULL)`, P0-1 is live in production and item
#1 in §7 is urgent. If someone has already tightened them by hand, it is not.

---

*Report generated 2026-07-31 against commit `6df93fb`. Gates run locally; public pages
observed at `localhost:3000` at 375×812. No production data was written, no payment
attempted, no dashboard touched. The sabotage tests ran in a throwaway copy under
`.sabotage/`, which has been removed.*
