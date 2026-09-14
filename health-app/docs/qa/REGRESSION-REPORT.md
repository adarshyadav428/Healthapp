# Regression Report — Previously Fixed Protections — 2026-09-14

Live re-verification of the protections named in the task, run against the local dev server (this
branch's code) using the real authenticated `+qa2` session. All test data created below was deleted
and the account's fields restored to their exact pre-test values at the end (see
`BATCH-IDEMPOTENCY-REPORT.md` §7 for the full before/after table).

| # | Protection | How tested | Result |
|---|---|---|---|
| 1 | Absurd grams (`addFoodSchema.grams` max 10,000) | `POST /api/logs/add` with `grams: 50000` | 400, `"Grams cannot exceed 10,000"` — ✅ PASS |
| 2 | Absurd servings (max 99) | `POST /api/logs/add` with `servings: 500` | 400, `"Servings cannot exceed 99"` — ✅ PASS |
| 3 | Negative grams | `POST /api/logs/add` with `grams: -50` | 400, `"grams: Number must be greater than 0"` — ✅ PASS |
| 4 | Fabricated kcal/macros | `POST /api/logs/add` for a real `food_id` with `kcal: 99999, protein_g: 9999` injected into the body | Server ignored both — `addFoodSchema` declares no kcal/macro fields at all for a food-linked row, so the extra fields are dropped by Zod parsing; the route always recomputes from the food's per-100g values × grams. Row persisted with the **true** value (`kcal: 77.4`, matching `86 kcal/100g × 0.9`), not 99999. — ✅ PASS |
| 5 | Absurd weight (`weightKg` bound, max 500 kg) | `POST /api/weight/add` with `weight_kg: 5000` | 400, `"Weight cannot exceed 500 kg"` — ✅ PASS |
| 6 | Backdated weight does not overwrite live targets (R6, 2026-09-13) | Posted a weigh-in dated **2026-08-01** (older than every existing log) with `weight_kg: 55` (a large delta from the 70.5 kg baseline) | Row inserted (200, legitimate backfill), but `profiles.current_weight_kg` / `daily_calorie_target` stayed at 70.5 / 1595 — unchanged, confirming the fix only recalculates from the chronologically **latest** entry. Then posted a genuinely-latest weigh-in (`2026-09-14`, `68 kg`) as a positive control: `current_weight_kg` correctly updated to 68 and `daily_calorie_target` recomputed to 1556 — proving the mechanism engages when it should and stays silent when it shouldn't, not that it's simply inert. — ✅ PASS (both directions) |
| 7 | Single-item duplicate protection (migration 049, `/api/logs/add`) | One request + two concurrent retries (`Promise.all`) sharing one `client_request_id`, 3 requests total | All 3 responses returned the **identical row id** — one row created under a genuine 3-way race, not three | ✅ PASS |
| 8 | Batch duplicate protection — add-bulk (migration 050) | Full first/retry/concurrent/new-id matrix | See `BATCH-IDEMPOTENCY-REPORT.md` §2 | ✅ PASS (all 4 scenarios) |
| 9 | Batch duplicate protection — meals/log (migration 050) | Full first/retry/concurrent/new-id matrix | See `BATCH-IDEMPOTENCY-REPORT.md` §3 | ✅ PASS (all 4 scenarios) |
| 10 | AddFoodModal button reachable, no BottomNav overlap | Opened via real search result click at desktop width (1526×686, past the `lg:1024px` breakpoint that caused the original defect); `elementFromPoint` at the Add button's exact center | Hit-tests directly to the `<button>Add</button>` element — no nav/overlay interception; a real mouse click landed on it and produced a genuine `POST /api/logs/add` (200), updating Today's log to 74 kcal | ✅ PASS |
| 11 | Email verification gate on the AI trial | Code re-inspection only (not exercised live — see note below) | `app/api/chat/analyze/route.ts` still imports and calls `checkAiTrial` (`lib/aiTrialServer.ts`) before any Gemini call; unchanged this pass; covered by the still-green pinned suite | Not independently re-exercised live |

## Notes

**#4, fabricated kcal/macros** — this is a **structural** guarantee, not merely an observed behavior:
`addFoodSchema` (`lib/validations.ts`) has no `kcal`/`protein_g`/`carbs_g`/`fat_g` fields for a
food-linked row at all, so there is no code path by which a client-sent number could reach the
database for `/api/logs/add`, `/api/logs/add-bulk`, or `/api/meals/log` — all three always recompute
from the referenced food's per-100g values server-side. The one place a client-sent macro number *is*
ever trusted (`/api/logs/quick-add` and `/api/logs/edit` for a `food_id: null` quick-add row) still
runs through the same `HEIGHT_CM`/`WEIGHT_KG`-style bounded schema. This was proven live anyway (a
concrete request/response/row triple), not just asserted from reading the schema.

**#11, email verification** — not re-exercised live this pass. Toggling `email_verified_at` on `+qa2`
to test the negative case would mutate a shared fixture account's auth state beyond what a `food_logs`/
`weight_logs`/`saved_meals` cleanup can restore cleanly (auth timestamps aren't a "create it, then
delete it" kind of test), and the code path is unchanged by this pass's diff. Confirmed unchanged via
direct source read (`checkAiTrial` still gates both `/api/camera/analyze` and `/api/chat/analyze`) and
covered by the still-passing pinned suite (`aiTrialServer` has dedicated tests, part of the 1706/1706
green run). If a live negative-case re-check is wanted, it needs a dedicated unverified test account,
not a mutation of `+qa2`.

## Verdict

11 of 11 protections re-confirmed holding; 10 live-tested with a concrete request/response/database
result, 1 (email verification) confirmed unchanged by source inspection + the still-green pinned suite
rather than re-exercised live, for the reason above. No regression found in any of them.
