/**
 * lib/chat-prompt.ts shapes what Gemini is asked, and had no test at all
 * (flagged in docs/deep-dive-audit-2026-09-03.md as a silent-regression
 * risk). Prompt WORDING isn't unit-testable — whether the model actually
 * obeys it is a model-behaviour question, checked by the manual eval in
 * docs/ai-logging.md, not here. What this file pins: the key instructions
 * this prompt depends on are still present (so an edit can't silently drop
 * one), and stripMarkdown's parsing, which the route trusts unconditionally.
 */

import { describe, it, expect } from 'vitest'
import { CHAT_LOG_PROMPT, stripMarkdown } from '../lib/chat-prompt'

describe('CHAT_LOG_PROMPT', () => {
  it('carries the component/base classification the reconciliation backstop reads', () => {
    expect(CHAT_LOG_PROMPT).toContain('is_stated_component')
    expect(CHAT_LOG_PROMPT).toContain('ONE DISH, DESCRIBED')
  })

  it('carries the weight-anchoring rule', () => {
    expect(CHAT_LOG_PROMPT).toContain('WEIGHT ANCHORING')
  })

  it('carries the anti-over-specification rule', () => {
    expect(CHAT_LOG_PROMPT).toContain('DO NOT OVER-SPECIFY')
  })

  it('asks for per-item confidence and a top-level assumptions string', () => {
    expect(CHAT_LOG_PROMPT).toContain('"confidence"')
    expect(CHAT_LOG_PROMPT).toContain('"assumptions"')
  })

  it('carries the counted-item (pcs/count) rule the piece-count stepper depends on', () => {
    expect(CHAT_LOG_PROMPT).toContain('COUNTED ITEMS')
    expect(CHAT_LOG_PROMPT).toContain('"unit": "pcs"')
    expect(CHAT_LOG_PROMPT).toContain('"count"')
  })

  it('still asks for the not_food escape hatch and the max-items cap', () => {
    expect(CHAT_LOG_PROMPT).toContain('not_food')
    expect(CHAT_LOG_PROMPT).toContain('Max 8 items')
  })
})

describe('stripMarkdown()', () => {
  it('strips a ```json fenced block', () => {
    expect(stripMarkdown('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('strips a bare ``` fenced block with no language tag', () => {
    expect(stripMarkdown('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('passes unfenced JSON through unchanged (trimmed)', () => {
    expect(stripMarkdown('  {"a":1}  ')).toBe('{"a":1}')
  })
})
