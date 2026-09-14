# GetInShape — Security / Authorization QA Report

Part of the 2026-09-13 QA baseline. **All findings are CODE-REVIEWED** unless marked
OBSERVED — no exploit was run against the live database, no server was started for this
report, and the live Supabase project was not touched. "Confirmed" means "confirmed by
reading the source," never "confirmed against production," except where explicitly marked
OBSERVED (the PWA/middleware finding, tested against `https://www.getinshape.co.in`).

Every `app/api/**` route in the repo (48 routes) was read in full, along with every file
under `supabase/migrations/` and the three Supabase client factories.

---

## 1. Every `app/api/**` route — auth/ownership/admin-client/validation audit

Legend: **Auth** = session verified. **Own** = ownership (row's `user_id`) checked before
read/write. **Admin** = uses `createAdminClient()`, with justification. **Zod** = validated
via schema. **Bounds** = numeric input bounded on both sides.

| Route | Auth? | Ownership? | Admin client? | Zod? | Bounds? | Notes |
|---|---|---|---|---|---|---|
| `admin/seed-indian-foods` | N/A — `SEED_SECRET` gate | N/A | Y, justified | N | N/A | Non-constant-time secret compare (F-4) |
| `admin/run-migrations` | N/A — `SEED_SECRET` gate | N/A | Y, justified (probe only) | N | N/A | Same compare issue |
| `auth/signout` | implicit | N/A | N | N/A | N/A | Clean |
| `push/subscribe` | Y | Y | N | Y | N/A | Clean |
| `push/unsubscribe` | Y | Y | N | Y | N/A | Clean |
| `push/opened` | Y | Y | Y, justified (no user UPDATE policy on `push_sends`) | Y | N/A | Clean |
| `stripe/portal` | Y | Y | N | N/A | N/A | Legacy, read-only lookup |
| `stripe/webhook` | signature | via verified event | Y, justified | N/A | N/A | All three writes check `error` and throw |
| `razorpay/create-subscription` | Y | own id in notes | N | manual enum | N/A | No internals leaked in errors |
| `razorpay/cancel` | Y | Y | Y, justified (no user write policy) | N/A | N/A | Correct per 044 |
| `razorpay/verify` | Y | own id | Y, justified | Y | N/A | Signature verified before any write |
| `razorpay/webhook` | signature | via lookup | Y, justified | N/A | N/A | Checks `error`, throws — the exact class CLAUDE.md flags, fixed |
| `play/verify` | Y | **anti-replay: `neq('user_id', user.id)` check before upsert** | Y, justified | Y | N/A | Correctly blocks one Play token entitling two accounts (409) |
| `play/rtdn` | shared secret | via lookup | Y, justified | N/A | N/A | Both reads/writes check `error`; always 200s to stop Pub/Sub retry-storms, Sentry-reports failures |
| `onboarding` | Y | own id | N | Y | Y (`HEIGHT_CM`/`WEIGHT_KG`) | `goal`/pace derived server-side, never trusted from client |
| `profile/update` | Y | own id | N | Y | Y | Same TDEE recompute path; custom overrides bounded |
| `profile/reminder-hour` | Y | own id | N | manual | N/A | Write error checked |
| `account/delete` | Y | own id throughout | Y, justified | N/A | N/A | Subscription-read failure explicitly **blocks** deletion |
| `export` | Y | own id | N | N/A | N/A | Deliberately un-windowed (data portability, not gated) |
| `foods/custom` (POST/PATCH/DELETE) | Y | POST correct; **PATCH/DELETE use `.includes(user.id)` — F-3** | N | Y | Y | RLS is the real backstop |
| `foods/favourites` | Y | Y + `isFoodReferenceableBy` | N | Y | N/A | Re-checks referenceability before wiring a favourite |
| `foods/search` | Y | own rows scoped fresh, never cached | Y, justified (catalogue writes) | N (query string) | N/A | Confirms claim (e) below |
| `foods/suggest` | Y | dismissals scoped; user/estimate excluded | N | N/A | N/A | Confirms P2-2 ordered-read fix |
| `logs/add` | Y | `isFoodReferenceableBy` | N | Y | Y (`MAX_LOG_GRAMS`, 99 servings) | Uses `resolveLoggedAtForRequest` |
| `logs/add-bulk` | Y | filter over `.in('id',...)` | N | Y | Y | Clean |
| `logs/quick-add` | Y | scoped to `user_id` | N | Y, fully bounded | Y | Clean — **but zero route test (R18)** |
| `logs/edit` | Y | `.eq('id').eq('user_id')` | N | Y, bounded | Y | **Trusts client-computed macros with no server recompute — R7** |
| `logs/delete` | Y | `.eq('id').eq('user_id')` | N | Y | N/A | Clean |
| `logs/copy-yesterday` | Y | scoped; `copied_from_id` uniqueness | N | N/A | N/A | Idempotent per migration 047 |
| `logs/copy-meal` | Y | re-reads source rows under caller's RLS | N | Y | N/A | Idempotent per migration 048 |
| `logs` (GET) | Y | `.eq('user_id')` | N | N/A | N/A | Confirms claim (d) — parses `start` before comparing |
| `meals/log` | Y | `.eq('id').eq('user_id')` + `isFoodReferenceableBy` | N | Y | **N — R4/F-1 open** | Feeds unbounded grams/servings into `scaleMacros` |
| `meals/saved` | Y | Y | N | Y | **N — grams/servings unbounded, R4** | Confirmed still open 2026-09-13 |
| `exercise/add` | Y | scoped, `insertIdempotent` | N | Y, bounded | Y | Clean, matches migration 046 |
| `exercise/today` | Y | `.eq('user_id')` | N | N/A | N/A | Clean |
| `exercise/logs` | Y | `.eq('user_id')` | N | N/A | N/A | Confirms claim (d) for exercise too |
| `exercise/delete` | Y | `.eq('id').eq('user_id')` | N | Y | N/A | Clean |
| `weight/add` | Y | scoped, `insertIdempotent` | N | Y, bounded | Y | **No recency check on backdated writes overwriting live targets — R6** |
| `weight/logs` | Y | `.eq('user_id')` | N | N/A | N/A | Free-tier row cap |
| `weight/delete` | Y | `.eq('id').eq('user_id')` | N | Y | N/A | Clean |
| `streak/rescue` | Y (`getUser`, deliberately not `getApiUser`) | Y | Y, justified (no user INSERT policy) | N/A | N/A | Fail-closed on subscription-read and rescue-count read; **route's 4 negative paths untested — R10** |
| `camera/analyze` | Y | own-scoped; excludes `user`/`estimate` from name-match | Y, justified (writes shared catalogue) | manual body check | plausibility via `resolveNutrition`, not Zod | Confirms P0-1 fix and P0-2 exclusion |
| `chat/analyze` | Y | same as above | Y, justified | manual | same | Same protections; **zero route test — R15** |
| `camera/barcode` | Y | N/A (shared catalogue) | Y, justified (034 requires admin for OFF upsert) | N | N/A | `existing` read drops `error` (low severity, F-5) |
| `targets/suggestion` | Y | `.eq('id'/'user_id')` | N | N/A | N/A | Three reads drop `error` — fails to "no suggestion" (F-5, fail-safe) |
| `paywall/projection` | Y | `.eq('id'/'user_id')` | N | N/A | N/A | Errors unchecked, degrades to `{projection:null}` by design |
| `cron/push-reminders` | `CRON_SECRET` bearer | N/A | Y, justified | N/A | N/A | Confirms P1-4/P1-5 swallowed-error fix; **no route-level test — R11** |
| `cron/weekly-recap` | `CRON_SECRET` bearer | N/A | Y, justified | N/A | N/A | All four batched reads explicitly check `error` and throw |

**48/48 routes read. No route missing an auth check. No route missing a needed ownership
check where one applies** (the one weak spot, `foods/custom` PATCH/DELETE, is backstopped by
RLS — F-3). **No route found using the admin client without justification.**

## 2. RLS-relevant migrations on sensitive tables

| Migration | Table(s) | What it changed | Current live status |
|---|---|---|---|
| `001_initial.sql` | `profiles`, `foods`, `food_logs`, `weight_logs`, `subscriptions` | Initial schema + the original P0: owner-scoped CRUD on `subscriptions`, `foods` write gated on "signed in" only | Superseded by `034` and `044` |
| `004_favourites_saved_meals_measurements.sql` | `food_favourites`, `saved_meals`, `saved_meal_items` | Owner-scoped CRUD; `grams`/`servings` DB `CHECK (> 0)` only, no ceiling | **The DB-level half of R4/F-1 is still open** |
| `019_drop_deprecated_tables.sql` | 4 wellness tables | Drops them | Applied; no residual code references |
| `028_streak_rescues.sql` | `streak_rescues` | Owner SELECT only, deliberately no user INSERT (admin client enforces Pro/allowance rules RLS can't express) | Live, correct |
| `030_food_dismissals.sql` | `food_dismissals` | Owner select/insert/delete, deliberately no UPDATE | Live; route correctly uses `ignoreDuplicates: true` |
| `034_foods_rls_ownership.sql` | `foods` | **The P0 fix.** `owns_custom_food()` prefix predicate replaces "signed in" | **CONFIRMED live and holding** |
| `044_subscriptions_rls_lockdown.sql` | `subscriptions` | **The second P0 fix.** Drops all write policies, keeps `subs_select` only | **CONFIRMED live and holding** |
| `046`/`047`/`048` | `weight_logs`, `exercise_logs`, `food_logs` | Idempotency columns + partial unique indexes | Live; all matching routes use `insertIdempotent` correctly |

## 3. Findings

Severity key: **P0** = security/data-loss, **P1** = major, **P2** = meaningful, **P3** = minor.

### F-1 (P1, OPEN, live) — `saved_meal_items.grams`/`servings` still unbounded
See `RISK-REGISTER.md` R4 for the full traced blast radius. Confirmed unfixed as of
2026-09-13; open since the 2026-09-05 adversarial audit.

### F-2 (P2, OPEN, live, NEW) — Build-time admin-client reads drop `error`, defeating the documented "fail loudly" guarantee
`app/sitemap.ts:19-24` and `app/foods/[slug]/page.tsx:48-54` both never destructure `error`
on their `hasAdminEnv()`-guarded reads. The guard's own documented intent (and CLAUDE.md's
hard rule) is that a *reachable-but-failing* Supabase must fail the Vercel build loudly — it
doesn't, here: `data` is `undefined`, `(data ?? []).filter(...)` silently returns `[]`, and
the build **succeeds** with zero food detail pages and zero sitemap entries for them, no
error anywhere. See `RISK-REGISTER.md` R17.

### F-3 (P3, OPEN, live, NEW) — `foods/custom` PATCH/DELETE reimplements ownership with a weaker predicate
`.includes(user.id)` (substring) instead of `isFoodReferenceableBy`/`owns_custom_food()`
(prefix). Not exploitable today — RLS backstops it via the session-scoped client, and a UUID
collision inside another `source_id` string is astronomically unlikely — but it's a third
divergent reimplementation of the exact rule the P0-2 cross-user-custom-food postmortem
exists to prevent. See `RISK-REGISTER.md` R24.

### F-4 (P3, OPEN, low severity, NEW) — Non-constant-time secret comparison on admin endpoints
`app/api/admin/seed-indian-foods/route.ts:24` and `app/api/admin/run-migrations/route.ts:54`
both use plain `!==` on the `SEED_SECRET` compare. Low real-world risk (not public-traffic
endpoints; network jitter swamps any timing signal over HTTPS), but `crypto.timingSafeEqual`
is cheap insurance on a secret gating a service-role-backed write path.

### F-5 (informational, NOT a security issue) — Low-stakes reads that drop `error`, fail-safe not fail-open
`lib/signupAge.ts:27` (analytics field only), `targets/suggestion` (degrades to no
suggestion), `paywall/projection` (degrades to `null` by documented design),
`camera/barcode`'s local-cache lookup (falls through to a fresh OFF fetch),
`foods/custom`'s ownership lookup (fails closed → 404). None of these fail **open** on a
security/business boundary the way the two real historical incidents
(`sendBudgetedPush`, push-reminders) did — listed for completeness, not as action items.

## 4. Confirm/deny the five specific claims tasked to this audit

**(a) `subscriptions` has exactly one RLS policy today (`subs_select`), no write policy.**
**CONFIRMED.** `044_subscriptions_rls_lockdown.sql` drops all three write policies; every
write site uses `createAdminClient()`. `tests/rlsPolicies.test.ts` pins this by static
analysis of the migration files — this is confirmed by reading the migration set, **not by
querying the live database**; a policy added by hand in the Supabase dashboard outside these
files would not be visible to this analysis or that test.

**(b) No Server Component anywhere dots into `ProLock.Card`/`ProLock.Chip`.** **CONFIRMED.**
7 real call sites found; the 2 Server Components (`app/recipes/page.tsx`, `app/deficit/page.tsx`)
both import the flat `ProLockCard`; all 5 Client Components use `ProLock.Card`/`.Chip`
correctly. `tests/proLock.test.ts` walks the same file set programmatically and agrees.

**(c) `saved_meal_items.grams`/`servings` bounds status.** **CONFIRMED still unbounded** — see
F-1 above.

**(d) `/api/logs` and `/api/exercise/logs` parse `start` before comparing to a cutoff, never
string-compare.** **CONFIRMED for both** — `Date.parse(start)` validated before use;
`clampHistoryStart` compares parsed instants, never raw strings. The `?start=epoch` bypass
this fixed is closed.

**(e) Every `source='user'` foods code path re-checks ownership fresh, never from a shared
cache.** **CONFIRMED across every path found** — `foods/search`'s shared cached query
excludes `source='user'`/`'estimate'` entirely and re-merges the caller's own rows via a
separate, **uncached** query on every request; every logging/favouriting/saving route calls
`isFoodReferenceableBy` fresh; both AI routes exclude `source='user'` from fuzzy name-match.
The one deviation is F-3 (a divergent *implementation*, not a cache), backstopped by RLS.

## 5. Auth-boundary findings from the auth-onboarding domain (cross-referenced here)

### Finding A (P0) — see `RISK-REGISTER.md` R2 for full detail
`middleware.ts:131-134`'s blanket "authenticated user on `/auth/*` → `/dashboard`" redirect
has no exception for `/auth/callback` or `/auth/reset-password`. This is an
**availability/correctness** bug (a designed flow silently no-ops) rather than a data-
exposure one, but it's filed here because the mechanism is the authorization middleware
itself and the fix touches the same file as every other auth-boundary rule in this report.

### Finding D (P2, matches documented audit F10) — JWT revocation lag on sign-out
`middleware.ts:31-36` skips `/api/*` entirely; API routes authenticate via `getClaims()`
(local signature check only, no live revocation). Signing out in one tab/device does not
stop a different tab/device's still-unexpired access token from continuing to write via API
routes. **Not a cross-user leak** — RLS still scopes every write to that token's own
`auth.uid()` — but "signed out" is not instantaneous everywhere the phrase implies.

## 6. Production PWA/middleware finding (OBSERVED, not CODE-REVIEWED-only)

See `RISK-REGISTER.md` R3 and `FEATURE-INVENTORY.md`'s PWA section for full detail. Filed
here because the root cause is the same `middleware.ts` matcher regex
(`middleware.ts:144`) that gates every other authorization decision in this app — the two
generated PWA worker files are simply missing from its exclusion list, so anonymous
requests for them are redirect-gated exactly like a protected page would be.

## Summary — no new cross-user data leaks or auth bypasses found

Every documented past P0 (`foods` cascade-delete RLS, `subscriptions` self-grant, camera
`pcs` fallback, cross-user custom-food visibility, `?start=epoch` history bypass) was
re-verified against current source and confirmed **still fixed**. The security posture of
this codebase is materially better than a typical pre-launch app — three prior full audits
have already closed every P0/P1 security finding they surfaced, and this pass found no new
one of that severity. The new findings here (F-2 through F-5) are real but bounded: one
content/SEO regression risk (F-2), two low-severity hygiene items (F-3, F-4), and a set of
fail-safe (not fail-open) swallowed errors (F-5) listed for completeness.

The two P0s that *are* new in this baseline (weight-trend string bug, PWA middleware
matcher) are **not security vulnerabilities** — they are correctness/availability bugs that
happen to route through the same files security logic lives in. They are tracked in
`RISK-REGISTER.md` as R1 and R3 respectively, not duplicated as security findings here
beyond the cross-reference above.
