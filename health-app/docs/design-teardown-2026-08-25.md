# Design teardown — five reference apps → GetInShape

**Date:** 2026-08-25 · **Scope:** visual language only · **Status:** Step 1 of 4, tokens awaiting approval

Five calorie-tracker screenshots were supplied as inspiration. This document extracts the design
language they share, then states what GetInShape takes, what it refuses, and why.

> **Note on process.** The brief asked me to read `/mnt/skills/public/frontend-design/SKILL.md`.
> That path does not exist on this machine — there is no `/mnt` mount on Windows, and the only
> installed skill is `deep-dive-audit`. I did not read it and have not pretended to. What follows
> is worked from the screenshots, the existing `docs/design-system.md`, and measured contrast.

---

## 0 · What the five references are

| # | Character | Accent | Ground |
|---|---|---|---|
| 1 | Play listing, playful, emoji-led | Kelly green `#22C55E` | white / pale green |
| 2 | Marketing on black, editorial | Orange `#F97316` | warm near-white `#F7F5F0` |
| 3 | "WiseMeal", friendly, rounded | Blue `#2563EB` | white / pale blue |
| 4 | "Calyra AI", iridescent mesh gauge | Pink→purple→blue gradient | cool grey `#F2F2F4` |
| 5 | Lavender, glassy, gauge-heavy | Violet `#8B5CF6` | white on lavender |

Five apps, five different accents — and yet they read as one category. That is the useful finding:
**the accent hue is not what makes them cohere. The structure is.**

---

## 1 · Colour

### The pattern

Every one of the five uses the same three-layer colour model:

| Layer | Role | Values across the set |
|---|---|---|
| **Ground** | canvas behind everything | `#F2F2F4` – `#FFFFFF`, 2–5% darker than the cards |
| **Surface** | cards | pure `#FFFFFF`, always |
| **Ink** | text | near-black `#0F1115`–`#1A1A1A`, plus 1–2 greys |

Then exactly **one accent**, and a **fixed macro triad that is never the accent**:

- protein → blue (`#3B82F6`-ish) in all five
- carbs → amber (`#F59E0B`-ish) in all five
- fat → red/rose (`#EF4444`-ish) in all five

**Where the accent is deliberately withheld** — this is the important half:

- Food names, meal names, section headings: **ink, never accent**
- Every number except the hero: **ink**
- All labels ("Remaining", "Eaten", "Protein"): **grey, never accent**
- Card backgrounds: **white, never tinted**

The accent appears in only three places: **the ring arc, the "today" chip, and the primary
button.** In screenshot 2 it appears literally twice on the whole screen. That scarcity is what
makes it read as a decision rather than as decoration.

### Distinct colour count

Six to eight hues total per app: ground, surface, ink, ink-muted, accent, and the three macro
colours. Nobody in the set uses a ninth.

---

## 2 · Typography

Free equivalents, since none of the five ships a licensed face we can use:

| Reference | Closest free face |
|---|---|
| 1 (rounded, heavy) | Nunito / Figtree |
| 2, 3 (grotesque) | **Inter** |
| 4, 5 (neutral geometric) | Inter / Plus Jakarta |

**Inter is already what GetInShape uses, and it is the correct answer.** The brief's "no new fonts
beyond one family plus optionally one for numerals" is already satisfied: Inter for UI, Inter Tight
for display and numerals.

### The scale they actually use

| Role | px | Weight | Tracking |
|---|---|---|---|
| Hero numeral | 44–56 | 700 | −3% to −4% |
| Hero label ("Remaining") | 13–15 | 400 | 0 |
| Section heading | 17–20 | 600–700 | −2% |
| Value in a value/target pair | 15–17 | 700 | −1%, tabular |
| Target in that pair | 15–17 | 400, muted | tabular |
| Row title (food name) | 14–16 | 600 | −1% |
| Row meta | 12–13 | 400, muted | 0 |
| Micro label | 10–11 | 500–600 | +6% to +8% if uppercase |

**Line-height** is tight on numerals (0.95–1.05) and loose on prose (1.4–1.5).

GetInShape's frozen ten-step scale (11 / 13 / 15 / 17 / 20 / 24 / 30 / 36 / 48 / 64) already covers
every one of these. **No scale change is needed.**

---

## 3 · Spacing

- **Base unit: 4px.** Every measurable gap in the set is a multiple of 4, most of 8.
- **Screen edge margin:** 16–24px. Screenshot 3 uses 16, screenshots 2 and 5 use 20–24.
- **Card padding:** 16–24px, and consistently *larger* on the hero card than on list rows.
- **Gap between sections:** 24–32px — roughly 1.5× the card padding.
- **Gap between rows in a list:** 8–12px.
- **Inside a row:** 12–14px between the thumbnail and the text.

