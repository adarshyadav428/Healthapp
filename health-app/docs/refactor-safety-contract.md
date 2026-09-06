# Refactor safety contract

**Claim:** if a change only touches `components/` and page-level JSX/styles in `app/` (no edits
to `lib/`, `app/api/`, `hooks/`' fetch logic, `store/`, `middleware.ts`, or `supabase/migrations/`),
then no behavior listed below can change without a failing check.

## Why this holds

1. **All writes go through API routes.** Every `insert`/`update`/`upsert`/`delete` in the app
   lives in `app/api/**`, and there are **zero** in `components/` or `hooks/` — the zero is the
   load-bearing half.

   **This is now enforced, not documented.** `tests/architectureInvariants.test.ts` walks both trees
   on every run and fails if a component or hook writes to the database. It excludes
   `URLSearchParams.delete()` by matching on the receiver rather than filtering the word
   `searchParams` out of the file, so a real `.delete(` in a file that also touches query params is
   still caught (the two legitimate uses are in `BottomNav.tsx` and `FoodLanding.tsx`). It also
   asserts the `app/api` walk still finds >30 writers, so the check can never pass because the walk
   silently found nothing.

   The previous version of this section asked the reader to re-run two greps by hand and quoted a
   call-site count. That count went stale twice while the invariant itself never broke — which is
   worse than a wrong number, because it invites the conclusion that the rule lapsed. Numbers that
   need a human to refresh them do not belong in a safety contract; the test is the number now.

   Components can only `fetch()` those routes; the routes validate input with Zod
   (`lib/validations.ts`) and recompute derived values (TDEE, macros) server-side, so a UI change
   cannot alter what gets stored.
2. **All reads of gated data go through API routes.** `/api/logs` and `/api/exercise/logs` clamp
   free-tier history to the last 7 IST days regardless of what the UI asks for. (`DayDiary` was
   the last component reading `food_logs`/`exercise_logs` via the browser Supabase client; it now
   goes through the APIs.)
3. **Core calculations are pure functions in `lib/`, pinned by tests** that never import a
   component, so a reskin cannot make them pass while behavior changed.

## Covered behaviors → pinning test/gate

| Behavior | Source of truth | Pinned by |
|---|---|---|
| BMR / TDEE / macro targets (incl. 1200 kcal floor) | `lib/tdee.ts` | `tests/tdee.test.ts` |
| Weekly deficit math + status thresholds | `lib/deficit-calculator.ts` | `tests/deficit-calculator.test.ts` |
| API input contracts (bounds, enums, macro sanity) | `lib/validations.ts` | `tests/validations.test.ts` |
| Pro gate vocabulary (`active`/`trialing`) | `lib/subscription.ts` | `tests/subscription.test.ts` |
| Streak (IST day semantics) | `lib/streak.ts` | `tests/streak.test.ts` |
| IST day windows / 7-day cutoff (`istDaysAgoStart`) | `lib/dateUtils.ts` | `tests/dateUtils.test.ts` |
| Log date grouping | `lib/logDates.ts` | `tests/logDates.test.ts` |
| Nutrition scaling | `lib/nutrition.ts` | `tests/nutrition.test.ts` |
| Camera scan nutrition parsing | `lib/camera-nutrition.ts` | `tests/camera-nutrition.test.ts` |
| Search filtering / barcode / CSV / milestones / rating prompt / A2HS | respective `lib/` modules | matching `tests/*.test.ts` |
| Design tokens (no raw hex, no broken `/NN` opacity) | `app/globals.css` tokens | `npm run check:tokens` |
| Types at the client/server boundary | `types/index.ts` | `npx tsc --noEmit` (zero `any` in `app/api/**`) |
| **No DB writes / direct table reads in `components/`, `hooks/`** | this contract's premise | `tests/architectureInvariants.test.ts` |
| **Onboarding guard on every authenticated page** | each `app/**/page.tsx` | `tests/architectureInvariants.test.ts` |
| **The public-route list in `middleware.ts`** | `middleware.ts` `isPublic` | `tests/architectureInvariants.test.ts` |
| **The five gates actually running** | `.github/workflows/gates.yml` | `tests/ciGates.test.ts` |

## Server-enforced invariants (immune to UI changes by construction)

- **Free tier**: 7-day history (`/api/logs`, `/api/exercise/logs`) and a **3-call lifetime**
  AI trial shared across `/api/camera/analyze` and `/api/chat/analyze`, unlocked only once the
  email is verified (`lib/aiTrial.ts` + `lib/aiTrialServer.ts`) — all checked server-side per
  request, and the trial counter **fails closed** on a read error. *(Superseded the old
  5 scans/day + 10 chat logs/day quotas on 2026-07-18.)*
- **CSV export is deliberately ungated and unwindowed** (`/api/export`) — returning a user
  their own complete data is portability, not a feature.
- **TDEE recalc**: onboarding and profile updates recompute targets server-side from validated
  inputs; the client's preview is display-only. Weight logging ≥0.5 kg shift triggers an awaited recalc.
- **Billing**: Razorpay webhook is signature-verified; `/api/razorpay/verify` validates the
  payment signature server-side; Play RTDN re-verifies tokens with Google before writing. One
  Play token / one Razorpay subscription = one account (unique indexes, migrations 022 + 023).

## Verification gates (run all before shipping)

```bash
npm test           # 120 files / 1,589 tests
npx tsc --noEmit
npm run lint
npm run check:tokens
npm run build
```

Since 2026-09-06 these also run in CI on every PR and every push to `main`
(`.github/workflows/gates.yml`), so "I forgot to run them" is no longer a way for a change to reach
production. Note CI runs **build before tsc** — `next-env.d.ts` is gitignored but listed in
`tsconfig.json`'s `include`, so on a fresh checkout there is nothing for tsc to read until the build
generates it. Branch protection requiring the `gates` check is a separate, manual repo setting; until
it is on, the check reports but does not block.

## Known residual gaps (accepted for launch, revisit later)

- **Reminder hours are inert until two setup steps happen** (as of 2026-07-31): migration
  `036_reminder_hour.sql` must be applied, and `.github/workflows/reminder-tick.yml` needs the
  `CRON_SECRET` and `APP_URL` repo secrets. Until then the picker stores a value nobody acts on
  and every reminder arrives from the 20:30 IST catch-all, exactly as before the feature. No
  user loses a reminder in that state — see `lib/reminderSchedule.ts` for why the catch-all is
  the floor.

- **RLS is tested statically, not against a live Postgres.** `tests/rlsPolicies.test.ts`
  replays the migrations and asserts the policies are shaped correctly (no write gated on
  authentication alone, every expression tied to the caller, an UPDATE policy wherever a
  user-scoped writer needs one). It cannot prove Postgres *enforces* them as written, and it
  cannot prove the live database matches the files — a policy hand-edited in the Supabase
  dashboard, or a migration never applied, is invisible to it. The stronger test needs
  `supabase start` (Docker) plus two real users asserting 42501 across the boundary; that is
  worth building when CI can run a service container, but it must not be the only test, since
  it cannot run on a dev machine without Docker.

- **RLS does not enforce the 7-day rule at the data plane.** A user with their own JWT could query
  PostgREST directly and read their older rows. Every in-app path now goes through the clamped
  APIs; closing the raw-PostgREST path needs an RLS policy migration (subscription-aware
  `USING` clause on `food_logs`/`exercise_logs` SELECT). *(Note: the harsher version of this gap —
  `foods` UPDATE/DELETE being open to any authenticated user, with four cascading FKs behind it —
  was closed by `034_foods_rls_ownership.sql` on 2026-07-31. That one was a data-loss hole, not a
  tier bypass.)*
- ~~`/api/export` returns 90 days to free users~~ — **settled 2026-07-31**: export is a
  data-portability right, so it is ungated and returns the user's complete history.
- `/api/logs/copy-yesterday` is not idempotent — a double-tap duplicates yesterday's logs
  (client disables the button in-flight; server-side guard would be nicer).
- Migrations `012`/`022`/`023` (billing columns incl. `cancel_at_period_end`) are **applied in
  prod** (verified 2026-07-17 via REST probe). `015_chat_logs.sql` **was applied on 2026-07-18**;
  this line claimed it was outstanding and that "the 10/day AI-chat limit is silently off" for over
  a year after both facts stopped being true — the limit is now the lifetime AI trial in
  `lib/aiTrial.ts`, not a daily cap. Migrations `001`–`044` are applied; see `CLAUDE.md` for the
  authoritative list. `011_weekly_calorie_view` is unapplied but referenced nowhere in code
  (deliberately skipped). See `docs/launch-plan-2026-07-17.md` §4 for the apply-and-verify playbook.
