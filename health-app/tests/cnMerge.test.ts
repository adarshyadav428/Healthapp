import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cn } from '../lib/utils'

/**
 * `cn()` is tailwind-merge, and tailwind-merge drops what it thinks is a
 * conflict. A custom font-size it does not recognise is classified as a text
 * *colour*, so `cn('text-title-sm', 'text-ink')` returned just `text-ink` and
 * the DialogTitle rendered at the browser's 16px with nothing failing
 * (2026-09-11). Every custom scale name in tailwind.config.ts that shares a
 * prefix with a default group (`text-`, `rounded-`, `shadow-`, `tracking-`)
 * must be registered in lib/utils.ts. This walks the config so adding a step
 * there without registering it fails here, not on a phone.
 */

const config = readFileSync(join(__dirname, '..', 'tailwind.config.ts'), 'utf8')

function keysOf(block: string): string[] {
  const start = config.indexOf(`${block}: {`)
  if (start === -1) throw new Error(`no ${block} block in tailwind.config.ts`)
  const body = config.slice(start, config.indexOf('\n      },', start))
  return [...body.matchAll(/^\s+'?([\w-]+)'?:\s+\[/gm)].map((m) => m[1])
}

describe('cn() keeps custom scale names', () => {
  it('a custom text size survives a text colour beside it', () => {
    expect(cn('text-title-sm text-ink')).toBe('text-title-sm text-ink')
    expect(cn('text-caption text-ink-2')).toBe('text-caption text-ink-2')
  })

  it('a later custom size still overrides an earlier default one', () => {
    expect(cn('text-sm', 'text-body')).toBe('text-body')
    expect(cn('rounded-lg', 'rounded-card')).toBe('rounded-card')
    expect(cn('shadow-rest', 'shadow-air')).toBe('shadow-air')
    expect(cn('tracking-tight', 'tracking-caps')).toBe('tracking-caps')
  })

  it('every fontSize step in tailwind.config.ts is registered', () => {
    const steps = keysOf('fontSize')
    expect(steps.length).toBeGreaterThanOrEqual(10)
    for (const step of steps) {
      expect(cn(`text-${step} text-ink`), step).toBe(`text-${step} text-ink`)
    }
  })

  it('every borderRadius step in tailwind.config.ts is registered', () => {
    const start = config.indexOf('borderRadius: {')
    const body = config.slice(start, config.indexOf('\n      },', start))
    const steps = [...body.matchAll(/^\s+'?([\w-]+)'?:\s+'/gm)].map((m) => m[1])
    expect(steps).toContain('card-lg')
    for (const step of steps) {
      expect(cn(`rounded-lg rounded-${step}`), step).toBe(`rounded-${step}`)
    }
  })
})
