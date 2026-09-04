# Visual audit — 2026-09-04

## Why this exists

Adarsh sent two iPhone screenshots and one sentence: *"it doesn't look like an app, it looks
like a website."* Both screenshots turned out to be the same defect class, and both were
**invisible to all five gates** — 1410 tests, tsc, lint, `check:tokens` and a clean build all
passed while the AI chat logger's input row rendered off the bottom of the screen and the camera
offered no reachable way to log a scanned meal.

That is the point of this document. The gates pin *behaviour*; nothing in the toolchain looks at
whether a screen is usable on a 375px phone. This is the first pass that does.

Two defects are already fixed and are **not** re-listed as findings here:

- **PR #64** — `ChatLogModal`'s missing `min-h-0`, and sheets that never moved for the keyboard.
- **PR #65** — `CameraModal`'s unreachable "Log food", and body-scroll lock on six overlays.

Both introduced rules into `CLAUDE.md`. Everything below is what remains.

## Method and its limits

- **Source sweeps** across `app/` and `components/` for each rubric item (the counts below are
  reproducible with the greps noted).
- **Live measurement** in the dev server at 320×720 and 375×812.
- **Coverage limit, stated plainly:** the browser measurements cover only the **public** routes
  (`/`, `/pricing`, `/upgrade`, `/privacy`, `/terms`, `/refunds`, `/contact`, `/auth/*`). Every
  authenticated screen — `/dashboard`, `/log`, `/progress`, `/weight`, `/settings`, `/recipes`,
  `/deficit`, `/welcome`, `/wrapped` — is assessed **from source only**, because I do not sign in
  (Adarsh holds the session). Findings on those screens are therefore well-evidenced as code but
  unconfirmed as pixels.
- One measurement round was **discarded**: the dev server was serving stale CSS after a branch
  switch, so an early pass measured unstyled UA defaults (44px inputs reading as 21px). Numbers
  below are from a restarted server with `cssLoaded: true` verified on each page.

---

## P1 — reads as broken, or blocks a touch target

### P1-1 · Every input in the app is 14px

`components/ui/input.tsx:10` sets `text-sm` on the shared `Input` primitive, so **every form
field in the product** renders at 14px. Measured live on `/auth/sign-in`: `fontSize: "14px"`,
height 44px.

16px is the threshold below which iOS Safari zooms the viewport on focus. The app currently
suppresses that with `maximumScale: 1, userScalable: false` (`app/layout.tsx:76-77`), so instead
of zooming it simply renders small — which is precisely the "web form, not an app" texture
Adarsh described. The suppression is also not a guarantee: Safari has repeatedly relaxed
`user-scalable=no`, and if it does so again every field in the app starts zoom-punching on focus.

**This is the single highest-leverage fix in the document.** One primitive, plus 15 raw controls
that set their own size:

