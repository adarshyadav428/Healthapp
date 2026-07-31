/**
 * The data-plane test class.
 *
 * The 2026-07-31 audit's P0-1 was a policy bug: `foods` allowed UPDATE and
 * DELETE to anyone signed in, and four tables cascade off it, so one crafted
 * PostgREST request wiped a food from every user's diary. Ownership lived only
 * in JavaScript. Every one of the 610 tests passed while that hole was open,
 * because none of them looked at the data plane. This file looks at the data
 * plane.
 *
 * WHAT THIS PROVES
 *   The policies we wrote are shaped correctly: no write path is gated on mere
 *   authentication, every policy ties the row to the caller, and the tables the
 *   app updates have an UPDATE policy to update through.
 *
 * WHAT THIS DOES NOT PROVE
 *   1. That Postgres enforces them the way we read them. The SQL is analysed,
 *      not executed.
 *   2. That the live database matches these files. A policy edited by hand in
 *      the Supabase dashboard, or a migration never applied, is invisible here.
 *      Both 034 and 035 are unapplied as of 2026-07-31 — this suite passing
 *      says nothing about production until they are run.
 *
 * Closing those two gaps needs a real Postgres: `supabase start` (Docker),
 * apply the migrations, create two users, and assert from B's JWT that every
 * write against A's rows returns 42501. That is the stronger test and it should
 * exist, but it cannot run on a machine without Docker and it cannot run in CI
 * without a service container — so it must not be the *only* test. This one
 * runs everywhere, in milliseconds, and catches the specific defect that
 * shipped.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPolicyState,
  enforcedExpressions,
  isAuthenticatedOnlyExpression,
  parseCreatePolicy,
  policiesFor,
  referencesCallerIdentity,
  splitStatements,
  stripLineComments,
  type MigrationFile,
  type PolicyCommand,
} from '../lib/rlsPolicies'

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

/**
 * Ownership helpers a policy may delegate its auth.uid() check to.
 * Each one is separately asserted to reference auth.uid() itself below.
 */
const OWNERSHIP_HELPERS = ['owns_custom_food'] as const

/**
 * The only tables whose SELECT policy may be a bare "are you signed in".
 *
 * `foods` is the shared catalogue: search reads IFCT, curated and Open Food
 * Facts rows across all users by design, and CLAUDE.md's food-search pipeline
 * depends on it. Reading it leaks nothing personal — the per-user AI `estimate`
 * rows are filtered in the route, not by RLS.
 *
 * This list must never grow to include a table with a user_id column.
 */
const SHARED_READ_TABLES = new Set(['foods'])

const WRITE_COMMANDS: Exclude<PolicyCommand, 'all' | 'select'>[] = [
  'insert',
  'update',
  'delete',
]

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // filename order — numbering has duplicates, so this is the real order
    .map((filename) => ({
      filename,
      sql: readFileSync(join(MIGRATIONS_DIR, filename), 'utf8'),
    }))
}

const migrations = loadMigrations()
const state = buildPolicyState(migrations)
const allSql = migrations.map((m) => stripLineComments(m.sql)).join('\n')

/** Tables that end up with RLS switched on and were never dropped. */
function tablesWithRlsEnabled(): Set<string> {
  const tables = new Set<string>()
  const re =
    /alter\s+table\s+(?:if\s+exists\s+)?("?[a-z_][a-z0-9_$.]*"?)\s+enable\s+row\s+level\s+security/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(allSql))) {
    const name = match[1].replace(/"/g, '').toLowerCase()
    const dot = name.lastIndexOf('.')
    tables.add(dot === -1 ? name : name.slice(dot + 1))
  }
  for (const dropped of state.droppedTables) tables.delete(dropped)
  return tables
}

