# GetInShape — Data Integrity Report

Part of the 2026-09-13 QA baseline, **updated after an authenticated pass** against
production (account `+qa2`, via the user's own already-signed-in Chrome — no credentials
ever seen or typed). Focus: for every important mutation, does the user-visible state match
the persisted backend state, and are quantities/dates/ownership correct end to end. Findings
below are marked **OBSERVED** where directly reproduced against the live database this
session, **CODE-REVIEWED** where not independently re-run.

## 1. Cache-consistency — Home/Log/Progress totals after a mutation

**Confirmed no divergence path exists in the code for any mutation examined.** All "today"
totals key off `['food-logs', userId, start]` where `start = getIstDayRange(date).start`
(`hooks/useFoodLogs.ts:8-11`). `DashboardClient`, `TodayFoodLog`, and `AddFoodModal`'s
`useDailyTotals` all resolve to the identical cache key for the same calendar day — verified
by reading all four call sites directly, not inferred.

- **Targeted cache writes** (no invalidation, no refetch): add/edit/delete each patch the
  exact cache entry in place, keyed from the *viewed* day (so a backfilled edit correctly
  updates that day's cache, not today's).
- **Broad invalidation** (`invalidateQueries({queryKey:['food-logs']})`): saved-combo log,
  copy-yesterday, quick-add, re-log, paste-meal, quick-add-modal, undo — all refetch every
  active `food-logs` query, correctly catching both Dashboard and Log-page totals at the cost
  of a network round trip instead of an instant patch.

No test currently pins this cross-component agreement as a single assertion (it's provable
today by reading four files, which is what this pass did) — recommend a targeted regression
test if any of these four call sites is ever touched independently.

## 2. Server-side recomputation vs. client trust — by mutation

| Mutation | Recomputes server-side? | Evidence |
|---|---|---|
| `/api/logs/add` | **Yes** — `kcal`/macros computed from `food.kcal_per_100g * grams/100 * servings` | `app/api/logs/add/route.ts:46-51` |
| `/api/logs/add-bulk` | Yes, same pattern per item | — |
| `/api/logs/quick-add` | N/A — no linked food, values are the log itself | Bounded (kcal 1-5000 etc.) |
| **`/api/logs/edit`** | **No** — trusts client-computed `kcal`/`protein_g`/`carbs_g`/`fat_g` verbatim | `app/api/logs/edit/route.ts:22-27`; bounded only by schema ceilings (R7 in Risk Register) |
| `/api/meals/log` (saved combo) | Yes — `scaleMacros(food, grams, servings)` server-side | `app/api/meals/log/route.ts:80` — but the `grams`/`servings` inputs themselves are unbounded at creation time (R4) |
| `/api/camera/analyze`, `/api/chat/analyze` | Yes — `resolveNutrition`/`resolveChatItemNutrition` run plausibility clamps before any write; the AI is never trusted for arithmetic | Confirmed both routes' upsert payloads are built from already-clamped structs, never raw model fields |
| `/api/weight/add` | Partial — writes the raw weigh-in, then **conditionally overwrites `profiles.current_weight_kg`/targets** with no recency check (R6) | `app/api/weight/add/route.ts:60-95` |
| `/api/onboarding`, `/api/profile/update` | Yes — `goal`/pace derived from `body_focus` via `planForFocus`, never trusted raw from client | Confirmed both routes call the same function server-side |

**The one confirmed trust-boundary gap that reaches persisted data with no re-check is
`/api/logs/edit`** — self-scoped (RLS still enforces `user_id`), but a client-side arithmetic
bug in `EditFoodLogModal`'s `nutrition` `useMemo` would silently persist wrong numbers.
**OBSERVED this session:** `PATCH /api/logs/edit` with `{grams:105, kcal:4999}` for "Roti /
Chapati (Wheat)" (true value for 105g is 311.85 kcal) was accepted with 200 and persisted
verbatim; Home's ring immediately showed "4,999 kcal eaten... 3,421 kcal over" — full
cross-screen propagation of the corrupted value confirmed, not just the write itself. Cleaned
up by deleting the test row immediately after confirmation.

