/**
 * One-time seeding script: run with `npx tsx scripts/seed-indian-foods.ts`
 * Reads SUPABASE_SERVICE_ROLE_KEY from .env.local and upserts all Indian foods.
 */
import * as fs from 'fs'
import * as https from 'https'
import * as path from 'path'
import { INDIAN_FOODS, type FoodSeed } from '../lib/indian-foods-data'
import { CURATED_FOODS } from '../lib/curated-foods-data'

// Read .env.local manually (no dotenv dependency needed)
const envPath = path.join(process.cwd(), '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')
const getEnv = (key: string): string => {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, 'm'))
  if (!m) throw new Error(`Missing ${key} in .env.local`)
  return m[1].trim()
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const host = new URL(SUPABASE_URL).hostname

// Seed exactly what the app's own auto-seed would insert. This deliberately no
// longer reads data/indian-foods.json directly: the raw file still contains the
// ~60 names that duplicate a measured IFCT entry, and `CURATED_FOODS` is the
// filtered view that drops them. Reading the JSON straight would put both rows
// in the table and let an estimate shadow a measurement.
const loadFoods = (): FoodSeed[] => [...INDIAN_FOODS, ...CURATED_FOODS]

function post(body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host,
      path: '/rest/v1/foods',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
    }
    const req = https.request(opts, (res) => {
      let b = ''
      res.on('data', (c) => (b += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function seed() {
  const BATCH = 50
  let inserted = 0
  let skipped = 0
  const foods = loadFoods()
  const sourceLabel = `lib/indian-foods-data.ts (${INDIAN_FOODS.length}) + lib/curated-foods-data.ts (${CURATED_FOODS.length})`

  console.log(`Seeding ${foods.length} Indian foods in batches of ${BATCH}...`)
  console.log(`Source: ${sourceLabel}`)

  for (let i = 0; i < foods.length; i += BATCH) {
    const batch = foods.slice(i, i + BATCH)
    const { status, body } = await post(JSON.stringify(batch))

    if (status === 201 || status === 200) {
      inserted += batch.length
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ✓ ${batch.length} rows`)
    } else if (status === 409) {
      skipped += batch.length
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: skipped (already exist)`)
    } else {
      console.error(`  Batch ${Math.floor(i / BATCH) + 1}: FAILED status=${status} body=${body}`)
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`)
}

seed().catch((e) => { console.error(e); process.exit(1) })
