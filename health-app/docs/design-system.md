# Design system — "Ember" (Porcelain light / Onyx dark)

> **Read this before any visual change to `app/globals.css`, `tailwind.config.ts`, `components/ui/`,
> `components/layout/`, or any screen-level styling.** `/studio` is the living reference
> implementation — the `WORLDS` object in `components/studio/StudioClient.tsx` mirrors the token
> values; when in doubt about what a token *should* render as in either theme, look there.

## The principle — "still surface, moving data"

The interface is calm so the numbers can be loud. The surface — canvas, cards, chrome, type — is
neutral, quiet and consistent; ember and the macro hues are spent only on the things that change:
the calorie ring, the streak flame, an over-goal amount, today's bar, the one primary action on a
screen. GetInShape carries real gamification; the way it stays premium is that the *container*
never joins in.

**Shared foundation refreshed 2026-09-11** (branch `design/foundation-still-surface`). What changed
and why is recorded inline below; the page-by-page redesign (Home, Food, Camera, Progress and Profile done 2026-09-11;
Plans and Onboarding still to come) builds on this.

## Colour

One accent, two themes, no exceptions. **Ember (`--brand`)** — a warm orange-red — is the only accent
colour in the entire app: the primary button, the calorie ring, the streak flame, progress fills, the
tab bar's active state. There is no second brand colour (`--brand` and `--energy` both point at the
same ember family for back-compat, not as two accents). Semantic green/red (`--good` / `--bad`) are
reserved for state; macro colours (`--protein` / `--carbs` / `--fat`) are the only other fixed hues,
used solely for macro data.

**The ground is neutral, not warm.** `--canvas` is `#F4F5F7` in light and `#0F1013` in dark, with a
neutral ink family (`--ink` `#15171C`, `--ink-2` `#5C6270`, `--ink-3` `#8B919E`). Until 2026-09-11
the canvas was a warm cream (`#F7F6F3`) under a warm ink, which made the whole *interface* orange-ish
and left the ember accent with nothing to stand against. On a neutral ground ember is the only warm
thing on the screen, which is what "one accent" was always supposed to mean. The one trace of the
blue that a cool, airy reference language uses is `--ambient` — a whisper of the `--protein` hue at
the top of the page, ≤ 7% alpha — and it is a background treatment, never a second accent.

Both themes are live and real: **Porcelain** (`:root`, light) and **Onyx** (`.dark`). Dark surfaces
step visibly — `--surface` `#181A1F` on `#0F1013` — because the old `#171512` on `#0F0E0C` was
near-invisible and cards vanished. `next-themes` drives it (`attribute="class"`,
`defaultTheme="system"`, provider in `app/providers.tsx`); users override via Profile → Appearance
(`components/ui/theme-toggle.tsx`).

Text-safe semantic colours: `--brand-text` (`#B3441A`), `--good` (`#24784C`) and `--bad` (`#C43838`)
all clear 4.5:1 on canvas, surface and surface-2 in light; `--good-soft` exists so a "good" chip is
green on green, not green on ember.

- **Tokens are the single source of truth.** All colours are CSS variables in `app/globals.css`
  (`:root` = Porcelain, `.dark` = Onyx); `tailwind.config.ts` maps token names to them. **Never write
  raw hex in a component** — `bg-brand`, `text-ink`, `border-hairline`, `bg-brand-soft`, …. Legacy
  aliases (`primary`, `accent`, `muted`, `card`, `background`, `foreground`) still resolve and are
  theme-reactive; they are not the preferred spelling for new code.
- **Opacity modifiers are broken on every token colour.** Tokens are plain `var(--x)` strings, so
  `bg-token/NN` is a silent no-op. Use a pre-mixed alpha token (`--brand-soft`, `--brand-ring`,
  `--good-soft`, `--bad-soft`, `--header-bg`, `--glass-hair`, `--scrim`) or an inline
  `color-mix(in srgb, var(--token) N%, transparent)`.
- Off-app brand assets (`app/opengraph-image.tsx`, `lib/shareCard.ts`) carry their own literal
  palette on purpose — they must render identically for dark-theme users and leave the app. They
  still show the pre-2026-09-11 warm canvas; retune them in their own pass.

## Type

Inter (`--font-sans`, body) + Inter Tight (`--font-display`, headings and big numerals), both via
`next/font/google`. Numerals use `tabular-nums`. **Headings are semibold**, not bold — `globals.css`
sets `h1–h4` to `font-semibold` — because bold at 24px+ shouts, and on a calm surface the numbers
should be the loud thing.

**Ten named steps, each with its own line-height and tracking** (`tailwind.config.ts` `fontSize`).
Tracking tightens as size grows, which is most of what separates a designed numeral from a default
one, so a component never sets letter-spacing on display type by hand:

