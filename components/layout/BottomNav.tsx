'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plus, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  const homeActive     = pathname === '/dashboard'
  const progressActive = pathname === '/progress'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-5 px-4 safe-area-bottom pointer-events-none">
      <nav className="pointer-events-auto flex items-center rounded-[28px] bg-white/95 dark:bg-slate-900/95 border border-slate-100 dark:border-slate-800 px-4 py-3 shadow-2xl shadow-black/[0.08] dark:shadow-black/50 backdrop-blur-xl gap-2">

        {/* Home */}
        <Link
          href="/dashboard"
          className={cn(
            'flex flex-col items-center gap-1 w-[72px] py-1.5 rounded-2xl transition-all duration-200 active:scale-90',
            homeActive
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          )}
        >
          <Home
            className={cn('h-[22px] w-[22px]', homeActive && 'fill-indigo-100 dark:fill-indigo-950/60')}
            strokeWidth={homeActive ? 2.5 : 2}
          />
          <span className="text-[10px] font-bold">Home</span>
        </Link>

        {/* Log FAB — centre */}
        <Link
          href="/log"
          aria-label="Log food"
          className={cn(
            'mx-3 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-90',
            pathname === '/log'
              ? 'bg-indigo-700 shadow-indigo-600/40'
              : 'bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-700'
          )}
        >
          <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
        </Link>

        {/* Progress */}
        <Link
          href="/progress"
          className={cn(
            'flex flex-col items-center gap-1 w-[72px] py-1.5 rounded-2xl transition-all duration-200 active:scale-90',
            progressActive
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          )}
        >
          <TrendingUp
            className={cn('h-[22px] w-[22px]', progressActive && 'text-indigo-600 dark:text-indigo-400')}
            strokeWidth={progressActive ? 2.5 : 2}
          />
          <span className="text-[10px] font-bold">Progress</span>
        </Link>
      </nav>
    </div>
  )
}
