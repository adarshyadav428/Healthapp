import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { INDIAN_FOODS } from '../../../../lib/indian-foods-data'

export const runtime = 'nodejs'

// Simple secret check so this endpoint can't be triggered by random visitors.
// Set SEED_SECRET in your environment, then call:
//   POST /api/admin/seed-indian-foods   { "secret": "<SEED_SECRET>" }
// Or if SEED_SECRET is not set, the endpoint is disabled entirely.
export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SEED_SECRET env var not set — endpoint disabled' }, { status: 403 })
  }

  let body: { secret?: string }
  try {
    body = (await req.json()) as { secret?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.secret?.trim() !== secret.trim()) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Upsert in batches of 50 to avoid hitting Supabase's row limit per request
  const BATCH_SIZE = 50
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < INDIAN_FOODS.length; i += BATCH_SIZE) {
    const batch = INDIAN_FOODS.slice(i, i + BATCH_SIZE)
    const { error, count } = await admin
      .from('foods')
      .upsert(batch, { onConflict: 'source,source_id', ignoreDuplicates: true, count: 'exact' })

    if (error) {
      return NextResponse.json(
        { error: `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`, inserted, skipped },
        { status: 500 },
      )
    }

    inserted += count ?? 0
    skipped += batch.length - (count ?? 0)
  }

  return NextResponse.json({
    ok: true,
    total: INDIAN_FOODS.length,
    inserted,
    skipped,
    message: `Seeded ${inserted} new Indian foods (${skipped} already existed).`,
  })
}
