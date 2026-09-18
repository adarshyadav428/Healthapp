/**
 * Exactly one file names the Gemini endpoint or a Gemini model id.
 *
 * Until 2026-09-18 `gemini-2.5-flash-lite` was a string literal in three
 * routes, so changing one silently forked the other two — CLAUDE.md said
 * "grep to find them all", which is a rule nobody runs. This walks the
 * shipped tree instead. A new AI feature goes through `callGemini`; if it
 * genuinely needs a different model, that becomes a named constant in
 * lib/gemini.ts, not a literal where it's used.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const SHIPPED = ['app', 'components', 'hooks', 'lib', 'store', 'worker']
const THE_ONE_FILE = 'lib/gemini.ts'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

/** Strips // and /* comments so a file may still explain history without tripping the rule. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')
}

const files = SHIPPED.flatMap((d) => walk(join(ROOT, d))).map((p) => relative(ROOT, p).replace(/\\/g, '/'))

describe('Gemini has one call site', () => {
  it(`only ${THE_ONE_FILE} names the generativelanguage endpoint`, () => {
    const offenders = files.filter((f) => f !== THE_ONE_FILE && stripComments(readFileSync(join(ROOT, f), 'utf8')).includes('generativelanguage.googleapis.com'))
    expect(offenders).toEqual([])
  })

  it(`only ${THE_ONE_FILE} names a gemini-* model id`, () => {
    const offenders = files.filter((f) => f !== THE_ONE_FILE && /['"`]gemini-[0-9a-z.-]+['"`]/.test(stripComments(readFileSync(join(ROOT, f), 'utf8'))))
    expect(offenders).toEqual([])
  })

  it('every AI route reaches Gemini through callGemini', () => {
    for (const route of ['app/api/camera/analyze/route.ts', 'app/api/chat/analyze/route.ts', 'app/api/cron/weekly-recap/route.ts']) {
      const src = readFileSync(join(ROOT, route), 'utf8')
      expect(src, route).toMatch(/import \{[^}]*\bcallGemini\b[^}]*\} from '[./]*lib\/gemini'/)
      expect(src, route).toContain('await callGemini(')
    }
  })
})
