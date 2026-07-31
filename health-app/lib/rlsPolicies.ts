/**
 * Row-Level Security policy analysis.
 *
 * WHY THIS EXISTS
 * ---------------
 * The 2026-07-31 audit found P0-1: `foods` had
 *
 *   CREATE POLICY foods_delete ON foods FOR DELETE USING (auth.uid() IS NOT NULL);
 *
 * "Are you logged in" is not an ownership check. Any signed-up account could
 * DELETE any catalogue row through PostgREST, and four tables cascade off
 * `foods`, so one request silently wiped that food from every user's diary.
 * Ownership was enforced only in JavaScript, so skipping the route skipped the
 * check. No amount of application-level testing could have caught it — the bug
 * was in the data plane, and the data plane had no tests at all.
 *
 * This module is the data-plane test. It reads the migrations, replays them in
 * order, reconstructs the policy set each table ends up with, and lets
 * tests/rlsPolicies.test.ts assert invariants over it. A new migration that
 * ships a permissive write policy now fails `npm test`.
 *
 * WHAT IT IS NOT
 * --------------
 * This is static analysis of migration SQL, not an integration test against a
 * live Postgres. It proves the policies we *wrote* are shaped correctly; it
 * cannot prove Postgres *enforces* them as intended, and it cannot prove the
 * live database matches these files (a policy edited by hand in the Supabase
 * dashboard is invisible here). Both of those need a real instance — see the
 * header of tests/rlsPolicies.test.ts for what that would take and what it adds.
 *
 * The parser is deliberately small and total: it understands the subset of DDL
 * these migrations actually use. Anything it cannot parse it reports rather
 * than skipping, because a silently-ignored CREATE POLICY is exactly the
 * failure mode this file exists to prevent.
 */

export type PolicyCommand = 'select' | 'insert' | 'update' | 'delete' | 'all'

export interface Policy {
  /** Policy name, unquoted. */
  name: string
  /** Table name, without any `public.` qualifier. */
  table: string
  /** The command it governs. A policy with no FOR clause governs ALL. */
  command: PolicyCommand
  /** The USING expression, parens stripped, or null when absent. */
  using: string | null
  /** The WITH CHECK expression, parens stripped, or null when absent. */
  withCheck: string | null
  /** Migration filename this policy's surviving definition came from. */
  source: string
}

/** Final state after replaying every migration in order. */
export interface PolicyState {
  /** table name → policy name → policy */
  policies: Map<string, Map<string, Policy>>
  /** Tables that were dropped; their policies are gone with them. */
  droppedTables: Set<string>
}

export interface MigrationFile {
  filename: string
  sql: string
}

/**
 * Strip `--` line comments. Dollar-quoted bodies (`$$ ... $$`) are preserved
 * verbatim — a function body is not a comment, and 034's ownership helper lives
 * in one.
 */
export function stripLineComments(sql: string): string {
  let out = ''
  let i = 0
  let inSingleQuote = false
  let dollarTag: string | null = null

  while (i < sql.length) {
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        out += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      out += sql[i++]
      continue
    }

    if (inSingleQuote) {
      out += sql[i]
      if (sql[i] === "'") inSingleQuote = false
      i++
      continue
    }

    const dollarMatch = /^\$[a-z_]*\$/i.exec(sql.slice(i))
    if (dollarMatch) {
      dollarTag = dollarMatch[0]
      out += dollarTag
      i += dollarTag.length
      continue
    }

    if (sql[i] === "'") {
      inSingleQuote = true
      out += sql[i++]
      continue
    }

    if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n') i++
      continue
    }

    out += sql[i++]
  }

  return out
}

/**
 * Split into statements on `;`, respecting string literals and dollar-quoted
 * bodies. Comments are stripped first.
 */
