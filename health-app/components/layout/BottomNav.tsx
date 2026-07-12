'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Home, Utensils, TrendingUp, User, Camera } from 'lucide-react'
import type { Food } from '../../types/index'

const CameraModal  = dynamic(() => import('../camera/CameraModal').then(m => m.CameraModal),   { ssr: false })
const AddFoodModal = dynamic(() => import('../log/AddFoodModal').then(m => m.AddFoodModal),     { ssr: false })

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
  const [showCamera, setShowCamera] = useState(false)
  const [foundFood, setFoundFood]   = useState<Food | null>(null)

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

        {/* Floating camera FAB */}
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          aria-label="Scan food with camera"
          className="absolute bottom-4 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-[17px] bg-cta-grad tap-scale"
          style={{ boxShadow: '0 0 0 3px var(--canvas), var(--fab-shadow)' }}
        >
          <Camera className="h-[22px] w-[22px] text-white" strokeWidth={2.2} />
        </button>
      </div>

      {showCamera && (
        <CameraModal
          onClose={() => setShowCamera(false)}
          onFoodFound={(food) => { setShowCamera(false); setFoundFood(food) }}
        />
      )}
      {foundFood && (
        <AddFoodModal food={foundFood} onClose={() => setFoundFood(null)} />
      )}
    </div>
  )
}