describe('RLS policy parser', () => {
  it('strips line comments without eating dollar-quoted function bodies', () => {
    const sql = `
      -- STRIPPED
      CREATE FUNCTION f() RETURNS boolean AS $$
        SELECT source_id LIKE 'user_%' -- KEPT: inside a body, not a comment we may drop
      $$ LANGUAGE sql;
    `
    const stripped = stripLineComments(sql)
    expect(stripped).not.toContain('STRIPPED')
    expect(stripped).toContain('KEPT')
    expect(stripped).toContain("LIKE 'user_%'")
  })

  it('does not split statements on a semicolon inside a function body', () => {
    const sql = `
      CREATE FUNCTION f() RETURNS boolean AS $$
        SELECT true;
      $$ LANGUAGE sql;
      CREATE POLICY p ON t FOR SELECT USING (auth.uid() = user_id);
    `
    expect(splitStatements(sql)).toHaveLength(2)
  })

  it('reads a policy with no FOR clause as governing every command', () => {
    const policy = parseCreatePolicy(
      'CREATE POLICY "Users manage own favourites" ON food_favourites ' +
        'USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      'test.sql'
    )
    expect(policy?.command).toBe('all')
    expect(policy?.name).toBe('Users manage own favourites')
  })

  it('does not mistake a subquery SELECT for a FOR SELECT clause', () => {
    const policy = parseCreatePolicy(
      'CREATE POLICY "Users update own meal items" ON saved_meal_items FOR UPDATE ' +
        'USING (EXISTS (SELECT 1 FROM saved_meals WHERE id = saved_meal_items.meal_id ' +
        'AND user_id = auth.uid()))',
      'test.sql'
    )
    expect(policy?.command).toBe('update')
    expect(policy?.using).toContain('EXISTS')
    expect(policy?.using).toContain('auth.uid()')
  })

  it('refuses a policy with neither USING nor WITH CHECK', () => {
    expect(() =>
      parseCreatePolicy('CREATE POLICY p ON t FOR DELETE', 'test.sql')
    ).toThrow(/unrestricted/i)
  })

  it('lets a later migration replace an earlier policy of the same name', () => {
    const built = buildPolicyState([
      { filename: '001.sql', sql: 'CREATE POLICY p ON t FOR DELETE USING (auth.uid() IS NOT NULL);' },
      { filename: '002.sql', sql: 'DROP POLICY IF EXISTS p ON t; CREATE POLICY p ON t FOR DELETE USING (auth.uid() = user_id);' },
    ])
    expect(built.policies.get('t')?.get('p')?.using).toBe('auth.uid() = user_id')
  })

  it('drops a table’s policies when the table is dropped', () => {
    const built = buildPolicyState([
      { filename: '001.sql', sql: 'CREATE POLICY p ON water_logs FOR SELECT USING (auth.uid() = user_id);' },
      { filename: '019.sql', sql: 'DROP TABLE IF EXISTS water_logs;' },
    ])
    expect(built.policies.has('water_logs')).toBe(false)
    expect(built.droppedTables.has('water_logs')).toBe(true)
  })

  /**
   * The detector, aimed at the exact SQL that shipped. If this ever stops
   * flagging these four lines, the suite has gone blind to P0-1.
   */
  it('flags the pre-034 foods policies as authenticated-only', () => {
    const shipped = buildPolicyState([
      {
        filename: '001_initial.sql',
        sql: `
          CREATE POLICY foods_select ON foods FOR SELECT USING (auth.uid() IS NOT NULL);
          CREATE POLICY foods_insert ON foods FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
          CREATE POLICY foods_update ON foods FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
          CREATE POLICY foods_delete ON foods FOR DELETE USING (auth.uid() IS NOT NULL);
        `,
      },
    ])

    const offenders = WRITE_COMMANDS.flatMap((command) =>
      policiesFor(shipped, 'foods', command)
        .filter((p) =>
          enforcedExpressions(p, command).some(isAuthenticatedOnlyExpression)
        )
        .map((p) => `${p.name}/${command}`)
    )

    expect(offenders.sort()).toEqual([
      'foods_delete/delete',
      'foods_insert/insert',
      'foods_update/update',
    ])
  })

  it('treats USING (true) as authenticated-only', () => {
    expect(isAuthenticatedOnlyExpression('true')).toBe(true)
    expect(isAuthenticatedOnlyExpression('auth.uid() IS NOT NULL')).toBe(true)
    expect(isAuthenticatedOnlyExpression('auth.uid() = user_id')).toBe(false)
  })
})

