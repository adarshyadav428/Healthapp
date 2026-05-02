'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Activity, Settings } from 'lucide-react'
import { cn } from '../../lib/utils'

const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/log', label: 'Log', icon: Search },
  { href: '/weight', label: 'Weight', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white px-4 py-3 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('flex flex-col items-center gap-1 text-xs', active ? 'text-blue-600' : 'text-gray-500')}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
