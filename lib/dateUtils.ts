/**
 * Returns the UTC start and end ISO timestamps for a given calendar date.
 * Defaults to today if no date is provided.
 */
export function getUtcDayRange(date: Date = new Date()): { start: string; end: string } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  ).toISOString()
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
  ).toISOString()
  return { start, end }
}
