/**
 * useCameraScan (hooks/useCameraScan.ts) — the client half of the P0-1
 * unresolved-food invariant.
 *
 * app/api/camera/analyze/route.ts already guarantees an unresolved "pcs" item
 * (lib/camera-nutrition.ts's `resolvable: false`) never reaches
 * `json.foods` — it is dropped server-side and only its name rides back in
 * `json.unresolved` (see routeCameraAnalyze.test.ts's P0-1 describe block).
 * This file pins the other half of the invariant: that the CLIENT cannot
 * undo that guarantee by reconstructing a usable item from an unresolved
 * name. There is no jsdom in this suite (no vitest.config.ts — specs run in
 * node), and the hook is stateful React wired to camera/media APIs that
 * don't exist there, so — following the precedent in coachingWiring.test.ts
 * — this pins the hook's SOURCE rather than rendering it: what feeds
 * `results` (the only thing `logFood` and the totals ever read) is asserted
 * directly against the file text.
 *
 * Audit 2026-09-04, P0-1 follow-up (camera unresolved-state invariant review).
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(__dirname, '..', 'hooks', 'useCameraScan.ts'), 'utf8')

describe('useCameraScan — an unresolved item cannot become a loggable result', () => {
  it('builds every PhotoResult from json.foods, never from json.unresolved', () => {
    expect(source).toContain('const items: PhotoResult[] = (json.foods as')
  })

  it("handles json.unresolved with a toast only — it never feeds `results`/`items`", () => {
    const at = source.indexOf('if (Array.isArray(json.unresolved)')
    expect(at).toBeGreaterThan(-1)
    // The block is short (one toast call); 400 chars is generous headroom
    // without risking bleeding into an unrelated later block.
    const block = source.slice(at, at + 400)
    const closingBrace = block.indexOf('\n  })')
    const unresolvedBlock = closingBrace > -1 ? block.slice(0, closingBrace) : block
    expect(unresolvedBlock).toContain('toast(')
    expect(unresolvedBlock).not.toMatch(/setResults|items\.push|results\.push|setSelectedIdx/)
  })

  it('logFood never reads json.unresolved or reconstructs a dropped item — only `results`/`selected`', () => {
    const at = source.indexOf('const logFood = useCallback(')
    expect(at).toBeGreaterThan(-1)
    // logFood is the last hook-body callback before the derived-values
    // section; bound its extraction there so a later addition to the file
    // can't silently widen what this test reads.
    const end = source.indexOf('// ── Derived nutrition values', at)
    expect(end).toBeGreaterThan(at)
    const logFoodBody = source.slice(at, end)

    expect(logFoodBody).not.toContain('unresolved')
    // Both log paths must build their payload from `results`/`selected` —
    // the arrays that provably contain only json.foods-derived items.
    expect(logFoodBody).toMatch(/items:\s*results\.map/)
    expect(logFoodBody).toContain('selected.food.id')
  })
})
