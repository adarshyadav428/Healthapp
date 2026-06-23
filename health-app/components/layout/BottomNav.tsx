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

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div
      className="fixed z-40"
      style={{
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 40px)',
        maxWidth: 428,
      }}
    >
      <div
        className="relative flex items-center justify-around px-2 py-2"
        style={{
          background: 'rgba(255,255,255,.9)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 24,
          border: '1px solid #EFEDE6',
          boxShadow: '0 10px 34px -12px rgba(20,24,29,.22)',
        }}
      >
        {TABS.slice(0, 2).map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-[3px] w-14 py-1 tap-scale"
              style={{ color: active ? '#B5471A' : '#A8A498' }}
            >
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className="text-[10px]"
                style={{ fontWeight: active ? 700 : 500 }}
              >
                {label}
              </span>
            </Link>
          )
        })}

        {/* Spacer for FAB */}
        <div className="w-[54px]" />

        {TABS.slice(2).map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-[3px] w-14 py-1 tap-scale"
              style={{ color: active ? '#B5471A' : '#A8A498' }}
            >
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className="text-[10px]"
                style={{ fontWeight: active ? 700 : 500 }}
              >
                {label}
              </span>
            </Link>
          )
        })}

        {/* Floating + FAB */}
        <Link
          href="/log"
          aria-label="Log food"
          className="absolute left-1/2 flex items-center justify-center tap-scale"
          style={{
            transform: 'translateX(-50%)',
            bottom: 18,
            width: 54,
            height: 54,
            borderRadius: 18,
            background: '#FB7445',
            border: '3px solid #fff',
            boxShadow: '0 8px 18px -6px #FB7445',
          }}
        >
          <Plus className="h-[22px] w-[22px] text-white" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  )
}
