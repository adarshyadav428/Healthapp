# GetInShape — Remediation Report

Follow-up to the 2026-09-13 QA baseline (`EXPLORATORY-QA-REPORT.md`, `RISK-REGISTER.md`,
`DATA-INTEGRITY-REPORT.md`, `SECURITY-QA-REPORT.md`, `PERFORMANCE-REPORT.md`,
`QA-COVERAGE-MAP.md`). Every confirmed bug from that pass is fixed here, in the order
requested (Phase A — critical data/security, Phase B — product correctness, Phase C —
performance), each with a regression test that reproduces the original failure before
asserting the corrected behavior. **No commit was made.** All five gates are green:

```
npm test            → 1686/1686 passed (133 files)
npx tsc --noEmit     → clean
npm run lint         → no warnings or errors
npm run check:tokens → PASS, 0 violations
npm run build        → exit 0
```

`git status --short` shows exactly the files this remediation pass touched, plus the
already-authorized middleware fix and the `docs/qa/` baseline from the prior session —
nothing else.

---

## Phase A — critical data / security

### R4 — `saved_meal_items` unbounded quantity/calorie input

- **Original severity:** P0 (elevated from P1 during the authenticated QA pass, since no
  downstream layer applied any bound either).
- **Root cause:** `app/api/meals/saved/route.ts`'s `createSchema` validated `grams`/`servings`
  with `z.number().positive()` — no ceiling — the one door left open when every sibling
  schema (`addFoodSchema`, `editFoodLogSchema`, `customFoodSchema`) was bounded on both
  sides in the 2026-09-05 pass. `/api/meals/log` then fed the stored value straight into
  `scaleMacros` with no re-validation.
- **Trust boundary:** the API request body, at the point a combo is *created*
  (`POST /api/meals/saved`) — not at log time. Bounding it there means every future
  "log this combo" tap is safe by construction; no second check is needed at
  `/api/meals/log`.
- **Fix:** [app/api/meals/saved/route.ts](../../app/api/meals/saved/route.ts) — `grams` now
  `.max(MAX_LOG_GRAMS)` (10,000) and `servings` now `.max(99)`, importing the same constant
  `addFoodSchema` already uses (`lib/portion-units.ts`). No new constant, no new pattern —
  exactly the ceiling CLAUDE.md's own "bounded on both sides" rule already names as the
  intended fix for this file.
- **Regression tests:** [tests/routeMealsSaved.test.ts](../../tests/routeMealsSaved.test.ts)
  (new `describe` block) — rejects `grams: 999999999` and `servings: 100000` with nothing
  persisted; rejects one unit past the new maximum (`10001` / `100`); accepts the maximum
  itself (`10000` / `99`). [tests/routeMealsLog.test.ts](../../tests/routeMealsLog.test.ts)
  (new `describe` block) — logging a combo item at the new maximum produces a large but
  finite, bounded kcal figure (8,910,000 for a 900 kcal/100g oil at the ceiling), asserted
  `< 2,969,999,997` (the live-exploited figure) and `Number.isFinite`.
- **Before:** `grams: 999999999` accepted with 200 OK; logging it wrote
  `kcal: 2,969,999,997.03` to `food_logs`, rendered unclamped on Food, Home's ring, macro
  tallies and the coaching line ("Protein target hit — 78000000g today").
- **After:** the same payload is rejected with 400 before anything is persisted. The
  worst case at the new, deliberate ceiling (10,000 g × 99 servings of the most
  calorie-dense food in the catalogue) is bounded and finite — nonsensical for a single
  food, but not billions, and not unbounded.
- **Remaining risk:** the 10,000 g × 99-servings ceiling is the same compounding
  headroom every other logging path in the app already accepts (`/api/logs/add` bounds
  `grams` and `servings` independently the same way) — this is a pre-existing, deliberate
  property of the app's grams+servings model, not something this fix introduced or is
  scoped to redesign. `/api/logs/add-bulk` and `/api/meals/log` were not given their own
  independent bound on the *items array itself* (e.g., a max total combined grams across
  all items in one request) — not needed for R4's specific defect (each item's own fields
  are now bounded at the point they're created), but worth a future look if a similar
  compounding concern is raised for a different route.

