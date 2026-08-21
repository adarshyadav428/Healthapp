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
- **Tests:** Vitest 4.1 — **68 files / 936 tests**. There is no `vitest.config.ts`; defaults apply.
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
  precisely so the logic stays testable. Key modules: `tdee.ts` (Mifflin-St Jeor → macro targets),
  `streak.ts`, `dateUtils.ts` (**IST** day windows — the whole app's day boundary), `validations.ts`
  (Zod schemas shared by forms and routes), `nutrition.ts`, `subscription.ts` (the Pro gate).
- **`lib/supabase/`** — three factories, never interchangeable: `createServerClient()` (cookie-bound,
  acts as the current user), `createAdminClient()` (service-role; trusted server-only routes),
  `getBrowserSupabaseClient()` (Client Components).
- **`lib/razorpay/`, `lib/play/`, `lib/stripe/`** — three providers, **one** `subscriptions` table,
  **one** status vocabulary, so every Pro gate is provider-agnostic. → `docs/billing.md`
- **`lib/posthog/`** — `events.ts` is a **frozen event catalog**; `client.ts`/`server.ts` are the typed
  emitters. **`lib/push/`** — `budgetedSend.ts` is the only sanctioned scheduled-push path.
- **Retention/coaching logic** (all pure, all in `lib/`): `adaptiveTarget.ts`, `coaching.ts`,
  `proteinCoach.ts`, `plateau.ts`, `projection.ts`, `goalProjection.ts`, `weightTrend.ts`,
  `logMilestones.ts`, `badges.ts`, `seasons.ts`, `streakRescue.ts`, `mealSuggest.ts`, `shareCard.ts`.
- **`components/`** — `ui/` holds primitives; everything else is domain-scoped (`dashboard/`, `log/`,
  `story/`, `milestones/`, `camera/`, `chat/`, …). **`hooks/`** are fetch/TanStack wrappers only — no writes.
- **`supabase/migrations/`** — `001`–`037`. Numbers are **not unique** (`002`, `004`, `005`, `009` each
  appear twice) and there is **no `021`**. Always reference a migration by its exact filename.
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

npm test                 # vitest run — the whole suite (68 files / 936 tests)
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
  re-run it; keep `tests/curatedFoods.test.ts` green — it's what stops a meat dish shipping with a
  carb dish's protein.
- **Never write a raw hex color** in `app/` or `components/` — reference a token (`bg-brand`, `text-ink`, …).
- **Never use Tailwind's `/NN` opacity modifier on a token color.** Our tokens are plain `var(--x)`
  strings, so `bg-brand/40` is a **silent no-op** that renders full strength. Use a pre-mixed alpha
  token (`--brand-soft`, `--scrim`, …) or an inline `color-mix()`.
- **Never add a third Vercel cron.** Hobby caps at two, and both are used (`vercel.json`). Monthly
  Wrapped deliberately rides inside the Sunday recap run.
- **Never call `sendPushToUser` for a scheduled push** — always `sendBudgetedPush`. The one-push-per-day
  budget only works if nothing bypasses it.
- **Never import the server Supabase client into a Client Component**, or the browser client into a
  Server Component / Route Handler. `createAdminClient()` is for trusted server-only routes only.
- **Never reference the four dropped wellness tables** (`water_logs`, `sleep_logs`, `fasting_sessions`,
  `measurements_logs`) — migration `019` removed them. Only `exercise_logs` remains of the extended trackers.
- **Streak freezes are never paywalled.** The free auto-*freeze* prevents a break; the Pro *rescue*
  repairs one. Do not merge or gate the two.
- **If you move the reminder cron, move `CATCH_ALL_IST_HOUR` with it.** They are coupled, and
  `tests/reminderWiring.test.ts` parses `vercel.json` to prove it.
- **The free-tier list on `app/page.tsx` is a public claim.** If you change what's free, change both.
- **AI limits are server-enforced and fail closed.** Camera and chat share **one** lifetime pool of
  `AI_TRIAL_SCANS` (3) calls, unlocked only after email verification (`lib/aiTrial.ts` +
  `lib/aiTrialServer.ts`, enforced with a 403 in the routes). The UI is never the boundary.
- **Surgical changes only.** No drive-by refactors, no unrelated cleanup, no speculative abstractions.
- **All five gates green before declaring done.** Never report a change as working on the strength of a
  successful build alone.

## Behavioral / workflow principles

- **State assumptions before coding.** Surface ambiguity rather than picking silently — most rules in
  this file exist because a reasonable-looking assumption produced a wrong answer in production.
- **Simplicity first.** Minimum viable code. No feature, abstraction or config that today's task
  doesn't need.
- **Define the verifiable success criterion up front**, then loop until it's met. "The test I wrote
  passes" beats "the code looks right".
- **Touching `lib/` means touching `tests/` in the same pass.** Those pure functions are the safety
  contract; an unpinned change to one is a silent behavior change.
- **Prefer changing data over changing ranking.** In search especially, the tier order is load-bearing
  in both directions — fix the synonym group or the row first. When the comparator genuinely must
  change, change **what string the tiers are applied to** (`normalize`/`foldSpelling`, `nameReadings`,
  `foodIdentity`), never the tier order itself. Both dal scars were fixed that way.

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
  to the end") and `story_cta_clicked` ("acted") must never be collapsed.
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
| `docs/food-search.md` | `app/api/foods/search/`, `lib/searchRanking.ts`, `lib/searchFilter.ts`, `lib/food-synonyms.ts`, `lib/mergeSearchResults.ts`, `lib/searchCache.ts` |
| `docs/billing.md` | `app/api/razorpay/`, `app/api/play/`, `app/api/stripe/`, `lib/razorpay/`, `lib/play/`, `lib/stripe/`, `lib/subscription.ts`, `app/upgrade/` |
| `docs/design-system.md` | `app/globals.css`, `tailwind.config.ts`, `components/ui/`, `components/layout/`, any screen styling |
| `docs/growth-mechanics-plan-2026-07-29.md` | `components/story/`, `lib/seasons.ts`, `lib/streakRescue.ts`, `lib/mealSuggest.ts`, `lib/pushBudget.ts`, `lib/reminderSchedule.ts`, `lib/cronBatch.ts` |
| `docs/refactor-safety-contract.md` | Any refactor — it maps each covered behavior to the test that pins it, and lists the accepted residual gaps |
| `TESTING.md` | Shipping. The manual script for everything tests can't reach (auth, real phones, the day boundary) |
| `docs/deep-dive-audit-2026-07-31.md` | Investigating a suspected systemic issue — the last full audit |

### Growth mechanics — the load-bearing rules

Full rationale in `docs/growth-mechanics-plan-2026-07-29.md`.

- **Story engine** (`components/story/`) — **no auto-advance** (a stat that vanishes before it's read is
  worse than one never shown, and there is no correct duration), **no image downloads** (emoji + CSS
  gradients only — a celebration must not cost a user on a metered connection), motion via `.story-rise`
  behind `prefers-reduced-motion`. Cards are JSX-free and serializable so a Server Component can build them.
- **`/welcome` fires on entitlement granted** (`active` *or* `trialing`), not on payment captured —
  Play's trial captures nothing for 3 days, so a payment-based trigger would hide it from trial users.
- **Seasons** are authored in **code**, not rows; progress is recomputed from logs, never stored. Season
  badges are a **separate collection** from the ten in `lib/badges.ts` — that cap is doctrine. Free to join.
- **Push budget:** one push per user per day across all sources, priority
  `streak-save > season-deadline > monthly-wrapped > weekly-recap > daily-reminder`, backing off after 5 ignored.
- **Reminder hours** need `.github/workflows/reminder-tick.yml` plus the `CRON_SECRET` and `APP_URL`
  repo secrets. Without them nobody loses a reminder — the 20:30 IST Vercel catch-all still fires; the
  chosen hour just isn't honoured.
- **Downgrade rule:** things you *earned* persist, things you *hold* expire. Hence `monthly_wraps.was_pro` —
  a wrap unlocks on whether the user was Pro when it was written, not now.

### Database tables

`profiles`, `food_logs`, `foods`, `weight_logs`, `subscriptions`, `exercise_logs`, `food_favourites`,
`saved_meals`, `saved_meal_items`, `camera_photo_logs`, `chat_logs`, `push_subscriptions`,
`weekly_recaps`, `streak_rescues`, `monthly_wraps`, `food_dismissals`, `season_participants`, `push_sends`.

Migrations worth knowing: `001_initial.sql` (core schema) · `007_seed_indian_foods.sql`,
`009_seed_indian_foods_v2.sql`, `010_seed_missing_foods.sql` (IFCT data) ·
`019_drop_deprecated_tables.sql` (removed the four wellness tables) · `034_foods_rls_ownership.sql`
(restricts `foods` writes to a user's own `source='user'` rows — before this, RLS checked only "are you
logged in", so any account could delete a catalogue row and cascade it out of **every** user's diary) ·
`036_reminder_hour.sql` (`profiles.reminder_hour`, IST, default 20) · `037_name_packaged_moong_dal.sql`
(renamed ten OFF-persisted namkeen packets keyed by barcode — the precedent for correcting a name Open
Food Facts gave us, and for how to audit such an `UPDATE` in the file header).
