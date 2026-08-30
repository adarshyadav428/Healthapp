# Body-type artwork

The illustrations behind the "Which is closest to you?" picker on onboarding step 3.
Rendered by `components/onboarding/BodyTypeImage.tsx`.

## State — complete

Both sets are in place. Ten files, ~184 KB (male) and ~240 KB (female):

```
male-skinny.png       female-skinny.png
male-skinny_fat.png   female-skinny_fat.png
male-average.png      female-average.png
male-soft.png         female-soft.png
male-athletic.png     female-athletic.png
```

`sex: 'other'` uses the `male-*` set by design. `BodyTypeImage` tries the female file first for
a female user and falls back to the male one, then to a neutral block — so a file that ever goes
missing degrades rather than showing a broken-image icon.

Using `webp` or `svg` instead is fine: change `BODY_TYPE_ASSET_EXT` in
`components/onboarding/BodyTypeImage.tsx`. That is the only place the extension appears, and all
ten files must share it.

## Where they came from

Adarsh generated both sources with ChatGPT (male 2026-08-30, female 2026-08-31) and the figures
were cut out of them. Neither source composite is kept — do not commit them, they are ~1.5 MB each.

| File | Source cell |
|---|---|
| `male-athletic.png`   | male chart, row 1 col 2 — "Athletic" |
| `male-average.png`    | male chart, row 1 col 4 — "Average" |
| `male-soft.png`       | male chart, row 1 col 5 — "Overweight" |
| `male-skinny.png`     | male chart, row 2 col 1 — thin, low muscle mass |
| `male-skinny_fat.png` | male chart, row 2 col 3 — higher fat around the waist |
| `female-*.png`        | female chart, already labelled with these exact type names |

## What extraction has to get right

Anyone redoing this — a restyle, a third set — needs all four of these. Each one was a bug first.

- **Drop the percentage labels.** The male chart is a body-fat-percentage chart; the picker is not,
  and must never present a tap as a measurement. Only the figures were taken.
- **Normalise scale across rows.** The male chart draws its two rows at different sizes. Every
  figure is re-cropped to the same anatomical span — top of head to the hem of the shorts — and
  scaled to one height, so builds from different rows sit together without one towering over the
  other. Cropping the cards as-drawn does not work.
- **Remove the card border stroke by eroding the card, not by colour or by edge-contact.** The
  stroke differs per card, so colour keying misses it; and "drop any blob touching the crop edge"
  deletes the arms, which hang free of the torso near the card's sides. Eroding the card's own
  opaque rounded-rect by ~8px strips the ring and leaves everything inside.
- **Seed the background flood-fill inside the stroke, and take the reference colour from the modal
  border pixel.** On a rounded card the literal corner pixel is outside the shape and already
  transparent, carrying garbage RGB — seed there and the fill never starts.

Then: flood-fill the tint away, drop isolated blobs under ~200px (stray specks, 4–17px each), and
trim to the tight bounding box. Skipping that last trim leaves invisible strays inflating the box,
which silently makes one figure render smaller than its neighbours.

## What the art has to satisfy

- **Transparent background** once extracted. The tile is `bg-surface-2` in light mode and near-black
  in dark; a baked-in white background looks like a sticker in dark mode and nothing can correct it.
- **One consistent framing and scale across all files.** The picker exists to be compared.
- **Legible at ~96px tall**, three-across on a phone.
- **Small.** ~240 KB per set is the ceiling, not the target — all five load at once on a first-run
  screen over Indian mobile data.

## Licensing

These are the first raster assets in the app and the one exception to the emoji-and-gradients house
style — see the note in `CLAUDE.md`. Both sets are Adarsh's own AI generations, so there is no
third-party licence to track; if either is ever replaced with stock art, keep the licence with the
project.
