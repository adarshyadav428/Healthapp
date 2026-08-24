'use client'

import { useEffect, useState } from 'react'
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
  // "Progress" not "Trends": the tab is about whether *you* are moving, which
  // is the reason to open it. "Trends" describes the charts, not the answer.
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
      className={`flex w-[60px] flex-col items-center gap-[3px] tap-scale ${active ? 'text-brand-ink' : 'text-ink-3'}`}
    >
      <Icon className="h-[23px] w-[23px]" strokeWidth={active ? 2 : 1.75} />
      <span className={`text-micro ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const [showCamera, setShowCamera] = useState(false)
  const [foundFood, setFoundFood]   = useState<Food | null>(null)

  // `?scan=1` opens the scanner on arrival, so a surface that ends in "go scan
  // something" (the Pro welcome, a Wrapped card, a push) can land the user in
  // the camera instead of on a screen where they still have to find the button.
  //
  // Read from window rather than useSearchParams deliberately: this component
  // renders on every authenticated page, and useSearchParams would opt all of
  // them into client rendering for a one-shot deep link. The param is stripped
  // immediately so a refresh — or a Back — doesn't reopen the camera.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('scan') !== '1') return
    setShowCamera(true)
    const url = new URL(window.location.href)
    url.searchParams.delete('scan')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [])

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-header-bg px-2 pt-2.5"
        style={{
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="relative mx-auto flex max-w-md items-center justify-around">
          {TABS.slice(0, 2).map((tab) => (
            <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
          ))}

          {/* Center camera FAB — ember gradient */}
          <div className="flex w-[60px] items-center justify-center">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              aria-label="Scan food with camera"
              className="-mt-6 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-cta-grad tap-scale"
              style={{ boxShadow: 'var(--fab-shadow)' }}
            >
              <Camera className="h-[23px] w-[23px] text-white" strokeWidth={2} />
            </button>
          </div>

          {TABS.slice(2).map((tab) => (
            <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
          ))}
        </div>
      </nav>

      {showCamera && (
        <CameraModal
          onClose={() => setShowCamera(false)}
          onFoodFound={(food) => { setShowCamera(false); setFoundFood(food) }}
        />
      )}
      {foundFood && (
        <AddFoodModal food={foundFood} onClose={() => setFoundFood(null)} />
      )}
    </>
  )
}
