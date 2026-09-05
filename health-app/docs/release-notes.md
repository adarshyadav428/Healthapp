# GetInShape — release notes (2026-09-05 reliability release)

This release closes out the findings from the 2026-09-05 adversarial testing pass
(`docs/adversarial-audit-2026-09-05.md`) plus the custom-food ownership and camera fixes already
committed on this branch. It is a reliability release — no new user-facing features, no product
changes.

---

## What shipped

### Camera nutrition safety
Regression coverage added for the camera scan's unresolved-state invariant (commit `5909818`),
building on the nutrition-guardrail work already merged to `main` (PR #73, "Add nutrition
guardrails to chat AI logging"). No behavior change in this release beyond the added test coverage
— confirms the invariant holds and stays held.

### Custom-food ownership isolation
Closed ownership leaks across every path that can discover, match, log, favourite, or save a
custom (`source='user'`) food (commit `b6875ba`) — a private food created by one account could
previously surface to, or be referenced by, another account through one of those paths. All five
surfaces now consistently check `isFoodReferenceableBy` before a private food is exposed or
logged against.

### Subscription entitlement reliability (F2)
Nine call sites — the canonical `lib/subscription.ts` helper plus inline copies in
`app/api/chat/analyze`, `app/api/camera/analyze`, `app/api/foods/custom`, `app/api/foods/suggest`,
`app/api/streak/rescue`, `app/api/weight/logs`, `app/api/exercise/logs`, `app/api/logs`, and
`lib/backfill.ts` — all shared the same defect: a failed Supabase read of `subscriptions.status`
resolved to `undefined`, which reads identically to "not Pro." A transient DB read failure and a
genuinely free account were indistinguishable, so a paying Pro user could be told to upgrade, or
silently denied a Pro feature, on nothing more than a momentary blip. Every one of these now
surfaces the read failure explicitly and fails in the direction that doesn't cost the user money —
an unreadable entitlement is never treated as "not Pro" by assumption.

### Account deletion / billing safety (F1)
`POST /api/account/delete` read the caller's `subscriptions` row without checking for a read
error before deciding whether to cancel a live Razorpay/Stripe subscription first. On a transient
read failure, the cancel-or-block guard was silently skipped, the account was deleted anyway, and
the route reported success — leaving an active subscription billing a card attached to an account
that no longer exists to manage it from (and Razorpay has no self-serve cancellation portal). The
read failure is now checked explicitly and blocks the deletion rather than proceeding past it.

### Weight / exercise idempotency (F3, migration `046`)
Neither "Save weight" nor the exercise logger's submit had any duplicate-submission defense — the
client guard was `useState`-only, which two rapid taps in the same event-loop tick both read before
either had a chance to update, and there was no database constraint to catch a race that got past
the client. `046_weight_exercise_idempotency.sql` adds `client_request_id` to `weight_logs` and
`exercise_logs` with a unique partial index per `(user_id, client_request_id)`; a client-generated
ID identifies one logical submission regardless of how many HTTP requests it turns into, and
`lib/requestIdempotency.ts`'s `insertIdempotent` treats a resulting `23505` as "already saved," not
an error.

### Copy-yesterday idempotency (F4, migration `047`)
"Copy yesterday" had the identical defect — no server-side check for whether yesterday's logs had
already been copied to today, so a double-tap duplicated the entire day. `047_food_logs_copy_
idempotency.sql` adds `food_logs.copied_from_id` (a self-referencing pointer to the source row)
with a unique index, so each source log can be copied at most once to its one legitimate target
(today, at the time the copy runs).

### Copy-meal idempotency (P2, found during QA, migration `048`)
Found during the authenticated QA pass that followed F1-F4: `/api/logs/copy-meal` had zero
duplicate-submission protection at all — real concurrent testing produced two duplicate rows from
two identical requests. Reused copy-yesterday's `copied_from_id` mechanism, but widened the unique
constraint to `(copied_from_id, target IST day)` rather than `copied_from_id` alone — copy-meal,
unlike copy-yesterday, legitimately supports pasting the same saved meal onto several different
days, so uniqueness had to be scoped per target day instead of globally per source row.
`048_copy_meal_idempotency.sql` replaces `047`'s index with this composite one; it is a strict
widening for copy-yesterday (its target is always "today" at call time, so the two constraints
coincide there) and the added scope is what makes copy-meal correct. Verified against the real
production database this session: concurrent identical requests produced exactly one copy, a retry
produced no duplicate, and a legitimate copy of the same meal onto a different day still succeeded.

---

## Accepted P2/P3 risks (not fixed in this release, tracked for later)

These were surfaced by the 2026-09-05 adversarial pass and are deliberately **not** addressed here
— fixing them was out of scope for this release, which focused on the P1 duplicate-submission and
entitlement-reliability class above.

| ID | Risk | Why it's accepted for now |
|---|---|---|
| F5 | `saved_meal_items.grams`/`.servings` accept `Infinity` (no `.max()` bound), reachable via a direct `POST /api/meals/saved` call, not through the bounded slider UI. Could write an `Infinity`-kcal diary entry. | Requires a hand-crafted API call, not reachable through any UI control. Same fix pattern as the already-fixed height/weight bound (`lib/validations.ts`'s `WEIGHT_KG`/`HEIGHT_CM` constants) — small, well-understood fix, just not this release's scope. |
| F6 | A transient DB blip during Open Food Facts persistence silently drops packaged search results with no user-visible error. | Narrow window (only fires on a DB error during a specific insert), degrades to "no result" rather than a wrong result or a crash. |
| F7 | Razorpay SDK client has no request timeout — a stalled Razorpay API call hangs until Vercel's platform-level function kill (504) instead of a graceful timeout message. | Same class already fixed for Gemini and Play OAuth; Razorpay's own uptime has not been an observed problem. |
| F8 | `/api/logs`'s `end` query param has no validation (unlike `start`, which was hardened for exactly this class in the 2026-09-03 audit). Not a paywall bypass — only `start` gates history — but a malformed value reaches PostgREST unvalidated. | Lower severity than the `start` bypass it's modeled on since no entitlement is at stake; same fix (`clampHistoryStart` treatment) is a known follow-up. |
| F9 | No protected page sets `Cache-Control: no-store`, so a signed-out user pressing Back is architecturally exposed to a bfcache-restored flash of a previously authenticated page before any client re-check runs. **Unverified live** — needs a real device/browser test, not confirmed to actually occur. | Unconfirmed as a live defect; needs device verification before prioritizing a fix. |
| F10 | Signing out in one tab doesn't revoke another tab's still-valid access token for API writes — RLS still scopes every write to that token's own user, so this is not a cross-user leak, just a "signed out doesn't mean revoked" gap. | No cross-user exposure; narrow multi-tab/multi-device scenario. |
| F11 | Opening the same magic link in two tabs leaves the second tab on a plain sign-in page with no explanation (`?error=oauth_callback_failed` is set but never displayed). | Cosmetic/UX papercut, not a functional break — the correct tab still signs in. |
| F12 | `/deficit`'s "All time" total hand-rolls the same `maintenance − eaten` loop instead of calling the canonical `lib/deficit-calculator.ts` functions — currently numerically identical, but a future edit to either copy could silently diverge them again (this exact class was a P1 once before). | Currently correct; flagged as a drift risk for future changes, not a live wrong number. |
| F13 | `/auth/forgot-password` redirects to `/auth/reset-password` rather than the documented single authoritative `/auth/callback` session-establishing route. Doesn't currently break anything (middleware never bounces `/auth/*` regardless of session state). | Needs a one-line confirmation this is a deliberate password-recovery exception rather than an oversight — not urgent since nothing is broken today. |

None of these are duplicate-submission, entitlement, or data-isolation defects — the categories
this release specifically targeted are fully closed.
