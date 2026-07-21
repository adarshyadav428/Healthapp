/**
 * A small TTL + LRU cache for the food-search route.
 *
 * Extracted from the route so the *degraded* path is testable. The search cache
 * is keyed by query alone and therefore shared across every user, which makes a
 * wrong entry unusually expensive: one user's timed-out Open Food Facts lookup
 * used to hide a food from everybody until the entry expired. Callers now pass
 * the TTL per write, so a result assembled while an upstream was down lives for
 * seconds instead of minutes.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { data: T; expires: number }>()

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expires <= Date.now()) {
      this.store.delete(key)
      return null
    }
    // Re-insert so Map iteration order tracks recency, making the eviction in
    // `set` least-recently-*used* rather than merely oldest-written.
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.data
  }

  set(key: string, data: T, ttlMs: number): void {
    this.store.delete(key)
    if (this.store.size >= this.maxEntries) {
      const lru = this.store.keys().next().value as string | undefined
      if (lru !== undefined) this.store.delete(lru)
    }
    this.store.set(key, { data, expires: Date.now() + ttlMs })
  }

  get size(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }
}
