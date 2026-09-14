# Food Regression Report — Migration 049 Fix-Forward Verification

**Date:** 2026-09-14
**Scope:** Verify migration 049 was correctly applied to the QA/dev database, then completely
re-verify every food-logging flow it blocked, plus the surrounding data-integrity guarantees from the
prior remediation.
**Rule followed:** nothing was fixed or committed during this pass except applying migration 049 to
the QA database (done by Adarsh himself, per his message — not by this session). Production was not
touched.
**Account:** `adarshyadavazm123+qa2@gmail.com` ("Priya QA"), free tier, authenticated session in
Adarsh's real Chrome (Claude-in-Chrome extension). No credentials were entered or viewed.
**Environment:** local dev server (`npm run dev`), uncommitted remediation branch, against the shared
dev Supabase project (`zbhufeorpdnlbbcdnmzb`).

## Environment notes

- The Claude-in-Chrome extension disconnected once mid-session (likely because the Chrome window had
  been minimized) and was reconnected by Adarsh. After reconnecting, the window had real, non-zero
  dimensions for the entire remainder of this pass — screenshots, real coordinate clicks, and the
  accessibility-tree reader all worked, unlike the fully-blind previous session.
- The local dev server itself had stopped (stale from the prior session) and was restarted
  (`preview_start` → `health-app-dev`); the authenticated session survived across the restart with no
  re-login needed.
- One methodology correction, recorded here so it isn't mistaken for a finding: an early check of the
  "Previous day" date-navigation chevron appeared to do nothing after a 1-second wait, three times in a
  row. Investigating further (comparing against the "Today" pill button, which uses the identical
  `router.push` mechanism and worked immediately) showed this was **dev-server route-compilation
  latency**, not a bug — a later check confirmed the navigation had completed correctly, just slower
  than my wait window. Verified working correctly once given enough time; **not** listed as a defect
  below.

---

## Phase 2 — Migration verification

Verified directly against the live database schema (read-only introspection; no writes to catalog
metadata). Two methods were used, both without needing the browser:

**Column existence, type, nullability** — via PostgREST's OpenAPI schema endpoint
(`GET /rest/v1/` with `Accept: application/openapi+json`; this endpoint requires a secret key, so the
already-present `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` was used for this one read-only
introspection call):

| Check | Result | Evidence |
|---|---|---|
| 1. `food_logs.client_request_id` exists | **PASS** | Column appears in the live schema's `food_logs` property list: `[..., 'context', 'copied_from_id', 'client_request_id']` |
| 2. Type is `uuid` | **PASS** | `{"format": "uuid", "type": "string"}` — PostgREST's standard representation of a Postgres `uuid` column |
| 3. Nullable | **PASS** | Absent from the table's `required` array (`["id","user_id","meal","servings","grams","kcal","protein_g","carbs_g","fat_g","logged_at"]`) — PostgREST lists NOT-NULL-no-default columns as required, and this one isn't there |

**Composite unique index behavior** — verified live, through the actual application code path
(`POST /api/logs/add`, using the real authenticated session — not a raw database write):

| Check | Result | Evidence |
|---|---|---|
| 4. Unique index on `(user_id, client_request_id)` | **PASS** | Two `POST /api/logs/add` calls with the **same** `client_request_id` returned the exact same row id (`12d837d9-...`) both times — the second recovered via `insertIdempotent`'s `23505`-conflict path, proving the constraint exists. A third call with a **different** key for the same user created a genuinely new row (`e4f48eed-...`), ruling out an overly-broad index (e.g. one scoped to `user_id` alone) |
| 5. Predicate `WHERE client_request_id IS NOT NULL` | **Inferred, not independently distinguishable behaviorally** | A plain (non-partial) unique index on the same two columns would behave identically for this test — Postgres never treats two NULLs as equal in a unique index, partial or not, so no insert-based test can tell the two apart. Confidence instead comes from: the migration file's literal text (read in Phase 1, unchanged since), Adarsh's confirmation it was applied "exactly as provided," and the index's existence being confirmed above — a single `CREATE UNIQUE INDEX ... WHERE ...` statement either runs in full or fails atomically, so there is no plausible partial-application state here |

