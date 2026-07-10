'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, TrendingUp, User, Plus } from 'lucide-react'

const TABS = [
  { href: '/dashboard', icon: Home,        label: 'Home'     },
  { href: '/log',       icon: Utensils,    label: 'Food'     },
  { href: '/progress',  icon: TrendingUp,  label: 'Trends'   },
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
      <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2 : 1.75} />
      <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-[18px] left-1/2 z-40 w-[calc(100%-40px)] max-w-[428px] -translate-x-1/2">
      <div
        className="relative flex items-center justify-around rounded-[26px] bg-header-bg px-2 py-2"
        style={{
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          boxShadow: '0 0 0 1px var(--glass-hair), var(--shadow-float)',
        }}
      >
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
          className="absolute bottom-4 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-[17px] bg-cta-grad tap-scale"
          style={{ boxShadow: '0 0 0 3px var(--canvas), var(--fab-shadow)' }}
        >
          <Plus className="h-[22px] w-[22px] text-white" strokeWidth={2.2} />
        </Link>
      </div>
    </div>
  )
}
