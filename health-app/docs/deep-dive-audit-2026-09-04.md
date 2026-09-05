# GetInShape — deep-dive audit

**Date:** 2026-09-04 · **HEAD:** `92d587a` · **Branch:** `main` (clean at start and end)
**Scope:** every screen, every API route, the data plane, the test suite, and the product —
four lenses (QA, security/reliability, product, first-time user), one day after the previous
full audit closed.

---

## 1. Executive summary

**Verdict: not launch-ready as of this audit — two new P0s, both silent-wrong-data bugs, not
security holes.** Neither blocks the Play submission process itself (which per prior notes is
waiting on BillDesk merchant verification, not code), but both should be fixed before real users
hit them. Estimated gap: **1–2 days**, both fixes are localized.

The 2026-09-03 audit's two P0s (subscriptions self-grantable Pro, saved-combo wrong-day write) are
**confirmed fixed and holding** — re-verified against current source, not taken on trust. All 13 P1s
and 14 P2s from that audit are likewise confirmed fixed and holding, with one exception: the
**"Founder pricing — lock in ₹1,999/year" claim**, which that audit named in its §5 ("where the app
lies") but never gave a tracked finding ID, so it was never closed. It is still live today.

**The two new P0s, both found by static review and independently verified by re-reading the actual
code paths:**

1. **The camera's AI multi-food scan can silently log nutrition wrong by 10–100×, and the bad
   number gets permanently cached and reused.** When a scanned item is piece-counted (`pcs`) and
   isn't already in the food catalogue, and Gemini's per-item total is missing or fails a
   plausibility check, the code falls back to treating a **per-100-gram** estimate as if it were
   **per-100-piece** — so "6 hot wings" at ~250 kcal/100g logs as ~15 kcal for the whole plate. This
   directly undermines the "nutrition guardrails" work that shipped as recently as today's merged
   PR #73, on the app's flagship (Pro-only) AI feature.
2. **A custom food is visible, searchable and loggable by every user, not just its creator — and
   deleting your own custom food can silently delete a stranger's diary entry that logged it.**
   `foods_select` RLS is deliberately open to all authenticated users (correct, for the shared
   catalogue), but the search route only excludes `source='estimate'` rows from other users, never
   `source='user'` (custom-food) rows. Any user's custom food surfaces in anyone's search (labelled
   "👤 Custom", which is simply false for the finder), can be logged by them, and then
   `food_logs.food_id REFERENCES foods(id) ON DELETE CASCADE` means the *original creator deleting
   their own food* — completely ordinary behaviour — silently wipes the other person's log row.

Three new P1s, all instances of failure modes this codebase has fixed before in other files but
missed here: a fourth occurrence of the "swallowed Supabase error" bug class
(`generateMonthlyWraps`, could duplicate a push or silently process zero users), the legacy Stripe
webhook not checking write results at all (unlike the already-fixed Razorpay/Play webhooks), and
the visual audit's `BottomNav`-vs-keyboard item from 2026-09-04 still being open.

**What this audit could not do:** no authenticated session was available (this agent does not sign
in or type passwords), so Phases 4–5's runtime/adversarial passes are limited to what's reachable
unauthenticated. Everything below marked "code-reviewed" needs one session on `+qa1`/`+qa2` to
become "observed." See §10.

---

## 2. Gate results

Real numbers from the terminal.

| Gate | Result | Note |
|---|---|---|
| `npm test` | ✅ **95 files / 1,419 tests passed** | 33.78s. `TESTING.md` (89/1,334) and `docs/refactor-safety-contract.md` (89/1,334) are both stale — see P2 finding below. |
| `npx tsc --noEmit` | ✅ clean, exit 0 | Run after the build, per the stale-`.next/types` trap. |
| `npm run lint` | ✅ "No ESLint warnings or errors" | |
| `npm run check:tokens` | ✅ `0 violation(s) across 0 file(s)` | Spacing advisory unchanged: 53 across 20 files, baseline 53. |
| `npm run build` | ✅ clean | 91.6s, **520 static pages** (445 `/foods/[slug]`). |

**Build warning (benign, same as last audit):** `Module not found: ESM packages
(@apm-js-collab/tracing-hooks/hook-sync.mjs)` inside `@sentry/server-utils`, reached via
`@sentry/nextjs`. Third-party, not actionable, noise on every build.

**Tree stayed clean after the build** — confirms the `public/sw.js` gitignore fix (2026-09-04) is
still holding; `git status --short` was empty before and after.

---

## 3. Test-suite quality (Phase 2)

**Sabotage-tested five load-bearing pure functions myself, in a scratch edit reverted immediately
after:**

| Mutation | File | Result |
|---|---|---|
| TDEE 1,200 kcal floor → 1,000 | `lib/tdee.ts` | 🔴 caught (1 test) |
| Streak freeze cap (`MAX_FREEZES_BANKED`) 2 → 99 | `lib/streak.ts` | 🔴 caught (2 tests) |
| `istDaysAgoStart` off-by-one (`d - (days-1)` → `d - days`) | `lib/dateUtils.ts` | 🔴 caught (2 tests) |
| AI trial `remaining` calc `limit - used` → `limit - used + 5` | `lib/aiTrial.ts` | 🔴 caught (11 tests, cascading into `routeAiGate`/`routeAiScansRemaining`) |
| `SOURCE_RANK` reversed (`ifct: 6→1`, `curated: 1→6`) | `lib/foodMatch.ts` | 🔴 caught (25 tests, cascading into search/merge/suggest) |

**All five caught, 41 failing tests total, cascading correctly across dependent modules** (a
mutation to `foodMatch.ts`'s source ranking broke tests in `searchRanking`, `curatedFoods`,
`foodSynonyms`, `mealSuggest`, `mergeSearchResults` and `foodMatch` itself — real coupling, not
brittle duplication). Reverted cleanly; `git status --short` confirmed empty afterward.

**14 `lib/` modules have no test importer at all — unchanged from the 2026-09-03 audit** (same
exact list, re-derived independently): `chat-prompt.ts`, `foodVisual.ts`, `indian-portions.ts`,
`logActivation.ts`, `merchant.ts`, `play/google-auth.ts`, `posthog/client.ts`, `push/client.ts`,
`razorpay/client.ts`, `razorpay/plans.ts`, `stripe/client.ts`, `supabase/client.ts`, `utils.ts`,
`verifyPromptStore.ts`. Of these, `logActivation.ts` (runs on every log, resolves the paywall
threshold per cohort) and `merchant.ts` (single source of the merchant identity a payment
aggregator verifies) remain the two gaps worth closing; the rest are thin SDK constructors or low
in isolation, as the prior audit judged.

**Tests I would write first**, ranked (updates the 09-03 list with what this audit actually found):

1. A test asserting `generateMonthlyWraps`'s three batched reads fail loud on error — would have
   caught this audit's new P1.
2. A test that logs a `pcs` food with no DB match and a Gemini response missing `total_kcal` —
   would have caught this audit's new P0-1 (the fallback returns a wrong-but-plausible-looking
   number, so nothing currently exercises that exact branch with an assertion on the resulting
   `kcal_per_100g`).