### R7 — `/api/logs/edit` trusts client-provided kcal

- **Original severity:** P1 (item 2's confirmed exploit; the RISK-REGISTER entry).
- **Root cause:** `editFoodLogSchema`'s kcal/protein/carbs/fat fields were the client's own
  computed preview, trusted verbatim and bounded only by a raw ceiling (5,000 kcal). The
  route's docstring claimed this was necessary because "an entry may have no linked food at
  all" — investigation showed that's only true for a genuine quick-add note (`food_id`
  NULL, migration `009_nullable_food_id_quickadd.sql`, a raw calorie figure with no
  per-100g row to recompute from). Every other food_logs row — search, camera, chat, and
  saved-combo entries — has a NOT-NULL `food_id` pointing at a real `foods` row (camera/chat
  upsert one; `foods.food_id` is a foreign key `ON DELETE CASCADE`), so a per-100g source
  to recompute from is *always available* for those rows. The route simply never used it.
- **Authoritative source:** the linked `foods` row's per-100g values, when one exists —
  exactly what `/api/logs/add` already uses. Only a true quick-add row (no linked food)
  falls back to the client's own figure, since there is nothing else to check it against.
- **Fix:** [app/api/logs/edit/route.ts](../../app/api/logs/edit/route.ts) — reads the
  existing row's `food:foods(...)` join first; when it resolves to a real food, recomputes
  kcal/protein/carbs/fat server-side via `scaleMacros(food, grams, servings)` (the same
  helper `/api/logs/add` and `/api/meals/log` use) and discards whatever the client sent
  for those four fields. When the join resolves to `null` (a quick-add note), the client's
  values are used as before, still bounded by the schema's ceilings. Also updated
  [lib/validations.ts](../../lib/validations.ts)'s `editFoodLogSchema` doc comment, which
  had the food_id-nullability claim backwards.
- **Regression tests:** [tests/routeLogsEdit.test.ts](../../tests/routeLogsEdit.test.ts)
  (new file, 8 cases) — a valid edit persists the recomputed value; a fabricated kcal
  (`grams:105, kcal:4999`, true value 311.85) is silently corrected, not accepted; fabricated
  macros are corrected the same way; a quantity change recomputes proportionally
  (`grams:210` → double); a food_id-NULL quick-add row still trusts the client's kcal;
  both the read and the write are scoped to `user_id`; a missing/foreign entry 404s rather
  than 500s or silently succeeding; an out-of-bounds grams value 400s before the row is
  even read.
- **Before:** `PATCH` with `{grams:105, kcal:4999, ...}` for a food whose true 105g value is
  311.85 kcal was accepted with 200, persisted verbatim, and Home's ring read "4,999 kcal
  eaten... 3,421 kcal over."
- **After:** the same request persists `kcal: 311.85` — the client's fabricated value never
  reaches the database. Home, Progress and every other reader of `food_logs.kcal` now see
  the correct figure for that entry.
- **Remaining risk:** none identified for the fixed path. The quick-add fallback (client
  kcal trusted, food_id NULL) is unchanged by design — there is no per-100g source to check
  it against, and it was already bounded 0–5,000 kcal by the schema; this is the same
  trust model `/api/logs/quick-add` itself uses for the same shape of entry.

### R8 — Duplicate concurrent food-log creation

- **Original severity:** P1.
- **Root cause:** `/api/logs/add` and `/api/logs/quick-add` had no server-side idempotency —
  a documented, deliberate scope boundary at the time (only weight/exercise/copy-yesterday/
  copy-meal got the treatment in the 2026-09-05 pass) — confirmed live-exploitable: two
  genuinely simultaneous (`Promise.all`) identical `POST /api/logs/add` requests both
  returned 200 and both rows persisted.
