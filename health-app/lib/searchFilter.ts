/**
 * Builds the PostgREST `.or()` filter used by /api/foods/search.
 *
 * PostgREST's or= syntax is comma/paren-delimited, so a raw user query
 * containing `,`, `(` or `)` (e.g. "rice, boiled") used to split the ilike
 * value mid-pattern — producing a malformed filter (500 error) and, in
 * principle, letting a crafted query inject extra filter conditions.
 * Those delimiter characters carry no meaning for a food-name match, so we
 * replace them with spaces before assembling the filter.
 */
export function sanitizeFilterTerm(term: string): string {
  return term.replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** `name.ilike.%…%` OR-filter across up to `max` sanitized terms. */
export function buildNameIlikeOrFilter(terms: string[], max = 6): string {
  return terms
    .map(sanitizeFilterTerm)
    .filter((t) => t.length > 0)
    .slice(0, max)
    .map((t) => `name.ilike.%${t}%`)
    .join(',')
}