export function splitStatements(sql: string): string[] {
  const cleaned = stripLineComments(sql)
  const statements: string[] = []
  let current = ''
  let i = 0
  let inSingleQuote = false
  let dollarTag: string | null = null

  while (i < cleaned.length) {
    if (dollarTag) {
      if (cleaned.startsWith(dollarTag, i)) {
        current += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      current += cleaned[i++]
      continue
    }

    if (inSingleQuote) {
      current += cleaned[i]
      if (cleaned[i] === "'") inSingleQuote = false
      i++
      continue
    }

    const dollarMatch = /^\$[a-z_]*\$/i.exec(cleaned.slice(i))
    if (dollarMatch) {
      dollarTag = dollarMatch[0]
      current += dollarTag
      i += dollarTag.length
      continue
    }

    if (cleaned[i] === "'") {
      inSingleQuote = true
      current += cleaned[i++]
      continue
    }

    if (cleaned[i] === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
      i++
      continue
    }

    current += cleaned[i++]
  }

  if (current.trim()) statements.push(current.trim())
  return statements
}

/** Drop surrounding double quotes from an identifier. */
function unquoteIdentifier(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  return trimmed.toLowerCase()
}

/** Drop a `public.` (or any) schema qualifier and normalise case. */
function normaliseTable(raw: string): string {
  const name = unquoteIdentifier(raw)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(dot + 1)
}

/**
 * Read a balanced parenthesised group starting at the `(` at or after `from`.
 * Returns the inner text with the outer parens removed, plus the index just
 * past the closing paren. Needed because policy expressions nest — the
 * saved_meal_items policies wrap an entire `EXISTS (SELECT ...)` subquery.
 */
function readBalancedParens(
  text: string,
  from: number
): { inner: string; end: number } | null {
  let i = from
  while (i < text.length && /\s/.test(text[i])) i++
  if (text[i] !== '(') return null

  let depth = 0
  const start = i
  let inSingleQuote = false

  for (; i < text.length; i++) {
    const ch = text[i]
    if (inSingleQuote) {
      if (ch === "'") inSingleQuote = false
      continue
    }
    if (ch === "'") {
      inSingleQuote = true
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) {
        return { inner: text.slice(start + 1, i).trim(), end: i + 1 }
      }
    }
  }
  return null
}

const CREATE_POLICY_RE =
  /^\s*create\s+policy\s+(?:if\s+not\s+exists\s+)?("[^"]+"|[a-z_][a-z0-9_$]*)\s+on\s+("?[a-z_][a-z0-9_$.]*"?)/i

const DROP_POLICY_RE =
  /^\s*drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|[a-z_][a-z0-9_$]*)\s+on\s+("?[a-z_][a-z0-9_$.]*"?)/i

const DROP_TABLE_RE =
  /^\s*drop\s+table\s+(?:if\s+exists\s+)?(.+?)(?:\s+cascade|\s+restrict)?\s*$/i

/**
 * Parse one CREATE POLICY statement. Returns null when the statement is not a
 * CREATE POLICY at all; throws when it is one but cannot be understood, so a
 * new syntax never slips past the invariants unnoticed.
 */
