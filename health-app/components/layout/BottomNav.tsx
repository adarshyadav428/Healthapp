'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, TrendingUp, User, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-0.5 w-14 py-1 transition-colors active:scale-95',
        active ? 'text-[#EA580C]' : 'text-[#9CA3AF]'
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
      <span className="text-[10px] font-semibold">{label}</span>
      {active && <div className="h-0.5 w-4 rounded-full bg-[#EA580C]" />}
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white safe-area-bottom"
      style={{ borderTop: '1px solid #F0F0F0' }}
    >
      <div className="relative flex items-center justify-around h-16 max-w-md mx-auto px-4">
        <NavItem href="/dashboard" icon={Home}       label="Home"     active={pathname === '/dashboard'} />
        <NavItem href="/log"       icon={Utensils}   label="Food"     active={pathname === '/log'} />

        {/* Spacer for floating button */}
        <div className="w-14" />

        <NavItem href="/progress"  icon={TrendingUp} label="Progress" active={pathname === '/progress'} />
        <NavItem href="/settings"  icon={User}       label="Profile"  active={pathname === '/settings'} />
      </div>

      {/* Floating center + button */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[18px]">
        <Link
          href="/log"
          aria-label="Log food"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EA580C] transition-transform active:scale-95"
          style={{ boxShadow: '0 4px 16px rgba(234,88,12,0.35)' }}
        >
          <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  )
}
