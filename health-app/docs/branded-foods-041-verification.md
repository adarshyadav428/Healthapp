# Branded foods (migration 041) — verification sheet

`supabase/migrations/041_branded_foods_v2.sql` adds 43 `source='branded'` rows. `branded` sits at
`SOURCE_RANK` 4 (`lib/foodMatch.ts`), above every Open Food Facts row and every generated estimate,
so these numbers win in search. That ranking is only earned if the numbers are right.

**Provenance, stated plainly:** these are as-published nutrition-panel values, entered on
**2026-08-31** from product labels and brand sites. They were **not** read off a pack in hand. Nothing
here is invented — every row is a real SKU with a real panel — but until a line below is ticked, treat
it as unverified.

## How to correct one

Never delete. `food_logs`, `food_favourites`, `saved_meal_items` and `food_dismissals` all reference
`foods` `ON DELETE CASCADE`, so one delete wipes that food from every user's diary with no error. A
correction is a guarded, idempotent `UPDATE` keyed on `source_id`, in the style of
`038_correct_mislabelled_food_rows.sql`:

```sql
update foods
   set kcal_per_100g = 560, fat_g_per_100g = 41.0
 where source = 'branded'
   and source_id = 'branded-haldirams-nut-cracker'
   and kcal_per_100g = 586;   -- guard: only the row as this migration wrote it
```

Past diaries do not move — `food_logs` snapshots its own kcal and macros at log time.

## Check these four first

Highest search volume, so a wrong number here costs the most:

1. **Haldiram's Nut Cracker Namkeen** — the product this whole migration started from.
2. **Amul Butter** — the catalogue had no butter row at all before this.
3. **Aashirvaad Whole Wheat Atta** — logged daily, and the per-roti serving matters as much as the panel.
4. **Nescafé Classic Instant Coffee** — already corrected once during authoring (carbs were entered at
   42 g instead of ~75 g; instant-coffee solids are mostly carbohydrate).

## Provenance failures found in review (2026-08-31)

These four rows did not hold up. **None of their numbers has been changed.** Correcting them needs a
panel read off a pack, and guessing one would make a rank-4 row more confidently wrong, not less.
Until each is ticked, treat these as *less* trustworthy than the unreviewed rows below.

| Row | What is wrong | ✓ |
|---|---|:-:|
| **Amul Butter (Pasteurised)** | Duplicates `ifct-butter` ("Butter (Amul)", `007`) and `ifct-amul-butter-unsalted` (`017`) — same brand, same 720/0.5/~0.5/80. The migration header's claim that no butter row existed is false. Three rows for one product, and the `ifct` one outranks this at rank 6 vs 4. | ☐ |
| **Haldiram's Rasgulla (Tin)** | Duplicates `ifct-rasgulla` (186, 4.5, 40.2, 1.5) with protein changed to 2.5 — same kcal, same fat, carbs within 0.2. Two visible rows disagree by 80% on protein, and whichever the user taps decides their day. | ☐ |
| **Nutrela Soya Chunks (Raw)** | 345/52.0/33.0/0.5/13.0 is byte-identical to `ifct-soya-chunks-dry` (`017`); `010` holds a third row. These are generic IFCT values wearing a brand name, not a Nutrela panel. | ☐ |
| **Aashirvaad Whole Wheat Atta (Raw)** | 341/12.0/69.0/1.5 is `ifct-atta`'s generic wheat-flour data (341/12.1/69.4/1.7), fibre aside. This is also one of the four highest-traffic rows listed above. | ☐ |

**Removal is not available as a fix.** `foods` has no soft-delete column and `DELETE` is forbidden —
`food_logs`, `food_favourites`, `saved_meal_items` and `food_dismissals` all cascade off it. Search
dedupes by normalised name + brand (`lib/mergeSearchResults.ts`), so renaming a duplicate to collide
with the row it duplicates *would* collapse it behind the higher-ranked IFCT row. That is a product
decision about what users see in search, not a data correction, and has not been taken.

