/**
 * The regression guard for the bug that started this: a stated total plus
 * explicitly-quantified components summing to more than what the user said
 * they ate. Modelled on tests/curatedFoods.test.ts's "collect every offender,
 * then assert the list is empty" style, so one failing case names itself
 * instead of failing the whole suite opaquely.
 */

import { describe, it, expect } from 'vitest'
import { parseStatedTotal, rebalanceChatItems } from '../lib/chat-nutrition'
import { CHAT_LOG_CASES } from './fixtures/chat-log-cases'

describe('chat-log reconciliation eval', () => {
  it('every labelled case produces the expected final item list', () => {
    const offenders: string[] = []

    for (const c of CHAT_LOG_CASES) {
      const stated = parseStatedTotal(c.message)
      const { items, mismatch } = rebalanceChatItems(c.rawItems, stated, c.rawAssumptions ?? '')
      const total = items.reduce((sum, i) => sum + i.grams, 0)

      if (items.length !== c.expect.itemCount) {
        offenders.push(`${c.name}: got ${items.length} items, want ${c.expect.itemCount}`)
      }
      if (Math.abs(total - c.expect.totalGrams) > 1) {
        offenders.push(`${c.name}: total ${total}g, want ${c.expect.totalGrams}g`)
      }
      if (c.expect.anyLowConfidence && !items.some((i) => i.confidence === 'low')) {
        offenders.push(`${c.name}: expected at least one low-confidence item`)
      }
      if (c.expect.expectMismatch && !mismatch) {
        offenders.push(`${c.name}: expected a mismatch, got none`)
      }
      if (!c.expect.expectMismatch && mismatch) {
        offenders.push(`${c.name}: expected no mismatch, got ${mismatch.action}`)
      }
      if (c.expect.mismatchAction && mismatch?.action !== c.expect.mismatchAction) {
        offenders.push(`${c.name}: mismatch action ${mismatch?.action}, want ${c.expect.mismatchAction}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