**Also OBSERVED this session — the `saved_meal_items` bound gap (R4) reaches an even more
extreme state than the code review predicted.** `POST /api/meals/saved` with
`grams: 999999999` for a real food (Roti / Chapati, 297 kcal/100g) was accepted (200), and
logging it via `/api/meals/log` wrote **`kcal: 2969999997.03`** (`protein_g: 78,000,000`) to
`food_logs`. This rendered, unclamped, on: the Food page ("Last time 999999999 g · 2969999997
kcal"), Today's log total, Home's calorie ring ("2,96,99,99,997 / 1,578 kcal" — Indian digit
grouping applied correctly even at this scale, which is almost darkly funny), the macro
tallies, and the coaching line ("Protein target hit — 78000000g today. That's 1.6g per kg of
bodyweight" — a sentence that is not just wrong but actively nonsensical at this magnitude).
**No layer anywhere — API validation, database constraint, or UI render — applies any
sanity bound.** Cleaned up by deleting the test log and the test combo immediately after
confirmation.

## 3. Idempotency / duplicate-submission — by insert path

| Path | Idempotency mechanism | Status |
|---|---|---|
| `weight_logs`, `exercise_logs` | `client_request_id`, unique per `(user_id, client_request_id)` — migration 046 | ✅ Confirmed correct, tested |
| `copy-yesterday` | `copied_from_id`, global-per-source unique — migration 047 | ✅ Confirmed correct, tested (`tests/routeCopyYesterday.test.ts` covers double-tap/race/partial-retry) |
| `copy-meal` | `(copied_from_id, target IST day)` unique — migration 048 | ✅ Confirmed correct, tested (`tests/routeCopyMeal.test.ts` covers the same plus legitimate re-paste-onto-a-different-day) |
| **`/api/logs/add`, `/quick-add`, `/add-bulk`, `/api/meals/log`** | **None** — client-side `useRef`/`isSubmitting` flags only | **OBSERVED this session:** two genuinely simultaneous (`Promise.all`) identical `POST /api/logs/add` requests both returned 200, and a direct DB read immediately after confirmed **2 duplicate rows** for the same food/grams/meal. Deliberate, documented scope boundary in CLAUDE.md (only weight/exercise/copy routes got idempotency treatment) — but the live reproduction shows the gap is real, not merely theoretical. Cleaned up immediately. |
| `streak/rescue` | `23505` on `(user_id, rescued_date)` treated as success, same payload returned | ✅ Confirmed correct |

## 4. IST / timezone day-boundary correctness

**No UTC/IST mis-grouping bug found anywhere in this pass.** Specifically checked and
confirmed correct:

- `weight_logs.measured_at` is always stored at synthetic UTC-midnight of the chosen IST
  calendar date (deliberate — `WeightLogModal.tsx:43-45` states this explicitly), which is
  *why* `lib/weightTrend.ts`'s UTC-day-key bucketing recovers the correct IST date rather
  than being a zone bug. (The actual live bug in that file is a data-typing issue — see
  Section 5 below and `RISK-REGISTER.md` R1 — not a zone bug.)
- `/progress`'s month-calendar cell math is deliberately `Date.UTC`-built and read back with
  UTC getters, because the cells themselves are derived from IST date-keys upstream, not
  because UTC is being treated as IST.
- `/deficit`'s weekly/monthly window boundaries (`weekStartOf`/`monthStartOf` in
  `lib/deficit-calculator.ts`) operate on `YYYY-MM-DD` string keys with UTC-anchored
  arithmetic — the zone-free date-key pattern the codebase's day-boundary rule requires, fed
  by `istDateStr()` upstream.
- Backfill (`resolveLoggedAtForRequest`) stores a past-day log at noon IST that day —
  unambiguous regardless of server timezone.
- The one genuinely-tested historical time bomb (`routeCopyMeal.test.ts` pasting onto a
  fixed historical day as a free account, which broke for real on 2026-09-11 when the
  fixture date aged past the free-tier window) is fixed and correctly frozen with
  `vi.useFakeTimers`.