**A. Migration verified?** Yes — items 1–4 directly confirmed; item 5 inferred with high confidence
for the reasons above, not independently provable by any test.

---

## Phase 3 — Smoke test

| Test | Result | Evidence |
|---|---|---|
| `POST /api/logs/add` (real food, valid grams/servings) | **PASS** | `200`, row persisted, `kcal: 214` (107 kcal/100g × 200g, correct) — no more `"client_request_id column not found"` |
| `POST /api/logs/quick-add` | **PASS** | `200`, row persisted |

The P0 from the prior regression pass is resolved.

---

## Phase 4 — Complete food end-to-end regression

Driven through the real, authenticated UI wherever the environment allowed real clicks (it did, for
almost all of this phase — see the one exception below), cross-checked against the underlying API/DB.

### Search
| Test | Result |
|---|---|
| Open Food, type a query ("paneer") | **PASS** — results loaded, correctly ranked (Paneer Cottage Cheese, branded Amul/Milky Mist variants, Kadai/Matar/Palak Paneer dishes) |
| Loading state | **PASS** — skeleton placeholders shown while the query resolved |
| Successful results | **PASS** |
| Repeated search (dal, roti, paneer, protien, curd, dahi) | **PASS** — all returned sensible, live-catalogue results across this whole session |
| Empty results / clear search | **NOT independently tested this pass** — not attempted with a query guaranteed to return zero rows |