`CameraModal.tsx:322,357` · `ChatLogModal.tsx:222` (fixed in #64) · `ExerciseLogger.tsx:142,157,172` ·
`FoodSearch.tsx:67` (`text-[14px]`) · `QuickAddModal.tsx:150` · `TodayFoodLog.tsx:165` (`text-xs` — 12px) ·
`RecipeBuilder.tsx:163,202` · `ReminderHourPicker.tsx:79` · `SettingsClient.tsx:298,305,325,358`

Reproduce: `grep -rnU -A8 "<input\b\|<textarea\b\|<select\b" app components --include=*.tsx | grep "text-sm\|text-xs\|text-\[1[0-5]"`

### P1-2 · `RecipeBuilder`'s ingredient list chains scroll to the page

`components/recipes/RecipeBuilder.tsx:213` — `max-h-48 overflow-y-auto` with no
`overscroll-contain`. After #64 and #65 this is the **last** inner scroller in the app that lets
a touch drag fall through to the document once it hits its end. Same family as the bug Adarsh
reported, one line to close.

### P1-3 · `BottomNav` does not know about the keyboard

`components/layout/BottomNav.tsx:63` is `fixed inset-x-0 bottom-0`. #64 taught *sheets* to lift
by `--kb-inset`, but the nav is a page-level fixed element and still sits behind the keyboard
whenever a page-level input is focused — and it is 4 tabs plus a FAB, i.e. the app's primary
navigation, covered.

This needs a decision rather than a reflex, and it is the reason it is a finding and not a fix:
lifting the nav above the keyboard (the Android `resizes-content` look) is arguably *worse* than
letting it hide, because a nav floating on top of a keyboard is not a pattern iOS users expect.
The likely right answer is to **hide** it while `--kb-inset > 0`. Cheap to implement now that
the variable exists; needs Adarsh's eye on a device.

---

## P2 — systemic inconsistency; this is most of the "website" feel

### P2-1 · Corner radii: a documented 4-step scale, and at least 10 values in use

`tailwind.config.ts:79-88` defines four steps — `control` 12px, `card` 18px, `sheet` 28px, plus
the built-in pill — and `docs/design-system.md:18` presents that as the system. The code uses:

| value | count | | value | count |
|---|---|---|---|---|
| `rounded-[24px]` | 20 | | `rounded-[12px]` | 3 |
| `rounded-[20px]` | 18 | | `rounded-[0.625rem]` | 3 |
| `rounded-lg` | 17 | | `rounded-[18px]` | 2 |
| `rounded-[14px]` | 11 | | `rounded-[16px]` | 1 |
| `rounded-sm` | 3 | | `rounded-[10px]` | 1 |

79 off-scale radii. Note `rounded-[12px]` and `rounded-[18px]` are *exactly* `rounded-control`
and `rounded-card` written the long way — those are free to convert. `rounded-[24px]` and
`rounded-[20px]` are the real drift: two extra card sizes that nothing in the system names.

Worst offenders: `ProgressClient.tsx` (18), `log/shortcuts.tsx` (5), `app/progress/loading.tsx`
(5), `FoodLanding.tsx` (4), `app/recipes/loading.tsx` (4).

Mismatched radii between adjacent cards is one of the most reliable "unsystematic" tells there
is, and `/progress` — 18 in one file — is where it will read worst.

Reproduce: `grep -rno "rounded-\[[^]]*\]\|rounded-\(sm\|md\|lg\)\b" app components --include=*.tsx`

### P2-2 · 53 arbitrary spacing values, ratcheted but never reduced

`scripts/check-tokens.mjs:68` holds `SPACING_BASELINE = 53` with **zero headroom** — the guard
stops new ones and has never been used to remove old ones. The Ember system is a 4px/8px scale;
each of these opts out of it.

Concentrated in `SettingsClient.tsx` (14 — mostly `px-[18px]` and `mt-[3px]`),
`DashboardClient.tsx` (4), `FoodLanding.tsx` (4), `ProgressClient.tsx` (3).

`px-[18px]` appears 9 times in Settings alone and is not on the scale (16 or 20 is). `mt-[3px]`
appears 6 times app-wide — a 3px nudge is exactly the kind of hand-tuning that makes a layout
look assembled rather than designed. Every fix here also lowers the baseline, which is the
ratchet working as intended.

Reproduce: `npm run check:tokens -- --report`

### P2-3 · A third of tappables have no press feedback

144 `<button>` elements; `tap-scale` / `active:scale` appears 111 times. On a phone, a control
that does not respond to touch reads as a dead web page — this is one of the strongest
app-versus-website signals and it is currently applied by hand, so it drifts.

| file | buttons with no press state |
|---|---|
| `studio/StudioClient.tsx` | 7 of 7 |
| `log/TodayFoodLog.tsx` | 5 of 5 |
| `log/AddFoodModal.tsx` | 4 of 7 |
| `recipes/RecipeBuilder.tsx` | 3 of 6 |
| `onboarding/OnboardingForm.tsx` | 3 of 9 |
| `log/FoodSearch.tsx` | 3 of 5 |
| `camera/CameraModal.tsx` | 3 of 10 |
| `progress/DayDiary.tsx` | 2 of 2 |
| `story/Story.tsx`, `log/QuickAddModal.tsx`, `log/FoodResult.tsx`, `log/EditFoodLogModal.tsx`, `progress/ProgressClient.tsx` | 2 each |

`TodayFoodLog` and `DayDiary` matter most — they are the diary rows a user taps every single day.
`StudioClient` is the internal design studio and can be last.

The durable fix is to put the press state in `components/ui/button.tsx` so it is the default
rather than an opt-in, and keep `tap-scale` for non-`<button>` tappables.

### P2-4 · Icon buttons below the 44px touch minimum

`h-8`/`h-9`/`h-10` icon buttons across 15+ files — highest density in `WeightLogModal` (5),
`FoodLanding` (5), `CameraModal` (5), `ProgressClient` (4), `OnboardingForm` (4),
`AddFoodModal` (4). #64 raised the chat send button to `h-11`; nothing else was touched.

44px is Apple's minimum and Google's is 48dp. A visually small icon can keep its size — the fix
is padding or an `::after` hit-area expansion, not a bigger glyph.

---

## P3 — polish

### P3-1 · Two loading idioms

8 route-level `loading.tsx` skeletons using `animate-shimmer` (9 files), alongside bare `Loader2`
spinners in 12 components. Skeletons read as native; a centred spinner reads as a web page
waiting on XHR. Worth converging in-component loading onto the skeleton idiom where the shape of
the result is known.

### P3-2 · Text links under 44px on auth and upgrade

Measured at 320px: `/auth/sign-in` — "Forgot?" 16px tall, "Create account" 17px.
`/upgrade` — "Back to dashboard" 20px, "Terms" and "Privacy" 16px.

Inline text links legitimately don't need 44px, but "Forgot?" is what a locked-out user reaches
for, and it is a 16px-tall target. Widen the hit area, not the type.

### P3-3 · Two idioms for the same safe-area padding

`BottomNav.tsx:67` uses an inline `calc(18px + env(safe-area-inset-bottom))`;
`app/dashboard/loading.tsx:62` uses the `.safe-area-bottom` utility;
`app/log/page.tsx:183-184` uses arbitrary `pb-[calc(...)]`. #65 removed a fourth (a class name
that never existed). One idiom should win — most likely the utility, extended to take the base
padding — and this should be settled **before** `viewport-fit: cover` lands, since that is when
all of them stop being no-ops simultaneously.

