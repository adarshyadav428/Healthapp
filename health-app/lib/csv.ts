/**
 * Escape a value for a CSV cell.
 *
 * - Quotes values containing delimiters/quotes/newlines (RFC 4180).
 * - Neutralizes spreadsheet formula injection: food names come from external
 *   sources (Open Food Facts, AI output, user-created foods), so a name like
 *   `=HYPERLINK(...)` would execute when the export is opened in Excel/Sheets.
 *   Cells starting with = + - @ or a tab/CR are prefixed with a single quote,
 *   which spreadsheets render as plain text.
 */
export function csvEscape(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) {
    v = `'${v}`
  }
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}
