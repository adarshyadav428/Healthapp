'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plus, Scale, BarChart2, Settings } from 'lucide-react'
import { cn } from '../../lib/utils'

const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/log', label: 'Log', icon: Plus, highlight: true },
  { href: '/weight', label: 'Weight', icon: Scale },
  { href: '/history', label: 'History', icon: BarChart2 },
  { href: '/settings', label: 'Profile', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-orange-100/60 bg-[#fff7ed]/90 backdrop-blur-md px-1 py-2 safe-area-bottom">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5"
              >
                <span className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-2xl shadow-md transition-all active:scale-95',
                  active
                    ? 'bg-orange-700 shadow-orange-200'
                    : 'bg-orange-600 shadow-orange-200 hover:bg-orange-700'
                )}>
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <span className="text-[10px] font-semibold text-orange-600">{item.label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-2xl transition-all',
                active ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-orange-600')} />
              <span className={cn('text-[10px] font-semibold', active ? 'text-orange-600' : 'text-gray-400')}>
                {item.label}
              </span>
              {active && (
                <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-orange-500" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
