/**
 * Bounded, deadline-aware batching for the cron routes.
 *
 * Both crons were written as a plain `for` loop with an `await` per user — one
 * or more network round trips each, serially. That is fine at a hundred users
 * and fails silently at a few thousand: the function hits the platform timeout
 * partway through, the remaining users simply never get their push, and nothing
 * anywhere reports an error. A cron that quietly does 60% of its job is worse
 * than one that fails loudly.
 *
 * Two fixes, both here so the crons stay readable:
 *  - run a bounded number of users concurrently instead of one at a time
 *  - stop cleanly at a deadline and report what's left, so the caller can say
 *    so out loud and the next run can pick it up
 *
 * Pure except for the clock, which is injectable so tests aren't flaky.
 */

/**
 * Vercel's default function ceiling is 60s. Stopping at 50 leaves room to write
 * the response — a batch that overruns is killed mid-flight and reports nothing
 * at all, which is the exact failure this module exists to prevent.
 */
export const CRON_TIME_BUDGET_MS = 50_000

/**
 * Enough to hide network latency, low enough not to stampede Supabase, the push
 * service, or Gemini's rate limit from a single invocation.
 */
export const CRON_CONCURRENCY = 8

export type BatchOutcome = {
  processed: number
  /** Items never started because the deadline hit first. */
  remaining: number
  timedOut: boolean
  /** Workers that threw. One bad user must not abort everyone else's push. */
  failed: number
}

export async function processInBatches<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  opts: {
    concurrency?: number
    /** Absolute ms timestamp to stop starting new work at. */
    deadline?: number
    now?: () => number
  } = {}
): Promise<BatchOutcome> {
  const concurrency = Math.max(1, opts.concurrency ?? CRON_CONCURRENCY)
  const now = opts.now ?? Date.now
  const deadline = opts.deadline ?? now() + CRON_TIME_BUDGET_MS

  let cursor = 0
  let processed = 0
  let failed = 0
  let timedOut = false

  const runner = async () => {
    for (;;) {
      if (now() >= deadline) {
        timedOut = true
        return
      }
      const index = cursor++
      if (index >= items.length) return
      try {
        await worker(items[index])
        processed += 1
      } catch {
        // Swallowed on purpose: the loop's job is to reach every user, and one
        // user's failed push must not cost everybody after them theirs.
        failed += 1
        processed += 1
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner))

  return {
    processed,
    remaining: Math.max(0, items.length - processed),
    timedOut,
    failed,
  }
}