---

## Verified clean

- **No horizontal overflow at 320px** on `/`, `/pricing`, `/upgrade`, `/auth/sign-in` (measured,
  `scrollWidth === clientWidth`, zero offending elements). `TESTING.md:176` asks for this check
  and nothing enforced it; these four now have a number behind them. The authenticated screens
  remain unmeasured.
- **The `min-h-0` / scroller sweep is otherwise clean.** After #64 and #65, `RecipeBuilder.tsx:213`
  (P1-2) is the only remaining offender in the app.
- **Token discipline holds:** `check:tokens` reports 0 raw hex and 0 broken opacity modifiers.
  The colour system is in good shape; it is the *geometry* (radii, spacing, touch targets) that
  has drifted.

---

## Suggested order

The rubric ranked these by severity; this orders them by **value per unit of risk**:

1. **P1-1** (input sizing) — one primitive plus 15 sites, and the biggest single change in how
   the app feels. Do it first.
2. **P1-2** (RecipeBuilder scroller) — one line, closes the reported bug class completely.
3. **P2-3** (press feedback) — move the press state into `button.tsx`; large perceived gain,
   small diff.
4. **P1-3** (BottomNav vs keyboard) — needs a device call from Adarsh before implementing.
5. **P2-1** (radii) — start with the free conversions (`rounded-[12px]` → `rounded-control`,
   `rounded-[18px]` → `rounded-card`), then decide whether `20px`/`24px` earn a named step or
   collapse into `card`/`sheet`. This is a design decision, not a cleanup.
6. **P2-4** (touch targets), **P2-2** (spacing), then **P3**.

One PR per item, five gates on each. Per `CLAUDE.md`'s "adding without removing" rule, P2-1 and
P2-2 in particular must not leave a screen showing both the old and new value for the same thing.

**Do not start fixing until Adarsh has read this and chosen.** A full-app sweep is exactly the
situation the "surgical changes only" rule exists for, and several items here (P1-3, P2-1) are
design calls rather than defects.
