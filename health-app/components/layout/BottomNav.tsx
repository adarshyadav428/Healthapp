'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, TrendingUp, User, Plus } from 'lucide-react'

const TABS = [
  { href: '/dashboard', icon: Home,        label: 'Home'     },
  { href: '/log',       icon: Utensils,    label: 'Food'     },
  { href: '/progress',  icon: TrendingUp,  label: 'Progress' },
  { href: '/settings',  icon: User,        label: 'Profile'  },
]

function NavTab({ href, icon: Icon, label, active }: {
  href: string
  icon: typeof Home
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex w-14 flex-col items-center gap-[3px] py-1 tap-scale ${active ? 'text-brand-ink' : 'text-ink-3'}`}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 1.8} />
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-[18px] left-1/2 z-40 w-[calc(100%-40px)] max-w-[428px] -translate-x-1/2">
      <div className="relative flex items-center justify-around rounded-sheet border border-hairline bg-header-bg px-2 py-2 shadow-float backdrop-blur-md">
        {TABS.slice(0, 2).map((tab) => (
          <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
        ))}

        {/* Spacer for FAB */}
        <div className="w-[54px]" />

        {TABS.slice(2).map((tab) => (
          <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
        ))}

        {/* Floating + FAB */}
        <Link
          href="/log"
          aria-label="Log food"
          className="absolute bottom-[18px] left-1/2 flex h-[54px] w-[54px] -translate-x-1/2 items-center justify-center rounded-card border-[3px] border-canvas bg-brand shadow-float tap-scale"
        >
          <Plus className="h-[22px] w-[22px] text-white" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  )
}