| step | px | use |
|---|---|---|
| `text-micro` | 11 | unit suffixes, tab labels, tiny chips |
| `text-caption` | 13 | secondary lines, labels, meta |
| `text-body` | 15 | body copy, buttons, descriptions |
| `text-body-lg` | 17 | lead copy |
| `text-title-sm` | 20 | card / dialog / sheet titles |
| `text-title` | 24 | page titles (`PageHeader`) |
| `text-title-lg` | 30 | section heroes |
| `text-display` | 36 | large numerals |
| `text-hero` | 48 | |
| `text-hero-lg` | 64 | the calorie numeral |

`tracking-caps` (0.08em) is the one hand-set tracking, for letterspaced caps labels; nothing else.

Tailwind's own `text-sm` / `text-2xl` still resolve — ~500 call sites use them — and the arbitrary
`text-[Npx]` count is **ratcheted** by `check:tokens` (see Guardrail). Every shared primitive is on
the named scale; a page moves to it when it is redesigned. Inputs stay at 16px (`text-base`) because
that is iOS Safari's zoom threshold.

**`cn()` knows the scale.** `lib/utils.ts` extends tailwind-merge with every custom `text-`,
`rounded-`, `shadow-` and `tracking-` name; without that, tailwind-merge filed `text-title-sm` as a
*colour* and dropped it beside `text-ink`, so a DialogTitle rendered at 16px with nothing failing.
`tests/cnMerge.test.ts` walks `tailwind.config.ts` and fails when a step is added there but not
registered.

## Geometry

- **Radius: four steps** — `rounded-control` 12 · `rounded-card` **20** · `rounded-card-lg` 24 ·
  `rounded-sheet` 28 — plus `rounded-full` for pills (and `rounded-phone` 44, for the public site's
  product screens only). `card` was 18 while the core screens wrote
  `rounded-[20px]` by hand; the config was the half of the pair that was wrong. Nested corners inside a
  control (a select item, a segment) use `rounded-lg` (8px), smaller than their container.
- **Spacing** is the 4px/8px scale. Arbitrary `m-[…]`/`p-[…]`/`gap-[…]` values are ratcheted.
- **Touch targets are 44px.** `Button size="icon"` is `h-11 w-11`; the tab bar's tabs are `h-11`;
  `PageHeader`'s back chevron is a bare 44px target, not a floating disc — chrome does not cast
  shadows, only content does. The row-level `IconButton` stays at 32px for the reasons in its header.
- **`--tab-bar-h`** (72px, `globals.css`) is `BottomNav`'s height before the safe-area inset, so a
  page or a toast can clear the bar without measuring it. Keep it in step with the nav's padding.

## Elevation and surfaces

A hairline separates; a whisper of shadow lifts. **`shadow-air` and `shadow-rest` are the same
value** — one card elevation for the whole app (the redesigned core screens and the older secondary
pages used to differ, and `--shadow-air` had no Tailwind class, so 29 sites wrote it inline).
`shadow-float` is for things that genuinely hover: sheets, dialogs, the tab bar, toasts.
`shadow-cta` / `shadow-fab` are a tinted whisper under the primary button and the FAB, not a glow.

- **The primary CTA is `bg-cta-grad` + `shadow-cta`** (what `<Button variant="default">` renders).
  The gradient's stops now sit close enough to read as a flat ember with depth, not a sunset; keep
  the token shape so call sites need not change. Never hand-roll a flat `bg-brand` primary.
- **`--hairline-2` (22% light / 24% dark) at `border-2` is the frame weight** — the outline around a
  whole region (the Home and Food page frames, Food's shelves and log card, Home's meals). `--hairline`
  (7%) at 1px stays the divider between rows and the edge of an ordinary card.
- **Cards are `bg-surface` + `border-hairline` + `shadow-air`**, and there is one level of them: no
  card inside a card. A list inside a card is rows separated by hairlines, not more cards.
- **Inputs are filled** (`bg-surface-2`, hairline border) and go white with a brand border + ring on
  focus. On a white card a hairline alone vanished, and the fill is what says "type here".
  `SearchField` (`components/ui/search-field.tsx`) is the one search idiom — a filled pill with a
  leading glass, a 44px clear target and an `actions` slot for trailing 44px controls (Food passes
  chat + scan). `FoodSearch` is its first consumer.
- **List rows, not cards, for anything repeated.** A food row (`FoodResult`, `ShortcutRow`) is a
  44px tile, name over one caption line of context, and a 44px action at the end; rows sit on the
  canvas separated by `divide-hairline`. The row's add affordance is **soft ember**
  (`bg-brand-soft text-brand-text`) — a column of filled-ember discs read as a wall of buttons.
- **Scrim:** `--scrim` at `.56` light / `.55` dark with a 12px blur, shared by `sheet.tsx`,
  `dialog.tsx`, `UnitPicker` and `LogMilestones` — every modal hides what is behind it by the same
  amount.

