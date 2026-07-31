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
 */
export type TableConfig =
  | TableResult
  | Partial<Record<'select' | 'insert' | 'update' | 'upsert' | 'delete', TableResult>>

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
}

export interface MockOptions {
  /** The signed-in user, or null for an unauthenticated request. */
  user?: { id: string; email?: string | null } | null
  tables?: Record<string, TableConfig>
}

function resultFor(config: TableConfig | undefined, operation: string): TableResult {
  if (!config) return { data: null, count: null, error: null }
  if (
    'select' in config ||
    'insert' in config ||
    'update' in config ||
    'upsert' in config ||
    'delete' in config
  ) {
    const byOp = config as Record<string, TableResult | undefined>
    return byOp[operation] ?? { data: null, count: null, error: null }
  }
  return config as TableResult
}

export function createSupabaseMock(options: MockOptions = {}) {
  const user = options.user === undefined ? { id: 'user-1', email: 'a@b.com' } : options.user
  const calls: RecordedCall[] = []

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

    const settle = () => {
      const result = resultFor(options.tables?.[table], record.operation)
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