- **Fix:** new migration
  [049_food_logs_add_idempotency.sql](../../supabase/migrations/049_food_logs_add_idempotency.sql)
  adds a nullable `client_request_id uuid` column to `food_logs` with a unique partial index
  on `(user_id, client_request_id)` — the identical mechanism migration `046` already gave
  `weight_logs`/`exercise_logs`, routed through the existing, shared
  `lib/requestIdempotency.ts::insertIdempotent`. `addFoodSchema` (used by both routes) gained
  an optional `client_request_id: z.string().uuid()` field.
  [app/api/logs/add/route.ts](../../app/api/logs/add/route.ts) and
  [app/api/logs/quick-add/route.ts](../../app/api/logs/quick-add/route.ts) both now insert
  through `insertIdempotent` instead of a plain `.insert()`, and both skip the
  analytics/milestone firing when the result is a recovered replay
  (`result.alreadyExisted`), so a retried request cannot double-count a first-log
  celebration or a streak event.
  [components/log/AddFoodModal.tsx](../../components/log/AddFoodModal.tsx) and
  [components/log/QuickAddModal.tsx](../../components/log/QuickAddModal.tsx) each generate a
  `client_request_id` once per modal-open (`useRef(crypto.randomUUID())`, the same pattern
  already used by `WeightLogModal`) and send it with the request.
- **Regression tests:**
  [tests/routeLogsAdd.test.ts](../../tests/routeLogsAdd.test.ts) (new `describe` block, 3
  cases) — a genuine retry after a simulated `23505` conflict recovers the original row
  rather than creating a second one; a fresh `client_request_id` (a genuinely separate log)
  is never blocked; a recovered replay does not double-fire the milestone.
  [tests/routeLogsQuickAdd.test.ts](../../tests/routeLogsQuickAdd.test.ts) (new file, 4
  cases) — the same shape of coverage for the quick-add path.
- **Before:** two simultaneous identical `POST /api/logs/add` calls both returned 200 and
  both rows persisted, confirmed via a direct DB read.
- **After:** the second of two racing inserts hits the unique index, is recognized as a
  replay of the first via the shared `client_request_id`, and the response returns the
  original row instead of creating a duplicate.
- **Remaining risk:** `/api/logs/add-bulk` (camera/chat multi-item inserts) and
  `/api/meals/log` (saved-combo logging) were **not** given the same treatment in this pass.
  Both insert several rows in one request, and a single `client_request_id` column with a
  per-row unique index — the mechanism used here — does not fit a multi-row batch (every
  row in the batch would collide with every other row under the same key). The correct
  fix for a batch is a different shape (a small marker table recording
  `(user_id, client_request_id)` once per *batch*, gating whether the batch's rows are
  inserted at all) and was deliberately left out of this pass to avoid scope creep beyond
  the two routes QA actually reproduced the defect against. This is a known, named gap —
  flag it explicitly if a duplicate-batch bug is ever reported against either route.

### R6 — Backdated weight changing current calorie target

- **Original severity:** P1.
- **Investigation finding:** the *existing* product rule — confirmed correct, not changed
  by this fix — is that `profiles.current_weight_kg` and the derived calorie/macro targets
  are meant to track the user's most **recent** known weight. That's the intended behavior;
  `calculateTDEE` running off a stale weight would be the actual bug. The defect was in how
  "most recent" was determined: the route recalculated whenever the *newly inserted* row's
  weight differed ≥0.5 kg from the stored value, with no check on whether that row was
  actually the latest one **chronologically** (`measured_at`). Backdating old weigh-ins —
  entirely legitimate (filling in history) — could overwrite today's live targets purely
  because that insert happened last, not because it described the most recent weight.
  Confirmed live: posting 14 backdated weigh-ins in chronological order shifted the calorie
  target from 1,589 → 1,578 kcal, driven by an intermediate historical entry.
