# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview + tech stack

**GetInShape** — a calorie and weight-tracking PWA built for the Indian market, sold as a freemium
subscription (Pro) on the web and as an Android TWA on Google Play. Users log meals by search, photo,
chat, barcode or saved combo; the app tracks calories, macros, weight and a logging streak.

- **Next.js 14.2.0, App Router** — *not* 15. React 18.2, TypeScript **5.4.5** (`strict: true`), path alias `@/*`.
- **npm** — no pnpm, no yarn, no monorepo tooling. Node scripts are `.mjs`/`.ts`.
- **Supabase** — auth + Postgres + RLS, via `@supabase/ssr` 0.12.
- **Tailwind 3.4** + shadcn/ui pattern (Radix primitives, `clsx`/`tailwind-merge`). `next-themes` for light/dark.
- **Zustand** (client auth state) + **TanStack Query** (server state) + **Recharts** + **react-hook-form** + **Zod**.
- **Billing:** Razorpay (web) + Google Play Billing (TWA). Stripe is **legacy, read-only**.
- **AI:** Google Gemini via `@google/generative-ai` — powers photo scan and chat logging.
- **Observability:** Sentry (runtime capture only) + PostHog (product analytics).
- **PWA:** `@ducanh2912/next-pwa` (Workbox) — `worker/index.js` plus the generated `public/sw.js`.
- **Tests:** Vitest 4.1 — **90 files / 1,379 tests**. There is no `vitest.config.ts`; defaults apply.
- **Deploy:** Vercel **Hobby** plan, region `bom1`. The Hobby limits are load-bearing (see Hard rules).

## Architecture / directory map

- **`app/`** — App Router. Protected pages follow one pattern: a **Server Component shell**
  (`app/<route>/page.tsx`) fetches via `createServerClient()`, checks auth/onboarding and passes props
  to a **Client Component** (`components/<domain>/<Name>Client.tsx`) that owns interactivity and
  optimistic updates. Example: `app/dashboard/page.tsx` → `components/dashboard/DashboardClient.tsx`.
- **`app/api/`** — **every database write in the app lives here.** There are zero
  `insert`/`update`/`upsert`/`delete` calls in `components/` or `hooks/`, and that invariant is what
  makes `docs/refactor-safety-contract.md` hold — keep it true. Components may only `fetch()` these
  routes; routes validate with Zod and recompute derived values server-side.
