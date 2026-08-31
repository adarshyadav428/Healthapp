/**
 * 041_branded_foods_v2.sql is applied by hand in the Supabase SQL editor, so
 * nothing else in this repo ever executes it. These assertions are the only
 * thing standing between a typo in that file and a wrong number in someone's
 * diary — and every one of them caught a real defect while the file was being
 * written: a duplicate of an existing ifct row, instant coffee entered with a
 * third of its carbohydrate, and four products whose *name* routed them to the
 * wrong portion rule (a chocolate offered as a 250 ml glass of cola, a namkeen
 * as a 200 g katori).
 *
 * The portion assertion is the important one. lib/portion-units.ts matches on
 * the name, first pattern wins, and a name match makes buildUnits ignore the
 * row's own common_portions — so a row can carry a perfect 30 g pack and still
 * open on 250 g. Nothing in the SQL hints at that; only this test does.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildUnits, pickDefaultUnit } from '../lib/portion-units'
import { stripLineComments } from '../lib/rlsPolicies'
import { CURATED_FOODS } from '../lib/curated-foods-data'
import { INDIAN_FOODS } from '../lib/indian-foods-data'
import type { Food } from '../types/index'

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')
const FILE = '041_branded_foods_v2.sql'
const sql = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')

type Row = {
  source_id: string
  name: string
  brand: string
  serving_size_g: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  common_portions: string
}

/** Postgres escapes a quote by doubling it; undo that to get the stored value. */
const unquote = (s: string) => s.replace(/''/g, "'")

const ROW_RE =
  /\('branded','([^']+)',\s*\n\s*'((?:[^']|'')+)', '((?:[^']|'')+)',\s*\n\s*([\d.]+), '(?:[^']|'')+',\s*\n\s*([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+),\s*\n\s*'(\[.*?\])'\)/g

const rows: Row[] = []
for (const m of sql.matchAll(ROW_RE)) {
  rows.push({
    source_id: m[1],
    name: unquote(m[2]),
    brand: unquote(m[3]),
    serving_size_g: Number(m[4]),
    kcal: Number(m[5]),
    protein: Number(m[6]),
    carbs: Number(m[7]),
    fat: Number(m[8]),
    fibre: Number(m[9]),
    common_portions: m[10],
  })
}

const asFood = (r: Row): Food => ({
  id: r.source_id,
  source: 'branded',
  source_id: r.source_id,
  name: r.name,
  brand: r.brand,
  serving_size_g: r.serving_size_g,
  serving_description: `${r.serving_size_g}g`,
  kcal_per_100g: r.kcal,
  protein_g_per_100g: r.protein,
  carbs_g_per_100g: r.carbs,
  fat_g_per_100g: r.fat,
  fiber_g_per_100g: r.fibre,
  common_portions: JSON.parse(r.common_portions),
})

describe(FILE, () => {
  it('every VALUES tuple parses', () => {
    expect(rows.length).toBe((sql.match(/\('branded','/g) ?? []).length)
    expect(rows.length).toBeGreaterThan(30)
  })

  it('is idempotent — re-running it cannot duplicate a row', () => {
    expect(sql).toContain('ON CONFLICT (source, source_id) DO NOTHING')
  })

  it('never deletes from foods (four tables cascade off it)', () => {
    // Comments stripped first — this file's own header says "NEVER DELETE
    // FROM foods", and the point is to catch a statement, not a warning.
    expect(/delete\s+from\s+foods/i.test(stripLineComments(sql))).toBe(false)
  })

  it('source_ids are unique here and unused by any other migration', () => {
    const ids = rows.map((r) => r.source_id)
    expect(new Set(ids).size).toBe(ids.length)
    const others = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && f !== FILE)
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
      .join('\n')
    for (const id of ids) expect(others.includes(`'${id}'`), id).toBe(false)
  })

  it('common_portions is valid JSON with real gram weights', () => {
    for (const r of rows) {
      const parsed = JSON.parse(r.common_portions) as { unit: string; grams: number; label: string }[]
      expect(parsed.length, r.name).toBeGreaterThan(0)
      for (const p of parsed) {
        expect(p.grams, `${r.name} / ${p.label}`).toBeGreaterThan(0)
        expect(p.label, r.name).toBeTruthy()
      }
    }
  })

  it('macros are physically possible and roughly reconcile with the stated kcal', () => {
    for (const r of rows) {
      expect(r.protein + r.carbs + r.fat, r.name).toBeLessThanOrEqual(100)
      // Labels legitimately deviate from 4/4/9 (fibre, polyols, rounding), so
      // this is a smell test, not the strict equality curatedFoods.test.ts
      // applies to generated rows. It is what caught instant coffee entered at
      // 42g carbs instead of 75g.
      const atwater = r.protein * 4 + r.carbs * 4 + r.fat * 9
      expect(
        Math.abs(atwater - r.kcal),
        `${r.name}: stated ${r.kcal} kcal vs ${atwater.toFixed(0)} from macros`
      ).toBeLessThan(r.kcal * 0.15 + 15)
    }
  })

  it('does not duplicate a food the catalogue already has', () => {
    const existing = new Set([...CURATED_FOODS, ...INDIAN_FOODS].map((f) => f.name.toLowerCase()))
    for (const r of rows) expect(existing.has(r.name.toLowerCase()), r.name).toBe(false)
  })

  it('every name routes to a portion default near its own pack serving', () => {
    for (const r of rows) {
      const food = asFood(r)
      const grams = pickDefaultUnit(buildUnits(food), food).toGrams(1)
      // A default more than 3x the pack serving means the name matched a rule
      // written for a different food — a katori, a glass, a bowl.
      expect(grams, `${r.name}: opens on ${grams}g against a ${r.serving_size_g}g serving`)
        .toBeLessThanOrEqual(r.serving_size_g * 3)
      expect(grams, `${r.name}: opens on ${grams}g against a ${r.serving_size_g}g serving`)
        .toBeGreaterThanOrEqual(r.serving_size_g * 0.25)
    }
  })

  it('the Nut Cracker row this migration exists for is present and sane', () => {
    const nc = rows.find((r) => r.source_id === 'branded-haldirams-nut-cracker')
    expect(nc).toBeDefined()
    expect(nc!.name).toContain('Nut Cracker')
    // "Namkeen" is load-bearing: without it the name matches no portion rule.
    expect(nc!.name).toContain('Namkeen')
    const food = asFood(nc!)
    expect(pickDefaultUnit(buildUnits(food), food).toGrams(1)).toBe(30)
  })
})