3. A test that two accounts can't see or log each other's `source='user'` rows via search — would
   have caught this audit's new P0-2.
4. A `subscriptions` write-error test for the Stripe webhook, matching the ones that already exist
   for Razorpay/RTDN.
5. A live-Postgres RLS test suite (`supabase start` + two real users) — still the only test class
   that would catch a policy that's a *correct ownership predicate scoped wider than any code needs*
   (`foods_select`'s open-to-all SELECT is exactly this shape, and it's the mechanism behind P0-2).

---

## 4. Findings

Severity: **P0** blocks launch (broken, data-loss, security, money, or a false public claim) ·
**P1** damages trust, retention or conversion · **P2** polish. Every finding was independently
verified against the source by me (not taken on a subagent reviewer's word) — file:line, the
downstream math, and the actual RLS/schema text were all re-read before anything below was written.

| ID | Sev | Finding | Repro | Evidence | file:line | Conf |
|---|---|---|---|---|---|---|
| **P0-1** | **P0** | **Camera AI scan can silently log a piece-counted food's calories wrong by 10–100×, permanently.** When a scanned item's unit is `pcs`, no existing DB row matches its name, and Gemini's `total_kcal`/`total_protein_g`/etc. are missing or fail the Atwater/per-piece plausibility check, `resolveNutrition()` returns its `fallback` object unchanged — which still carries `kcal_per_100g` as a **per-100-gram** figure (from `item.kcal_per_100g`) alongside `portion` = the **piece count**. The route then upserts a new `estimate` food row with `serving_size_g: <piece count>` and `kcal_per_100g: <per-100g figure>` verbatim, and `/api/logs/add-bulk` computes `kcal = food.kcal_per_100g * (grams/100)` where `grams` is actually the piece count. | Photograph a piece-counted item not in the catalogue (any branded/restaurant wings, samosas, momos) where Gemini can't produce a confident per-piece total. 6 wings at 250 kcal/100g logs as `250 × 6/100 = 15 kcal` for the whole plate instead of ~900. If the per-100g fields are near-zero instead, the item logs as **0 kcal** with no warning. | `lib/camera-nutrition.ts:107-166` (`return fallback` at :165); consumed at `app/api/camera/analyze/route.ts:290-322` (writes `kcal_per_100g: round1(n.kcal_per_100g)` and `serving_size_g: Math.round(n.portion)` into a new row with no unit-mismatch check); math confirmed at `app/api/logs/add-bulk/route.ts:48,55` (`factor = item.grams/100; kcal = food.kcal_per_100g * factor`). `tests/camera-nutrition.test.ts:97-101` documents the fallback exists but never asserts its numbers are safe to use — it only checks `fromServingTotal === false`. | `lib/camera-nutrition.ts:165` | **high** — traced the exact code path and the downstream arithmetic myself; not exploited live (no camera access without a session) |
| **P0-2** | **P0** | **A custom food is globally visible and loggable, and its owner deleting it can silently delete another user's diary entry.** `foods_select` (`001_initial.sql:146`) is `USING (auth.uid() IS NOT NULL)` — deliberately open to every signed-in user for the shared catalogue, and `034_foods_rls_ownership.sql` only ever restricted INSERT/UPDATE/DELETE, never SELECT (its own comment says so: "`foods_select` is intentionally untouched"). The search route (`app/api/foods/search/route.ts:185`) excludes `.neq('source', 'estimate')` but has **no equivalent exclusion for `source='user'`**, and its `ilike` match means any other user's custom food can surface on an ordinary partial-word search, not just an exact-name collision. `lib/foodMatch.ts`'s `SOURCE_RANK` table doesn't even list `'user'` (falls to rank 0) — reads as an oversight, since the identical problem *was* solved for `'estimate'` rows (excluded from shared results, later re-merged scoped to the current user only). | User A creates a custom food ("Amma's Curry", Pro-gated, via `POST /api/foods/custom`). User B searches "curry" and gets User A's row back, badged **"👤 Custom"** (`components/log/FoodResult.tsx:10-13`, comment: *"a food you made"* — false for User B) — and logs it. `food_logs.food_id` now references User A's row. User A later deletes their own food (ordinary cleanup) via `DELETE /api/foods/custom` — the ownership check passes correctly, it *is* their row — and `food_logs.food_id REFERENCES foods(id) ON DELETE CASCADE` (`001_initial.sql:54`) silently deletes User B's log entry too, no error, no notice to either party. | `app/api/foods/search/route.ts:185` (missing filter); `supabase/migrations/001_initial.sql:146` (`foods_select`), `:54` (the CASCADE FK); `034_foods_rls_ownership.sql:87-88` (comment confirming SELECT was deliberately left open); `app/api/foods/custom/route.ts:110-136` (the cascade-triggering DELETE, itself correctly ownership-checked); `components/log/FoodResult.tsx:10-13` (the now-false "Custom" badge). | `app/api/foods/search/route.ts:185` | **high** — every step of the chain read and confirmed against current source; this is exactly the bug class (`034`'s own lesson: "a row being yours does not mean every column of it is yours to assert") applied to visibility rather than to a write |
| **P1-1** | P1 | **`generateMonthlyWraps` swallows errors on all three of its batched reads — a fourth instance of this codebase's most recurrent bug class.** `Promise.all([...])` destructures `{data: logs}`, `{data: weights}`, `{data: done}` with no `error` check, ~90 lines below a comment in the *same file* explaining exactly why this is dangerous for the weekly recap's own reads (which were fixed for this in the 2026-09-03 audit). If the `monthly_wraps` ("already wrapped") read fails, every already-wrapped user becomes a candidate again and gets a **second** "Your Month is ready" push; if the `food_logs` read fails, the run silently processes **zero** users while still reporting a clean-looking response. | Force either read to fail (transient DB error) during the monthly-wrap branch of the Sunday cron. | `Promise.all` at `app/api/cron/weekly-recap/route.ts:187-193`; contrast the two checked reads twelve lines earlier in the same file (the weekly-recap reads, fixed 2026-09-03). No test file references `generateMonthlyWraps`/`monthly_wraps`/`alreadyWrapped` — nothing pins this once fixed. | `app/api/cron/weekly-recap/route.ts:187` | **high** |
| **P1-2** | P1 | **The legacy Stripe webhook doesn't check any of its three write results at all** — worse than a swallowed destructure, the return value isn't even captured (`await admin.from('subscriptions').upsert({...})` with nothing on the left of `=`). Razorpay's webhook and Play's RTDN were both explicitly fixed for this exact class in prior audits, with a comment in the Razorpay file spelling out the failure mode; the fix was never carried to the third (legacy but still-live) webhook. | Simulate a Supabase write failure during a `customer.subscription.deleted` or `invoice.payment_failed` event for a legacy Stripe subscriber. Stripe gets 200, never retries, and the row keeps its old (Pro) status forever — a cancelled legacy subscriber silently stays Pro; a failed-payment one is never flagged `past_due`. | `app/api/stripe/webhook/route.ts:48,74,91` — confirmed by direct read, no `{ error }` destructure or check on any of the three `admin.from('subscriptions')` calls. | `app/api/stripe/webhook/route.ts:48` | **high** |
| **P1-3** | P1 | **`BottomNav` still doesn't account for the on-screen keyboard** — confirmed still open from the 2026-09-04 visual audit (`docs/visual-audit-2026-09-04.md` P1-3), which explicitly deferred it pending a design call from Adarsh on a real device (float above the keyboard vs. hide while typing). `components/layout/BottomNav.tsx:63` is still `fixed inset-x-0 bottom-0` with no reference to `--kb-inset` anywhere in the file, while every sheet in the app was taught to respect that variable in the same week's PRs. | Focus any page-level text input (not inside a sheet) on iOS/Android with the keyboard up; the 4-tab + FAB primary navigation sits behind the keyboard. | `grep -n "kb-inset" components/layout/BottomNav.tsx` → no matches. | `components/layout/BottomNav.tsx:63` | **high** on the code state; the actual on-device feel is unverified by this audit (needs a phone, as the visual audit already said) |
| **P1-4** | P1 | **"Founder pricing — lock in ₹1,999/year while we're new" has no locking mechanism, and this was already named (but never closed) by the previous audit.** `lib/pricing.ts`'s `PRICE_ANNUAL` is a plain string constant with no cohort key and no code path that pins a subscriber's rate at signup time — the same pattern that correctly protects the free-tier cohort (`lib/freeTier.ts`) doesn't exist for price. If the annual price is ever raised, every "locked-in" subscriber renews at the new rate with nothing preventing it. The 2026-09-03 audit's §5 ("where the app lies to the user") named this exact copy but never gave it a finding ID, so it was never added to that audit's tracked "fix status" table and never closed. | Read `app/upgrade/page.tsx:224` against `lib/pricing.ts` — no subscription-row field, migration column, or renewal-time check ties a user's rate to their signup date. | `app/upgrade/page.tsx:224`; `lib/pricing.ts:19` | `app/upgrade/page.tsx:224` | **high** |
| **P2-1** | P2 | **A TOCTOU race lets a user exceed the 3-lifetime-scan AI trial by a small margin.** `checkAiTrial`'s count read and `recordAiUsage`'s later insert are unlocked and unserialized; two near-simultaneous requests (two tabs, a fast double-submit) can both read the same pre-scan count, both pass, both spend a Gemini call. CLAUDE.md states the AI limit is "server-enforced and fail closed" — true per-request, not true concurrently. | Fire two `POST /api/chat/analyze` (or camera) requests back to back with `usedCount` one below the cap; both succeed. | `lib/aiTrialServer.ts:23-63`, write side `lib/usageCounter.ts:23-33` — no row lock or unique constraint serializes the read against the write. | `lib/aiTrialServer.ts:51` | **medium** — plausible mechanism, bounded impact (typically 1-2 extra calls) |
| **P2-2** | P2 | **`editFoodLogSchema` has no upper bound on `kcal`/`protein_g`/`carbs_g`/`fat_g`** — the one macro-accepting path that doesn't recompute server-side or cap the client-supplied number, unlike `addFoodSchema`, `quick-add` (capped 5000/500/500/1000), and `add-bulk`/`meals/log` (both recompute from the food row). Self-scoped to the caller's own row, so not a cross-user issue, but it can corrupt the caller's own deficit, streak, Trends, weekly-recap and Wrapped stats — the last of which feeds a number into a Gemini prompt. | `PATCH /api/logs/edit` with `{"kcal": 999999999, "protein_g": 0, ...}` on your own log id is accepted. | `lib/validations.ts:102-115` | `lib/validations.ts:102` | **high** |
| **P2-3** | P2 | **`streak/rescue` authorizes an RLS-bypassing admin-client write using the fast, non-revalidating auth check.** `getAuthedUser()` (`lib/supabase/server.ts`) uses `getClaims()` — local signature/expiry only, no live revocation check — and the route's own comment justifies this pattern by saying RLS is the backstop; but this route's write goes through `createAdminClient()` specifically because `streak_rescues` has no user INSERT policy, so RLS provides no backstop here. Every other admin-client route authorizing a sensitive write (`chat/analyze`, `camera/analyze`, `razorpay/verify`, `account/delete`, …) uses the fully-revalidated `getUser()`. Low impact (spending your own monthly rescue allowance with a stale token), but it's the one place the documented two-tier auth argument doesn't hold. | Code review — a revoked-but-unexpired token would still spend a rescue. | `app/api/streak/rescue/route.ts:24-25`; `lib/supabase/server.ts:35-52` | `app/api/streak/rescue/route.ts:24` | **medium** |
| **P2-4** | P2 | **Barcode scan silently falls back to an id-less, un-persisted food object on a DB write failure.** `app/api/camera/barcode/route.ts:82-88` doesn't check `error` on the upsert; if it fails, the route returns the raw pre-insert `row` (no `id`), which the client treats as a real `Food` — any attempt to log it then fails Zod's `food_id: uuid()` validation with an opaque "Log failed" toast and no Sentry signal pointing at the real cause. | Code review — force the upsert to fail (RLS hiccup, transient DB error). | `app/api/camera/barcode/route.ts:82-88` (unchecked `{ data: inserted }`), also `:17` (milder version, unchecked `{ data: existing }`) | `app/api/camera/barcode/route.ts:82` | **medium** |
| **P2-5** | P2 | **Open Food Facts persistence in search silently drops results on a DB read/write failure**, without the shorter-TTL degraded-cache handling that already protects against an OFF *network* failure. `existing`/`inserted` reads at lines 130/139 are unchecked; on failure, `toInsert` may re-attempt rows that already exist (a plausible unique-constraint failure, itself silently dropped), and the search response just loses its packaged-food contribution with no Sentry visibility. Lower severity: `myEstimateLogs` at line 297 (unchecked) only omits the current user's own AI-logged foods from their own results — cosmetic. | Code review — force a `foods` read/write to fail during a search that would otherwise persist new OFF rows. | `app/api/foods/search/route.ts:130,139,297` | `app/api/foods/search/route.ts:130` | **medium** |
| **P2-6** | P2 | **Most PostHog emit sites bypass the frozen `EVENTS` catalog with bare string literals**, against CLAUDE.md's explicit rule ("event names come from `EVENTS` — never a bare string"). Of 43 `captureEvent(...)` sites, only 15 use `EVENTS.KEY`; the rest (`AdaptiveTargetCard.tsx:58`, `PlateauCard.tsx:61`, `useCheckout.ts:159/169/183`, `app/upgrade/page.tsx:98/108`, 4 sites in `LogMilestones.tsx`, more) pass raw strings. Functionally harmless today — the strings happen to match — but a typo in a bare string ships silently where `EVENTS.KEY` would fail `tsc`. The 09-03 audit's dead-event sweep checked "does every constant have a live emit site," not "does every emit site use the constant," so this drift went unnoticed. | `grep -rn "captureEvent('" app components hooks` vs `grep -c "EVENTS\." ...` | 24+ of 43 call sites | `components/dashboard/AdaptiveTargetCard.tsx:58` (example) | **high** |
| **P2-7** | P2 | **`TESTING.md` and `docs/refactor-safety-contract.md` both understate the test suite a second time** (89 files / 1,334 tests vs the real 95/1,419), the same doc-rot class the 09-03 audit already flagged once for a different pair of numbers. `docs/visual-audit-2026-09-04.md` says "1410 tests" with no file count — closer, but still off by 9. Most likely cause: the chat-log-AI-accuracy PR stack (#73, merged today) added tests after these docs were last touched. | Compare doc text to `npm test` output. | `TESTING.md:10`; `docs/refactor-safety-contract.md:63`; `docs/visual-audit-2026-09-04.md:7` | `TESTING.md:10` | **high** |
| **P2-8** | P2 | **Razorpay refunds never emit `subscription_refunded`**, while Play's do — a documented, honest TODO (`// TODO(growth-audit): wire subscription_refunded for Razorpay`), not a landmine, but a live gap: Razorpay's `refund.created` event carries a payment id, not a subscription id, and the lookup to resolve the subscriber was never built, so the handler's switch statement has no case for it at all. Razorpay is the *web* (non-TWA) provider — likely the larger share of refunds — so any refund-rate metric built on this event silently undercounts. | `grep -n "refund" app/api/razorpay/webhook/route.ts` → TODO comment, no handling case. | `app/api/razorpay/webhook/route.ts:99` | `app/api/razorpay/webhook/route.ts:99` | **high** |
| **P2-9** | P2 | **`P2-1` and `P1-2` from the 2026-09-04 visual audit remain only partially addressed.** Corner-radius drift: 79 → 59 arbitrary `rounded-[...]` values (real improvement, not resolved). Spacing drift: baseline unchanged at 53 arbitrary values across 20 files (`npm run check:tokens` advisory). Press-feedback (`P2-3` in that audit): `components/ui/button.tsx:7` now bakes `tap-scale` in as a base class — the "durable fix" the audit suggested — so any component using the shared `<Button>` primitive is covered by default; raw non-primitive `<button>` elements (144 total in the app, per the visual audit's own count) may still lack it, not independently re-swept here. | `grep -c "rounded-\[" app components --include=*.tsx` → 59 (was 79). `check:tokens` spacing baseline → 53 (unchanged). `grep -n "tap-scale" components/ui/button.tsx` → present. | | `tailwind.config.ts:79-88` | **high** on the counts, **medium** on whether the remaining raw buttons are covered |
| **P3-1** | P3 | `razorpay/verify` relies on a DB unique-constraint 500 rather than an explicit ownership check before upserting a subscription — unlike `play/verify`, which explicitly checks and returns a clean 409. **Not exploitable**: `022_razorpay_billing.sql` puts a unique index on `razorpay_subscription_id` and `subscriptions.user_id` is the primary key, so a replayed signature from a second account still collides and 500s with a raw Postgres error string leaked to the client — an ugly failure, not a security hole. | Code review; constraint confirmed in migration `022`. | `app/api/razorpay/verify/route.ts:46-59` | `app/api/razorpay/verify/route.ts:46` | **high** |
| **P3-2** | P3 | `?end=` on `/api/logs` and `/api/exercise/logs` is never validated (only `?start=` is, per the P1-1 fix from 2026-09-03). Not exploitable for the free-tier bypass that fix addressed (only the lower bound gates that); a garbage value most likely just 400s from Postgres. | Code review. | `app/api/logs/route.ts:22,53`; `app/api/exercise/logs/route.ts:17,44` | `app/api/logs/route.ts:22` | **medium** |
| **P3-3** | P3 | Shared-secret comparisons (`SEED_SECRET`, `PLAY_RTDN_SECRET`) use plain `!==` rather than a constant-time compare. Theoretical timing side-channel only; secrets are long random strings on cold endpoints. | Code review. | `app/api/admin/run-migrations/route.ts:54`; `app/api/admin/seed-indian-foods/route.ts:24`; `app/api/play/rtdn/route.ts:26` | `app/api/admin/run-migrations/route.ts:54` | **medium** |
| **P3-4** | P3 | `ChatLogModal`'s "Log N items" has no explicit re-entrancy guard, unlike `useCameraScan.logFood`'s explicit `if (logging || ...) return` + disabled button. In practice a true double-submit is unlikely because React commits the state transition before a second tap can land, but it's an inconsistent, unguarded sibling to an explicitly-guarded path. | Code review. | `hooks/useChatLog.ts:147-185` vs `hooks/useCameraScan.ts:330-393` | `hooks/useChatLog.ts:150` | **medium** |
| **P3-5** | P3 | AI-returned `meal` value is type-cast, not validated, before being used (`(data.meal?.toLowerCase() ?? mealForTime()) as Meal`). If Gemini ever returns something outside the four valid values, the meal-selector UI shows nothing selected and the eventual submit gets a confusing raw Zod error rather than a graceful fallback. `add-bulk`'s schema correctly rejects it server-side either way — not a data-corruption risk, a UX robustness gap. | Code review. | `hooks/useChatLog.ts:124` | `hooks/useChatLog.ts:124` | **medium** |

---

## 5. Regression check — the 2026-09-03 audit's findings

Its two P0s plus a sample of five P1s, re-verified against current source (not re-taken on trust).

| Prev. ID | Finding then | Verdict now | Evidence |
|---|---|---|---|
| **P0-1** | `subscriptions` self-grantable Pro via open INSERT/UPDATE/DELETE policies | ✅ **FIXED and holding.** `044_subscriptions_rls_lockdown.sql` drops all three; `subs_select` is the only remaining policy; no migration since touches it. Every write path (6 call sites: razorpay verify/cancel/webhook, play verify/rtdn, stripe webhook) confirmed on `createAdminClient()`. | `supabase/migrations/044_subscriptions_rls_lockdown.sql` |
| **P0-2** | Saved combo on a past day silently files on today (`DEFAULT now()`) | ✅ **FIXED and holding.** `/api/meals/log` accepts an optional `date`, routes through `resolveLoggedAtForRequest`, never falls back to the DB default; `FoodLanding`'s combo block now sends `date`. | `app/api/meals/log/route.ts`; `components/log/FoodLanding.tsx` |
| **P1-1** | `?start=epoch` defeats the free-tier history clamp via lexicographic string comparison | ✅ **FIXED and holding.** `clampHistoryStart` compares parsed instants and 400s any unparseable `start`, for every tier, in both `/api/logs` and `/api/exercise/logs`. | `lib/dateUtils.ts:134-139` |
| **P1-4** | Push budget (`push_sends`) fails open on a read error | ✅ **FIXED and holding.** Both reads in `budgetedSend.ts` check `error` and fail closed (`skipped: 'budget_unreadable'`). | `lib/push/budgetedSend.ts:57-59` |
| **P1-6** | Weekly-recap Gemini call has no timeout | ✅ **FIXED and holding.** `AbortSignal.timeout(20_000)` present. | `app/api/cron/weekly-recap/route.ts:288` |
| **P1-12** | `PRO_FEATURES` sells "No ads, ever" (free has no ads either) and omits streak rescue/month deficit/suggestions | ✅ **FIXED and holding.** "No ads" removed; the three real benefits are listed and match server enforcement. | `lib/planFeatures.ts:42-50` |
| **P1-13** | Coaching line wired only to the two AI-gated surfaces, unreachable by most free users | ✅ **FIXED and holding.** `AddFoodModal` now fires `coachingLine` with `targets` threaded from `app/log/page.tsx`; `tests/coachingWiring.test.ts` pins it. | `components/log/AddFoodModal.tsx` |

**Nothing that was fixed has regressed.** One item from that audit's own §5 ("where the app lies")
was never formally tracked and is still open — see **P1-4** in §4 above (founder pricing).

---

## 6. Coverage gaps

See §3 for the sabotage results and the untested-module list (unchanged from the prior audit — 14
modules, same list, no new gaps and no closed ones).

---

## 7. The four product tables

**Carried forward from the 2026-09-03 audit's product review** (`docs/deep-dive-audit-2026-09-03.md`
§6), re-verified rather than re-derived: nothing product-facing has shipped since — the last 24
commits are bug fixes and UX polish (chat nutrition guardrails, camera multi-food logging, overlay
Back-button dismissal, keyboard-inset detection), not new features or removed ones. I spot-checked
the two items that audit's Table 3 recommended cutting and confirmed **neither has been cut**: meal
context tags (`lib/mealContext.ts`, still wired into `AddFoodModal`/`EditFoodLogModal`/
`ProgressClient`) and the badge shelf (`components/progress/BadgeShelf.tsx`, still present) are both
still shipping as of this audit. The full four tables, the "necessary and working" / "necessary but
weak" / "cut, hide or merge" / "missing" breakdown, and the effort/tier estimates in that document
stand unchanged and are not reproduced here to avoid duplicating a document that is one day old and
still accurate — see `docs/deep-dive-audit-2026-09-03.md` §6 for the full tables.

**One update worth naming explicitly:** the coaching-line fix (this audit's regression-check P1-13)
means Table 2's top complaint from the prior audit — "a free user logging by search never sees a
coaching sentence" — is resolved. That was the prior audit's #1 recommended next feature (§8, item
5) and it has shipped. The next item on that list, "build the Pro weekly pattern from the coaching
data," has not.

---

## 8. Direct answers

Reusing the prior audit's structure, updated only where this audit's findings change the answer.

**1. Is Pro worth ₹299/month today?** Unchanged verdict: **not yet, but closer than a day ago.** The
coaching line now fires for everyone (a free-tier improvement, which paradoxically makes the free
tier *more* competitive with Pro, not less — Pro still needs its own headline capability). The two
new P0s in this audit both land specifically on **paid** surfaces (AI camera scan is Pro-gated after
the trial; custom foods are Pro-only) — a paying user is more likely to hit the wrong-nutrition bug
than a free one, since AI scanning is the thing they're paying for.

**2. Why won't a new user come back?** Unchanged from the prior audit's answer (day-2/day-7/week-4
analysis) — nothing in this audit's findings changes that story. One addition: if a paying user's
first AI scan of a piece-counted food lands on the P0-1 bug, the number is wrong in a way that
*looks* plausible (15 kcal for a plate of wings reads as "obviously broken," but a milder version of
the same bug — say 40% low instead of 90% low — would read as a small counting slip and quietly
erode trust in every other AI-scanned number afterward).

**3. The one feature to build next.** Unchanged from the prior audit: **the Pro weekly pattern**
built from the (now-fully-wired) coaching data. Still the right call — nothing in this audit argues
against it, and the coaching-line prerequisite it depended on has now shipped.

**4. What to cut entirely.** Unchanged: meal context tags, the badge shelf, `/wrapped`'s current
form — see §7.

**5. Where does the app lie to the user?** One item, carried forward and now formally tracked for
the first time: **"Founder pricing — lock in ₹1,999/year"** (P1-4, §4) has no mechanism behind the
word "lock." Not currently false (the price hasn't moved), but it's a promise the code can't keep if
it ever does.

**6. First-run, as a 32-year-old in Pune who has never tracked calories.** Unchanged from the prior
audit's walkthrough up through the first successful search-logged meal. One new wrinkle if their
first log happens to be a camera scan of a piece-counted restaurant item: the number that appears
may be silently wrong (P0-1), and nothing in the UI would tell them.

---

## 9. Top 10, ranked — the order I would do these in

| # | Do this | Why now | Effort |
|---|---|---|---|
| **1** | **Fix the `pcs` fallback in `lib/camera-nutrition.ts`.** When `unit === 'pcs'` and the serving-total branch doesn't produce a plausible result, either refuse to log the item (surface "couldn't estimate this one" instead of a number) or treat the per-100g fields honestly by dividing by an assumed grams-per-piece rather than writing them straight through as per-100-piece. | **P0-1.** Silent 10–100× wrong nutrition on the app's flagship paid AI feature, permanently cached via `onConflict` upsert so it compounds on repeat scans of the same item. | **S** (a few hours — the fix is localized to one function plus a guard in the route) |
| **2** | **Exclude `source='user'` from other users' search results** (`app/api/foods/search/route.ts:185`, mirror the existing `estimate` handling: exclude globally, re-merge scoped to `food_logs.user_id = current user` only if you want a user to find their own custom foods in search). Add `'user'` to `SOURCE_RANK` for completeness. | **P0-2.** A silent, ordinary-behavior-triggered cross-user data loss — exactly the bug class two prior migrations (`034`, `044`) already exist to prevent, just applied to visibility instead of writes. | **S** (a few hours — one filter change plus a re-scoped join, following the `estimate` precedent already in the same file) |
| **3** | **Add the missing `error` checks to `generateMonthlyWraps`'s three reads** (`app/api/cron/weekly-recap/route.ts:187-193`), matching the pattern twelve lines above in the same file. Add a test. | **P1-1.** Fourth recurrence of this codebase's most persistent bug class; cheap, mechanical fix. | **S** (1 h) |
| **4** | **Check every `subscriptions` write in `app/api/stripe/webhook/route.ts`** and 500 on failure, matching Razorpay/RTDN. | **P1-2.** A cancelled legacy subscriber can stay Pro forever on a transient blip; low-traffic surface (Stripe is legacy) but the fix is trivial and the class is exactly what two other webhooks were already hardened against. | **S** (1 h) |
| **5** | **Decide and implement the `BottomNav`-vs-keyboard behaviour** (hide while typing is the visual audit's likely recommendation) — this is a design call for Adarsh, not a blind fix. | **P1-3.** Carried over from the 2026-09-04 visual audit, still open, still needs a device. | **S** once decided |
| **6** | **Either build the founder-pricing lock (store the rate on the subscription row at signup) or drop the "lock in" wording.** | **P1-4.** A promise with no mechanism; cheap either way, and the previous audit already named this without closing it — don't let it slip a third time. | **S** (copy fix) or **M** (real lock) |
| **7** | **Bound `editFoodLogSchema`'s kcal/protein/carbs/fat**, matching the pattern already used everywhere else (`quick-add`'s caps, or the `HEIGHT_CM`/`WEIGHT_KG` shared-constant pattern). | **P2-2.** Self-scoped but can corrupt a user's own derived stats, including what gets fed into a Gemini prompt for their own Wrapped. | **S** (30 min) |
| **8** | **Swap `getAuthedUser()` for `getUser()` in `app/api/streak/rescue/route.ts`.** | **P2-3.** One-line change, closes the one place the fast-auth-check argument doesn't hold. | **S** (5 min) |
| **9** | **Migrate the 24+ bare-string `captureEvent` call sites to `EVENTS.KEY`**, and consider a lint rule (the same mechanism that already enforces the IST-formatting ban) to keep it closed. | **P2-6.** Currently harmless, but it's a hard rule silently not holding, and the failure mode (a typo shipping silently) is exactly what the rule exists to prevent. | **M** (mechanical, ~2 h with lint rule) |
| **10** | **Update `TESTING.md` and `docs/refactor-safety-contract.md`'s test counts**, and fix the barcode-scan and OFF-search silent swallows (P2-4, P2-5) in the same pass since they're the same bug shape as #3/#4. | **P2-7/P2-4/P2-5.** Doc rot compounds (this is the second time in two audits); the two remaining swallows are low-traffic but cheap to close while the pattern is fresh. | **S** (1-2 h combined) |

Fold in as ten-minute jobs alongside any of the above: the Razorpay `subscription_refunded` gap
(P2-8, needs a payment-id→subscriber lookup so it's actually **M**, not ten minutes — flagging the
gap in `docs/billing.md` is the ten-minute version), the `?end=` validation (P3-2), constant-time
secret comparisons (P3-3), the `ChatLogModal` re-entrancy guard (P3-4), and the AI-meal-value
validation (P3-5).

---

## 10. False alarms discarded

Two of my own this session — recording them because a report that only accumulates findings is a
report nobody checked.

| Claimed | Verdict | Why it was wrong |
|---|---|---|
| **The Design Studio's `/studio` "Home" mockup shows `EATEN 0 of 1,800 kcal` while the ring is ~70% filled and "Today's meals" totals 1,264 kcal** — looked like a live inconsistency bug on first screenshot. | **False positive — killed by me.** | Traced `StudioRing`'s digit to `useCountUp`, which is `requestAnimationFrame`-driven (`hooks`/`components/home/CalorieHeroCard.tsx:31`). CLAUDE.md documents explicitly that rAF never fires in this browser-pane tooling. The ring's fill percentage comes from a separate, non-rAF `mounted` state flip, which is why the ring itself rendered correctly while only the animated digit stuck at its initial 0. Exactly the class of tooling artifact a prior audit's intro caveat already warned about ("0 kcal eaten hero number... was rAF/toast-timing artifact"). |
| **`www.getinshape.co.in` appeared to redirect *to* the bare apex domain** when navigated to directly in the browser pane (the tab's resulting origin read `getinshape.co.in`, backwards from the documented canonical-www behaviour). | **Refuted — tooling artifact, not the app.** | `curl -I https://getinshape.co.in/` confirms the real server-side behaviour is correct: apex 308s to `https://www.getinshape.co.in/`, exactly as `twa-manifest.json` and the launch docs require. The browser pane's `navigate` tool appears to normalize/strip the `www.` prefix on input in a way that doesn't reflect what the server actually returns; curl is the ground truth here. |

---

## 11. What I could not test, and what I need from you

I never type passwords or sign in, so every authenticated flow is out of reach until a session is
available. This is a larger gap than in the 2026-09-03 audit, which at least had `+qa1`/`+qa2`
context from prior sessions to reason from — this session had none, so everything below is either
untested or code-reviewed-only, not "verified statically then spot-confirmed live."

| Untested | What I need |
|---|---|
| **Both new P0s, live** | A session. P0-1 needs photographing a piece-counted item Gemini can't confidently total (a branded snack pack of samosas/wings not in the catalogue is the fastest repro). P0-2 needs two accounts: one Pro (to create a custom food), one any-tier (to find and log it via search), then the first deleting it. |
| Food-search quality matrix (18 queries from `TESTING.md`) | A session — `/api/foods/search` correctly 401s unauthenticated. |
| Day-boundary behaviour at 23:55/00:05 IST, and in non-IST device timezones | A session + clock/timezone control. |
| Streaks, freezes, Pro Streak Rescue, milestone overlays, badge shelf | A session on `+qa1` (needs history). |
| Every logging method end to end, edit/delete, totals agreement across dashboard/log/trends | A session. |
| Growth surfaces — `/welcome`, `/wrapped`, story engine, meal suggestion deck | A session. |
| Paywall runtime — Razorpay widget open/dismiss/fail copy, TWA Play-Billing-disabled state | A session; the TWA half needs a real device. |
| Delete account, subscription management for all three providers | A throwaway account and your go-ahead. |
| Push end to end, cron partial-run behaviour, Monthly Wrapped actually firing | Ability to invoke the crons with `CRON_SECRET`, or a session with history that qualifies. |
| Analytics funnel (`TESTING.md` §0) | PostHog access. |
| PWA install, service-worker update behaviour, offline honesty (the app should fail cleanly, never claim offline logging — confirmed no such claim exists anywhere in the current copy, but the *behaviour* itself needs a real network toggle) | A real device. |
| The remaining visual-audit items (P1-3 decision, P2-1 radii convergence, P2-4 touch targets) on a real phone | A device pass, as that audit already said. |
| Whether the two new P0s are reachable on production right now | They are — the code is identical on `main`/production; I did not attempt to trigger either against production, per this audit's read-only rules. |

**What I did verify at runtime, unauthenticated, this session:** every public page (`/`, `/pricing`,
`/upgrade`, `/privacy`, `/terms`, `/refunds`, `/contact`, `/auth/*`) loads with zero console errors
and zero horizontal overflow at 375px, in both light and dark; every protected page (9 checked:
`/dashboard`, `/log`, `/progress`, `/weight`, `/settings`, `/recipes`, `/deficit`, `/welcome`,
`/wrapped`, `/onboarding`, `/onboarding/plan`) correctly redirects to `/auth/sign-in?returnTo=…`
when signed out; `/foods/ifct-rice-raw` renders correct SEO content and a non-existent slug 404s;
`/api/deficit/weekly` now 404s (confirms the 2026-09-03 deletion fix holds); admin routes fail
closed (403) with no `SEED_SECRET` set locally; cron routes require auth (401 unauthenticated);
`robots.txt`/`sitemap.xml`/`manifest.webmanifest` all match what's documented, with no leaked
auth-only routes; production (`www.getinshape.co.in`, checked via curl) matches local `main` exactly
on the two facts checked (the "850+" landing claim, the apex→www 308).
