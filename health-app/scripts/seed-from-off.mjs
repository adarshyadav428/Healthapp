/**
 * scripts/seed-from-off.mjs
 *
 * One-time script: fetches popular Indian packaged foods from Open Food Facts
 * and pre-seeds them into Supabase so they appear in local search immediately.
 *
 * Run: node scripts/seed-from-off.mjs
 *
 * Uses source='off' and source_id='offi_<barcode>' — identical to what the
 * live search pipeline writes via persistExternalFoods(), so there are no
 * duplicate conflicts when users search for the same items later.
 */

import * as fs from 'node:fs'
import * as https from 'node:https'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Env ──────────────────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '..', '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')
const getEnv = (key) => {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, 'm'))
  if (!m) throw new Error(`Missing ${key} in .env.local`)
  return m[1].trim()
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_HOST = new URL(SUPABASE_URL).hostname

// ── Search queries ────────────────────────────────────────────────────────────
// Each entry fetches up to PAGE_SIZE products from OFF filtered to India.
// Queries are intentionally overlapping; source_id deduplication handles that.

const QUERIES = [
  // Amul (dairy)
  'Amul butter', 'Amul cheese', 'Amul milk', 'Amul ghee', 'Amul paneer',
  'Amul ice cream', 'Amul curd', 'Amul cream', 'Amul lassi',

  // Britannia (biscuits & bread)
  'Britannia Marie', 'Britannia Good Day', 'Britannia NutriChoice',
  'Britannia bread', 'Britannia cake', 'Britannia cream biscuit',
  'Britannia Little Hearts', 'Britannia Bourbon',

  // Parle (biscuits & snacks)
  'Parle-G', 'Parle Monaco', 'Parle Hide and Seek', 'Parle KrackJack',
  'Parle Magix', 'Parle Melody',

  // ITC Sunfeast & Bingo
  'Sunfeast Marie', 'Sunfeast cream', 'Sunfeast Farmlite', 'Sunfeast Dark Fantasy',
  'Bingo chips', 'Bingo Mad Angles', 'Bingo Tedhe Medhe',

  // ITC Aashirvaad
  'Aashirvaad atta', 'Aashirvaad masala', 'Aashirvaad pasta',

  // Maggi / Nestlé
  'Maggi noodles', 'Maggi masala', 'Maggi sauce',
  'Nestle KitKat India', 'Nestle Munch', 'Nestle Milkmaid', 'Nestle Milo India',
  'Nestle Cerelac', 'Nestle Koko Krunch',

  // Cadbury / Mondelez
  'Cadbury Dairy Milk', 'Cadbury 5 Star', 'Cadbury Bournvita',
  'Cadbury Oreo India', 'Cadbury Gems', 'Cadbury Eclairs',

  // Haldiram's
  "Haldiram bhujia", "Haldiram namkeen", "Haldiram mixture",
  "Haldiram sev", "Haldiram moong dal", "Haldiram aloo bhujia",
  "Haldiram peanuts", "Haldiram sweets", "Haldiram rasgulla",

  // Bikaji
  'Bikaji bhujia', 'Bikaji namkeen', 'Bikaji mixture', 'Bikaji sev',

  // MTR
  'MTR masala', 'MTR ready to eat', 'MTR breakfast mix',
  'MTR dal makhani', 'MTR poha', 'MTR idli mix',

  // Patanjali
  'Patanjali atta', 'Patanjali biscuit', 'Patanjali ghee',
  'Patanjali honey', 'Patanjali juice', 'Patanjali noodles',
  'Patanjali rava', 'Patanjali moong dal',

  // Mother Dairy
  'Mother Dairy milk', 'Mother Dairy paneer', 'Mother Dairy curd',
  'Mother Dairy ice cream', 'Mother Dairy ghee',

  // PepsiCo India (Lays, Kurkure, Tropicana)
  'Lays chips India', 'Kurkure', 'Kurkure masala munch',
  'Tropicana juice India', 'Slice mango drink',

  // Coca-Cola India (Maaza, Limca, Thums Up)
  'Maaza mango', 'Limca drink', 'Thums Up',

  // Dabur
  'Dabur honey', 'Dabur Real juice', 'Dabur chyawanprash', 'Dabur Hajmola',

  // Paper Boat / Hector Beverages
  'Paper Boat juice', 'Paper Boat aamras',

  // Frooti / Parle Agro
  'Frooti mango', 'Appy Fizz',

  // Health drinks
  'Horlicks India', 'Boost drink India', 'Complan India', 'Ovaltine India',

  // Oils & ghee
  'Saffola oil', 'Fortune oil', 'Dhara oil', 'Sundrop oil',

  // Bread & dairy adjacent
  'Modern bread India', 'Harvest Gold bread', 'Wibs bread',

  // Instant oats & cereals
  'Quaker Oats India', 'Kelloggs India', 'Cornflakes India',

  // Masalas (packaged spice blends)
  'MDH masala', 'Everest masala', 'Catch masala', 'Ramdev masala',

  // Nut & seed snacks
  'Happilo dry fruits', 'True Elements seeds', 'Yoga Bar',
]

