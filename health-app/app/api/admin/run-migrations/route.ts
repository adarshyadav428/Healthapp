/**
 * One-time bootstrap check for `exercise_logs`. Secured by SEED_SECRET.
 *
 * Usage:
 *   POST /api/admin/run-migrations   { "secret": "<SEED_SECRET>" }
 *
 * **This route does not apply migrations.** The service role cannot run raw DDL
 * through the REST API, so all it does is probe whether the table exists and, if
 * not, hand back SQL for a human to paste into the Supabase SQL editor. The real
 * migration set lives in `supabase/migrations/` and is applied by hand, in order.
 *
 * It used to also probe `water_logs` and return DDL that re-created it, plus
 * `profiles.water_target_ml`. `019_drop_deprecated_tables.sql` dropped that table
 * on purpose, and CLAUDE.md makes referencing the four dropped wellness tables a
 * hard-rule violation — so the documented "apply migrations" path was actively
 * instructing an operator to undo a deliberate migration, and reporting the table
 * as `MISSING` (which is correct, and exactly what it should stay). Removed by the
 * 2026-09-03 audit (P1-11).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL,
  duration_min numeric NOT NULL,
  calories numeric NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_logged_at ON exercise_logs (user_id, logged_at DESC);
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exercise_logs_select ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_insert ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_update ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_delete ON exercise_logs;
CREATE POLICY exercise_logs_select ON exercise_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY exercise_logs_insert ON exercise_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY exercise_logs_update ON exercise_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY exercise_logs_delete ON exercise_logs FOR DELETE USING (auth.uid() = user_id);
`

export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: 'SEED_SECRET not configured' }, { status: 403 })

  let body: { secret?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.secret?.trim() !== secret) return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('exercise_logs').select('id', { count: 'exact', head: true })

  if (!error) {
    return NextResponse.json({
      ok: true,
      message: 'exercise_logs already exists. Nothing to do.',
      exercise_logs: 'exists',
    })
  }

  return NextResponse.json({
    ok: false,
    message: 'exercise_logs is missing. Run the SQL below in Supabase Dashboard → SQL Editor.',
    exercise_logs: 'MISSING',
    sql_to_run: MIGRATION_SQL.trim(),
    supabase_dashboard_url: `https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '')}/sql/new`,
  }, { status: 202 })
}