- **Fix (behavior is unintended per the rule above, so it was fixed, not documented as
  intentional):** [app/api/weight/add/route.ts](../../app/api/weight/add/route.ts) — before
  the recalc block, an added query checks whether any existing `weight_logs` row for this
  user has a `measured_at` later than the entry just inserted (`.gt('measured_at', ...)`).
  The recalc (`current_weight_kg`, `daily_calorie_target`, macro targets) now only fires
  when this entry is confirmed to be the chronologically latest — i.e., exactly the cases
  the rule always meant to cover.
- **Regression tests:**
  [tests/routeWeightAdd.test.ts](../../tests/routeWeightAdd.test.ts) (new `describe` block,
  3 cases) — recalculates when the new entry IS the latest on record; does **not**
  recalculate when a newer weigh-in already exists (the backdated case); the newer-row
  check is scoped to the caller and compares by `measured_at`, not insertion order. All 6
  pre-existing tests in the file still pass unmodified.
- **Before:** a chronologically-earlier weigh-in, inserted after later ones already
  existed, could still overwrite `current_weight_kg` and the live calorie/macro targets.
- **After:** only a weigh-in that is genuinely the most recent by `measured_at` triggers
  the recalc; backdating history never touches today's live targets.
- **Remaining risk:** none identified for the recalc path itself. A separate, unrelated P3
  already on record (a weight *milestone* can fire from a backdated entry inserted out of
  chronological order) was not touched — it's a display/celebration concern, not a data or
  targets defect, and out of this fix's scope.

### R2 — Deferred email verification

- **Original severity:** P0.
- **Root cause:** `middleware.ts`'s blanket rule — "an authenticated visitor on any
  `/auth/*` page bounces to `/dashboard`" — applied to `/auth/callback` and
  `/auth/reset-password` too, even though both are specifically meant to be reached by an
  **already-authenticated** visitor: `/auth/callback` is the PKCE code-exchange endpoint a
  signed-in user hits when re-clicking a verification or magic-link email (the check that
  matters runs inside the handler, on the code itself, not on whether a session cookie is
  already present); `/auth/reset-password` is where Supabase's password-recovery flow
  lands, using a token in the URL **hash fragment** the server never even sees. Confirmed
  live: `fetch('/auth/callback?code=fake&next=/dashboard')` while authenticated returned
  `redirected:true` to `/dashboard` — independent of the code's validity — and the same for
  `/auth/reset-password?code=fake`.
- **Fix:** [middleware.ts](../../middleware.ts) — added `isAuthExemptWhenSignedIn` (true for
  exactly `/auth/callback` and `/auth/reset-password`) and gated the authenticated-bounce
  redirect on `isAuthRoute && !isAuthExemptWhenSignedIn`. Every other `/auth/*` page
  (`/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`) is unaffected — a signed-in
  user still bounces off those, exactly as before.
  - Verification works for authenticated users: the callback route now actually runs for a
    signed-in visitor, so `exchangeCodeForSession` executes and `email_verified_at` stamps.
  - Valid verification code reaches the handler: confirmed — the request is no longer
    intercepted before the route handler runs.
  - Session behavior is preserved: no change to `getUser()`/cookie handling; only the
    routing decision after auth state is known changed.
  - Invalid/expired links fail safely: unchanged — `app/auth/callback/route.ts` already
    redirects to `/auth/sign-in?error=oauth_callback_failed` on an `exchangeCodeForSession`
    error, for both signed-in and signed-out callers.
  - Resend behavior works: unaffected — `useSendVerificationLink` calls Supabase's own
    resend API, unrelated to middleware routing.
  - Both authenticated and unauthenticated flows work: unauthenticated already passed
    through via `isPublic || isAuthRoute`; authenticated now also passes through for these
    two routes specifically, per the fix.
- **Regression tests:** [tests/middleware.test.ts](../../tests/middleware.test.ts) — new
  case: an authenticated visitor reaches `/auth/callback` and `/auth/reset-password`
  without a redirect (previously would have asserted a dashboard bounce); extended the
  existing unauthenticated-pass-through case to include `/auth/reset-password` alongside
  `/auth/callback`. The pre-existing "sends `/auth/sign-in`/`/auth/sign-up` to the
  dashboard" case is untouched and still passes, confirming the exemption is scoped to
  exactly the two intended routes.
