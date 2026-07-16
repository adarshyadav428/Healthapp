import { describe, it, expect } from 'vitest'
import { csvEscape } from '../lib/csv'

describe('csvEscape', () => {
  it('passes plain values through', () => {
    expect(csvEscape('Aloo Paratha')).toBe('Aloo Paratha')
  })

  it('quotes values with commas, quotes and newlines (RFC 4180)', () => {
    expect(csvEscape('Rice, boiled')).toBe('"Rice, boiled"')
    expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""')
    expect(csvEscape('a\nb')).toBe('"a\nb"')
  })

  it('neutralizes spreadsheet formula injection', () => {
    expect(csvEscape('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`)
    expect(csvEscape('=1+2')).toBe("'=1+2")
    expect(csvEscape('+91 snack')).toBe("'+91 snack")
    expect(csvEscape('-2 sugar')).toBe("'-2 sugar")
    expect(csvEscape('@cmd')).toBe("'@cmd")
  })

  it('does not mangle names merely containing (not starting with) formula chars', () => {
    expect(csvEscape('Bread + Butter')).toBe('Bread + Butter')
  })
})
