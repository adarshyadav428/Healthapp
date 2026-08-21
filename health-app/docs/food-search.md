# Food search — pipeline, ranking and synonyms

> Extracted verbatim from `CLAUDE.md` so the always-loaded file stays lean. **Read this before
> changing anything in `app/api/foods/search/route.ts`, `lib/searchRanking.ts`, `lib/searchFilter.ts`,
> `lib/food-synonyms.ts`, `lib/mergeSearchResults.ts` or `lib/searchCache.ts`.** Almost every rule
> below is a scar: it records a specific query that returned the wrong food, and the tier or guard
> that fixed it. Changing one tier in isolation reliably breaks a different query.

### Food search pipeline

`app/api/foods/search/route.ts` runs three sources in parallel, ranked by relevance:

1. **Local DB** — synonym-expanded `ilike` across the `foods` table, holding both the measured `ifct` rows (most accurate for Indian home cooking) and the estimated `curated` long tail. Rows are fetched 200-deep — Postgres applies `LIMIT` before the in-memory sort, so a tight limit hands back an arbitrary slice (measured: at 60, "rice" and "dal" returned a different top result purely because of where the slice fell).

**Multi-word queries match word by word, not as a literal string** (`lib/searchFilter.ts`): a term of two or more words becomes `and(name.ilike.%word1%,name.ilike.%word2%)`. `%bhutta corn%` required adjacency in that exact order, so "bhutta corn" found nothing and "biryani chicken" found nothing that "chicken biryani" found. The words are sanitized before the `and(...)` is assembled, so the grouping is ours alone and the injection guard in `tests/searchFilter.test.ts` still holds.

Ordering lives in `lib/searchRanking.ts` (`compareFoodsForQuery`), which is passed the **whole synonym list** and ranks in two tiers: **typed word (relevance → coverage → plain form) → synonym matches (relevance → coverage) → `SOURCE_RANK` → shorter name → alphabetical**.

**Coverage is measured against the best *reading* of the name, and the plain food outranks dishes made from it.** Our names carry their regional gloss in parentheses or after a slash ("Cooked Rice (Chawal)", "Kheer / Rice Pudding"); `nameReadings` strips it so the gloss doesn't dilute coverage — counting it made "rice" cover 1 of 3 words in "Cooked Rice (Chawal)" and lose the coverage tier to the two-word dish "Jeera Rice". `isPlainForm` then asks whether anything is left of the gloss-stripped name but the query words and preparation qualifiers (`QUALIFIERS`: cooked, raw, steamed, …) — that tier is what makes "rice" answer with rice instead of Jeera Rice, Sambar Rice and Curd Rice, which match the word and cover their names exactly as well. Relevance scores a **complete-word match above a mere prefix** — "starts with" is not evidence of being the food, which is how a biscuit called "milk bikis" beat "Toned Milk" and "Chai Latte Stick" beat "Masala Chai". Coverage is a yes/no signal (`isCoverageDominant`, ≥50% of the name's words), not a raw fraction: ranking on the fraction sorts by name length among equally-relevant rows and punishes descriptive IFCT names. Shortest-name is the last resort because it picks the plain food over the elaborated one. The tier order is load-bearing in both directions — score only against the typed word and a row reached via a synonym ties at zero and falls to source rank ("anjeer" returned an OFF protein bar above "Figs (Dry)"); let synonyms compete equally and they hijack the query ("bhutta" returned "Cornflakes", since `corn` is a synonym and matches that name more completely). Source rank comes last on purpose — it breaks a tie between comparable matches (measured IFCT over a `curated` estimate), and must never promote a poorly-matching row from a trusted source above a good one. Coverage exists because "Bhutta (Roasted Corn)" and "Black bean crusted cod with roasted corn & red pepper salsa" both contain every query word, but only one *is* the dish. `capOpenFoodFactsDominance` (`lib/mergeSearchResults.ts`) then holds OFF to 10 of the 20 slots: every OFF row we display is persisted into `foods`, so popular queries silently accumulate near-identical packaged products that crowd out Indian food — "corn" once returned twenty cornflakes variants and no roasted corn cob.

**Synonyms are load-bearing, and their order matters.** `buildNameIlikeOrFilter` keeps only the first 6 terms, so put the widely-typed spellings first in each group in `lib/food-synonyms.ts`. A group expands the query only when the query **is** one of its terms, or is a phrase **containing** one as a whole word ("chicken biryani" → the biryani group). The reverse — the query sitting inside a longer synonym — is deliberately not a match: it fired for every group that merely *mentions* a common word, so "rice" dragged in kheer ("rice pudding"), poha ("flattened rice") and murmura ("puffed rice") and the results filled with foods that are not rice. A food whose regional names share no substring (corn: bhutta / makki / makkai / challi / maize) is unreachable without a group — `tests/foodSynonyms.test.ts` guards this.
2. **Open Food Facts India** — `lib/open-food-facts.ts` → `world.openfoodfacts.org` filtered to `countries_tags:en:india`. Best for packaged/branded Indian products (Amul, Britannia, MTR).
3. **Open Food Facts World** — international packaged goods fallback.

Every OFF row that surfaces is also written into the `foods` table (`persistExternalFoods`), so the *first* successful search for a packaged food anywhere makes it permanently local for every user.

**Failure handling — do not regress this.** The OFF helpers return `{ foods, ok }`, never a bare array: `ok: false` means the request timed out (5 s), errored, or returned non-2xx, which is *not* the same as "OFF has nothing". The route's in-memory result cache is keyed by query alone and therefore **shared across all users**, so caching a failure is expensive — a result assembled while either OFF endpoint was down gets `DEGRADED_CACHE_TTL_MS` (10 s) instead of the normal 120 s. `lib/searchCache.ts` (`TtlCache`) holds that logic so it stays testable. The service worker also serves `/api/foods/search` `NetworkOnly` (`next.config.js`, prepended via `extendDefaultRuntimeCaching`) — the default `apis` rule is NetworkFirst with a 10 s network timeout and would hand a phone a previous query's results. Symptom when these break: a food is invisible on mobile, visible on desktop, then visible on mobile again.

Results are deduplicated by name and returned with a `source` label (`ifct` / `curated` / `off_india` / `off_world`). Rows with `source = 'estimate'` are excluded — that label means a per-user AI guess written into the shared table by camera/chat logging, and only the user who created one ever sees it back. USDA is permanently excluded.

## The food data sources

- **`lib/indian-foods-data.ts`** — 225 hand-curated IFCT 2017 entries auto-seeded into the `foods`
  table on first request. **Measured.**
- **`lib/curated-foods-data.ts`** — ~645 generated `curated` entries (estimates, not measurements)
  seeded alongside them in the same pass. Drops any name that duplicates an IFCT entry at import
  time, so the measured row is the only one in the table. Generated by
  `scripts/generate-indian-foods-estimate.ts` → `data/indian-foods.json`. **Never hand-edit the
  JSON** — fix the generator and re-run it, and keep `tests/curatedFoods.test.ts` green; it is what
  stops a meat dish shipping with a carb dish's protein.
- **`lib/food-synonyms.ts`** — Hindi/regional name synonym expansion, run before every search.

## Tests that pin this

`tests/searchRanking.test.ts`, `tests/searchFilter.test.ts` (including the injection guard),
`tests/foodSynonyms.test.ts`, `tests/mergeSearchResults.test.ts`, `tests/searchCache.test.ts`,
`tests/openFoodFacts.test.ts`, `tests/curatedFoods.test.ts`, `tests/foodMatch.test.ts`.