- **Before:** an authenticated visitor hitting either route was redirected to `/dashboard`
  before the route's own logic ran, so the deferred-email-verification flow could never
  complete for its designed, common-case user (someone who verifies days after signing up,
  while still signed in).
- **After:** both routes run their own logic regardless of auth state, exactly as their
  designs require.
- **Remaining risk:** a related, pre-existing, unrelated finding (F11: sign-in never
  renders the `?error=oauth_callback_failed` query param when the callback itself fails)
  was not touched — it's a copy/UX gap in a different file, not part of the confirmed R2
  defect, and doing so would be an unrequested fix beyond this issue's scope. One
  sub-part flagged in `BLOCKED-MANUAL-TESTS.md` remains genuinely untested: real end-to-end
  delivery and click-through of an actual verification email (no email account access this
  session) — this fix is verified at the routing layer, which is where the confirmed defect
  lived, but the full inbox-to-verified round trip has not been walked live.

---

## Phase B — product correctness

### NEW-1 — Protein bar / roti unit mapping

- **Original severity:** P2 (new finding from live search).
- **Root cause:** `lib/portion-units.ts`'s `SMART_PORTIONS` roti/chapati pattern was
  `/roti|chapati|chapathi/i` — an **unanchored substring match**, the exact bug shape
  CLAUDE.md already documents for `lassi`/`cola`/`fanta`/`puri` elsewhere in the same
  file (a fix comment for `\bpuri\b` sits four entries below this one). The catalogue
  carries a real misspelled row named "Protien Bar" (a genuine i/e swap of "Protein"),
  and "Protien" contains the four letters **r-o-t-i** consecutively (P-**roti**-en) — so
  the unbounded pattern matched it and offered "1 medium roti (35g)" as its portion unit.
- **Fix:** [lib/portion-units.ts](../../lib/portion-units.ts) — bounded the pattern to
  `/\broti\b|\bchapati\b|\bchapathi\b/i`, matching the same word-boundary convention every
  other previously-fixed entry in this table already uses. This is a data/mapping fix at
  the pattern level, not a special case for this one product — any future name that
  happens to contain the same hidden substring is now equally unaffected.
- **Regression test:** [tests/portionUnits.test.ts](../../tests/portionUnits.test.ts) — new
  case asserting "Protien Bar" and "Protein Bar (Chocolate)" no longer default to the 35g
  roti unit, while "Roti", "Chapati / Roti" and "Tandoori Roti" still correctly do.
- **Before:** searching "roti" and opening the "Protien bar" (Yoga Bar) result showed its
  unit as "1 medium roti."
- **After:** the same product's unit resolves through the normal `common_portions`/
  `serving_size_g` fallback chain, no longer matching the bread-portion table at all.
- **Remaining risk:** this fix addresses the **portion-unit mapping** defect specifically,
  per the issue's own title. A related but distinct observation from the QA baseline — that
  "Protien bar" also *appears in search results* for the query "roti" at all (because the
  same misspelled name contains "roti" as a raw substring, and the search index does a
  literal ILIKE match) — is not addressed here. That's a search-ranking/inclusion question,
  not a portion-unit one, and touching it would mean changing the search matching logic
  (`lib/searchRanking.ts`/`app/api/foods/search/route.ts`), a different surface than this
  issue named. Flagged for a separate look if it's judged worth fixing.

### NEW-2 — AI "curd" → "Curd Rice"

- **Original severity:** P2 (new finding from a live Gemini call).
- **Investigation:** traced the candidate-matching pipeline in
  `app/api/chat/analyze/route.ts` (shared by `app/api/camera/analyze/route.ts`) —
  `.ilike('name', '%curd%')` correctly returns every name containing "curd" as a candidate;
  the actual defect was in `lib/foodMatch.ts::nameScore`'s scoring tiers, used to pick the
  single best candidate. `n.startsWith(q)` ("whole-string prefix") scored 3 — one point
  below an exact match — for **any** name that happens to start with the query text,
  including a name that continues into a completely different dish ("Curd Rice (Thayir
  Sadam)" starts with "curd" exactly as much as "Curd (Dahi)" would). That beat a genuine
  "Dahi (Curd)" row's word-prefix score of 2 outright, regardless of source trust.