describe('RLS invariants across every migration', () => {
  it('parses a policy set for every table that enables RLS', () => {
    const missing = [...tablesWithRlsEnabled()].filter(
      (t) => !state.policies.has(t) || state.policies.get(t)!.size === 0
    )
    // A table with RLS on and no policies denies everything, which fails closed
    // rather than open — but it is always a mistake, so it fails the suite too.
    expect(missing).toEqual([])
  })

  it('keeps no policies on tables dropped by migration 019', () => {
    for (const dropped of ['water_logs', 'sleep_logs', 'fasting_sessions', 'measurements_logs']) {
      expect(state.droppedTables.has(dropped)).toBe(true)
      expect(state.policies.has(dropped)).toBe(false)
    }
  })

  /**
   * P0-1, generalised. Being signed in is not permission to write a row.
   * There is no allowlist: after 034 no table needs one.
   */
  it('gates no write path on authentication alone', () => {
    const offenders: string[] = []
    for (const [table, byName] of state.policies) {
      for (const command of WRITE_COMMANDS) {
        for (const policy of byName.values()) {
          if (!policiesFor(state, table, command).includes(policy)) continue
          for (const expr of enforcedExpressions(policy, command)) {
            if (isAuthenticatedOnlyExpression(expr)) {
              offenders.push(`${table}.${policy.name} (${command.toUpperCase()}): ${expr}`)
            }
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('ties every policy expression to the calling user', () => {
    const offenders: string[] = []
    for (const [table, byName] of state.policies) {
      for (const policy of byName.values()) {
        for (const command of ['select', 'insert', 'update', 'delete'] as const) {
          if (!policiesFor(state, table, command).includes(policy)) continue
          for (const expr of enforcedExpressions(policy, command)) {
            if (referencesCallerIdentity(expr, OWNERSHIP_HELPERS)) continue
            // A shared catalogue may be read by any signed-in user.
            if (
              command === 'select' &&
              SHARED_READ_TABLES.has(table) &&
              isAuthenticatedOnlyExpression(expr)
            ) {
              continue
            }
            offenders.push(`${table}.${policy.name} (${command.toUpperCase()}): ${expr}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('opens SELECT to all signed-in users only on the shared catalogue', () => {
    const offenders: string[] = []
    for (const [table, byName] of state.policies) {
      if (SHARED_READ_TABLES.has(table)) continue
      for (const policy of byName.values()) {
        if (!policiesFor(state, table, 'select').includes(policy)) continue
        if (policy.using !== null && isAuthenticatedOnlyExpression(policy.using)) {
          offenders.push(`${table}.${policy.name}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  /** P0-1 regression pin, on the real migration set rather than a synthetic one. */
  it('scopes every foods write to a row the caller owns', () => {
    for (const command of WRITE_COMMANDS) {
      const policies = policiesFor(state, 'foods', command)
      expect(policies.length, `foods has no ${command.toUpperCase()} policy`).toBe(1)
      for (const expr of enforcedExpressions(policies[0], command)) {
        expect(expr, `foods ${command.toUpperCase()}`).toContain('owns_custom_food')
      }
    }
  })

  it('defines owns_custom_food against auth.uid() and the user source', () => {
    const body = /create\s+or\s+replace\s+function\s+public\.owns_custom_food[\s\S]*?\$\$([\s\S]*?)\$\$/i.exec(
      allSql
    )?.[1]
    expect(body, 'owns_custom_food is referenced by policies but never defined').toBeTruthy()
    expect(body).toContain('auth.uid()')
    expect(body).toContain("'user'")
  })

  /**
   * Under RLS, "no policy" means denied. Supabase's `.upsert()` without
   * `ignoreDuplicates` becomes `INSERT ... ON CONFLICT DO UPDATE`, so a
   * conflicting write needs UPDATE permission — this is the whole of P1-1,
   * where a browser re-registering its push endpoint hit a table with
   * select/insert/delete and no UPDATE policy, and failed silently.
   *
   * Each entry below is a write on a USER-SCOPED client (`createServerClient`).
   * Service-role writes bypass RLS and are deliberately absent — notably
   * `season_participants.completed_at`, which app/api/seasons/route.ts stamps
   * through `createAdminClient()` precisely because users must not be able to
   * assert their own completion.
   */
  it.each([
    ['profiles', 'app/api/profile/update, app/api/onboarding'],
    ['food_logs', 'app/api/logs/edit'],
    ['weight_logs', 'app/api/weight/add'],
    ['subscriptions', 'app/api/razorpay/cancel'],
    ['foods', 'app/api/foods/custom (own custom rows only)'],
    ['push_subscriptions', 'app/api/push/subscribe upsert on endpoint'],
  ])('gives %s an UPDATE policy for its user-scoped writer (%s)', (table) => {
    expect(policiesFor(state, table, 'update').length).toBeGreaterThan(0)
  })

  /**
   * The other side of that coin. `food_dismissals` deliberately has no UPDATE
   * policy — nothing in the row is worth rewriting — so its user-scoped upsert
   * must resolve to ON CONFLICT DO NOTHING rather than DO UPDATE. Dropping
   * `ignoreDuplicates` would make every second swipe of the same dish a 500.
   *
   * Asserted against the route source because the defect lives in the gap
   * between the route and the policy, which is precisely where nothing else
   * looks.
   */
  it('keeps the food_dismissals upsert on the DO NOTHING path', () => {
    expect(policiesFor(state, 'food_dismissals', 'update')).toEqual([])

    const route = readFileSync(
      join(__dirname, '..', 'app', 'api', 'foods', 'suggest', 'route.ts'),
      'utf8'
    )
    const upsert = /\.from\('food_dismissals'\)\s*\.upsert\(([\s\S]*?)\n\s*\)/.exec(route)?.[1]
    expect(upsert, 'the food_dismissals upsert moved or changed shape').toBeTruthy()
    expect(upsert).toContain('ignoreDuplicates: true')
  })
})
