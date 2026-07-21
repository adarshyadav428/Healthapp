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

/** Most words a single multi-word term expands to, to keep the filter bounded. */
const MAX_WORDS_PER_TERM = 4

/**
 * One search term → one PostgREST condition.
 *
 * A multi-word term becomes an AND over its words rather than a single literal
 * pattern. `%bhutta corn%` required those words to sit adjacent in that exact
 * order inside the name, so "bhutta corn" matched nothing while "bhutta" matched
 * "Bhutta (Roasted Corn)", and "biryani chicken" found nothing that "chicken
 * biryani" found. Word order is not something a user should have to guess.
 *
 * The words are already sanitized, so the `and(...)` grouping introduced here is
 * ours alone — no delimiter can reach it from user input.
 */
function termToCondition(term: string): string {
  const words = term.split(' ').filter((w) => w.length > 1)
  // A term of nothing but single characters keeps its original literal form.
  if (words.length === 0) return `name.ilike.%${term}%`
  if (words.length === 1) return `name.ilike.%${words[0]}%`
  return `and(${words
    .slice(0, MAX_WORDS_PER_TERM)
    .map((w) => `name.ilike.%${w}%`)
    .join(',')})`
}

/**
 * OR-filter across up to `max` sanitized terms. Single-word terms match as a
 * substring; multi-word terms match every word anywhere in the name.
 */
export function buildNameIlikeOrFilter(terms: string[], max = 6): string {
  return terms
    .map(sanitizeFilterTerm)
    .filter((t) => t.length > 0)
    .slice(0, max)
    .map(termToCondition)
    .join(',')
}