- **Decision (per the instruction not to chase perfect AI classification):** rather than
  trying to teach the matcher semantics, the fix narrows the one tier that was
  systematically over-confident. The candidate lookup, confidence/ambiguity handling
  elsewhere in the pipeline (plausibility clamping, `confidence: 'low'` when macros are
  implausible), and the user's ability to correct a mis-logged item via
  `EditFoodLogModal` afterward are all unchanged — this closes the one deterministic
  mapping that was confidently, provably wrong, not the general ambiguity of short AI-named
  ingredients.
- **Fix:** [lib/foodMatch.ts](../../lib/foodMatch.ts) — `nameScore`'s whole-string-prefix
  tier (score 3) now only applies when what follows the matched prefix is a parenthetical
  qualifier ("Moong Dal **(Yellow)**") or nothing at all — not when the name continues into
  another bare word ("Curd **Rice**"). A name that no longer qualifies for tier 3 falls
  through to the existing word-prefix tier (2), same as before. Also added a length-based
  tie-break to `pickBestFoodMatch`: when two candidates score identically, the shorter name
  wins — closer to what was actually named, and only ever resolves a tie that was already
  ambiguous (it never overrides a genuine score difference).
- **Regression test:** [tests/foodMatch.test.ts](../../tests/foodMatch.test.ts) — new
  `describe` block: "curd" no longer prefix-matches "Curd Rice (Thayir Sadam)" over "Dahi
  (Curd)"; an exact name match ("Curd") still wins outright, unaffected by the tie-break;
  the pre-existing "Moong Dal (Yellow)" qualifier-suffix shape still resolves correctly. All
  11 pre-existing tests in the file (including the ones this exact scenario is drawn from —
  `pickBestFoodMatch with a branded row`, which already asserted `curd` → `Curd` when an
  *exact* row exists) still pass unmodified.
- **Before:** describing "2 paratha with curd and achar" to the chat AI logged "curd" as
  "Curd Rice (Thayir Sadam)" — a rice dish — at 120g/129.6 kcal.
- **After:** the same scenario resolves to a genuine plain-curd row when one exists in the
  candidate set, since the compound dish name no longer receives an inflated score merely
  for sharing a first word.
- **Remaining risk:** this is a targeted mitigation, not a guarantee — the instruction was
  explicit that perfect AI classification is not the goal. A genuine tie between two
  same-length, same-source candidates could still occasionally resolve either way (the
  length tie-break is a heuristic, not a semantic one), and a sufficiently ambiguous AI-named
  item can still, in principle, match something unintended. The user's correction path
  (editing the logged entry) remains the backstop, unchanged by this fix. No attempt was
  made to add a "low confidence" signal specifically for a name-matching tie — that would be
  a second, separable change to the confidence pipeline, not requested here.

### NEW-3 — "Ahead of schedule" deficit calculation

- **Original severity:** P2 (new finding from live `/progress` usage).
- **Investigation:** confirmed unlogged days are **already** correctly excluded from the
  deficit sum (never treated as a 0-eaten day) — `calculatePeriodDeficit` sums only
  `completedDays` that were actually logged, and `days_unlogged` is a separately, correctly
  computed field. The established product rule (the module's own file-header contract,
  rule 2) is: **"unlogged days are named, not silently dropped."** The `days_unlogged`
  number itself was never dropped — it's shown elsewhere on the card. The violation was
  narrower: the **"ahead of schedule" insight sentence** — the one sentence in the whole
  card that projects a confident weekly kg/week pace — made that claim without naming the
  sample it was extrapolated from, even when that sample was as small as 1–2 of 7 days.
  Observed live: "You are ahead of schedule — 1.54 kg of fat loss per week at this pace"
  sitting directly beside "2 of 7 days logged · 5 not logged" on the same card.
