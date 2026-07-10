'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, MonitorSmartphone } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Compact header toggle — one tap flips light ↔ dark (overriding system).
 * Mounted-gated: next-themes resolves the real theme only on the client,
 * so rendering the icon during SSR would guarantee a hydration mismatch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <button
      type="button"
      aria-label={mounted && resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'flex h-[38px] w-[38px] items-center justify-center rounded-full bg-surface text-ink-2 shadow-rest tap-scale',
        className
      )}
    >
      {/* Placeholder box pre-mount keeps layout stable without guessing the theme */}
      {mounted
        ? resolvedTheme === 'dark'
          ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
          : <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        : <span className="h-[18px] w-[18px]" />}
    </button>
  )
}

const MODES = [
  { value: 'light',  label: 'Light',  icon: Sun },
  { value: 'dark',   label: 'Dark',   icon: Moon },
  { value: 'system', label: 'System', icon: MonitorSmartphone },
] as const

/** Full three-way control for the Settings Appearance section. */
export function ThemeSegmented() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="grid grid-cols-3 gap-2">
      {MODES.map((m) => {
        const active = mounted && theme === m.value
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => setTheme(m.value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-control border py-3 text-xs font-semibold transition-all tap-scale',
              active
                ? 'border-brand bg-brand-soft text-brand-ink'
                : 'border-hairline bg-surface-2 text-ink-2 hover:border-brand-ring'
            )}
          >
            <m.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