### Corrected in `042_correct_branded_041_rows.sql`

- **Amul Pure Cow Ghee** — the row disagreed with itself about a tablespoon: `serving_size_g = 10`
  with `'1 tbsp (10g)'`, while its own `common_portions` said 14 g, and the two surface in different
  places (the food page renders the description, the add-modal reads the portions). `042` aligns the
  portions to the row's own stated serving, matching the Amul Butter row beside it. **Still open:**
  whether a tablespoon of ghee is 10 g or ~14 g — and note that `/ghee|butter/` in
  `lib/portion-units.ts` shows 15 g regardless, because a name match suppresses `common_portions`
  entirely.

## All rows

Per 100 g unless the name says otherwise. "Serving" is `serving_size_g`, the pack serving the row
opens on.

| Food | kcal | P | C | F | Fibre | Serving | ✓ |
|---|---:|---:|---:|---:|---:|---:|:-:|
| Haldiram's Nut Cracker Namkeen | 586 | 20.5 | 27.0 | 44.0 | 5.0 | 30 g | ☐ |
| Haldiram's Salted Peanuts | 578 | 25.8 | 16.1 | 49.2 | 8.0 | 30 g | ☐ |
| Haldiram's Masala Peanut Namkeen | 570 | 23.0 | 21.0 | 45.0 | 7.0 | 30 g | ☐ |
| Haldiram's Punjabi Tadka Namkeen | 519 | 13.0 | 48.0 | 31.0 | 5.0 | 30 g | ☐ |
| Haldiram's Golden Mixture Namkeen | 528 | 12.5 | 47.0 | 33.0 | 5.5 | 30 g | ☐ |
| Haldiram's Roasted Chana Namkeen | 380 | 22.0 | 58.0 | 5.5 | 15.0 | 30 g | ☐ |
| Bikaji Aloo Bhujia | 545 | 8.0 | 46.0 | 37.0 | 4.0 | 30 g | ☐ |
| Balaji Wafers Simply Masala | 540 | 6.5 | 52.0 | 34.0 | 3.0 | 30 g | ☐ |
| Lay's American Style Cream & Onion Chips | 549 | 6.5 | 51.0 | 35.0 | 1.5 | 26 g | ☐ |
| Bingo Original Style Chilli Sprinkled Chips | 542 | 6.0 | 52.0 | 34.0 | 1.5 | 26 g | ☐ |
| Kurkure Green Chutney Rajasthani Style | 552 | 6.5 | 54.0 | 34.0 | 2.0 | 30 g | ☐ |
| Act II Classic Salted Popcorn (Popped) | 500 | 8.0 | 55.0 | 27.0 | 9.0 | 30 g | ☐ |
| Haldiram's Roasted Makhana (Peri Peri) | 430 | 9.5 | 68.0 | 13.0 | 8.0 | 25 g | ☐ |
| Parle Hide & Seek Chocolate Chip Biscuits | 501 | 6.0 | 66.0 | 23.5 | 1.5 | 25 g | ☐ |
| Britannia Tiger Krunch Chocochip Biscuits | 480 | 6.5 | 69.0 | 20.0 | 1.5 | 25 g | ☐ |
| Sunfeast Bounce Elaichi Cream Biscuits | 500 | 5.0 | 68.0 | 23.0 | 1.0 | 25 g | ☐ |
| Unibic Choco Chip Cookies | 490 | 6.0 | 64.0 | 23.0 | 2.0 | 25 g | ☐ |
| Amul Butter (Pasteurised) | 720 | 0.5 | 0.4 | 80.0 | 0.0 | 10 g | ☐ |
| Amul Pure Cow Ghee | 900 | 0.0 | 0.0 | 100.0 | 0.0 | 10 g | ☐ |
| Epigamia Greek Yogurt (Natural) | 76 | 8.5 | 5.0 | 2.8 | 0.0 | 90 g | ☐ |
| Nestlé Everyday Dairy Whitener | 496 | 25.0 | 38.0 | 26.5 | 0.0 | 12 g | ☐ |
| Aashirvaad Whole Wheat Atta (Raw) | 341 | 12.0 | 69.0 | 1.5 | 11.0 | 30 g | ☐ |
| Pillsbury Chakki Fresh Atta (Raw) | 340 | 11.5 | 70.0 | 1.5 | 10.5 | 30 g | ☐ |
| Nutrela Soya Chunks (Raw) | 345 | 52.0 | 33.0 | 0.5 | 13.0 | 30 g | ☐ |
| Fortune Besan (Gram Flour, Raw) | 387 | 22.0 | 58.0 | 6.7 | 11.0 | 30 g | ☐ |
| McCain French Fries (Frozen) | 168 | 2.5 | 24.0 | 6.5 | 2.5 | 85 g | ☐ |
| McCain Potato Smiles (Frozen) | 190 | 2.5 | 26.0 | 8.0 | 2.5 | 85 g | ☐ |
| ID Fresh Malabar Parota | 320 | 7.0 | 45.0 | 12.0 | 2.0 | 62 g | ☐ |
| Kissan Fresh Tomato Ketchup | 108 | 0.9 | 25.5 | 0.1 | 0.5 | 15 g | ☐ |
| Veeba Real Mayonnaise | 680 | 1.0 | 4.0 | 73.0 | 0.0 | 15 g | ☐ |
| Pepsi | 44 | 0.0 | 11.0 | 0.0 | 0.0 | 250 g | ☐ |
| Mountain Dew | 51 | 0.0 | 13.0 | 0.0 | 0.0 | 250 g | ☐ |
| 7Up Lemon Soft Drink | 40 | 0.0 | 10.0 | 0.0 | 0.0 | 250 g | ☐ |
| Mirinda Orange Soft Drink | 54 | 0.0 | 13.5 | 0.0 | 0.0 | 250 g | ☐ |
| Sting Energy Drink | 48 | 0.0 | 12.0 | 0.0 | 0.0 | 250 g | ☐ |
| Tropicana 100% Orange Juice | 45 | 0.5 | 10.5 | 0.0 | 0.2 | 200 g | ☐ |
| Nescafé Classic Instant Coffee (Powder) | 353 | 12.2 | 75.0 | 0.5 | 0.0 | 2 g | ☐ |
| Bru Instant Coffee (Powder) | 350 | 8.0 | 80.0 | 0.5 | 0.0 | 2 g | ☐ |
| Haldiram's Soan Papdi | 540 | 5.0 | 60.0 | 31.0 | 1.0 | 25 g | ☐ |
| Haldiram's Rasgulla (Tin) | 186 | 2.5 | 40.0 | 1.5 | 0.0 | 45 g | ☐ |
| Kwality Wall's Cornetto Ice Cream Cone (Chocolate) | 290 | 4.0 | 36.0 | 14.0 | 0.5 | 70 g | ☐ |
| Cadbury Dairy Milk Silk | 555 | 7.5 | 57.0 | 32.5 | 0.5 | 60 g | ☐ |
| Cadbury Perk Chocolate | 530 | 6.0 | 62.0 | 28.0 | 0.5 | 13 g | ☐ |

## Deliberately absent

- **Paneer (Amul / Mother Dairy)** — `Paneer` is already measured IFCT data at rank 6, above
  `branded`, and `/paneer/` in `lib/portion-units.ts` is the cooked-sabzi katori: a branded row would
  have opened a 50 g pack serving on 150 g.
- **Amul Vanilla Ice Cream** — already exists as `ifct-amul-ice-cream` (206 kcal), again at a higher rank.
- **Maggi sauces** — any name containing "Maggi" matches the noodle portion rule and would be offered
  as a packet of noodles. Needs a portion rule before it needs a row.