- **Decision:** since the violation was in the sentence's wording, not the underlying
  arithmetic (`status`, `progress_percent`, and the prorated-target design are all correct
  and unchanged), the fix names the sample size in the sentence itself rather than
  changing any number the card already shows.
- **Fix:** [lib/deficit-calculator.ts](../../lib/deficit-calculator.ts) — a
  `sampleCaveat` clause (` based on N of M logged days so far`) is appended to the "ahead"
  insight for both the `lose` and `gain` goal branches (the two sentences that state a
  projected weekly rate as fact) whenever `days_unlogged > 0`. A full period with nothing
  unlogged gets no caveat — there is nothing to name. `on_track`/`behind`/`surplus`
  insights don't claim an achieved rate the same way and were left untouched.
- **Regression tests:** [tests/deficit-calculator.test.ts](../../tests/deficit-calculator.test.ts)
  — new `describe` block covering exactly the requested matrix: 0/7 logged days (status
  can never reach "ahead" with zero data — confirmed); 2/7 logged days reaching "ahead"
  names the sample ("based on 2 of 7 logged days"); 7/7 logged days reaching "ahead" carries
  no caveat (nothing was left out); a partial week that only reaches `on_track` is
  unaffected (the caveat is specific to the pace-claiming status); the `gain`-goal "ahead"
  mirror also names its sample; and a case with no `daysElapsed` passed (matching
  `daysLogged`) never invents a caveat. All 49 pre-existing tests in the file, including
  the exact "≥110% of target → ahead" case (which uses a full 7/7 week and asserts only
  `status`/`progress_percent`), still pass unmodified.
- **Before:** the "ahead of schedule" sentence stated a confident kg/week figure with no
  indication it came from a partial sample, even at 2 of 7 days logged.
- **After:** the same scenario reads "You are ahead of schedule based on 2 of 7 logged days
  so far — 1.54 kg of fat loss per week at this pace. Keep it up!" — the claim and its basis
  now sit in the same sentence.
- **Remaining risk:** none identified for the specific violation described. Whether a
  small sample should also gate the underlying `status`/`progress_percent` values
  themselves (rather than only the sentence) is a genuine product question — the
  instruction was explicit to fix only what violates the *established* rule, and the
  established rule is about naming the gap, not about suppressing "ahead" until a minimum
  sample size. That's a design decision for the founder, not a defect this pass found
  grounds to override.

---

## Phase C — performance

### `/progress`'s 410 KB First Load JS bundle

- **Investigation, not a blind optimization pass:** `PERFORMANCE-REPORT.md`'s Finding P-1
  named this the single most actionable lead in the whole baseline and specifically asked
  whether every chart on the page was genuinely `next/dynamic`-loaded. Checked each of the
  three `recharts`-based components `/progress` can render:
  - `TrendBarChart` (weekly bar chart) — already `next/dynamic`, `ssr: false`, in
    `ProgressClient.tsx`. Correct.
  - `WeightTrendChart` (weight trend line) — already `next/dynamic` inside `WeightHero.tsx`,
    which is itself what `ProgressClient.tsx` statically imports (correctly — `WeightHero`
    is a small wrapper; only the chart inside it needed deferring). Correct.
  - `CumulativeDeficitChart` (the "energy balance" running-total chart) —
    **statically imported** by `DeficitTrendCard.tsx`, which is itself statically imported
    by `ProgressClient.tsx`. `CumulativeDeficitChart.tsx` imports directly from `recharts`
    with no dynamic wrapper at all. **This was the gap** — the one chart on the page that
    never got the same treatment as its two siblings, pulling all of `recharts` into the
    page's initial bundle regardless of whether the user ever scrolls to the energy-balance
    card.