export function parseCreatePolicy(statement: string, source: string): Policy | null {
  const match = CREATE_POLICY_RE.exec(statement)
  if (!match) return null

  const name = unquoteIdentifier(match[1])
  const table = normaliseTable(match[2])
  const rest = statement.slice(match[0].length)

  // Locate USING / WITH CHECK first, so the FOR clause is only ever searched
  // for in the text before them. Policy expressions contain subqueries whose
  // own SELECT keyword would otherwise be mistaken for `FOR SELECT`.
  const usingMatch = /\busing\s*\(/i.exec(rest)
  const checkMatch = /\bwith\s+check\s*\(/i.exec(rest)

  const firstExprAt = Math.min(
    usingMatch ? usingMatch.index : Infinity,
    checkMatch ? checkMatch.index : Infinity
  )
  const head = firstExprAt === Infinity ? rest : rest.slice(0, firstExprAt)

  const forMatch = /\bfor\s+(select|insert|update|delete|all)\b/i.exec(head)
  const command = (forMatch ? forMatch[1].toLowerCase() : 'all') as PolicyCommand

  let using: string | null = null
  if (usingMatch) {
    const group = readBalancedParens(rest, usingMatch.index + usingMatch[0].length - 1)
    if (!group) {
      throw new Error(
        `Unbalanced USING expression in policy "${name}" on ${table} (${source})`
      )
    }
    using = group.inner
  }

  let withCheck: string | null = null
  if (checkMatch) {
    const group = readBalancedParens(rest, checkMatch.index + checkMatch[0].length - 1)
    if (!group) {
      throw new Error(
        `Unbalanced WITH CHECK expression in policy "${name}" on ${table} (${source})`
      )
    }
    withCheck = group.inner
  }

  if (!using && !withCheck) {
    throw new Error(
      `Policy "${name}" on ${table} (${source}) has neither USING nor WITH CHECK — ` +
        `that is an unrestricted policy.`
    )
  }

  return { name, table, command, using, withCheck, source }
}

/**
 * Replay migrations in the order given and return the surviving policy set.
 *
 * Callers must pass the files sorted by filename. Migration numbering has
 * duplicates (002/004/005/009 each appear twice, and there is no 021), so
 * filename sort — not a parsed number — is the only ordering that matches how
 * these are actually applied.
 */
export function buildPolicyState(migrations: MigrationFile[]): PolicyState {
  const policies = new Map<string, Map<string, Policy>>()
  const droppedTables = new Set<string>()

  for (const { filename, sql } of migrations) {
    for (const statement of splitStatements(sql)) {
      const dropTable = DROP_TABLE_RE.exec(statement)
      if (dropTable && /^\s*drop\s+table\b/i.test(statement)) {
        for (const raw of dropTable[1].split(',')) {
          const table = normaliseTable(raw)
          if (!table) continue
          droppedTables.add(table)
          policies.delete(table)
        }
        continue
      }

      const dropPolicy = DROP_POLICY_RE.exec(statement)
      if (dropPolicy) {
        const name = unquoteIdentifier(dropPolicy[1])
        const table = normaliseTable(dropPolicy[2])
        policies.get(table)?.delete(name)
        continue
      }

      const created = parseCreatePolicy(statement, filename)
      if (created) {
        // A table recreated after a drop is live again.
        droppedTables.delete(created.table)
        let forTable = policies.get(created.table)
        if (!forTable) {
          forTable = new Map()
          policies.set(created.table, forTable)
        }
        forTable.set(created.name, created)
      }
    }
  }

  return { policies, droppedTables }
}

/** Collapse whitespace and case so expressions can be compared by shape. */
export function normaliseExpression(expr: string): string {
  return expr.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Is this expression nothing more than "the caller is signed in"?
 *
 * This is the P0-1 detector. `auth.uid() IS NOT NULL` is a perfectly good
 * predicate for reading a shared catalogue and a catastrophic one for writing
 * to it, so the check is on the expression's shape and the decision about which
 * tables may use it lives in the test's allowlist.
 *
 * `true` counts too: it is the same statement with the pretence removed.
 */
export function isAuthenticatedOnlyExpression(expr: string | null): boolean {
  if (expr === null) return false
  const normalised = normaliseExpression(expr)
    .replace(/^\(+/, '')
    .replace(/\)+$/, '')
    .trim()

  return (
    normalised === 'true' ||
    normalised === 'auth.uid() is not null' ||
    normalised === 'auth.uid() is not null = true' ||
    normalised === 'not auth.uid() is null'
  )
}

/** Does this expression tie the row to the calling user in any way? */
export function referencesCallerIdentity(
  expr: string | null,
  ownershipHelpers: readonly string[]
): boolean {
  if (expr === null) return false
  const normalised = normaliseExpression(expr)
  if (normalised.includes('auth.uid()')) return true
  return ownershipHelpers.some((helper) => normalised.includes(`${helper}(`))
}

/** The commands a policy governs, expanding ALL. */
export function commandsCovered(policy: Policy): PolicyCommand[] {
  if (policy.command === 'all') return ['select', 'insert', 'update', 'delete']
  return [policy.command]
}

/** Every policy that governs the given command on the given table. */
export function policiesFor(
  state: PolicyState,
  table: string,
  command: Exclude<PolicyCommand, 'all'>
): Policy[] {
  const forTable = state.policies.get(table)
  if (!forTable) return []
  return [...forTable.values()].filter((p) => commandsCovered(p).includes(command))
}

/**
 * The expressions a policy actually enforces for a command.
 *
 * Postgres uses USING to decide which existing rows you may see or touch, and
 * WITH CHECK to vet the row you are writing. INSERT has no USING; the others
 * may have either or both. Only the ones that apply are returned, so an
 * invariant never passes by inspecting a clause Postgres ignores.
 */
export function enforcedExpressions(
  policy: Policy,
  command: Exclude<PolicyCommand, 'all'>
): string[] {
  const expressions: string[] = []
  if (command !== 'insert' && policy.using !== null) expressions.push(policy.using)
  if (command !== 'select' && command !== 'delete' && policy.withCheck !== null) {
    expressions.push(policy.withCheck)
  }
  return expressions
}