**Not independently re-verified in this pass** (requires runtime testing near a real
midnight IST, or clock-spoofing in a browser — see `BLOCKED-MANUAL-TESTS.md`): logging at
23:55 IST vs 00:05 IST and confirming the dashboard, `/log`, week strip, Trends calendar, day
diary, streak, and copy-yesterday all agree on which day a log belongs to in a live session.
The code-level logic all points at "yes" (single `istDateStr()`/`getIstDayRange()` source of
truth used everywhere), but this specific boundary has broken in production before (per
CLAUDE.md's documented incident history) and deserves a live check before being marked PASS.

## 5. Numeric correctness — the weight-trend string bug: REFUTED (see Risk Register)

`lib/weightTrend.ts:38-44` filters weigh-ins with `Number.isFinite(w.weight_kg)`, which does
not coerce a string. The static review's hypothesis was that PostgREST serializes `weight_kg`
(unconstrained Postgres `numeric`) as a JSON string, per `lib/formatWeight.ts`'s own docstring.

**Directly tested this session and found FALSE.** Created 14 real weigh-in rows (one via the
actual "Log weight" UI, 13 via the app's own `/api/weight/add` endpoint under the same
authenticated session) spanning Aug 31–Sep 13, 2026. `GET /api/weight/logs` returned
`weight_kg` as a genuine JSON **number** (e.g. `69.5`) for all 14 rows — confirmed by
checking `typeof` on every entry, not just eyeballing one. With ≥14 distinct days on record,
`computeWeightTrend` correctly computed and rendered a trend line, rate, and projected date
on **both** `/weight` ("~5w at 1.02 kg/week") and `/progress` ("Down 0.64 kg a week on a
4-week average. On track for 65.0 kg around 8 Nov 2026").

**Conclusion: this feature works correctly today.** The documented concern in
`lib/formatWeight.ts` is either stale, describes a different code path than the one actually
exercised by `/api/weight/logs`, or was true at some earlier point and has since stopped
applying — this pass did not determine which, only that the live behavior is correct now.
No further action needed on this specific item; it is removed from the P0 list in
`RISK-REGISTER.md`.

## 6. Calorie/macro logic — consistency across surfaces

- **Deficit's one definition** (`maintenance − eaten`, never `daily_calorie_target − eaten`)
  is used consistently in every surface checked (`/deficit`, `/progress`'s Energy-balance
  card) — confirmed by direct read, not inferred from the doc.
- **Today is peeled off before any deficit math**, everywhere — confirmed in both
  `/deficit` and `/progress`.
- **Exercise calories never enter deficit/TDEE math anywhere in `lib/`** — confirmed by grep.
  Plausibly deliberate (avoids "eat back your exercise calories") but undocumented as such —
  flagged in `RISK-REGISTER.md` R23 for a one-line product confirmation.
- **Chat AI's arithmetic guardrail** (`is_stated_component` + `rebalanceChatItems`) correctly
  prevents double-counting a dish's named components on top of a user-stated total — this is
  the one place in the app that does subtraction on AI-classified data, and the model is
  never trusted with the subtraction itself (only the classification).
- **No chart-level filtering of non-finite `kcal` values** was found in
  `lib/deficit-calculator.ts`'s `groupKcalByIstDay` (unlike `lib/plateau.ts`'s
  `intakeSummary`, which does guard `Number.isFinite`) — low risk since `food_logs.kcal` is
  server-validated at insert time, but it's an inconsistency in defensive posture between two
  files doing the same kind of aggregation.

## 7. Ownership / cross-user integrity

Every insert/read path that touches a `source='user'` custom food re-checks ownership fresh
(never from a shared cache) — see `SECURITY-QA-REPORT.md` claim (e) for the full trace. The
one weaker (but not exploitable) implementation is `foods/custom` PATCH/DELETE's substring
check (F-3/R24).

## 8. What was resolved this session vs. what still requires further testing

**Resolved (confirmed or refuted live) this session:**
- Whether `weight_kg` arrives as a string at runtime — **refuted**, confirmed a genuine
  number (Section 5).
- Whether a genuine concurrent request on `/api/logs/add` produces a duplicate row —
  **confirmed yes** (Section 3).
- Whether the backdated-weigh-in profile-overwrite (R6) actually corrupts a real account's
  calorie target — **confirmed yes**, Settings' target shifted 1,589→1,578 kcal purely from
  historical entries.
- Whether `/api/logs/edit`'s trust gap and `saved_meal_items`'s unbounded gap actually reach
  persisted data and render — **confirmed yes for both**, at extreme scale for the latter.

**Still requires further testing (not reached this session):**
- A real day-boundary walk (23:55/00:05 IST) — architecturally difficult to test through the
  legitimate API (see `BLOCKED-MANUAL-TESTS.md`), since neither `/api/logs/add` nor
  `/api/weight/add` accept an arbitrary timestamp, only a date. Day-labeling during normal
  hours was implicitly confirmed correct throughout this session (every mutation landed on
  the expected day).
- Whether the same duplicate-insert exposure (R8) exists on `/api/logs/quick-add`,
  `/add-bulk`, and `/api/meals/log` specifically — only `/api/logs/add` was directly tested;
  the other three share the identical code shape (no idempotency mechanism) per static review
  but weren't independently re-run.
- Cross-account/RLS data isolation was not re-tested live this session (no second account was
  available) — this remains CODE-REVIEWED only, per `SECURITY-QA-REPORT.md`.
