# Deferred signup (anonymous auth) — implementation plan

**Status:** proposed, not started. Written 2026-07-18.
**Recommendation:** fast-follow after launch, not on `launch-prep-2026-07-17`.

## Goal

Let a new user reach a working dashboard without typing an email. Move the
account-creation step from *before* onboarding to *after* first value.

Current funnel: `/` → `/auth/sign-up` (email + password) → `/onboarding` → `/dashboard`
Proposed funnel: `/` → `/onboarding` (silent anon session) → `/dashboard` → conversion prompt at earned value

## Approach

Supabase **anonymous sign-in** (`signInAnonymously()`), not removal of auth.

This is deliberately the conservative option. It mints a real row in `auth.users`
with a real `auth.uid()`, so every RLS policy across the 13 migrations that
reference `user_id` keeps working untouched. Later, `updateUser({ email, password })`
converts the *same* user in place — no data migration, no merge path, no risk of
losing a user's first week of logs.

Removing auth outright would mean either disabling RLS (making the database a
public read/write endpoint) or building a parallel localStorage data layer plus a
merge path. Both are much larger and much riskier than what follows.

---

## Blocker to clear first

**`profiles.email` is `NOT NULL`** — [001_initial.sql:11](../supabase/migrations/001_initial.sql#L11).

The `handle_new_user()` trigger ([001_initial.sql:110-126](../supabase/migrations/001_initial.sql#L110))
fires `AFTER INSERT ON auth.users` and inserts `NEW.email` into `profiles`.
Anonymous users have `email = NULL`, so the trigger raises, which aborts the
`auth.users` insert, which makes `signInAnonymously()` fail outright.

Nothing else works until this is fixed. The `UNIQUE` constraint is fine to keep —
Postgres treats NULLs as distinct, so any number of anon profiles coexist.

### Migration `026_anonymous_users.sql`

```sql
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
```

Verify no code path assumes `profile.email` is a string before shipping —
`getAuthedUser`/`getApiUser` already type it as `string | null`
([lib/supabase/server.ts:33](../lib/supabase/server.ts#L33)), which is a good sign,
but Settings renders it and should be checked.

---

## File-by-file changes

### 1. Entry point — `app/page.tsx`

Six `<Link href="/auth/sign-up">` CTAs (lines 20, 44, 195, 275). Replace with a
client "Get started" button that calls `signInAnonymously()` then routes to
`/onboarding`. Keep the "Sign in" links as-is for returning users.

Needs a new small client component (`components/marketing/StartFreeButton.tsx`)
since `app/page.tsx` is a Server Component. Handle the error case by falling back
to `/auth/sign-up` — if anon sign-in fails for any reason, the old funnel still works.

### 2. Middleware — `middleware.ts`

No change needed. An anon user has a valid session, so `supabase.auth.getUser()`
at [middleware.ts:75](../middleware.ts#L75) returns a user and the existing
redirect logic passes them through. This is the main payoff of the anon-auth
approach.

One addition to consider: block anon users from `/upgrade` and push them to the
conversion screen first. Checkout against an account with no email is not
something you want.

### 3. Onboarding — unchanged

[app/onboarding/page.tsx](../app/onboarding/page.tsx) and
[components/onboarding/OnboardingForm.tsx](../components/onboarding/OnboardingForm.tsx)
work as-is. The profile row exists (trigger), `height_cm` is NULL, so the page
renders the form. No change.

### 4. Conversion screen — new

`components/auth/SaveAccountSheet.tsx` — email + password fields calling
`supabase.auth.updateUser({ email, password })`. Reuse `signUpSchema` from
[lib/validations.ts](../lib/validations.ts) so the rules match sign-up exactly.

Copy must be explicit about the stakes, not buried: right now the account exists
only in this browser's cookies, and clearing site data orphans it permanently.
Something like *"Save your progress — your data currently only lives on this device."*

Trigger points, in priority order:
- Hard gate: any Pro/upgrade path, and account deletion
- Hard gate: AI features (see cost note below)
- Soft prompt: after first food log, and on day-2 return

Note Google OAuth also converts an anon user in place via `linkIdentity()` — worth
offering here since `handleGoogle` already exists in
[app/auth/sign-up/page.tsx:54](../app/auth/sign-up/page.tsx#L54).

### 5. AI quota gates — `app/api/camera/analyze/route.ts`, `app/api/chat/analyze/route.ts`

**This is the one that costs real money.** Free tier grants 5 camera scans/day
([camera/analyze/route.ts:11](../app/api/camera/analyze/route.ts#L11)) and 10 chat
logs/day ([chat/analyze/route.ts:10](../app/api/chat/analyze/route.ts#L10)), each a
paid Gemini call. Anonymous accounts are free to create, so without a change this
is an unauthenticated endpoint for burning your API budget.

Both routes already resolve the user and check `isProStatus`. Add an anon check
(the JWT carries `is_anonymous`; surface it through `getApiUser` alongside `id`/`email`)
and either refuse with an `upgrade`-style "create an account to use AI logging"
response, or drop the limit to 1/day.

Gating AI behind conversion is the recommendation — it doubles as your best
conversion prompt, since photo scan is the feature people actually want.

### 6. Abandoned-account cleanup — new cron

Anon users accumulate in `auth.users` forever. Without cleanup your user count
stops meaning anything and the table grows unbounded.

Add a route beside the existing crons (`app/api/cron/push-reminders/route.ts` is
the pattern to copy) that deletes anon users older than ~30 days with zero
`food_logs`. Uses `createAdminClient()`. `ON DELETE CASCADE` on `profiles.id`
handles the rest of the graph.

### 7. Analytics — `lib/posthog/events.ts`

`SIGNUP_COMPLETED` currently fires at account creation
([app/auth/sign-up/page.tsx:45](../app/auth/sign-up/page.tsx#L45)), which under the
new funnel happens much later and means something different. Add:

- `ANON_SESSION_STARTED` — the new top of funnel
- `ACCOUNT_SAVED` — anon → registered conversion, with a `trigger` property (which
  prompt caused it) and `days_since_anon`

Keep `SIGNUP_COMPLETED` firing on the direct sign-up path so the two funnels stay
comparable. `person_profiles: 'identified_only'`
([lib/posthog/client.ts:30](../lib/posthog/client.ts#L30)) means anon users won't
get person profiles until `identifyUser` runs — call it with the anon uid at session
start so the pre-conversion funnel is actually measurable.

---

## Supabase dashboard (manual, not code)

- Enable anonymous sign-ins (Authentication → Providers)
- **Enable CAPTCHA on the anon endpoint** — otherwise it's a free unauthenticated
  user-creation endpoint
- Rate-limit anonymous sign-ins per IP

## Tests

`npm test` covers `lib/` pure logic. Worth adding:
- anon-user quota gating in the AI routes
- the cleanup job's selection predicate (must never select a registered user or an
  anon user with logs — this one deletes data, so it deserves a test)

## Risks

| Risk | Mitigation |
|---|---|
| Trigger failure blocks all anon sign-in | Migration 026 first; verify on a branch DB before touching prod |
| AI cost abuse via free anon accounts | Gate AI behind conversion + CAPTCHA + IP rate limit |
| Users lose data by clearing browser | Explicit copy at conversion; prompt early and repeatedly |
| `auth.users` bloat | Cleanup cron |
| Conversion never happens; DAU is fake | Track `ACCOUNT_SAVED` rate; if it's bad, the gates are too soft |

## Sequencing

1. Migration 026 (blocker)
2. AI gates + CAPTCHA (cost protection — before any anon user exists)
3. Anon sign-in on `/` + analytics events
4. Conversion sheet + trigger points
5. Cleanup cron

Steps 1–2 must land before 3. Shipping 3 without 2 exposes a paid API endpoint.
