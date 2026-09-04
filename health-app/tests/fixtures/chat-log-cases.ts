// Labelled cases for the chat-log reconciliation eval (tests/chatLogEval.test.ts).
//
// `rawItems` stands in for a realistic raw model response to `message` — NOT
// what the model necessarily returns today. This harness tests the pure
// arithmetic in lib/chat-nutrition.ts (parseStatedTotal + rebalanceChatItems)
// given a model output, independent of whether the current prompt actually
// produces that output. Whether the prompt itself avoids over-specifying a
// dish name (e.g. "gravy" → "Chilli Paneer") is a model-behaviour question,
// not an arithmetic one — that's covered by chatPrompt.test.ts's structural
// checks and the manual eval in docs/ai-logging.md, not here.

import type { ChatItem } from '../../lib/chat-nutrition'

export type ChatLogCase = {
  name: string
  message: string
  rawItems: ChatItem[]
  rawAssumptions?: string
  expect: {
    itemCount: number
    /** Exact expected sum of grams across the final item list. */
    totalGrams: number
    anyLowConfidence?: boolean
    expectMismatch?: boolean
    mismatchAction?: 'rebalanced' | 'scaled_down'
  }
}

function item(partial: Partial<ChatItem> & Pick<ChatItem, 'name' | 'grams'>): ChatItem {
  return {
    portion_desc: `${partial.grams}g`,
    kcal_per_100g: 150,
    protein_g_per_100g: 8,
    carbs_g_per_100g: 15,
    fat_g_per_100g: 5,
    ...partial,
  }
}

export const CHAT_LOG_CASES: ChatLogCase[] = [
  {
    // The bug that started this: a stated total plus explicitly-quantified
    // components must never sum to more than the total.
    name: 'biryani-contained',
    message: '750g of Hyderabadi chicken biryani which contained 6 medium chicken pieces along with some gravy',
    rawItems: [
      item({ name: 'Hyderabadi Chicken Biryani', grams: 750, kcal_per_100g: 175, protein_g_per_100g: 8, carbs_g_per_100g: 20, fat_g_per_100g: 6 }),
      item({ name: 'Chicken Piece', grams: 300, is_stated_component: true, portion_desc: '6 medium pieces', kcal_per_100g: 165, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 }),
      item({ name: 'Mixed Vegetable Gravy', grams: 50, is_stated_component: true, portion_desc: 'a little', kcal_per_100g: 134, protein_g_per_100g: 9, carbs_g_per_100g: 5.4, fat_g_per_100g: 8.6 }),
    ],
    expect: { itemCount: 3, totalGrams: 750, expectMismatch: true, mismatchAction: 'rebalanced' },
  },
  {
    // "with" is not containment language — two genuinely separate items, no stated total to anchor to anyway.
    name: 'biryani-with-raita',
    message: '1 plate chicken biryani with raita',
    rawItems: [item({ name: 'Chicken Biryani', grams: 300 }), item({ name: 'Raita', grams: 60 })],
    expect: { itemCount: 2, totalGrams: 360 },
  },
  {
    name: 'thali-genuine',
    message: '2 roti, dal, bhindi sabzi, 1 katori rice',
    rawItems: [
      item({ name: 'Roti', grams: 80 }),
      item({ name: 'Dal', grams: 150 }),
      item({ name: 'Bhindi Sabzi', grams: 110 }),
      item({ name: 'Rice', grams: 150 }),
    ],
    expect: { itemCount: 4, totalGrams: 490 },
  },
  {
    name: 'explicit-weight-single',
    message: 'ate 200g paneer butter masala',
    rawItems: [item({ name: 'Paneer Butter Masala', grams: 200 })],
    expect: { itemCount: 1, totalGrams: 200 },
  },
  {
    // Components alone already exceed the stated total — a bad parse. Subtraction
    // would drive the base negative, so this must fall back to scaling everything.
    name: 'components-exceed-total',
    message: '500g rajma chawal with a huge amount of extra rice on the side',
    rawItems: [
      item({ name: 'Rajma Chawal', grams: 500 }),
      item({ name: 'Extra Rice', grams: 550, is_stated_component: true }),
    ],
    expect: { itemCount: 2, totalGrams: 500, anyLowConfidence: true, expectMismatch: true, mismatchAction: 'scaled_down' },
  },
  {
    // Hinglish half-kg phrasing, plus a genuine component to subtract.
    name: 'hinglish-half-kg',
    message: 'aadha kg biryani jisme chicken tha',
    rawItems: [
      item({ name: 'Chicken Biryani', grams: 400 }),
      item({ name: 'Chicken', grams: 200, is_stated_component: true }),
    ],
    expect: { itemCount: 2, totalGrams: 500, expectMismatch: true, mismatchAction: 'rebalanced' },
  },
  {
    name: 'plausibility-clamp',
    message: '1 katori dal',
    rawItems: [item({ name: 'Dal', grams: 150, kcal_per_100g: 900, protein_g_per_100g: 60, carbs_g_per_100g: 90, fat_g_per_100g: 40 })],
    expect: { itemCount: 1, totalGrams: 150, anyLowConfidence: true },
  },
  {
    name: 'no-weight-multi',
    message: 'poha aur chai',
    rawItems: [item({ name: 'Poha', grams: 200 }), item({ name: 'Chai', grams: 150 })],
    expect: { itemCount: 2, totalGrams: 350 },
  },
  {
    // Plain "1kg" plus a single item whose own grams undershoot the total.
    name: 'kg-plain-single-item',
    message: 'ate 1kg chicken curry for dinner',
    rawItems: [item({ name: 'Chicken Curry', grams: 900 })],
    expect: { itemCount: 1, totalGrams: 1000, expectMismatch: true, mismatchAction: 'rebalanced' },
  },
  {
    // Two distinct stated weights — deliberately conservative: do nothing
    // rather than guess which one is "the" total.
    name: 'multi-weight-ambiguous',
    message: '500g biryani and 200g raita',
    rawItems: [item({ name: 'Biryani', grams: 500 }), item({ name: 'Raita', grams: 200 })],
    expect: { itemCount: 2, totalGrams: 700 },
  },
  {
    // Every item claims to be a component — nothing to subtract FROM, so the
    // fallback is proportional scaling, not subtraction.
    name: 'all-components-no-base',
    message: '500g total of rajma and rice mixed together, roughly half and half',
    rawItems: [
      item({ name: 'Rajma', grams: 300, is_stated_component: true }),
      item({ name: 'Rice', grams: 300, is_stated_component: true }),
    ],
    expect: { itemCount: 2, totalGrams: 500, anyLowConfidence: true, expectMismatch: true, mismatchAction: 'scaled_down' },
  },
  {
    name: 'hinglish-pauna-kg',
    message: 'pauna kg chicken curry',
    rawItems: [item({ name: 'Chicken Curry', grams: 700 })],
    expect: { itemCount: 1, totalGrams: 750, expectMismatch: true, mismatchAction: 'rebalanced' },
  },
  {
    name: 'hinglish-dedh-kg',
    message: 'dedh kg chicken biryani for a party',
    rawItems: [item({ name: 'Chicken Biryani', grams: 1400 })],
    expect: { itemCount: 1, totalGrams: 1500, expectMismatch: true, mismatchAction: 'rebalanced' },
  },
]