const PAGE_SIZE = 50  // items per query (OFF max is 50 per page)
const REQUEST_DELAY_MS = 600  // polite delay between OFF requests

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { 'User-Agent': 'GetInShape/1.0 (getinshape.app, Indian calorie tracker)' },
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
      },
    )
    req.on('error', reject)
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

function supabasePost(rows) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(rows)
    const req = https.request(
      {
        hostname: SUPABASE_HOST,
        path: '/rest/v1/foods',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
      },
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── OFF fetch & parse ─────────────────────────────────────────────────────────

async function fetchOFFIndia(query) {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(query)}` +
    `&countries_tags=en:india` +
    `&action=process&json=1` +
    `&fields=code,product_name,brands,serving_size,nutriments` +
    `&page_size=${PAGE_SIZE}&sort_by=unique_scans_n`

  const { status, body } = await httpsGet(url)
  if (status < 200 || status >= 300) return []
  try {
    return JSON.parse(body).products ?? []
  } catch {
    return []
  }
}

function parseServingGrams(str) {
  if (!str) return 100
  const gMatch = str.match(/(\d+(?:\.\d+)?)\s*g\b/i)
  if (gMatch) {
    const v = parseFloat(gMatch[1])
    if (v > 0 && v <= 1000) return Math.round(v)
  }
  const mlMatch = str.match(/(\d+(?:\.\d+)?)\s*ml\b/i)
  if (mlMatch) {
    const v = parseFloat(mlMatch[1])
    if (v > 0 && v <= 1000) return Math.round(v)
  }
  return 100
}

function productToRow(p) {
  const name = p.product_name?.trim()
  if (!name || name.length < 2) return null

  const n = p.nutriments ?? {}
  const kcal =
    n['energy-kcal_100g'] ??
    (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0)
  const protein = n['proteins_100g'] ?? 0
  const carbs = n['carbohydrates_100g'] ?? 0
  const fat = n['fat_100g'] ?? 0
  const fiber = n['fiber_100g'] ?? null

  // Skip products with no usable nutrition data
  if (kcal === 0 && protein === 0 && carbs === 0 && fat === 0) return null
  // Skip clearly erroneous values
  if (kcal > 950) return null

  // source_id matches the 'offi_' prefix used by lib/open-food-facts.ts
  // searchOpenFoodFactsIndia (idPrefix='offi'), so live search won't re-insert.
  const source_id = p.code
    ? `offi_${p.code}`
    : `offi_name_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`

  const serving_size_g = parseServingGrams(p.serving_size)

  return {
    source: 'off',
    source_id,
    name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    serving_size_g,
    serving_description: p.serving_size?.trim() || `${serving_size_g}g`,
    kcal_per_100g: Math.round(kcal * 10) / 10,
    protein_g_per_100g: Math.round(protein * 10) / 10,
    carbs_g_per_100g: Math.round(carbs * 10) / 10,
    fat_g_per_100g: Math.round(fat * 10) / 10,
    fiber_g_per_100g: fiber !== null ? Math.round(fiber * 10) / 10 : null,
    // common_portions left null — OFF foods use name-based unit inference in AddFoodModal
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('GetInShape — Open Food Facts India seeder')
  console.log(`Searching ${QUERIES.length} queries on OFF (${PAGE_SIZE} products each)...\n`)

  const seen = new Set()
  const foods = []

  for (const query of QUERIES) {
    process.stdout.write(`  "${query}" ... `)
    let products
    try {
      products = await fetchOFFIndia(query)
    } catch (e) {
      console.log(`WARN: ${e.message}`)
      await delay(REQUEST_DELAY_MS)
      continue
    }

    let added = 0
    for (const p of products) {
      const row = productToRow(p)
      if (!row) continue
      if (seen.has(row.source_id)) continue
      seen.add(row.source_id)
      foods.push(row)
      added++
    }
    console.log(`${added} new (${products.length} returned)  [total: ${foods.length}]`)
    await delay(REQUEST_DELAY_MS)
  }

  console.log(`\nCollected ${foods.length} unique foods. Inserting into Supabase...\n`)

  const BATCH = 50
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < foods.length; i += BATCH) {
    const batch = foods.slice(i, i + BATCH)
    const batchNum = Math.floor(i / BATCH) + 1
    const { status, body } = await supabasePost(batch)

    if (status === 201 || status === 200) {
      inserted += batch.length
      console.log(`  Batch ${batchNum}: ✓ ${batch.length} rows inserted`)
    } else if (status === 409) {
      skipped += batch.length
      console.log(`  Batch ${batchNum}: skipped (already exist)`)
    } else {
      failed += batch.length
      console.error(`  Batch ${batchNum}: FAILED status=${status}`)
      if (body) console.error(`    ${body.slice(0, 300)}`)
    }
  }

  console.log('\n─────────────────────────────────')
  console.log(`Inserted : ${inserted}`)
  console.log(`Skipped  : ${skipped}  (already in DB)`)
  console.log(`Failed   : ${failed}`)
  console.log('─────────────────────────────────')
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