---

## 4 · Shape

| Component | Radius |
|---|---|
| Hero / feature card | 20–28px |
| List row, small card | 16–20px |
| Chip, day cell | 12–16px |
| Button, pill, avatar | fully round (`999px`) |
| Icon tile inside a row | 12–14px |

**Border vs shadow:** shadow, decisively. Four of the five use **no borders at all** on cards.
Screenshot 3 uses a 1px hairline *in addition to* a shadow on one card only. Nobody uses a border
alone.

Typical shadow: a large, very soft, low-opacity drop — roughly
`0 8px 24px -8px rgba(0,0,0,.08)`. It is a *lift*, not a *rim*.

---

## 5 · Depth and hierarchy

They separate card from ground by **contrast plus one soft shadow** — never by border, never by
tint. The canvas sits 2–5% darker than the white card, which alone is nearly enough; the shadow
just confirms it.

The ordering device is **size and weight, not colour**. A 48px/700 number beside a 13px/400 grey
label is the entire hierarchy. Nothing is emphasised by making it accent-coloured.

Dark mode (only screenshot 2's marketing frame hints at it) follows the standard inversion: the
*surface* gets lighter than the canvas, and shadows stop doing the work because a shadow on black is
invisible.

---

## 6 · Data display

This is where the set is most consistent, and most worth copying.

**The hero number**
- 44–56px, weight 700, near-black — **not** the accent colour
- tabular numerals, tracking −3%
- its label is 13–15px, weight 400, muted grey, sitting *above* or *below* it
- the size ratio between number and label is roughly **4:1**

**Progress rings**
- stroke 10–16px, round caps
- track is a flat light grey (light mode) — not a tinted version of the accent
- arc is the accent, flat fill, no gradient
- the number lives inside the ring, centred
- screenshots 1, 2 and 3 all show **"Remaining"**, not "eaten" — the decision-relevant figure

**Value / target pairs** — the single most repeated component in the set:
```
   100g / 153g          26g/46g          58 / 179g
   ^bold ink  ^muted    ^bold  ^muted    ^bold   ^muted
```
Eaten value in bold ink, separator and target in muted. Always tabular.

**Macro bars** are 4–6px tall, fully rounded, on a light track, in the fixed macro triad.

**Charts** (screenshot 5) use a single-hue area fill with a soft vertical fade, a highlighted
endpoint dot, no gridlines on the x-axis, and 2–3 y-labels maximum.

---

## 7 · Motion (implied)

Nothing is animated in a screenshot, but the components declare their transitions:

- **Ring arcs**: `stroke-dashoffset` easing from 0 to value over ~0.8–0.9s on a decelerating curve
  (`cubic-bezier(.22,1,.36,1)`). GetInShape already does this.
- **Numbers count up** alongside their ring rather than snapping. Already implemented (`useCountUp`).
- **Day-chip selection**: the filled shape scales in, ~180ms.
- **Row press**: scale to ~0.98, ~150ms.
- **Sheet entry**: translateY with a slight overshoot, ~380ms.

All of it must sit behind `prefers-reduced-motion`.

---

## 8 · What makes it feel premium — three specific choices

Not vibes. These three, and they are copyable:

1. **The accent is rationed to three uses.** Ring arc, today chip, primary button. Everything else
   is ink and grey. Premium reads as *restraint*, and the mechanism is a literal count: if the
   accent appears more than three times on a screen, it has stopped meaning anything.

2. **The number-to-label weight gap is extreme.** 48px/700 against 13px/400 muted — a 4:1 size
   ratio and a 300-weight gap. Cheap-looking apps use 24px/600 against 14px/500, and the hierarchy
   collapses. The gap *is* the design.

3. **Cards float on a tinted ground with no border.** The canvas is 2–5% darker than the card, and
   one large soft shadow does the separating. A 1px grey border is the single most reliable
   tell of an unconsidered interface, and none of the five has one.

---

## 9 · What GetInShape takes, and what it refuses

### Takes

- The three-layer ground / surface / ink model — **already how the app works**
- The rationed accent, the fixed macro triad, and withholding accent from labels and food names
- The 4:1 hero-number-to-label ratio, tabular numerals, value/target pairs
- Shadow over border, tinted canvas, generous radius — **already how the app works**
- "Remaining" over "eaten" as the hero figure — *see the separate Home direction proposal*

### Refuses, and why

| Not copied | Reason |
|---|---|
| **Screenshot 4's iridescent mesh gauge** | It is the single most recognisable AI-generated-design cliché of the moment. It will date within a year, and it cannot hold 4.5:1 text contrast over its own gradient. |
| **Screenshot 5's neumorphic mini-gauges** | Soft-shadow-in-shadow gauges are unreadable at 34px on a mid-range Android screen in daylight, which is this app's actual context. |
| **Screenshot 1 and 3's mascot / stock-photo people** | Licensing, and `docs/growth-mechanics-plan-2026-07-29.md` already forbids image downloads in the story engine on metered-connection grounds. |
| **Screenshot 2's orange** | Explicitly excluded by the brief — appetite-stimulating colour in a calorie-deficit app. Also 3.14:1 for white-on-orange, which fails. |
| **Screenshot 1's kelly green `#22C55E`** | It is the default "health app green" and it is what the largest competitor in the screenshots already owns. Adjacent, not identical, is the better position. |
| **Screenshot 5's purple/violet** | Purple-to-blue on white is on the AI-design cliché list, and it carries no meaning in a nutrition context. |
| **Gradient-filled ring arcs** | Two of the five use them; they lower the arc's effective contrast against the track and make the "how far round is it" judgement harder. Flat fill is both more legible and more restrained. |
| **Exact layout, screens, illustrations, brand names** | Inspiration, not a clone, per the brief. |

---

## 10 · The accent decision

The brief rules out warm orange/red and asks for "a calm near-white or near-black base, one
restrained accent". Working from the references' own logic — one accent, cool, health-coded,
not already owned by a competitor in the set:

**`#0E7C66` — a deep sea-green.** Called **Kelp**.

- **Cool**, which is the brief's stated requirement: the appetite-stimulating end of the spectrum
  (red / orange / warm yellow) is excluded, and blue-green is its opposite.
- **Green-adjacent**, so it still reads as health and progress, which users expect in this category
  and which a pure blue does not carry.
- **Deep and desaturated**, so it is not screenshot 1's `#22C55E` and not Tailwind's default
  `emerald-500`. It clears 4.5:1 as *text* on white (5.13:1) — most greens at this saturation do not.
- **White sits on it legibly** (5.13:1), which orange never managed (3.14:1).

Its neutrals are biased cool to match — a warm grey under a cool accent is the classic tell of a
palette that was assembled rather than chosen.

---

## 11 · Measured contrast — what this fixes

Run `node scripts/check-contrast.mjs`. Verified, not assumed.

**The palette shipping today fails seven checks**, six of them in light mode:

| Pair | Today | Required | Verdict |
|---|---|---|---|
| `--ink-3` on surface — every 11–13px caption | **2.59:1** | 4.5 | fail |
| `--ink-3` on canvas | **2.40:1** | 4.5 | fail |
| white on `--brand` — every primary button label | **3.14:1** | 4.5 | fail |
| `--brand` as body text | 3.14:1 | 4.5 | fail |
| `--good` on surface | 4.20:1 | 4.5 | fail |
| `--bad` on surface | 4.38:1 | 4.5 | fail |
| `--ink-3` on surface (dark) | 3.31:1 | 4.5 | fail |

**Kelp passes all thirty checks in both modes.**

One honest consequence: forcing the muted tier to 4.5:1 pushes `--ink-3` to `#66716F`, which is
darker than a "muted" grey instinctively wants to be, and narrows the gap to `--ink-2`. That is not
a compromise in the palette — it is what the 4.5:1 requirement costs, and any palette meeting the
brief pays it. Hierarchy is carried by **size and weight** instead, which is what the references do
anyway (§8.2).

A second consequence: `--brand` in dark mode is bright enough that **white text on it fails**.
Dark-mode accent buttons need dark labels, so the token set gains `--on-accent`
(`#FFFFFF` light / `#08100E` dark). Step 3 swaps `text-white` for `text-on-accent` wherever it sits
on an accent fill.

---

## 12 · Features noticed but deliberately not built

Per the brief — listed, not implemented:

1. **Exercise burn is not surfaced on Home.** Three of the five references show "Eaten / Burned"
   flanking the ring. `exercise_logs` exists and `ExerciseLogger` writes to it, but Home never reads
   it, so the ring shows intake only while the app also tracks expenditure.
2. **No per-meal recommended target.** Screenshot 1 shows "Recommended: 237 cal" per meal slot.
   `daily_calorie_target` exists and could be split, but nothing in the codebase does.
3. **No food thumbnails in list rows.** Four of five use a photo or illustrated tile. GetInShape
   uses an emoji tile (`lib/foodVisual.ts`) — a deliberate, cheaper choice given metered
   connections, and I would keep it.
4. **No health/quality score.** Screenshots 4 and 5 both show one. It would need a nutrient-density
   model the app does not have, and a bad one is worse than none.
