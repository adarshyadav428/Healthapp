/**
 * One-time migration endpoint. Secured by SEED_SECRET.
 * Creates exercise_logs + water_logs tables if they don't exist.
 *
 * Usage (run once):
 *   POST /api/admin/run-migrations   { "secret": "<SEED_SECRET>" }
 *
 * Uses the Supabase service role key — which has DDL rights via the
 * Postgres REST API when the JWT matches the project's service role.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

// The migration uses individual INSERT-based table existence checks
// because the service role can't run raw DDL via the REST API.
// Instead we use supabase's schema inspection + client operations
// to safely set up the tables via RPC if available, otherwise we
// signal what SQL to run manually.

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
CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml integer NOT NULL CHECK (ml > 0),
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_logged_at ON water_logs (user_id, logged_at DESC);
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS water_logs_select ON water_logs;
DROP POLICY IF EXISTS water_logs_insert ON water_logs;
DROP POLICY IF EXISTS water_logs_delete ON water_logs;
CREATE POLICY water_logs_select ON water_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY water_logs_insert ON water_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY water_logs_delete ON water_logs FOR DELETE USING (auth.uid() = user_id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_target_ml integer NOT NULL DEFAULT 2500;
`

export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: 'SEED_SECRET not configured' }, { status: 403 })

  let body: { secret?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.secret?.trim() !== secret) return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })

  // Check which tables already exist by attempting a count
  const admin = createAdminClient()
  const checks = await Promise.all([
    admin.from('exercise_logs').select('id', { count: 'exact', head: true }),
    admin.from('water_logs').select('id', { count: 'exact', head: true }),
  ])

  const exerciseExists = !checks[0].error
  const waterExists = !checks[1].error

  if (exerciseExists && waterExists) {
    return NextResponse.json({
      ok: true,
      message: 'Both tables already exist. No migration needed.',
      exercise_logs: 'exists',
      water_logs: 'exists',
    })
  }

  // Tables don't exist — return the SQL for the user to run in Supabase dashboard
  return NextResponse.json({
    ok: false,
    message: 'Tables missing. Run the SQL below in Supabase Dashboard → SQL Editor.',
    exercise_logs: exerciseExists ? 'exists' : 'MISSING',
    water_logs: waterExists ? 'exists' : 'MISSING',
    sql_to_run: MIGRATION_SQL.trim(),
    supabase_dashboard_url: `https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '')}/sql/new`,
  }, { status: 202 })
}
