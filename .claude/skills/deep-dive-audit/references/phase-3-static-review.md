## Phase 3 — Static deep review, route by route

Read every file. Do not sample. Group findings by dimension:

**A. Correctness** — off-by-one, timezone handling, null/undefined paths, floating-point
money and macro math, async races, optimistic-update rollback.

**B. Security & data isolation**
- Every route in `app/api/**` — is auth checked? Is input validated with a Zod schema
  from `lib/validations.ts` on the *server*? Can a parameter reach a query unvalidated?
- Which routes use `createAdminClient()` (service role, bypasses RLS)? For each, prove
  the user can only ever touch their own rows.
- Webhook routes (`/api/razorpay/webhook`, `/api/stripe/webhook`, `/api/play/rtdn`) —
  signature/secret verification, replay protection, idempotency, and what happens on a
  duplicate or out-of-order event.
- `/api/admin/*` — who can call these? `run-migrations` and `seed-indian-foods` are the
  two most dangerous routes in the codebase. Establish exactly what guards them.
- `/api/cron/*` — is `CRON_SECRET` enforced? What happens if someone hits them
  unauthenticated?
- `/api/export` — historically **not** Pro-gated. Verify current state.
- Any place a secret could reach the client bundle (`NEXT_PUBLIC_*` misuse).

**C. Entitlements** — the free/Pro boundary must be enforced **server-side**, never by
the UI. From `CLAUDE.md`: free tier = unlimited manual/search logging, barcode, exercise,
weight, 7 days of history. Pro = AI camera scan + AI chat logging, history beyond 7 days,
custom foods, streak rescue, unlimited meal suggestions. The AI trial is **3 lifetime
calls, shared across camera and chat, unlocked only once the email is verified**, and
both counters must **fail closed**. Trace each gate to the line that enforces it and say
whether a crafted request bypasses it.

**D. Reliability** — every external call (Supabase, Open Food Facts, Gemini, Razorpay,
Google Play, web-push, PostHog, Sentry). For each: is there a timeout? What does the user
see when it fails? Is a failure ever cached or written to shared state? Does any failure
get silently swallowed? (A swallowed count error is exactly how the free AI-chat limit
was silently off for weeks — look for that class of bug specifically.)

**E. Performance & cost** — N+1 queries, unbounded `select *`, missing indexes for the
queries actually issued, client bundle size, images, the 200-deep food fetch, and
**every path that spends money** (Gemini calls, OFF writes into `foods`, push sends).

**F. Data model** — read all of `supabase/migrations/`. Note that numbers are duplicated
(`002`/`004`/`005`/`009` appear twice, there is no `021`) so always cite exact filenames.
Check: does the schema in the migrations match what the code assumes? Are there columns
the code writes that no migration creates, or vice versa? Are there tables with no RLS?

**G. Dead code & drift** — components, routes, env vars, feature flags and docs that
describe something that no longer exists. Anything in the docs that makes a **public
claim** which the code no longer honours is a P0-class finding, not a nit (this app has
shipped a paywall selling a feature that didn't exist before).
