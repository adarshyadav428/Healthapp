'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plus, Scale, BarChart2, Settings } from 'lucide-react'
import { cn } from '../../lib/utils'

const items = [
  { href: '/dashboard', label: 'Home',    icon: Home },
  { href: '/weight',    label: 'Weight',  icon: Scale },
  { href: '/log',       label: 'Log',     icon: Plus, highlight: true },
  { href: '/history',   label: 'History', icon: BarChart2 },
  { href: '/settings',  label: 'Profile', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    /* Floating island wrapper — sits above the viewport bottom edge */
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center safe-area-bottom pb-4 px-4 pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-0.5 rounded-[26px] bg-white/95 dark:bg-slate-900/95 border border-gray-100/80 dark:border-slate-800/80 px-2 py-2 shadow-2xl shadow-black/10 dark:shadow-black/50 backdrop-blur-xl">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon   = item.icon

          /* ── Highlighted Log button ── */
          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 mx-1"
              >
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-[18px] transition-all duration-200 active:scale-90',
                    active
                      ? 'bg-orange-700 shadow-lg shadow-orange-500/40'
                      : 'bg-orange-500 shadow-lg shadow-orange-500/35 hover:bg-orange-600'
                  )}
                >
                  <Icon className="h-[22px] w-[22px] text-white" />
                </span>
                <span className="text-[9px] font-bold text-orange-500 dark:text-orange-400">
                  {item.label}
                </span>
              </Link>
            )
          }

          /* ── Regular tab ── */
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 w-[58px] py-2.5 rounded-[18px] transition-all duration-200 active:scale-90',
                active
                  ? 'bg-orange-50 dark:bg-orange-950/40'
                  : 'hover:bg-gray-50/80 dark:hover:bg-slate-800/60'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  active
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-400 dark:text-slate-500'
                )}
              />
              <span
                className={cn(
                  'text-[9px] font-bold transition-colors',
                  active
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-400 dark:text-slate-500'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
