# AI food logging — chat and camera

> Read this before changing `lib/chat-prompt.ts`, `lib/chat-nutrition.ts`,
> `app/api/chat/analyze/route.ts`, or the inline prompt in
> `app/api/camera/analyze/route.ts`. `lib/chat-prompt.ts` had no pointer doc
> until this one — the 2026-09-03 audit flagged that as a silent-regression
> risk, since prompt wording is not unit-testable.

## The two AI logging routes

`app/api/chat/analyze/route.ts` (text) and `app/api/camera/analyze/route.ts`
(photo) both call Gemini, match the result against the `foods` table, and
write a shared `estimate` row when nothing matches. They share
`INDIAN_PORTION_REFERENCE` (`lib/indian-portions.ts`) and
`pickBestFoodMatch` (`lib/foodMatch.ts`), but their prompts and
post-processing deliberately diverge — see below.

## The bug this doc exists because of

*"750g of Hyderabadi chicken biryani which contained 6 medium sized chicken
pieces along with some gravy"* used to come back as **three** items summing
to **1100g** — biryani 750g, chicken 300g, gravy 50g — because the chicken
and gravy are already inside the 750g and nothing subtracted them back out.
Two things were missing at once: the prompt had no rule distinguishing "the
user is describing what's inside one dish" from "the user is listing several
dishes", and the route had zero nutrition guardrails at all (it trusted
Gemini's macros verbatim — the camera route already had
`isPlausible`/`clampToPlausible` for this, chat never got them).

Fixed across three PRs:
1. Nutrition guardrails + fixed error handling (`lib/chat-nutrition.ts`
   `resolveChatItemNutrition`, mirroring `lib/camera-nutrition.ts`).
2. **The reconciliation backstop** — `parseStatedTotal` +
   `rebalanceChatItems` in `lib/chat-nutrition.ts`.
3. **The prompt rewrite** — this doc's eval section.

## Decompose-and-normalize, not collapse

The fix keeps every component the model identifies as a separate, editable
line item (so a user can bump "6 chicken pieces" to 8 without touching
anything else) — it does **not** collapse a composite dish into one opaque
row. What changed is the arithmetic: the model classifies each item as
`is_stated_component: true` (the user gave it its own count/amount inside a
larger dish) or `false`/omitted (the rest of the dish — rice, masala, base).
When the user also stated one total weight for the dish, the server —
**never the model** — computes:

```
base.grams = stated_total_grams − Σ(explicit component grams)
```

This is the same lesson `lib/camera-nutrition.ts` already encodes for label
panels: *the model transcribes/classifies, the app does the arithmetic.*
Camera learned this because letting Gemini scale a label panel itself
produced wrong numbers repeatedly; the live eval below (see "chicken pieces
inside a stated total") shows chat needed the identical lesson — even with
the new prompt, the model still tends to report the base item at the FULL
stated total (not total-minus-components), so the server-side subtraction
in `rebalanceChatItems` is load-bearing, not a belt-and-suspenders extra.

`parseStatedTotal` is deliberately conservative: a message naming more than
one distinct weight returns `null` rather than guess which one is "the"
total — doing nothing is safer than rebalancing against the wrong number.

## The deliberate camera/chat prompt divergence

Camera's prompt (inline in `app/api/camera/analyze/route.ts`, rule 2)
explicitly decomposes a visible thali/bucket/combo into its components — the
photo shows a plate with several distinct foods, so decomposing is correct.
Chat's prompt has the opposite default: a single named dish stays one dish
unless the user lists genuinely separate, separately-quantified foods. These
are not the same rule accidentally diverging — they answer different
questions (what's visibly on a plate vs. what did the user say they ate) —
**do not "unify" them.**

## `ai_estimate_corrected` payload shape — chat vs. camera

Pre-existing, noted here so nobody "fixes" it by accident: chat emits this
event once per logged item with `original_grams`/`corrected_grams`/
`delta_grams`; camera emits it once per scan with `original_amount`/
`corrected_amount`/`delta_amount` plus `unit` and `confidence` and both a
name and amount correction flag. Reconciling the two shapes is a distinct
analytics-hygiene task, not addressed here.

## Manual prompt eval

Prompt wording is not unit-testable — `tests/chatPrompt.test.ts` only pins
that the key instructions are still present in the string, not that the
model obeys them. Whenever `CHAT_LOG_PROMPT` changes, run it against a
handful of real messages by hand and record the result here before merging.

**Run 2026-09-04**, `gemini-2.5-flash-lite`, temperature 0.1, against the
prompt in this PR (composite-dish rule + `is_stated_component` +
weight-anchoring + anti-over-specification + confidence/assumptions). Ran
against the live API using the project's own `GEMINI_API_KEY`; a free-tier
key is rate-limited to 20 requests/day, which cut the run short — worth
checking that production's key is on a paid plan, since the app's real
request volume is well over that.

| Message | Result |
|---|---|
| "So i ate 750g of Hyderabadi chicken biryani which contained 6 medium sized chicken pieces along with some gravy" (the original bug report) | Biryani `750g, is_stated_component:false` + Chicken `330g, is_stated_component:true` (gravy folded into `assumptions` rather than listed at all — a valid, even more conservative reading than expected). `rebalanceChatItems` corrects this to biryani 420g / chicken 330g, **summing to exactly 750g**. |
| "aadha kg biryani jisme chicken tha" (Hinglish, no explicit gram figure) | Biryani `500g, is_stated_component:false` + Chicken `165g, is_stated_component:true` — the model reported the base at the FULL 500g total, not 500 minus the chicken. This is the concrete proof that the server-side subtraction is necessary, not redundant: `rebalanceChatItems` corrects it to biryani 335g / chicken 165g = 500g. |
| "1 plate chicken biryani with raita" | Two items, both `is_stated_component:false` — correctly read as two separate foods (no containment language, "1 plate" isn't a parseable weight so no rebalancing is attempted either). |
| "4 medium roti, aloo beans sabzi, 1 katori dal, 3 katori chawal" | Four separate items, all `is_stated_component:false` — a genuine list stays a list. |
| "ate 200g paneer butter masala" | One item, exactly 200g, `confidence: high`. |

Three further messages ("had 2 roti with some sabzi and a little gravy",
"2 bhature with chole for breakfast", "masala dosa with sambar and chutney")
queued but hit the free-tier daily quota before returning — re-run and
append results here the next time this prompt changes, ideally with a
paid-tier key so a full run doesn't get cut off.

**Takeaway:** the prompt change alone measurably improves the model's own
classification (it now reliably flags the right item as the component), but
it does **not** reliably make the model do the subtraction itself — confirm
`rebalanceChatItems` stays wired in before ever considering the prompt
"enough" on its own.

## Model choice

Chat currently runs `gemini-2.5-flash-lite` (same as camera), temperature
0.1, no seed. A move to a stronger model (`gemini-2.5-flash` or
`gemini-2.5-pro`) is a measured decision, not a default — re-run the manual
eval above against the candidate model on the same messages, and only
switch if it clearly improves the composite-dish/over-specification cases
with acceptable latency (chat is a foreground wait, unlike camera's async
upload). If chat and camera ever run different models, record which and why
right here — a later reader will otherwise "align" them back to matching by
default.
