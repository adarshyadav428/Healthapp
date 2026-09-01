# Duplicate-cluster corrections (migration 043) — verification sheet

`supabase/migrations/043_correct_duplicate_cluster_rows.sql` corrects rows found while building the
search-result collapse (`collapseDuplicateFoods`, `lib/mergeSearchResults.ts`) and its data-quality
guardrail (`tests/foodDataQuality.test.ts`). Collapsing hard-merges every cluster of same-food rows
down to one at search time and `FoodResult.tsx` no longer badges the survivor by source, so a wrong
number in the surviving row is no longer visible as a spread the user could notice and cross-check
themselves. This sheet exists so a correction's provenance is recorded the same way `041`'s is
(`docs/branded-foods-041-verification.md`), in the same "what was corrected and how it was checked"
style — not because these rows are branded.

## Corrected

### Boiled Egg (Anda) — `ifct`, `source_id = ifct-egg-boiled`

**Symptom.** Searching "boiled egg" returned three cards for one food: a `curated` estimate at
108 kcal/100g, this measured `ifct` row at 173 with fat 13.3 g, and an Open Food Facts row at 140 —
each wearing a source badge asking the user which to trust.

**What was wrong.** The row's fat field (13.3) reads as a copy-paste of its protein field (also
13.3), and its stated kcal (173) is exactly `4×13.3 + 9×13.3` rounded — internally *consistent* with
the wrong fat. An Atwater-consistency check cannot catch this class of bug, because the row agrees
with itself; only checking the source can.

**Checked against.** IFCT 2017 itself, via the machine-readable dataset at
[`nodef/ifct2017`](https://github.com/nodef/ifct2017) (`compositions/index.csv`), code `M004`,
description "Egg, poultry, whole, boiled":

| Field | IFCT 2017 (M004) | Our row (before) | Our row (after) |
|---|---:|---:|---:|
| Energy | 618 kJ (≈ 148 kcal @ 4.184 kJ/kcal) | 173 kcal | 148 kcal |
| Protein | 13.43 g | 13.3 g | 13.4 g (unchanged, already correct) |
| Fat | 10.54 g | 13.3 g | 10.5 g |
| Carbohydrate | 0 | 0 | 0 |
| Fibre | 0 | 0 | 0 |

Protein was already right to one decimal and is untouched. Energy and fat are corrected to the
published figure rather than re-derived from the row's own (wrong) macros.

**Where fixed.** `lib/indian-foods-data.ts` directly — that file is hand-curated, not generated, so
the seed source of truth is corrected in the same commit as the migration. `043` retroactively
corrects any database that already seeded the wrong value; on a fresh database seeded from the
corrected `lib/indian-foods-data.ts` directly, `043`'s guard makes it a no-op.

**Side effect worth knowing.** The `curated` "Boiled Egg" duplicate no longer exists in the seed data
at all as of this same change — `lib/curated-foods-data.ts`'s IFCT-collision filter now compares by
`foodClusterKey` instead of exact name, and "Boiled Egg" clusters with "Boiled Egg (Anda)" once the
gloss is recognised as a translation (`anda` and `egg` share a synonym group in
`lib/food-synonyms.ts`). It was dropped by regenerating, not by any statement in `043`.

## Found in review, deliberately not a migration statement

**Corn Chaat — duplicate generator input, not a wrong production value.** The curated dataset's
generator (`scripts/generate-indian-foods-estimate.ts`) listed `'Corn Chaat'` twice — once under the
`street` category, once under `snack` — each producing a different macro estimate for the identical
literal name (264.5 vs 219.9 kcal). Caught by `tests/foodDataQuality.test.ts`'s cluster-disagreement
check. Fixed by removing the `snack` occurrence and re-running the generator
(`npx tsx scripts/generate-indian-foods-estimate.ts`), which changes a `source_id` in
`data/indian-foods.json` rather than any row's stored values — nothing for a migration to `UPDATE`.
Any already-seeded duplicate `source_id` from the old generated file is superseded going forward by
`collapseDuplicateFoods` electing a single surviving row at search time regardless.

**The four provenance-failed `041` rows** (`docs/branded-foods-041-verification.md`) are unaffected by
this migration. `collapseDuplicateFoods` will now elect the measured `ifct` row over each of them at
search time (`ifct` outranks `branded` in `SOURCE_RANK`), which resolves what the *user* sees without
correcting the underlying `branded` row's numbers — those still need a pack-in-hand read and remain
tracked in that sheet.
