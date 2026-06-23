'use client'

import { Flame, Bell } from 'lucide-react'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomeHeader({ displayName }: { displayName: string | null }) {
  const firstName = displayName?.split(' ')[0] ?? 'there'
  const initial = (displayName?.[0] ?? '?').toUpperCase()

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-[18px] py-3"
      style={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'rgba(250,250,247,.88)',
        borderBottom: '1px solid #F1EFE9',
      }}
    >
      {/* Left: logo + name */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center flex-shrink-0"
          style={{
            borderRadius: 11,
            background: '#FFF0E7',
            border: '1px solid #FBDCCB',
          }}
        >
          <Flame className="h-[18px] w-[18px]" style={{ color: '#FB7445' }} strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-[13px] font-bold leading-none text-ink">GetInShape</p>
          <p className="text-[12px] font-medium text-secondary mt-[2px]">
            {greeting()}, {firstName}
          </p>
        </div>
      </div>

      {/* Right: bell + avatar */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <button
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white tap-scale"
            style={{ border: '1px solid #ECEAE3' }}
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px] text-secondary" strokeWidth={1.8} />
          </button>
          <span
            className="absolute top-[7px] right-[7px] h-[6px] w-[6px] rounded-full bg-accent"
            style={{ border: '1.5px solid #fff' }}
          />
        </div>
        <div
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-white text-[14px] font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(150deg, #FB7445, #B5471A)',
            boxShadow: '0 4px 10px -4px #FB7445',
          }}
        >
          {initial}
        </div>
      </div>
    </header>
  )
}