## States

- **Hover only where a pointer can hover.** `tailwind.config.ts` sets
  `future.hoverOnlyWhenSupported`, so every `hover:` variant is wrapped in `@media (hover: hover)` and
  a tap on a phone never leaves a hover style stuck on the element.
- **Pressed:** `tap-scale` (a transform, so it never shifts layout) on every tappable; `Button` also
  darkens/lightens by variant via `active:`. Reduced motion disables the transition.
- **Focus:** keyboard-only (`focus-visible`) — a 2px brand ring offset from the canvas on buttons; a
  brand border + 3px `brand-ring` on fields. A tap never draws a ring. Since the 2026-09-11 QA pass
  `globals.css` draws the same ember ring on *every* `:focus-visible` element (tab bar, week strip,
  food rows, chips, calendar discs) so a bare `<button>` never falls back to the browser's blue.
- **Disabled:** `opacity-40` + `pointer-events-none` / `cursor-not-allowed`, no colour change.

## Motion

`cubic-bezier(.22,1,.36,1)` (`ease-out`) for most transitions, the springier `cubic-bezier(.32,.72,0,1)`
(`ease-spring`) for sheets; all gated behind `prefers-reduced-motion` — the named animations are
switched off by class, and a global near-zero duration rule collapses everything else (sheet slide,
overlay fade, the analysing spinner, colour transitions) to a cut while still firing `animationend`
so Radix unmounts closed dialogs. Motion answers an action
(a sheet opening, a toast arriving, a ring filling); nothing on a screen moves on its own except the
story engine, which breaks the calm on purpose and says so in `globals.css`.

## Icons