### Add
| Test | Result | Evidence |
|---|---|---|
| New food add | **PASS** | Opened "Paneer (Cottage Cheese)" from search, full quantity-editor flow |
| Quantity editor — decimal | **PASS** | Set `2.5` katori → `994 Cal`, `68.6g` protein, `78g` fat — correct scaling live in the UI |
| Minimum valid quantity / zero quantity | **PASS** | Setting `0` auto-corrected to `0.25` (≈38g) on blur — a sensible non-zero floor, not a crash or a silently-accepted zero-calorie log |
| Invalid (negative) quantity | **PASS** | A `-5` value was rejected at the input level before reaching app state (the number input's own `min` semantics stripped it) |
| Very large quantity | **PASS (client), PASS (server)** | Typing `500` (→ 75,000g) auto-clamped on blur to `66.66` units (≈9,999g, just under the 10,000g server cap) — good defensive UX. A low-level programmatic value-set that bypasses the blur handler can transiently *display* an uncomputed absurd total (a testing-tool artifact, not a real typing path); this is never submitted, since the same blur-time clamp runs before Save is reachable in the real flow, and the server independently rejects >10,000g regardless (Phase 5A) |
| Meal selection | **PASS** | Breakfast/Lunch/Dinner/Snack selectable; correctly reflected in the persisted row (confirmed via edit test moving Lunch → Dinner) |
| Save | **PASS (logic), FAIL (reachability at one viewport) — see finding F1 below** |

**Finding F1 (new, pre-existing, not caused by this remediation):** at a viewport of 1140×678 (a
real possible size class — comparable in height to an iPhone SE at 375×667 portrait), the
`AddFoodModal`'s sticky "Add" submit button is **completely unclickable**. `document.elementFromPoint`
at the button's left edge, exact center, and right edge all resolve to the persistent `BottomNav`
bar instead of the button, across the button's *entire* width — not just where the nav's camera FAB
sits. Both elements are `position: fixed` (`AddFoodModal` at `z-50`, `BottomNav` at `z-40`), and no
transform/filter/`contain`/`isolation` was found on any of the 10 ancestors between the button and
`<body>` that would explain the nav painting on top despite its lower z-index — the exact mechanism
was not fully root-caused in the time available for this pass, only the reproducible symptom. A
synthetic `.click()` call directly on the button (bypassing hit-testing) *does* correctly submit and
persist a row with the right values — so the underlying submit logic, validation, and server contract
are all intact; only the mouse/touch-reachable click path is broken at this viewport height.
**Confirmed unrelated to this remediation**: `AddFoodModal.tsx`'s only change in the whole remediation
branch is a non-layout `clientRequestIdRef` addition (R8) — nothing touching its JSX/CSS. **Not fixed,
per instructions** — flagged for a follow-up pass with a real device or a shorter test viewport.

### Edit
| Test | Result | Evidence |
|---|---|---|
| Open existing log via "Edit" button | **PASS** | `EditFoodLogModal` (a Radix dialog, different component from `AddFoodModal`) opened correctly, no occlusion issue — "Save changes" was fully reachable |
| Normal quantity edit | **PASS** | Changed `0.5` → `0.75` katori live in the UI; preview correctly recalculated (`161 kcal`, `11g P`, `27g C`, `1g F`) before saving |
| Valid kcal/macros behavior | **PASS** | Saved; "Entry updated" toast; Dinner entry updated to `150g · 161 kcal · P11 C27 F1`; Today's log total updated to `161 kcal` — all in the same page load, no manual reload needed (confirms TanStack Query invalidation fired correctly) |
| Attempt fabricated kcal/macros | **PASS** | `PATCH /api/logs/edit` with in-bounds but fabricated `{kcal:4999, protein_g:400, carbs_g:900, fat_g:400}` on a real 200g-Chana-Dal row (true kcal 214) — server silently ignored all four and returned/persisted the *true* recomputed values (`kcal:214, protein_g:14.2, carbs_g:36.4, fat_g:1`), confirmed both in the API response and by re-fetching the row afterward. (An out-of-bounds attempt, `kcal:9999`, correctly 400'd at the validation layer before ever reaching the recompute logic — a distinct, also-correct defense.) |
| Save | **PASS** |
| Verify resulting persisted record | **PASS** | Confirmed via `GET /api/logs` matching exactly what the UI displayed |

### Delete
| Test | Result | Evidence |
|---|---|---|
| Delete food (real click on the trash icon) | **PASS** | "Entry deleted" toast with an Undo action appeared |
| Verify removal from UI | **PASS** | Lunch entry vanished from Today's log immediately, no reload |
| Verify removal from database | **PASS** | `GET /api/logs` confirmed the row gone |
| Verify Home totals update | **PASS** | Today's log total recalculated correctly (`161 → 108 kcal` after removing the 54 kcal entry); separately confirmed on `/dashboard` earlier in this same pass after an API-driven delete (`311 → 161 kcal`) |

### Duplication / concurrency
| Test | Result | Evidence |
|---|---|---|
| Two identical adds (same `client_request_id`) | **PASS** | Second request returned the identical row id as the first; `GET /api/logs` confirmed only one row exists for that key — see Phase 2, item 4 |
| Idempotency key behavior | **PASS** | A different key for the same user correctly created a separate row — composite scoping confirmed, not a blanket per-user lock |
| Repeat with quick-add | **Verified via shared code path + unit tests, not independently duplicate-tested live this pass** | `/api/logs/quick-add` uses the identical `insertIdempotent` helper as `/api/logs/add` (same function, same migration); `tests/routeLogsQuickAdd.test.ts` (part of the 1686 passing) pins its duplicate-key recovery behavior directly against a mocked DB |

### Cache / consistency
Verified after every mutation above: Food's Today's-log panel updated **in the same page session**
(no manual reload) for both the edit and the delete, confirming `queryClient.invalidateQueries` fires
correctly. Home (`/dashboard`) was cross-checked earlier in this pass via reload and matched exactly.
Progress was checked via a fresh navigation (not isolated for same-session reactivity specifically) and
showed internally consistent numbers. No stale state, no duplicate records, no incorrect totals
observed anywhere in this pass.

---

## Phase 5 — Data integrity regression

**A. Saved meal bounds**
| Test | Result |
|---|---|
| `grams: 999999999` via `/api/logs/add` | **PASS** — `400 "Grams cannot exceed 10,000"`, no row persisted |
| `servings: 99999` via `/api/logs/add` | **PASS** — `400 "Servings cannot exceed 99"`, no row persisted |
| Same absurd `grams` via `/api/meals/saved` | **PASS** — `400 "Grams cannot exceed 10,000"` |
| Totals not corrupted | **PASS** — nothing persisted, so no aggregate was ever touched |

**B. Fabricated nutrition** — see Phase 4/Edit above. **PASS**, confirmed live against a real row.

**C. Duplicate requests** — see Phase 4/Duplication above. **PASS**.

---

## Phase 6 — Batch endpoint assessment (`/api/logs/add-bulk`, `/api/meals/log`)

Carried forward from the prior session's code-level analysis (nothing in either route changed since,
so nothing to re-verify live):

1. **Used by a normal production journey?** Yes, both. `add-bulk` backs camera multi-food scans
   (`hooks/useCameraScan.ts`) and AI chat logging (`hooks/useChatLog.ts`) — two headline features.
   `meals/log` backs tapping a saved meal combo (`hooks/useFoodSearch.ts`'s `logSavedMeal`).
2. **Can the same logical operation be submitted twice?** Yes. All three call sites guard only with a
   client-side `useState`/state-machine flag (`logging`, the `'logging'` state, `loggingMealId`) —
   exactly the pattern `CLAUDE.md`'s own hard rule says "does not close a same-tick double-tap or a
   retry after a timeout."
3. **Can it produce duplicate food logs?** Yes — a duplicate submission re-inserts **every item in the
   batch**, not one row: a whole camera scan, a whole chat-logged meal, or a whole saved combo, twice.
4. **Does it need idempotency protection?** Yes, by the same reasoning that justified R8 (this
   remediation) and migrations 046–048.
5. **Is it safe to defer?** **Yes, for this branch specifically** — it is a pre-existing gap that
   predates this remediation entirely (neither route was touched by 046–049), and merging this branch
   neither creates nor worsens it. It is **not** a safe thing to defer indefinitely: it is a real,
   already-live production risk today, and duplicating a whole meal corrupts Home/Progress/streak/
   deficit totals more severely than the single-row bug R8 just fixed. A fix needs a different shape
   than `client_request_id` on `food_logs` (every row in one batch would collide against itself under a
   single-column key) — most likely a small batch-marker table keyed by `(user_id, client_request_id)`,
   checked once before the batch insert. Recommended as a near-term follow-up, not a blocker for this
   branch.

---

## Phase 7 — Food → Home → Progress consistency

Covered inline above (Phase 4's Edit/Delete tests, both confirmed same-session, no-reload UI updates)
and in this session's earlier segment (Phase 3/4 of the prior pass): create → Food shows correct
quantity/kcal/macros/meal/date → Home's ring and meal list update correctly → edit updates all three →
delete reverts all three. No stale TanStack Query state or missed invalidation found anywhere this was
tested. Progress's same-session (non-reload) reactivity specifically wasn't isolated as its own test.

---

## Phase 8 — IST date regression

| Test | Result |
|---|---|
| Date assignment via the legitimate `date` query param | **PASS** — `/log?date=2026-09-13` correctly rendered "Yesterday" with a "Today" pill shown |
| Today vs yesterday grouping | **PASS** |
| "Today" button navigation | **PASS** — instant `router.push` back to `/log` |
| "Previous day" chevron navigation | **PASS** — confirmed correct after accounting for dev-server route-compilation latency (see Environment notes); not a real defect |
| Home/Progress grouping | **PASS** — consistent with the diary throughout this pass |
| Streak effects | Not independently exercised this pass (no multi-day logging sequence was run) |

Per instructions, no artificial timestamp injection was attempted — only the legitimate `date`
parameter and UI navigation were used.

---

## Phase 9 — Form / input regression

| Test | Result |
|---|---|
| Decimal | **PASS** |
| Zero | **PASS** (clamped to a sensible minimum) |
| Negative | **PASS** (rejected at the input level) |
| Extremely large | **PASS** (client clamps on blur; server independently rejects past-bound values) |
| Repeated submission / double-tap | **PASS** (server-side idempotency collapses it regardless of client behavior — Phase 4/5C) |
| Empty quantity, whitespace, malformed (non-numeric) values | **Not independently tested this pass** — a native `type="number"` input already blocks non-numeric keystrokes at the browser level, which limits the value of this test without deliberately bypassing the input type |
| Save while request pending / cancel during pending request | **Not tested this pass** — would need a simulated network delay against real clicks; not pursued given the time already spent isolating finding F1 |

Both server-side validation (Zod bounds, confirmed via direct API calls) and client-side UX guards
(blur-time clamping) were exercised and found correct wherever tested.

---

## Phase 10 — AI flow (curd matching regression)

No live Gemini call was made this pass, per instructions.

| Check | Result | Evidence |
|---|---|---|
| `tests/foodMatch.test.ts` (NEW-2's 3-test describe block + the rest of the file) | **PASS** | 14/14 tests passing, re-run fresh this session |
| Live catalogue grounding for the NEW-2 fixture | **PASS** | `GET /api/foods/search?q=curd` against the real dev database returns `"Dahi / Curd (full fat)"` ranked above `"Curd Rice (Thayir Sadam)"` — confirms the real catalogue contains rows matching the test's premise, on the adjacent (and unaffected) main search-ranking system |
| Candidate matching (the actual `foodMatch.ts` code path used by camera/chat) | Covered by the unit tests above; no HTTP surface exists to exercise it without a real or injected Gemini response |
| Malformed response handling, unknown food, multiple food result, user correction, save after correction | **Not tested this pass** — all require either a live Gemini call (deliberately avoided) or driving the chat/camera modal UI end-to-end with a mocked model response, which this session's tooling has no injection point for outside the existing Vitest mocks |

---

## Phase 11 — Automated regression

No code was changed this pass (only migration 049 was applied to the QA database, by Adarsh), so no
new regression tests were added — finding F1 (the Add-button occlusion) is a real, reproducible layout
defect but is a pixel-layout/stacking issue that Vitest+jsdom cannot meaningfully assert on; it needs a
visual/device pass, not a unit test, and per instructions nothing was fixed this pass regardless.

| Gate | Result |
|---|---|
| `npm test` | **PASS** — 1686/1686 tests, 133 files |
| `npx tsc --noEmit` | **PASS** — no errors |
| `npm run lint` | **PASS** — no warnings |
| `npm run check:tokens` | **PASS** — 0 violations |
| `npm run build` | **PASS** — `/progress` holds at 11.3 kB own / 302 kB First Load JS |

---

## Phase 12 — Production migration safety

Unchanged from the prior session's analysis (nothing new since; production was not touched):

- The migration (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS ...
  WHERE client_request_id IS NOT NULL`) is safe and fully reversible. Adding a nullable column with no
  default is a fast, non-blocking metadata-only change; every existing row gets `NULL` automatically and
  the partial index initially covers zero rows, since nothing has the column set yet.
- **Deployment order is the one thing that must not be gotten wrong**: migration 049 must be applied to
  production **before** this code deploys, or production will hit the identical P0 this pass just
  verified fixed in QA.
- `food_logs` RLS is row-scoped only (`auth.uid() = user_id`) — no policy changes are needed for this
  migration.
- One recommendation for production specifically (not applied, not required for QA): the migration
  file's plain `CREATE UNIQUE INDEX` takes a write-blocking lock on `food_logs` for the build duration.
  Given `food_logs` is almost certainly far larger than `weight_logs`/`exercise_logs` (users log food
  multiple times a day vs. once), consider `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` for the
  production run to avoid locking writes during deploy.
- **Migration 049 was NOT applied to production during this pass**, per instructions.

---

## Newly discovered bugs this pass

- **F1 — `AddFoodModal`'s "Add" button is unreachable by mouse/touch at short viewport heights
  (~678px and below)**, fully covered by the persistent `BottomNav`. Real, reproducible, pre-existing
  (not caused by this remediation — the modal's only change in this branch is a non-layout field
  addition). The underlying submit logic works correctly when reached; only the click path is blocked.
  Not fixed, per instructions — recommended as a follow-up, ideally verified on a real short-screen
  device (e.g. iPhone SE) alongside a proper root-cause of the z-index/stacking mismatch.

No other new bugs were found. All previously-fixed issues (R2, R4, R6, R7, R8, NEW-1 (unit-tested,
not re-verified live), NEW-2, NEW-3, Phase C bundle size) remain fixed, and R8 is now confirmed
working **live**, which the prior pass could not do because of the P0 this pass resolved.

---

## Final answers

**A. Is migration 049 correctly applied to the QA database?** Yes — column, type, and nullability
directly confirmed via schema introspection; the composite unique index confirmed behaviorally through
the real app code path. The exact partial predicate isn't independently provable by any test (a
non-partial index would behave identically), but there's no plausible mechanism for a partial
application here.

**B. Does normal food logging work end-to-end again?** Yes. Search, add (including the full quantity
editor), edit (including the fabricated-value defense), and delete all work correctly against the real
database, both via direct API calls and via real UI clicks — with the one exception of finding F1
(the Add button is unreachable by click at a specific short viewport height; the underlying add logic
itself is intact and was proven via a direct fetch and via a synthetic click bypassing the occlusion).

**C. Does quick-add work?** Yes — confirmed via smoke test (200, row persisted); its duplicate-key
idempotency specifically was verified via the shared code path and passing unit tests rather than a
fresh live duplicate-submission test this pass.

**D. Does edit work?** Yes, fully, including the fabricated-kcal/macros defense confirmed live against
a real persisted row.

**E. Does delete work?** Yes, fully, confirmed via real UI click with correct toast, UI update, DB
removal, and Home-total recalculation, all in the same page session.

**F. Does concurrent duplicate protection work?** Yes — confirmed live: an identical repeated request
returns the same row rather than creating a duplicate, and a genuinely different request still creates
a new row.

**G. Are fabricated nutrition values prevented?** Yes — confirmed live against a real row: in-bounds
fabricated kcal/protein/carbs/fat are silently discarded and recomputed from the linked food, both in
the API response and the persisted database row.

**H. Are Home and Progress consistent?** Yes, wherever tested — Home confirmed to update in real time
(no reload) after edit and delete; Progress confirmed internally consistent on fresh navigation.
Progress's same-session (no-reload) reactivity specifically wasn't isolated as its own test.

**I. Is batch logging a release blocker?** Not for this branch — it's a real, pre-existing,
already-live gap that this remediation neither introduced nor worsened (add-bulk/meals/log were never
touched). It should be prioritized as a near-term follow-up given its severity (a full meal duplicates,
not one row), but it does not block shipping this migration/idempotency fix.

**J. Are all five gates green?** Yes — 1686/1686 tests, clean tsc/lint/tokens, successful build.

**K. What remains before release?**
1. **Apply migration 049 to production before deploying this code** (not after — see Phase 12).
   Consider `CREATE UNIQUE INDEX CONCURRENTLY` for the production run.
2. Investigate and fix finding F1 (Add-button occlusion at short viewport heights) — ideally on a real
   short-screen device — before or shortly after this ships, since it can make the primary "Add" action
   unreachable for some users.
3. Batch-endpoint idempotency (`add-bulk`, `meals/log`) — a real, live, pre-existing risk; not a
   blocker for this branch, but worth its own near-term fix given the severity of a duplicated meal.
4. A live (not just unit-tested) pass on the AI chat/camera correction flow, with a real or injected
   Gemini response, remains outstanding — deliberately deferred again this pass to avoid an
   unnecessary/non-deterministic live model call.
5. Minor test gaps noted in Phases 4/9 (empty search results, empty/whitespace/malformed quantity
   input, save-while-pending/cancel-while-pending) were not exercised this pass.

Nothing was committed, pushed, or deployed to production during this pass.
