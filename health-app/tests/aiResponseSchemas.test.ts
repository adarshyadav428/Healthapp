/**
 * The two response schemas the AI routes send to Gemini must describe the
 * exact objects the routes then read. A field read by the route but missing
 * from the schema is a field the model is no longer asked for — silently
 * null forever, with every parse still succeeding.
 */
import { describe, expect, it } from 'vitest'
import { CAMERA_RESPONSE_SCHEMA, MAX_CAMERA_ITEMS, type GeminiFood, type LabelPanel } from '../lib/camera-nutrition'
import { CHAT_RESPONSE_SCHEMA } from '../lib/chat-prompt'
import type { ChatItem } from '../lib/chat-nutrition'

/** A fully-populated value of the type, so `Object.keys` enumerates every field the route can read. */
const EVERY_GEMINI_FOOD_FIELD: Required<GeminiFood> = {
  name: '', estimated_grams: 0, unit: 'g',
  kcal_per_100g: 0, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 0,
  total_kcal: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0,
  label: null,
}
const EVERY_LABEL_FIELD: Required<LabelPanel> = {
  panel_amount: 0, serving_size: 0, servings_per_pack: 0, net_quantity: 0, unit: 'g',
  energy_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
}
const EVERY_CHAT_ITEM_FIELD: Required<ChatItem> = {
  name: '', portion_desc: '', grams: 0, is_stated_component: false, confidence: 'low', unit: 'pcs', count: 0,
  kcal_per_100g: 0, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 0,
}

describe('CAMERA_RESPONSE_SCHEMA', () => {
  const item = CAMERA_RESPONSE_SCHEMA.properties.foods.items

  it('declares every GeminiFood field, and nothing else', () => {
    expect(Object.keys(item.properties).sort()).toEqual(Object.keys(EVERY_GEMINI_FOOD_FIELD).sort())
    expect([...item.propertyOrdering].sort()).toEqual(Object.keys(EVERY_GEMINI_FOOD_FIELD).sort())
  })

  it('declares every LabelPanel field, and nothing else', () => {
    expect(Object.keys(item.properties.label.properties).sort()).toEqual(Object.keys(EVERY_LABEL_FIELD).sort())
  })

  it('requires the fields resolveNutrition cannot do without, and only those', () => {
    expect([...item.required].sort()).toEqual(
      ['name', 'estimated_grams', 'unit', 'kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g', 'fat_g_per_100g'].sort(),
    )
    expect(item.properties.label.nullable).toBe(true)
    expect(item.properties.total_kcal.nullable).toBe(true)
  })

  it('constrains unit and confidence to the values the route branches on', () => {
    expect(item.properties.unit.enum).toEqual(['g', 'ml', 'pcs'])
    expect(CAMERA_RESPONSE_SCHEMA.properties.confidence.enum).toEqual(['low', 'medium', 'high'])
  })

  it('caps a scan at eight items — a thali, not three', () => {
    expect(MAX_CAMERA_ITEMS).toBe(8)
  })
})

describe('CHAT_RESPONSE_SCHEMA', () => {
  const item = CHAT_RESPONSE_SCHEMA.properties.items.items

  it('declares every ChatItem field, and nothing else', () => {
    expect(Object.keys(item.properties).sort()).toEqual(Object.keys(EVERY_CHAT_ITEM_FIELD).sort())
    expect([...item.propertyOrdering].sort()).toEqual(Object.keys(EVERY_CHAT_ITEM_FIELD).sort())
  })

  it('keeps the not_food branch reachable under a schema (nullable top-level error, items always present)', () => {
    expect(CHAT_RESPONSE_SCHEMA.properties.error.nullable).toBe(true)
    expect(CHAT_RESPONSE_SCHEMA.required).toEqual(['items'])
  })

  it('constrains meal to the four slots the app files a log under', () => {
    expect(CHAT_RESPONSE_SCHEMA.properties.meal.enum).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack'])
  })
})