Lucide only, `strokeWidth` 1.75 by default (2 for an active tab or a filled control's glyph), one
style per hierarchy level. Sizes are `h-6 w-6` (24, navigation and page-level actions), `h-5 w-5`
(20, in-row and field icons) and `h-4 w-4` (16, inline beside text). Emoji are not icons — the story
engine's glyphs are the one exception and it downloads nothing for the same reason.

## Chrome

There is no shared top header. The four core tab screens have bespoke per-page headers (a
`text-caption` label over a `text-title` Inter Tight title); secondary pages use
`components/layout/PageHeader.tsx` (label + title + back chevron). `BottomNav` is the shared tab bar
+ FAB on every authenticated page: a full-width frosted bar (`bg-header-bg`, 24px blur) with a
hairline top, `brand-ink` active tab, `text-micro` labels, and a 56px ember FAB that opens the camera.
Whether the FAB should be ink with an ember glyph (as this file once said) or ember (as it ships) is
still Adarsh's call — see the 2026-09-11 redesign audit; only its glow and sizes changed here.

Toasts (`components/ui/toast.tsx`) sit **above the tab bar, centred** on a phone and in the top-right
corner from `sm:` up — the corner is a desktop-browser idiom.

## Camera and the AI result

The camera (`components/camera/CameraModal.tsx`, all behaviour in `hooks/useCameraScan.ts`) is a
focused tool, not a page: a full-bleed viewfinder, a 72px white shutter, and glass discs
(`bg-white/15` + blur — white is not a token, so the opacity modifier is real here) for close,
gallery and the Photo | Barcode toggle. Four thin corners say "put the food here" without copy. From
`md` up it keeps its phone shape (430px, `rounded-sheet`) in the middle of a scrim — stretching a
viewfinder across a monitor makes a small plate very large. **Photo is the default mode on every
device**; barcode is a mode you switch to, and "type the code" is a small sheet inside it.

The result is a `bg-canvas` sheet that rises over the photo, in one reading order: name (editable),
the calorie numeral on one `bg-surface` card with the three macros under it, "On the plate" when the
model saw more than one food, a `[−] 300 g [+]` quantity row whose number is typeable (the nudge is
25 g / 1 pc; the range is `portionRange`), a four-way meal radio (the selected slot is `bg-ink
text-canvas`, the same "selected" idiom as Home's week strip), a three-chip "Was this right?", and
the one primary action pinned outside the scroller — `Add to Lunch · 648 kcal` — which says what will
happen, where, and at what cost. The wait is a 56px ring with an ember arc and one changing line;
nothing else moves. After the write the same sheet turns into the confirmation — a `good-soft` check,
"Logged to Lunch", what went in, and where the day now stands — with Done and Scan another. A
milestone overlay (`LogMilestones`, `z-[100]`) still lands on top of it.

## Progress

Progress (`app/progress/page.tsx` → `components/progress/ProgressClient.tsx`) answers three questions
in order — *am I on track, am I moving, what am I eating* — inside the page frame, each big region in
its own `border-2 border-hairline-2` frame (the same weight as Home and Food). The one loud object is
the **streak banner** at the top: `bg-cta-grad` + `shadow-cta`, a flame in a white/20 disc, the day
count as a display numeral, seven dots for the last seven days, and the month's logged count. Then,
top to bottom: `DeficitTrendCard` as "Energy balance" (the leading indicator, status in a soft tinted
pill); `WeightHero` — the 48px numeral with a protein-tinted BMI tile beside it, "4.8 kg lost since
start · 5.2 kg to go", the ember start→goal bar, the 4-week trend sentence, and `WeightTrendChart`
(weigh-ins as ink dots over an ember average line with a wash under it; goal as a dashed rule only
when within 2 kg of the data); "Intake" with the existing 7/14/30-day range (Pro-locked beyond the
free window) as a segmented pill, the metric as a `SegmentedControl`, gradient bars and the goal a
hairline dashed rule named in the caption; exercise rows; the month as ember discs with today ringed
and future days bare; badges on `BRAND_TILE`; the share button last. Averages leave today out; the
per-day calorie list that duplicated the bars is gone.

## Profile

Profile (`app/settings/page.tsx` → `components/settings/SettingsClient.tsx`) is the calmest tab: a
place to manage, not a dashboard — the live numbers stay on Home and Progress. Inside the page frame,
top to bottom: the same caption + `text-title` header as the other tabs; an identity row (a 56px
ember-gradient initial, the name at `text-title-sm`, the email, a `brand` chip only when the account
is Pro — a free account is not labelled); one framed **Plan** block (focus and pace on one line, the
daily target as a `text-display` numeral, the three macros with their swatches, then target weight /
activity / height as a three-column `dl`) whose "Edit" opens the existing sheet with the quick
calorie editor and the full profile form; then settings as titled groups — Subscription, Tracking,
Preferences, Privacy & data — each one `bg-surface` card of 56px rows (`divide-hairline`, a 20px
lucide glyph, the label, the current value in `text-caption text-ink-3`, a chevron); and last an
outline Sign out, a `text-danger` Delete account and the version. The subscription is a status line,
never a card: "Pro subscription · Annual · renews 12 Mar 2027" (or "ends", once a cancellation is
scheduled) for Pro, "GetInShape Pro · Free plan" linking to `/upgrade` for free. From `lg` the
identity and plan sit sticky on the left and the groups on the right. Inside the sheet the selected
preset and the analytics choice use the ink-on-canvas "selected" idiom; every `<select>` shares the
`Input` primitive's filled style.

## The public site

`app/page.tsx` (with `components/landing/ProductScreens.tsx` and `Faq.tsx`) is the one surface that
is **azure-led**: `--azure` / `--azure-text` / `--azure-soft` / `--azure-ring` / `--azure-grad` /
`--azure-shadow` / `--azure-wash` in `globals.css` promote the blue the app already carries as
`--protein` and `--ambient` to a full family, in both themes. It exists so the product screenshots —
ember, as the app really is — are the warm thing on the page; inside the app ember stays the one
accent and nothing there may use `azure`. The page is short on purpose: header, hero, the three
product screens, four differentiators, three steps, the founder's two sentences, pricing rendered
from `lib/planFeatures` (the public claim), five native `<details>` questions, one closing CTA, a
one-line footer. The screens are the app's own components and classes laid out at 390px and scaled
(`rounded-phone`, 44px, is the one radius that exists only here), `aria-hidden` and non-interactive
so a visitor cannot tap into a page that bounces to sign-in. The keyboard ring on this page is azure
(`.site :focus-visible`); everywhere else it is ember.

## Guardrail

`npm run check:tokens` (`scripts/check-tokens.mjs`) **fails** on any raw hex colour or broken opacity
modifier anywhere in `app/` or `components/`, and **ratchets** three counts that may only fall:
arbitrary spacing (`m-[…]`/`p-[…]`/`gap-[…]`), arbitrary type (`text-[Npx]`) and arbitrary radius
(`rounded-[Npx]`). Each has a baseline constant in the script; lowering one is the sweep working,
raising one needs a `// token-check-ignore` and a reason. Legitimate exceptions (PWA meta colours, the
studio's own reference values, a fixed multi-colour brand mark) are allowlisted by filename or a
`token-check-ignore` comment — see the script header. If you add a colour token, add its name to
`TOKEN_NAMES` there too, or the opacity check goes blind to it; if you add a type/radius/shadow step,
register it in `lib/utils.ts` or `tests/cnMerge.test.ts` fails.

## UI component layout

Primitive components in `components/ui/` follow the shadcn/ui pattern (Radix UI primitives +
`clsx`/`tailwind-merge` via `lib/utils.ts`). Domain components live under `components/dashboard/`,
`components/log/`, `components/weight/`, `components/settings/`, `components/layout/`.
