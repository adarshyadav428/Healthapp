/**
 * A Supabase test double for route-handler tests.
 *
 * The 46 route handlers are where auth, entitlements and validation actually
 * live, and none of them had a test. The refactor-safety contract leans on them
 * explicitly. What matters about a route is the status code a *crafted* request
 * gets — not what the UI does with it, since the UI is not the boundary.
 *
 * This double covers the query shapes the routes actually use. It records every
 * call so a test can assert not just the response but the query that produced
 * it: that a free user's window really was clamped, that an export really was
 * not windowed, that a write really was scoped to the caller. Asserting only
 * the status code would let a route pass while reading the wrong rows.
 *
 * Deliberately not a Supabase reimplementation: it does not evaluate filters or
 * enforce RLS. Policy shape is tested in rlsPolicies.test.ts; this file tests
 * what the route asks for.
 */

export interface PostgrestError {
  message: string
  code?: string
}

export interface TableResult {
  data?: unknown
  count?: number | null
  error?: PostgrestError | null
}

/**
 * Per-table results. Either one result for every operation on that table, or a
 * map keyed by operation when a route both reads and writes the same table.
 *
 * An ARRAY supplies successive results for repeated calls of the same
 * operation, in the order the code issues them; the last entry repeats once the
 * list runs out. Needed wherever one function reads the same table twice for
 * different things — sendBudgetedPush reads push_sends both for "what went out
 * today" and for "the last few sends' opened_at", and a single shared result
 * cannot express one being empty while the other is not.
 */
export type OperationResult = TableResult | TableResult[]

export type TableConfig =
  | TableResult
  | Partial<Record<'select' | 'insert' | 'update' | 'upsert' | 'delete', OperationResult>>

export interface RecordedCall {
  table: string
  /** 'select' | 'insert' | 'update' | 'upsert' | 'delete' */
  operation: string
  /** Column list passed to .select(), when there was one. */
  columns: string | null
  /** The payload handed to insert/update/upsert. */
  payload: unknown
  /** Filters applied, in order: ['eq', 'user_id', 'u1'], ['gte', 'logged_at', '...'] */
  filters: [string, string, unknown][]
  /** True when .select() asked for a head-only count. */
  head: boolean
  /** This query's index among same-table, same-operation calls, in build order. */
  nth?: number
}

export interface MockOptions {
  /** The signed-in user, or null for an unauthenticated request. */
  user?: { id: string; email?: string | null } | null
  tables?: Record<string, TableConfig>
}

const EMPTY: TableResult = { data: null, count: null, error: null }

/**
 * The result for the `nth` call of `operation` against a table.
 *
 * `nth` is fixed when the query is BUILT, not when it is awaited: two queries
 * created inside one Promise.all are constructed in source order but may settle
 * in either, and a sequence keyed on settle order would be a coin flip.
 */
function resultFor(config: TableConfig | undefined, operation: string, nth: number): TableResult {
  if (!config) return EMPTY

  const isByOperation =
    'select' in config ||
    'insert' in config ||
    'update' in config ||
    'upsert' in config ||
    'delete' in config

  const value = isByOperation
    ? (config as Record<string, OperationResult | undefined>)[operation]
    : (config as TableResult)

  if (!value) return EMPTY
  if (Array.isArray(value)) {
    return value.length === 0 ? EMPTY : value[Math.min(nth, value.length - 1)]
  }
  return value
}

export function createSupabaseMock(options: MockOptions = {}) {
  const user = options.user === undefined ? { id: 'user-1', email: 'a@b.com' } : options.user
  const calls: RecordedCall[] = []
  /** How many times each table+operation pair has been built so far. */
  const sequence = new Map<string, number>()

  function builder(table: string, operation: string, payload: unknown) {
    const record: RecordedCall = {
      table,
      operation,
      columns: null,
      payload,
      filters: [],
      head: false,
    }
    calls.push(record)

    // Claim this query's position now, while construction order is still the
    // order the calling code wrote. Settle order is not guaranteed.
    const key = `${table}:${operation}`
    const nth = sequence.get(key) ?? 0
    sequence.set(key, nth + 1)
    record.nth = nth

    const settle = () => {
      const result = resultFor(options.tables?.[table], record.operation, nth)
      return {
        data: result.data ?? null,
        count: result.count ?? null,
        error: result.error ?? null,
      }
    }

    const chain: any = {
      select(columns?: string, opts?: { count?: string; head?: boolean }) {
        record.columns = columns ?? null
        record.head = opts?.head ?? false
        // .insert().select() is still an insert — don't relabel the operation.
        if (record.operation === 'select' || record.operation === 'unknown') {
          record.operation = 'select'
        }
        return chain
      },
      single: () => Promise.resolve(settle()),
      maybeSingle: () => Promise.resolve(settle()),
      order() {
        return chain
      },
      limit() {
        return chain
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(settle()).then(onFulfilled, onRejected)
      },
    }

    for (const filter of ['eq', 'neq', 'gte', 'gt', 'lte', 'lt', 'in', 'like', 'ilike', 'is']) {
      chain[filter] = (column: string, value: unknown) => {
        record.filters.push([filter, column, value])
        return chain
      }
    }

    return chain
  }

  const client: any = {
    from(table: string) {
      return {
        select: (columns?: string, opts?: { count?: string; head?: boolean }) =>
          builder(table, 'select', null).select(columns, opts),
        insert: (payload: unknown) => builder(table, 'insert', payload),
        update: (payload: unknown) => builder(table, 'update', payload),
        upsert: (payload: unknown, opts?: unknown) => builder(table, 'upsert', { payload, opts }),
        delete: () => builder(table, 'delete', null),
      }
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      getClaims: () =>
        Promise.resolve({
          data: user ? { claims: { sub: user.id, email: user.email ?? null } } : null,
          error: user ? null : { message: 'no session' },
        }),
    },
  }

  return {
    client,
    calls,
    /** Every recorded call against a table, in order. */
    callsTo: (table: string) => calls.filter((c) => c.table === table),
    /** The first call against a table, or undefined. */
    callTo: (table: string) => calls.find((c) => c.table === table),
  }
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>

/** An active Pro subscription row, as the entitlement reads expect it. */
export const PRO_SUB: TableResult = { data: { status: 'active' }, error: null }

/** No subscription row at all — the free tier's normal shape. */
export const NO_SUB: TableResult = { data: null, error: null }