- **Fix:** [components/progress/DeficitTrendCard.tsx](../../components/progress/DeficitTrendCard.tsx)
  — `CumulativeDeficitChart` is now `next/dynamic(() => import('./CumulativeDeficitChart')...,
  { ssr: false, loading: ... })`, the identical pattern already proven correct for
  `TrendBarChart` and `WeightTrendChart` (same file, same loading-skeleton convention). Only
  the runtime `import` changed to a dynamic one; `type DeficitPoint` remains a type-only
  import (type imports carry no runtime bundle cost, so this didn't need deferring).
- **Measured before → after** (`npm run build`, this session):

  | | Own bundle | First Load JS |
  |---|---|---|
  | `/progress` before | 118 kB | 410 kB |
  | `/progress` after | **11.3 kB** | **302 kB** |
  | `/deficit` (uses `recharts` independently, unaffected) | 6.87 kB → 6.87 kB | 177 kB → 177 kB |

  A 108 kB (26%) reduction in `/progress`'s First Load JS, and its own bundle dropped by
  ~90% (118 kB → 11.3 kB) — `/progress` is no longer the single heaviest page in the app by
  a wide margin (it now sits below `/settings` at 313 kB and `/log` at 305 kB, rather than
  ~100 kB above both).
- **No unrelated changes:** nothing else in `DeficitTrendCard.tsx`, `ProgressClient.tsx`, or
  `CumulativeDeficitChart.tsx` was touched. All five gates re-run clean after this change
  specifically (`npm test`: 1686/1686; `tsc`: clean; `lint`: clean; `check:tokens`: PASS;
  `build`: exit 0, numbers above).
- **Remaining risk / what this does not claim:** this defers *when* `recharts` loads — it
  does not eliminate the cost. A user who actually scrolls to and views the energy-balance
  card still eventually downloads the same chart library; the win is that a user who never
  scrolls that far (or is on the "Week" toggle default and doesn't view the chart before
  navigating away) no longer pays for it on first paint, and no page load pays for it
  before it's needed. Per `PERFORMANCE-REPORT.md` Section 6, still genuinely open and
  unaffected by this fix: no Lighthouse/DevTools trace was run, no cold-load or
  throttled-network measurement was taken, and no real-device timing exists — the number
  above is a build-time bundle-size measurement, the one category of evidence this session
  could gather without a live device. A visual smoke-test of `/progress`'s energy-balance
  card in a real browser session (confirming the loading skeleton and chart both render
  correctly) is recommended as a quick follow-up before considering this fully verified
  end-to-end, though the change itself is code-identical in shape to the two sibling
  deferrals already living in production.

---

## Summary

| ID | Area | Status |
|---|---|---|
| R4 | `saved_meal_items` unbounded input | **Fixed** — bounded, tested |
| R7 | `/api/logs/edit` trusts client kcal | **Fixed** — server recompute, tested |
| R8 | Duplicate concurrent food-log creation | **Fixed** (add, quick-add) — idempotency key, tested. add-bulk/meals-log deliberately deferred (see R8's remaining risk) |
| R6 | Backdated weight overwrites live targets | **Fixed** — recency-gated recalc, tested |
| R2 | Deferred email verification | **Fixed** — middleware exemption, tested |
| NEW-1 | Protein bar / roti unit mapping | **Fixed** — bounded regex, tested |
| NEW-2 | AI "curd" → "Curd Rice" | **Mitigated** — narrowed scoring tier + tie-break, tested. Not a guarantee of correct AI matching, by design |
| NEW-3 | "Ahead of schedule" deficit claim | **Fixed** — sample size named in the insight, tested |
| Phase C | `/progress` 410 KB bundle | **Fixed** — one missed `next/dynamic` deferral, measured 410 KB → 302 KB |

**Every fix above has a regression test that reproduces the original failure before**
**asserting the corrected behavior**, per the instruction. No test was deleted, no
validation was weakened, no unrelated feature was touched, and no redesign was performed —
each fix is the smallest change that closes the specific defect QA reproduced. **Nothing
in this pass was committed;** the working tree contains exactly the files listed by
`git status --short` above, ready for review before any commit is made.