- **`lib/`** — pure domain logic, each module pinned by a matching `tests/*.test.ts`. Routes stay thin
  precisely so the logic stays testable. Key modules: `tdee.ts` (Mifflin-St Jeor → macro targets, plus
  `calculateMaintenance` — the one source of TDEE), `deficit-calculator.ts` (the one definition of
  "deficit"; see Hard rules), `streak.ts`, `dateUtils.ts` (**IST** day windows — the whole app's day
  boundary), `logDates.ts` (the diary's date strings and hrefs — IST, delegating to `dateUtils`),
  `portion-units.ts` (`defaultPortionFor` — the one source of a food's serving amount; see Hard rules),
  `validations.ts` (Zod schemas shared by forms and routes), `nutrition.ts`,
  `mealClipboard.ts` (copy-a-meal-to-another-day; see Hard rules),
  `subscription.ts` (the Pro gate).
- **`lib/supabase/`** — three factories, never interchangeable: `createServerClient()` (cookie-bound,
  acts as the current user), `createAdminClient()` (service-role; trusted server-only routes),
  `getBrowserSupabaseClient()` (Client Components).
- **`lib/razorpay/`, `lib/play/`, `lib/stripe/`** — three providers, **one** `subscriptions` table,
  **one** status vocabulary, so every Pro gate is provider-agnostic. → `docs/billing.md`
- **`lib/posthog/`** — `events.ts` is a **frozen event catalog**; `client.ts`/`server.ts` are the typed
  emitters. **`lib/push/`** — `budgetedSend.ts` is the only sanctioned scheduled-push path.
- **Retention/coaching logic** (all pure, all in `lib/`): `adaptiveTarget.ts`, `coaching.ts`,
  `proteinCoach.ts`, `plateau.ts`, `projection.ts`, `goalProjection.ts`, `weightTrend.ts`,
  `logMilestones.ts`, `badges.ts`, `streakRescue.ts`, `streakRestart.ts` (the comeback card's copy),
  `streakEvents.ts` (what a new log did to the streak, for analytics), `dashboardMoments.ts` (which
  single attention card Home leads with), `mealSuggest.ts`, `shareCard.ts`.
- **`components/`** — `ui/` holds primitives; everything else is domain-scoped (`dashboard/`, `log/`,
  `story/`, `milestones/`, `camera/`, `chat/`, …). **`hooks/`** are fetch/TanStack wrappers only — no writes.
  `components/log/shortcuts.tsx` holds the one set of re-log / combo / copy-yesterday tiles that both
  `FoodLanding` and `FoodSearch` render — they used to be implemented twice, with different ordering
  and different meal-selection behaviour, which is how the same shortcut came to mean two things.
- **`supabase/migrations/`** — `001`–`045`. Numbers are **not unique** (`002`, `004`, `005`, `009` and
  `043` each appear twice) and there is **no `021`**. Always reference a migration by its exact filename.
  (`040_body_focus.sql` **is** on `main` — PR #46 merged; this line previously said otherwise.)
  `011_weekly_calorie_view.sql` is deliberately **unapplied** and referenced nowhere in code. `045` was
  applied 2026-09-04 and verified against the live schema; `044` was applied 2026-09-03. Don't assume
  the rest — **probe** rather than trusting any list, including this one: a `select=<column>` against
  `/rest/v1/<table>` with the public anon key answers `42703` for a column that isn't there and `200`
  for one that is, without reading a single row (RLS returns `[]`). Always probe a column you know
  exists in the same breath, or a 400 for an unrelated reason reads as proof.
- **`middleware.ts`** — self-contained (there is no `lib/supabase/middleware.ts`). Refreshes the
  session cookie on every request, redirects unauthenticated users to `/auth/sign-in?returnTo=…`, and
  bounces authenticated users off `/auth/*` to `/dashboard`. Public routes are `/`, `/privacy`,
  `/terms`, `/delete-account`, `/upgrade`, `/studio`, `/foods/*`, plus `/auth/*`, `/api/*` and
  `/_next/*`. **The onboarding gate is not here** — each protected page's Server Component does its own
  `if (!profile || profile.height_cm === null) redirect('/onboarding')` (8 sites). A new protected page
  must repeat that check; middleware will not do it for you.
- **The repo root is a different project** — a Bubblewrap-generated Android TWA wrapper. All npm
  commands below run from `health-app/`. See the root `CLAUDE.md`.

## Commands

Run everything from `health-app/`.

```bash
npm install              # install deps
npm run dev              # dev server at http://localhost:3000
npm run build            # production build
npm start                # serve the production build

npm test                 # vitest run — the whole suite (90 files / 1,379 tests)
npm run lint             # ESLint (next lint)
npm run format           # Prettier write
npm run check:tokens     # design-token guard: no raw hex, no broken opacity modifiers
npx tsc --noEmit         # typecheck (there is no `typecheck` script)
```

**Running a single test** — there is no `vitest.config.ts`, so Vitest defaults apply and specs are
picked up from `tests/`:

```bash
npx vitest run tests/streak.test.ts              # one file
npx vitest run tests/streak.test.ts -t "freeze"  # one case, by name substring
npx vitest                                       # watch mode
```

**The five gates.** All must pass before any change is "done":

```bash
npm test && npx tsc --noEmit && npm run lint && npm run check:tokens && npm run build
```

**Migrations** are applied by hand in the Supabase SQL editor, or through the `SEED_SECRET`-guarded
`/api/admin/run-migrations` route. There is **no Supabase CLI** in this toolchain, and
`scripts/run-migrations.mjs` is a one-off foods upsert, not a general runner. Apply **all** migrations
in order before running locally.

**Local webhook testing** — Razorpay has no CLI forwarder: tunnel the dev server (`ngrok http 3000`)
and point a Dashboard webhook at it. Legacy Stripe: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

**Environment** — copy `.env.local.example` → `.env.local`; it lists every key. `USDA_API_KEY` is
intentionally absent. `SUPABASE_SERVICE_ROLE_KEY` belongs only in trusted server routes (webhooks,
admin). `SEED_SECRET` and `CRON_SECRET` **fail closed** — unset means `/api/admin/*` and `/api/cron/*`
return 403 and the endpoints are simply unavailable, which is the correct default anywhere that isn't
actively seeding.

## Hard rules — never violate

- **No USDA data, ever.** It was removed permanently; US-centric nutrition data is wrong for Indian food.
- **INR pricing only, never USD.** Pro Monthly ₹299, Pro Annual ₹1,999. The 3-day trial is a Play
  Console offer, so trial copy renders **only** inside the TWA.
- **Never `DELETE` from `foods`.** `food_logs`, `food_favourites`, `saved_meal_items` and
  `food_dismissals` all reference it `ON DELETE CASCADE` — one delete silently wipes that food from
  every user's diary, with no error.
- **Never hand-edit `data/indian-foods.json`.** Fix `scripts/generate-indian-foods-estimate.ts` and
  re-run it; keep `tests/curatedFoods.test.ts` and `tests/foodDataQuality.test.ts` green — between
  them they stop a meat dish shipping with a carb dish's protein, and stop the same dish shipping
  twice under one name at two different calorie counts.
- **Search results collapse to one row per food, never multiple.** `collapseDuplicateFoods`
  (`lib/mergeSearchResults.ts`) groups by `foodClusterKey` and elects the highest-`SOURCE_RANK` member
  of each cluster — this is what stopped "boiled egg" returning three cards at three different kcal
  figures with a source badge asking the user to pick. `foodClusterKey` is deliberately conservative:
  two rows cluster only when every word distinguishing them is a provable translation of a word
  already in the other name (checked against `lib/food-synonyms.ts`'s groups), and a branded row never
  clusters with a brandless one or a different brand. Under-clustering is the safe failure — widening
  it (plurals, dropping true qualifiers like "raw"/"cooked") needs its own evidence
  (`tests/foodDataQuality.test.ts` exists to catch an over-merge before it ships), never a quiet
  refinement. `components/log/FoodResult.tsx` no longer badges a result by source for this reason —
  `👤 Custom` (ownership) is the one label kept; provenance is an arbitration the collapse already
  performs, so surfacing it again re-asks a settled question.
- **`subscriptions` has exactly one RLS policy — `subs_select`. Never give it a user-scoped write
  policy.** `status` is the entire Pro gate (`isProStatus`, ~20 surfaces) and it is an entitlement the
  *business* grants; every write in the tree is a provider webhook on `createAdminClient()`. From
  `001_initial.sql` until `044_subscriptions_rls_lockdown.sql` the table also carried
  `subs_insert`/`subs_update`/`subs_delete` scoped to `auth.uid() = user_id`, which meant any signed-in
  account could POST `{"user_id":"<self>","status":"active"}` straight to PostgREST with the **public**
  anon key and its own JWT and hold Pro forever — free, permanent (nothing reads `current_period_end`)
  and invisible to Razorpay, Play and Stripe alike, because no provider was ever involved. It was found
  by the 2026-09-03 audit, not by a user, and the fix removed privileges **no code had ever used**.
  The generalisation is the important part, and it is the same lesson `034` taught on `foods`:
  **a row being yours does not mean every column of it is yours to assert.** Before adding a write
  policy to any table, ask which *session-scoped* writer needs it; if the answer is "none, the webhook
  uses the admin client", the policy is pure attack surface. `tests/rlsPolicies.test.ts` now pins both
  halves (no write policy, SELECT kept) — and note the same file used to *assert* that `subscriptions`
  needed an UPDATE policy "for `app/api/razorpay/cancel`", a route that uses the admin client. That
  wrong entry passed, and a passing assertion is what hid the hole for two audits.
- **The `source_id` prefix `offi_` vs `off_` records whether Open Food Facts lists a product as sold in
  India, and it is the only surviving signal.** `lib/open-food-facts.ts` writes `offi_` for the India
  endpoint and `off_` for the world one, but `offToExternal` in `app/api/foods/search/route.ts` flattens
  `source` to `'off'` for **both**, so after a row is persisted the prefix is all that is left — which is
  also what makes it answerable for the ~900 rows already cached, with no migration.
  `dropForeignWhenIndianExists` (`lib/mergeSearchResults.ts`) hides `off_` rows whenever any Indian row
  matched, because "boiled egg" was answering with five British and American supermarket own-brands a
  user here cannot buy; `app/api/camera/barcode/route.ts` looks up both prefixes by hand. Renaming or
  "tidying" either prefix silently breaks both. Its two escape hatches are load-bearing: nothing Indian
  matched → return everything (an empty screen is worse than a foreign packet), and the query naming a
  brand → keep that brand. It is **not** a cap and does not replace `capOpenFoodFactsDominance`, which
  answers a different question (how many packaged rows crowd a page) and still must never suppress
  Indian packaged rows.
- **Never write a raw hex color** in `app/` or `components/` — reference a token (`bg-brand`, `text-ink`, …).
- **Never use Tailwind's `/NN` opacity modifier on a token color.** Our tokens are plain `var(--x)`
  strings, so `bg-brand/40` is a **silent no-op** that renders full strength. Use a pre-mixed alpha
  token (`--brand-soft`, `--scrim`, …) or an inline `color-mix()`.
- **Never add a third Vercel cron.** Hobby caps at two, and both are used (`vercel.json`). Monthly
  Wrapped deliberately rides inside the Sunday recap run.
- **Never call `sendPushToUser` for a scheduled push** — always `sendBudgetedPush`. The one-push-per-day
  budget only works if nothing bypasses it — **and that includes a failed read of its own bookkeeping.**
  `sendBudgetedPush` took `data` alone from both `push_sends` reads, so a DB blip produced "nothing sent
  today, nothing ignored": the daily cap lifted and the back-off cleared at the same instant, on every
  user at once. It now fails **closed** (`skipped: 'budget_unreadable'`). The insert is the deliberate
  exception and stays swallowed — losing the bookkeeping costs one extra push, losing the read costs the
  notification permission. The same swallow had also reappeared in `push-reminders`' batched reads,
  twenty lines below a comment refusing exactly that ("a mass mis-timed send dressed as a no-op"), where
  an empty `food_logs` result classifies **every** subscribed user as "hasn't logged today". Both fixed
  2026-09-03 (audit P1-4, P1-5). **The general rule: supabase-js *resolves* with `{ data, error }`, so
  `const { data } = await …` inside a `try` silently discards the failure and the `catch` never fires.
  Destructure `error` on every read whose emptiness means something.**
- **The coaching line is free and belongs on every logging surface.** `coachingLine` (`lib/coaching.ts`)
  is pure, needs no AI call and costs nothing to run — but it was wired only into `useCameraScan` and
  `useChatLog`, both behind the 3-call lifetime AI trial, so a free user logging by search never saw a
  sentence in their life. `AddFoodModal` now fires it too, taking the day's `targets` as an optional
  prop from `app/log/page.tsx` (surfaces without a profile — BottomNav's barcode result, the onboarding
  barcode step — pass nothing and correctly get no line). Any new logging surface should pass `targets`
  and scope `useDailyTotals` to `logDate`; `tests/coachingWiring.test.ts` pins all of them.
- **Never import the server Supabase client into a Client Component**, or the browser client into a
  Server Component / Route Handler. `createAdminClient()` is for trusted server-only routes only.
- **Never reference the four dropped wellness tables** (`water_logs`, `sleep_logs`, `fasting_sessions`,
  `measurements_logs`) — migration `019` removed them. Only `exercise_logs` remains of the extended trackers.
  Two references outlived the drop by two audits, both because nothing *executed* them:
  `/api/admin/run-migrations` probed `water_logs`, reported it `MISSING` (correctly — it is meant to be)
  and handed the operator DDL to **re-create** it, so the documented "apply migrations" path actively
  instructed undoing `019`; and `types/index.ts` still exported `WaterLog` and `MeasurementLog`, which a
  contributor grepping for the shape would reasonably read as evidence the tables exist. Both removed
  2026-09-03 (audit P1-11). Dead code that *describes* a dropped table is the same violation as live code
  that reads one. `profiles.water_target_ml` was the last stub of this kind — no UI rendered it, yet it
  was carried in `/log`'s select, echoed back by two components, validated in Zod and given its own
  named branch in `/api/profile/update`'s error recovery, so it was dead *and* load-bearing: dropping
  the column would have 500'd every profile update. All six sites removed 2026-09-04 (audit P2-3), and
  **`045_drop_water_target_ml.sql` then dropped the column — applied to production 2026-09-04 and
  verified** (`select=water_target_ml` on `/rest/v1/profiles` answers `42703: column
  profiles.water_target_ml does not exist`, while `height_cm` still answers 200). Water tracking now
  has no trace in the schema, the types or the code. **The order was the whole trick**: code first,
  column second, so the migration changed nothing. Nothing about a dead field should be load-bearing —
  if removing it needs a checklist, it isn't dead, it's undocumented.
- **Every number a server recomputes from must be bounded on BOTH sides.** `z.number().positive()` is
  not a bound: it has no ceiling and it accepts `Infinity`. `height_cm` and the three `*_weight_kg`
  fields were declared that way in `onboardingSchema`, `profileUpdateSchema` and `weightLogSchema`,
  and the routes feed them to `calculateTDEE` and **write the result back** — so the nonsense was
  server-generated, not a client display glitch: 5,000 kg gave a `daily_calorie_target` of 78,421 and
  an 8,000 g protein target; `height_cm: Infinity` made every macro target `Infinity`. Bounded by the
  shared `HEIGHT_CM` / `WEIGHT_KG` constants in `lib/validations.ts` (2026-09-03, P2-14) — one constant
  each, because the three schemas are three doors to the same column and a bound on two of them is the
  same hole with an extra step. `customFoodSchema` already did this correctly; copy it.
- **A capped read must be an ordered read.** Postgres applies `LIMIT` before any sort, so
  `.limit(400)` with no `.order()` returns an arbitrary 400 rows that drift as the table grows and
  after a `VACUUM`. `/api/foods/suggest` did exactly that under a comment claiming the pool was
  "ordered by the measured sources first" — `grep -c "\.order(" ` returned **0** — so `suggestMeals`
  could rank a pool with no measured IFCT rows in it at all (2026-09-03, P2-2). It now runs two
  ordered reads, measured tier first, curated only filling the remainder, because PostgREST cannot
  `ORDER BY` a `CASE` and `source` sorts alphabetically — which would put `curated` above `ifct`,
  precisely backwards. Define the tiers by **exclusion**: a new source name missing from a hardcoded
  allow-list would silently vanish from every suggestion.
- **`SMART_PORTIONS` is ordered, specific before generic** (`lib/portion-units.ts`). It is scanned with
  `.find`, so the first matching pattern wins and a name can match two: "Moong Dal Namkeen" carries both
  a dish word and a snack word. With the dal rule first it pre-selected a 200 g katori and offered
  **~952 kcal** for a 30 g packet. Adding a pattern near the top, or a broad one anywhere, silently
  re-homes every food that also matches something below it — `tests/portionUnits.test.ts` pins both
  directions, and a fix in search ranking is only half a fix until the portion default agrees with it.
- **A `SMART_PORTIONS` pattern is a substring match — word-bound anything that hides inside a longer
  word.** `lassi` sits inside "Cla**ssi**c" and `cola` inside "cho**cola**te", so *every* Classic-branded
  product was offered a 200 ml glass of lassi (Pintola Classic Peanut Butter opened on 200 g, ~1,200 kcal)
  and *every* chocolate row a 250 ml glass of cola (Dairy Milk, KitKat, 5 Star, Munch, Amul Dark, both
  chocolate wheys). Both had been live since the rules were written, because the rule that *should* have
  caught them sits lower in the table and `.find` never reached it. `\bsev\b`, `\bpav\b`, `\bsoda\b`,
  `\bgur\b`, `\blassi\b`, `\bcola\b`, `\bfanta\b`, `\bpuri\b` and `\boil\b` are all bounded for this
  reason — `fanta` hid inside "Dark **Fanta**sy" (a 28 g biscuit pack offered a 250 ml glass, ~1,320
  kcal) and `puri` inside "Kolha**puri** Mutton" (a 150 g katori of curry offered one 25 g puri).
  Two ways to be wrong here: a pattern too broad (steals foods from below) and a pattern too low
  (never gets reached) — the second is the invisible one. **Not every case is a boundary case:**
  "Saffola Gold Oil (Rice Bran + Sunflower)" contains the real word "rice" and took the rice katori —
  150 g of a 900 kcal/100 g oil, ~1,350 kcal — so it needed a `\boil\b` rule placed *above* the dish
  rules instead. Where bounding a word would not be true to the name, the fix is ordering, not
  anchoring. **`SMART_PORTIONS` is not the only name-matching regex in that file** — `isLiquidFood`'s
  `LIQUID_FOOD_INCLUDE` decides whether the raw unit reads "Millilitres" or "Grams" and had the same
  two words unbounded, so "Saffola Classic Oats" and "Dark Fantasy" were both being poured. Fix a
  hidden substring in one and grep the file for the others.
- **A `SMART_PORTIONS` rule *replaces* the row's `common_portions`, so it must carry that pack's real
  size — and one ladder must never be shared across packs of different sizes.** Suppressing
  `common_portions` is deliberate (see `defaultPortionFor` below), but it means a rule is a promise
  that its numbers beat the row's own. A shared `/whey|mass gainer|protein powder/` scoop of 30 g put
  MuscleBlaze Mass Gainer XXL — a **50 g** scoop on a **150 g** three-scoop label serving — on a fifth
  of one serving, with no unit in the picker able to express a real one, because the row's correct
  50 g/150 g portions had already been discarded. Gainers now have their own rule above the whey one.
  The same shape, inverted: `Cadbury Perk` is a **13 g** count-line bar, and `/chocolate/`'s 25 g "half
  bar" logged nearly two of them, so it needs its own rule too. Before adding a pattern, check the
  `serving_size_g` and `common_portions` of every row it will capture; if they disagree on size, that
  is two rules, not one. `tests/portionUnits.test.ts` pins both.
- **One function decides how much of a food a tap logs: `defaultPortionFor`** (`lib/portion-units.ts`).
  Every surface that adds a food without asking — the "+" quick-add pill and `AddFoodModal`'s opening
  state — must call it. They used to disagree: the pill used `food.serving_size_g` while the modal used
  `SMART_PORTIONS`, so two controls on the same row logged 180 g and 150 g of the same cooked rice, and
  a food whose serving string didn't parse opened the modal on **"1 gram"**. Neither is a rounding
  difference a user forgives. A smart match also **suppresses** the DB `common_portions` from migration
  `008` — that is deliberate and pinned (a bogus `999 g` label must stay out of the picker); if measured
  IFCT portions need to surface, fix the rows, not the precedence.
- **Every logging surface threads the date it is looking at — and "surface" includes the ones that
  don't open a modal.** `useChatLog`, search and quick-add all send `date` in the payload *and* scope
  `useDailyTotals` to the same day. The camera did neither, so scanning while viewing a past day filed
  the meal on today, silently. **Saved combos were the same bug, found two audits later** (2026-09-03,
  P0-2): `/api/meals/log` had no `date` in its schema *at all*, so every combo took
  `logged_at DEFAULT now()`, and `FoodLanding`'s "Your combos" row carried no `isToday` guard while
  `FoodSearch`'s copy of the same row did. `app/log/page.tsx` mounts `FoodLanding` on any **editable**
  day, on purpose, "so a missed day can be backfilled" — so the row was reachable on a past day and
  tapping it moved today's total instead. Three lessons worth keeping: a **column default is not a
  policy** (`DEFAULT now()` silently supplies a wrong answer where a missing value should have been an
  error); two components rendering "the same" shortcut will drift unless both are pinned; and a route
  that starts accepting a date must resolve it through **`resolveLoggedAtForRequest`** (`lib/backfill.ts`),
  never `new Date()` inline, or accepting the date becomes a way around the free-tier backfill window.
  `tests/coachingWiring.test.ts` holds all of them to it: the payload date and the totals context must
  be the same day, or the coaching line describes a day the meal didn't land on — and it now also pins
  that both saved-combo call sites send a `date` and that the insert never falls back to the default.
- **Never compare an untrusted timestamp as a string — parse it.** `/api/logs` and
  `/api/exercise/logs` clamped the free-tier history window with
  `if (!start || start < cutoff) start = cutoff`, over a `start` taken raw from the query
  string. That is only correct for ISO-8601 input and **nothing validated that it was ISO-8601**.
  PostgreSQL also accepts `epoch`, `today`, `now`, `yesterday` and `infinity` as timestamp
  literals, and every one of them sorts *above* a cutoff beginning `'2'` — so `?start=epoch`
  survived the clamp, PostgREST forwarded it verbatim as `logged_at=gte.epoch`, Postgres read it
  as 1970-01-01, and a free account got its **entire** history through the app's own API
  (audit 2026-09-03, P1-1). The comment above the line even asserted the invariant
  ("ISO-8601 UTC strings compare correctly as strings") — true, and irrelevant, because the input
  was never checked to be one. Both routes now parse first: an unparseable `start` is a 400 for
  every tier, and the bound goes through **`clampHistoryStart`** (`lib/dateUtils.ts`), which
  compares instants. Parsing also fixes the quieter inverse — an ISO string with a large positive
  UTC offset is a *later* instant than its digits look. Pinned in both places on purpose
  (`tests/dateUtils.test.ts` for the function, `tests/routeEntitlements.test.ts` for each literal
  against the real route), and each defence fails independently under sabotage.
- **The meal clipboard carries a *reference*, never nutrition.** "Copy Breakfast" (`lib/mealClipboard.ts`,
  `components/log/PasteMealCard.tsx`) stores only the source IST day and meal slot in `localStorage`;
  `/api/logs/copy-meal` re-reads those rows under the caller's RLS and re-inserts them wholesale, the
  same way `copy-yesterday` does. Making the clipboard carry the items would put user-editable kcal on
  the way back into `food_logs` — the one thing every logging route refuses — and would paste a stale
  snapshot when the source meal was edited in between. A *deleted* source meal must 404, never paste
  nothing and report success. It is `localStorage` and not React state because copy and paste happen on
  two different days and changing the day is a navigation. `tests/mealClipboard.test.ts` pins both the
  parse (a hand-edited or expired entry degrades to "no paste button", never a crash) and the wiring.
- **The diary's day boundary is IST, everywhere, including the header.** `lib/logDates.ts` delegates to
  `istDateStr`; there is no UTC day helper left and none may come back. When the page resolved the day
  in IST and the header in UTC, everything between 00:00 and 05:30 IST — the late-dinner window — was
  off by one: the "Today" pill sat on the wrong day and the next-day chevron unlocked.
- **Never format a date or time without naming a zone — `npm run lint` now refuses it.** Use
  **`formatIst`** (`lib/dateUtils.ts`) for anything a user reads; pass an explicit `timeZone` only when
  you genuinely mean another zone (`/wrapped`, `StreakRescueCard` and `FoodHeader` format a synthetic
  UTC-midnight date standing in for an IST calendar date, and say so). `.eslintrc.json` bans bare
  `toLocaleDateString` / `toLocaleTimeString`, `new Date(…).toLocaleString` and `new Intl.DateTimeFormat`
  via `no-restricted-syntax`; `next.config.js` extends the lint dirs to `hooks/` and `store/`, which
  `next lint` skips by default and which is where one of these hid. Number formatting is untouched —
  `kcal.toLocaleString('en-IN')` is not a date. **The locale is not the zone:** `'en-IN'` sets language
  and field order only, which is why `new Date(iso).toLocaleTimeString('en-IN', …)` reads as correct
  and is not — it formats in the *device's* zone in a client component and in UTC on Vercel. That put a
  1am snack under yesterday, listed a 00:30 IST weigh-in on the previous date, let Home's header name a
  day the diary beneath it disagreed with, and sent an NRI's 9pm dinner to the AI as 06:30, which came
  back tagged breakfast. Three of them survived two audits (2026-09-03: P1-8/P1-9/P2-4).
- **`getHours()`, `getDay()`, `getDate()`, `getMonth()`, `getFullYear()` and `getMinutes()` are banned
  too** — same rule, same reason. They read the **runtime's** calendar fields, and a ban on
  `toLocaleTimeString` that left these alone would just move the leak. `lib/meal.ts` used `getHours()`,
  so the meal a log was filed under came from the device's clock while the day it was filed on came
  from IST: **two clocks deciding one row**, disagreeing by a whole meal near a boundary. Use
  `istHour` / `istDateStr` / `getIstDayRange`, or the `getUTC*` form when the date was built with
  `Date.UTC` (which is what the /progress month calendar does — its cell arithmetic is zone-free).
- **`MEAL_WINDOWS` (`lib/meal.ts`) are IST hours**, not local ones, and `mealForTime` is the only
  meal-inference rule. There were seven copies once; the last private one lived in `useChatLog` and
  disagreed in *both* directions (17:00–18:00 → dinner where everything else says snack; 20:00–23:00 →
  snack where everything else says dinner, the behaviour `lib/meal.ts` explicitly removed). It fired
  only when the AI returned no meal, and its comment defended the gap by citing a boundary in
  `mealForTime` that has never existed. Deleted 2026-09-04 (audit P2-5).
- **`date-fns` is banned outright** (`no-restricted-imports`), and the dependency is now unused.
  `startOfDay`, `eachDayOfInterval`, `format` and `parseISO` all work in the runtime's **local** day —
  a second definition of "a day" competing with IST, and the one that made the Trends chart group a
  meal into one bar and label that bar with a different date. Replacements: `istDateStr`,
  `getIstDayRange`, `istDaysAgoStart`, `formatIst` (`lib/dateUtils.ts`) and `shiftDateStr`,
  `lastIstDateStrs` (`lib/logDates.ts`). The rule and the lint dirs are themselves pinned by
  `tests/istFormatting.test.ts`, which also sweeps the shipped tree for both constructs and for the
  `eslint-disable` that would quietly re-open the hole.
- **Home leads with one attention card, never two.** `pickDashboardMoment` (`lib/dashboardMoments.ts`)
  holds the frozen order `streak-rescue > streak-restart > plateau`, the same shape as `lib/pushBudget.ts`
  one screen further in. At a streak of zero a Pro user inside the rescue window qualifies for two cards
  that argue: "repair it and it goes back to 12" above "your best run was 12 days, start again". Both are
  true; only one can be the next action. Cards that probe the browser for themselves (install, rate,
  notification priming, email verification) still self-gate — folding them in needs their checks lifted
  out first.
- **"Deficit" has exactly one definition: `maintenance − eaten`**, and it comes from
  `lib/deficit-calculator.ts`. Never re-derive it, and never compute `daily_calorie_target − eaten` —
  that is "did you hit your eat-goal", a different question with a different answer. Trends and
  `/deficit` each rolled their own for months and disagreed by ~1,200 kcal on cards that link to each
  other (audit P1-11).
- **Today is never passed to the deficit maths.** A day in progress holds one meal, so `tdee − eaten`
  reads as a ~1,900 kcal triumph at 9am and *shrinks with every honest log* — the app punishing its own
  core action (audit P1-12). `buildPeriodWindow` peels today off once so no screen has to remember;
  render it as in-progress, never as a number that counts.
- **Anything comparing a day to a benchmark must say which benchmark.** `daily_calorie_target` (what to
  eat) and maintenance (TDEE) are both live in this app and point opposite ways: 819 kcal is a *miss*
  against a 1,600 goal and the *best day of the week* against 2,602 maintenance. Deficit surfaces use
  maintenance.
- **Deficit periods are calendar windows by default — Mon–Sun, or the 1st to month end.** A calendar
  total only grows and then resets; a trailing window drops whenever a good day ages out of the back,
  which reads as punishment for nothing. `/deficit`'s week-by-week history always uses this default.
  The one deliberate exception: the Progress page's "Week"/"Month" trend card (`buildDeficitView` in
  `app/progress/page.tsx`) opts into `buildPeriodWindow`'s `rolling` flag, because that card answers
  "how have the last 7/30 days gone" rather than "how has this calendar period gone" — added 2026-08-26
  at Adarsh's request, accepting the punishment-for-nothing trade-off there on purpose. Don't spread
  `rolling` to other surfaces without the same explicit call. Week is free, month is Pro — and the
  month is withheld **server-side**, so a free client never receives numbers a padlock is merely covering.
- **`goal` has three values and gains no more.** The user-facing selector is `profiles.body_focus`
  (`fat_loss | recomp | maintain | muscle_gain`, migration `040`); `goal` and the default pace are
  **derived** from it by `planForFocus` (`lib/bodyType.ts`), which both `/api/onboarding` and
  `/api/profile/update` call server-side rather than trusting the client's `goal`. ~20 modules branch
  on `goal` — `deficit-calculator`, `plateau`, `adaptiveTarget`, `planCards`, `goalProjection`,
  `WeightStats`, the paywall — so a fourth enum value means re-auditing every one for nothing.
  `recomp` is `goal='lose'` pinned to 0.25 kg/week: a gentle deficit is the only one in which muscle
  is realistically kept, so the pin overrides whatever pace the client sent. Pre-`040` rows have
  `body_focus` NULL and are back-filled for display by `focusFromProfile` — never assume it is set.
  **`body_type` is a self-reported preference that preselects a focus; it is never presented as a
  body-fat measurement**, and nothing may derive one from it. Its illustrations in
  `public/body-types/` are the **one sanctioned exception** to the emoji-and-gradients house style —
  four hand-drawn SVG versions were tried and none read as a body, because width alone cannot express
  body composition. They load through a plain `<img>`, never `next/image` (Hobby meters image
  optimisation), and `BodyTypeImage` falls back to a neutral block when a file is absent, so a missing
  asset can never ship a broken-image icon. Constraints on the artwork live in that folder's README.
  This exception does **not** extend to the story engine, which still downloads no images at all.
- **Streak freezes are never paywalled.** The free auto-*freeze* prevents a break; the Pro *rescue*
  repairs one. Do not merge or gate the two.
- **If you move the reminder cron, move `CATCH_ALL_IST_HOUR` with it.** They are coupled, and
  `tests/reminderWiring.test.ts` parses `vercel.json` to prove it.
- **The free-tier list on `app/page.tsx` is a public claim.** If you change what's free, change both.
  **And no user-facing string may hardcode a per-cohort number.** The limits are threaded correctly
  through the *enforcement* — but the sentences explaining each gate still said "the last 7 days" and
  "your last 30 weigh-ins" after `POST_CUTOFF_LIMITS` made those 5 and 14, so a post-cutoff user was
  served 5 and told 7 at the exact moment they hit the wall. The fix is not "show no number" — it is
  **pass the account's real number down as a prop** (`DayDiary` takes `freeHistoryDays`, `WeightClient`
  takes `freeWeightRows`) and keep copy that can't receive one cohort-neutral. `PRO_FEATURES` was wrong
  in both directions too: it sold "No ads, ever" (free has no ads either) while omitting streak rescue,
  the month deficit and unlimited suggestions — three gates people actually pay for.
  `tests/planFeatures.test.ts` now fails on the banned literals, scanning shipped strings with comments
  stripped so a file may still explain the history without tripping its own rule (audit P1-3, P1-12).
- **Free-tier limits come from `lib/freeTier.ts`, never a local constant.** Every history/weight/
  suggestion/scan/paywall number is keyed on `profiles.created_at`: accounts created before
  `FREE_TIER_CUTOFF` keep `LEGACY_LIMITS` forever (the "Free forever" promise is made to every
  visitor, so an existing user's entitlement never shrinks), accounts on/after get the tighter
  `POST_CUTOFF_LIMITS`. A null/unparseable `created_at` fails **open** to `LEGACY_LIMITS` — the
  opposite of the "unreadable tier is not Pro" rule, on purpose: the one-way door is on the
  tightening side. Pure and import-free so Client Components can read it; the server resolves the
  cohort and passes limits down as props / on the `LogMilestone`.
- **New capabilities added after the cutoff ship Pro-gated by default.** Moving one to free is a
  deliberate call, not the default. This is how the free/paid balance shifts over time without ever
  revoking a feature someone already had.
- **AI limits are server-enforced and fail closed.** Camera and chat share **one** lifetime pool of
  `AI_TRIAL_SCANS` (`lib/freeTier.ts` `LEGACY_LIMITS.aiScans`) calls, unlocked only after email
  verification (`lib/aiTrial.ts` + `lib/aiTrialServer.ts`, enforced with a 403 in the routes). The UI
  is never the boundary.
- **An OAuth / magic-link redirect must land on `/auth/callback`, and that route must stay out of the
  service-worker page cache.** Only `app/auth/callback/route.ts` calls `exchangeCodeForSession`; send a
  PKCE `?code=` anywhere else (`/onboarding`, `/dashboard`) and middleware sees no session, bounces to
  `/auth/sign-in` and the code is gone — the flow silently does nothing. Pass a destination with
  `?next=`. Separately, any route that answers with a redirect needs a `NetworkOnly` entry in
  `next.config.js` `runtimeCaching` (like `/auth/callback` and `/api/foods/search`): the default
  `pages` `NetworkFirst` rule caches and replays a `redirected` response, which the browser rejects
  for a navigation — an intermittent blank page a hard refresh clears.
- **Surgical changes only.** No drive-by refactors, no unrelated cleanup, no speculative abstractions.
- **All five gates green before declaring done.** Never report a change as working on the strength of a
  successful build alone.

## Deploying — the rules that cost a production outage

All three were learned on **2026-08-26**, in one afternoon, on the live site.

- **Never delete a Vercel deployment.** The custom domain is *assigned* to a specific deployment, and
  deleting it does not fall back to the previous build — it leaves `www.getinshape.co.in` serving
  Vercel's `DEPLOYMENT_NOT_FOUND` 404. Redeploying does **not** repair this: a redeploy is a new
  deployment with a new URL, and nothing reattaches the domain. The fix, and the *only* way to roll
  back, is **Promote to Production** on a known-good deployment (Deployments → the row's `…` menu).
  Rolling back is a promote, never a delete.
- **`main` has no branch protection, so merging a PR ships to production immediately.** There is no
  gate, no required check, nothing to catch a wrong click. Merge from the GitHub UI only after the
  preview has been looked at, and check the PR *number and title* first — with two PRs open, #31 was
  merged when #30 was meant, which put the kelp rebrand live and needed a revert (#32) plus a Vercel
  promote to undo. `gh pr merge --auto` is worse than useless here: with no protection it merges
  instantly rather than waiting for Vercel.
- **A long-lived branch carries everything on it, not just the commit you want.** `feat/kelp-tokens`
  held a colour rebrand *and* several wanted features, so no build from it could ship one without the
  other. To land one commit from such a branch, cherry-pick it onto a branch off `main` and PR that.
  (This used to add "and drop `public/sw.js` from the cherry-pick", because its precache manifest lists
  chunk hashes from the *source* branch's build. The generated worker files are gitignored as of
  2026-09-04, so there is nothing to drop.)

## Behavioral / workflow principles

- **State assumptions before coding.** Surface ambiguity rather than picking silently — most rules in
  this file exist because a reasonable-looking assumption produced a wrong answer in production.
- **Simplicity first.** Minimum viable code. No feature, abstraction or config that today's task
  doesn't need.
- **Define the verifiable success criterion up front**, then loop until it's met. "The test I wrote
  passes" beats "the code looks right".
- **Touching `lib/` means touching `tests/` in the same pass.** Those pure functions are the safety
  contract; an unpinned change to one is a silent behavior change.
- **Adding a card means deleting what it replaces.** A correct new number beside a stale one that
  answers the same question reads as a broken app, not a better one — the screen is judged whole, top
  to bottom. Before adding a surface, grep the same screen for anything answering the same question and
  remove it. The deficit rebuild shipped a provably correct card next to the old tiles, so one screen
  said both "5 of 5 days" and "7 of 7 days", and both "1,623" and "2,134" for a typical day; it was
  rejected on sight despite the maths being right.
- **Prefer changing data over changing ranking.** In search especially, the tier order is load-bearing
  in both directions — fix the synonym group or the row first. When the comparator genuinely must
  change, change **what string the tiers are applied to** (`normalize`/`foldSpelling`, `nameReadings`,
  `termScore`/`foodIdentity`), never the tier order itself. Both dal scars were fixed that way — and
  keep that change as narrow as the bug: capping one tier fixed the namkeen, while rescoring every tier
  broke "paneer", "dahi" and "roti".

## Coding conventions linters miss

- **Server Components by default.** Reach for `'use client'` only when the component needs state,
  effects or event handlers.
- **Validate every API input server-side** with a Zod schema from `lib/validations.ts`, even when the
  form already validated it. Derived values (TDEE, macros) are recomputed on the server; the client's
  preview is display-only.
- **No `any` at the client/server boundary**, and none in `app/api/`. Shared types live in
  `types/index.ts` (`Profile`, `Food`, `FoodLog`, `WeightLog`, `DailyTotals`, `Subscription`). The
  `Subscription` type carries `provider: 'stripe' | 'google_play' | 'razorpay'` — never assume one provider.
- **Pure `lib/` functions take data as arguments** rather than reading tables. `calculateStreakState`
  is the precedent: rescued dates are passed **in** as a third argument, never fetched inside.
- **Analytics event names come from `EVENTS`** (`lib/posthog/events.ts`) — never a bare string. That
  file is the frozen catalog; anything not listed is not a sanctioned event. `story_completed` ("read
  to the end") and `story_cta_clicked` ("acted") must never be collapsed. **Frozen means the names
  don't drift, not that the catalog can't grow** — adding a constant there is the sanctioned way to add
  an event. What is *not* sanctioned is a declared event with no emit site: four streak events sat in
  the catalog for months firing nothing, which is worse than absence because the dashboard looks
  instrumented.
- **`seconds_since_open` and `seconds_to_log` measure different things and reset differently.**
  `markAppOpened()` stamps once per app load — deliberately, it answers "how deep into the session".
  `markLogStart()` resets on **every** call and is stamped when a logging surface opens (search, camera,
  chat, the add modal), so `seconds_to_log` answers "how long did *this* log take". Before it existed,
  the 2nd–Nth log of a session each reported a bigger number than the last purely because time passed —
  the one metric the adherence research ties to retention was the one that couldn't be read. Both
  arrive as headers from `logMetaHeaders` and are re-read as **untrusted input** in `readLogMeta`.
- **Streak analytics describe what the log did, not what the streak is.** `streakEventsForLog`
  (`lib/streakEvents.ts`) takes the prior logs in and emits from the route, like every other pure module.
  Note `streak_frozen` fires on a freeze **bridged** by this log, not on a freeze being spent: a freeze
  is spent when a day *passes* unlogged, so comparing frozen-day counts before and after a log can never
  observe one. The fourth declared event, "streak broken", was renamed rather than faked — a break is the
  absence of a log, and nothing runs at the moment nothing happens.
- **User-facing failure copy goes through `userFacingApiError`** (`lib/apiError.ts`): show a 4xx
  message (it was written for a person), swallow a 5xx (it's a Postgres or provider string written for
  us). `lib/checkoutErrors.ts` does the same job on the checkout path.
- **Numerals use `tabular-nums`.** Type is Inter (body) + Inter Tight (display); keep weights restrained.
- **Sentry is runtime capture only** — `instrumentation.ts`, deliberately *not* `withSentryConfig`, so
  the build pipeline stays untouched when a DSN or auth token is missing. Don't add the webpack plugin.

## Pointers — read before you touch

These are deep dives, kept out of this file on purpose. Read the relevant one **before** editing:

| Read | Before touching |
|---|---|
| `docs/food-search.md` | `app/api/foods/search/`, `lib/searchRanking.ts`, `lib/searchFilter.ts`, `lib/food-synonyms.ts`, `lib/spelling-variants.ts`, `lib/typo-correction.ts`, `lib/mergeSearchResults.ts`, `lib/searchCache.ts` |
| `docs/billing.md` | `app/api/razorpay/`, `app/api/play/`, `app/api/stripe/`, `lib/razorpay/`, `lib/play/`, `lib/stripe/`, `lib/subscription.ts`, `app/upgrade/` |
| `docs/design-system.md` | `app/globals.css`, `tailwind.config.ts`, `components/ui/`, `components/layout/`, any screen styling |
| `docs/growth-mechanics-plan-2026-07-29.md` | `components/story/`, `lib/streakRescue.ts`, `lib/mealSuggest.ts`, `lib/pushBudget.ts`, `lib/reminderSchedule.ts`, `lib/cronBatch.ts` — note Seasons was cut, see below |
| `docs/refactor-safety-contract.md` | Any refactor — it maps each covered behavior to the test that pins it, and lists the accepted residual gaps |
| `TESTING.md` | Shipping. The manual script for everything tests can't reach (auth, real phones, the day boundary) |
| `docs/deep-dive-audit-2026-09-03.md` | Investigating a suspected systemic issue — the **latest** full audit. **Every finding is fixed** — both P0s, all 13 P1s, all 14 P2s |
| `docs/deep-dive-audit-2026-07-31.md` | The previous full audit — read for the fixes it made and the false alarms it recorded |
| `docs/growth-advice-audit-2026-08-25.md` | Anything about attribution, the paywall's placement, trial length, or adding an A/B mechanism — it scores the app against an external growth playbook, and §7 records where we disagree with it on purpose |
| `docs/prompts/growth-advice-apply.md` | Re-running that audit, or holding any new growth book against the app |

### Growth mechanics — the load-bearing rules

Full rationale in `docs/growth-mechanics-plan-2026-07-29.md`.

- **Story engine** (`components/story/`) — **no auto-advance** (a stat that vanishes before it's read is
  worse than one never shown, and there is no correct duration), **no image downloads** (emoji + CSS
  gradients only — a celebration must not cost a user on a metered connection), motion via `.story-rise`
  behind `prefers-reduced-motion`. Cards are JSX-free and serializable so a Server Component can build them.
- **`/welcome` fires on entitlement granted** (`active` *or* `trialing`), not on payment captured —
  Play's trial captures nothing for 3 days, so a payment-based trigger would hide it from trial users.
- **Seasons were cut** (2026-08-23). The 30-day competitive frame duplicated the streak's psychological
  job with a migration, three lib modules, a route, a card and a push rung to maintain — the
  2026-07-31 audit's Table 3 called it the clearest growth mechanic that hadn't earned its keep.
  `season_participants` (migration `031`) is **deliberately left applied and unread**, the same
  treatment `026_anonymous_users` gets: dropping a table to tidy up is not worth the risk. Do not
  reintroduce Seasons without re-arguing the case — the ten-badge cap in `lib/badges.ts` is still doctrine.
- **The meal-suggestion deck was cut to a row** (2026-08-23). `/api/foods/suggest` and its Pro cap are
  unchanged and `meal_suggestion_swiped` still fires; what went was the full-screen deck standing
  between the user and the log screen. A suggestion is worth one row on `FoodLanding`, not a surface.
- **Push budget:** one push per user per day across all sources, priority
  `streak-save > monthly-wrapped > weekly-recap > daily-reminder`, backing off after 5 ignored.
  The back-off only loosens because taps are recorded: `worker/index.js`'s `notificationclick` POSTs to
  `/api/push/opened`, which stamps `push_sends.opened_at`. Keep that write in the handler's
  `event.waitUntil` alongside the focus, never instead of it — and note the route uses
  `createAdminClient()` on purpose, because `push_sends` has no UPDATE policy and shouldn't get one.
  **`worker/index.js` is the source; `public/sw.js`, `public/workbox-<hash>.js` and
  `public/swe-worker-<hash>.js` are generated and now gitignored.** Vercel builds them on deploy;
  editing `worker/index.js` is the whole change. They were tracked until 2026-09-04, which meant every
  `npm run build` left the working tree dirty — `sw.js`'s precache manifest carries a fresh revision
  hash per file — so every branch carried a regenerated artifact nobody reviews, and the five gates
  could not be run without producing a diff (2026-07-31 P2-9 → 2026-09-03 P2-10).
- **The streak that ends gets a sentence.** Only ~0.9% of broken streaks restart unprompted, and the
  flame pill simply stops rendering — a twelve-day run vanishing without comment. `StreakRestartCard`
  fills that silence and has **no dismiss button** on purpose: it isn't a message to acknowledge, it
  removes itself when the user logs, because that is the action it asks for.
- **Manifest shortcuts** (`app/manifest.ts`) point at existing deep links — `/log?search=1`,
  `/dashboard?scan=1`, `/weight`. They are the closest a TWA gets to a home-screen quick-log widget.
  Adding one means adding the deep link first, not a new route.
- **Reminder hours** need `.github/workflows/reminder-tick.yml` plus the `CRON_SECRET` and `APP_URL`
  repo secrets. Without them nobody loses a reminder — the 20:30 IST Vercel catch-all still fires; the
  chosen hour just isn't honoured.
- **Downgrade rule:** things you *earned* persist, things you *hold* expire. Hence `monthly_wraps.was_pro` —
  a wrap unlocks on whether the user was Pro when it was written, not now.

### Database tables

`profiles`, `food_logs`, `foods`, `weight_logs`, `subscriptions`, `exercise_logs`, `food_favourites`,
`saved_meals`, `saved_meal_items`, `camera_photo_logs`, `chat_logs`, `push_subscriptions`,
`weekly_recaps`, `streak_rescues`, `monthly_wraps`, `food_dismissals`, `push_sends`.

`season_participants` still exists in the database but nothing reads it — see the Seasons note above.
`push_sends.opened_at` (migration `033`) is written by `/api/push/opened`; it sat NULL until 2026-08-23,
which is why the send back-off could only ever tighten.

Migrations worth knowing: `001_initial.sql` (core schema) · `007_seed_indian_foods.sql`,
`009_seed_indian_foods_v2.sql`, `010_seed_missing_foods.sql` (IFCT data) ·
`019_drop_deprecated_tables.sql` (removed the four wellness tables) ·
`045_drop_water_target_ml.sql` (**applied 2026-09-04** — removed `profiles.water_target_ml`, the last
trace of water tracking. `019` dropped the readings but left the target, which then spent a year dead
*and* load-bearing; the six code sites went first in PR #60, so this migration changed nothing) ·
`034_foods_rls_ownership.sql`
(restricts `foods` writes to a user's own `source='user'` rows — before this, RLS checked only "are you
logged in", so any account could delete a catalogue row and cascade it out of **every** user's diary) ·
`044_subscriptions_rls_lockdown.sql` (the same defect on the **billing** table: drops
`subs_insert`/`subs_update`/`subs_delete`, keeping only `subs_select`, so `status` can no longer be
asserted by the account it bills — see the hard rule above) ·
`036_reminder_hour.sql` (`profiles.reminder_hour`, IST, default 20) · `037_name_packaged_moong_dal.sql`
(renamed ten OFF-persisted namkeen packets keyed by barcode — the precedent for correcting a name Open
Food Facts gave us, and for how to audit such an `UPDATE` in the file header) ·
`038_correct_mislabelled_food_rows.sql` (the same, for **values**: a row whose per-serving column landed
in the per-100 g fields is rescaled by its own `serving_size_g`, never by another product's numbers, and
guarded on a plausibility range so a second hand-paste cannot rescale twice — these are applied by hand,
so every value-correcting `UPDATE` needs to be idempotent) · `018_branded_foods.sql` and
`041_branded_foods_v2.sql` (label-accurate `source='branded'` rows, rank 4 — above Open Food Facts and
above generated estimates, so the numbers must actually come from a panel; `041`'s provenance and its
spot-check sheet are in `docs/branded-foods-041-verification.md`, and `tests/brandedFoods041.test.ts`
pins the parts a hand-applied migration has nothing else to catch: uniqueness, macro plausibility, no
duplicate of an existing row, and that every **name** routes to a portion default near its own pack
serving — the name, not `common_portions`, decides that) · `042_correct_branded_041_rows.sql` (the
first correction to `041`, and the shape every later one should copy: guarded, idempotent `UPDATE`s
keyed on `source_id`, no-ops both on a re-run and on a database where `041` was never applied. Its
header also records what was **not** corrected — four `041` rows duplicate measured IFCT rows and
three of those carry IFCT-derived values under a `branded` provenance claim. Those need a panel read
off a pack; inventing one makes a rank-4 row more confidently wrong. They are tracked in
`docs/branded-foods-041-verification.md`, and note that **removing a duplicate is not available** —
`foods` has no soft-delete column and `DELETE` is forbidden) · `043_correct_rasgulla_protein.sql`
(aligns `branded-haldirams-rasgulla`'s protein to the measured `ifct-rasgulla` row it was derived
from — **not** a verified tin panel, so it is a correction to re-correct, not a settled number) ·
`043_correct_duplicate_cluster_rows.sql` (two different `043`s — see the note on non-unique numbers
above; the measured `ifct-egg-boiled` row had shipped with fat copied from protein, kcal computed from
that wrong fat — internally consistent, so no Atwater check could have caught it; corrected against
IFCT 2017's own published figure. `lib/indian-foods-data.ts`'s seed value was corrected directly in
the same commit, since that file is hand-curated, not generated; provenance in
`docs/duplicate-cluster-corrections-043.md`).
**Once a migration is applied, its file no longer matches the database** — every later correction
lives in its own file and 041 still reads the original values, so read the corrections before
trusting a number in 041 or in the verification sheet's table. `tests/brandedFoods041.test.ts` walks
every `NNN_correct_*.sql` that corrects a **041** row automatically and holds each to the same shape:
UPDATE-only, keyed on `source_id`, guarded on the value being replaced. A correction to a row from a
different migration (`038`, `043_correct_duplicate_cluster_rows`) is excluded from that walk by name
and reviewed by eye instead — the same reason `038` always was.
