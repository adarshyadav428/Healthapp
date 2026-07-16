'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { FoodLog, Profile } from '../../types/index'
import { CalorieHeroCard } from '../home/CalorieHeroCard'
import { RecentMealCard } from '../home/RecentMealCard'
import { EmptyMeals } from '../home/EmptyMeals'
import { EditFoodLogModal } from '../log/EditFoodLogModal'
import { RatePromptCard } from './RatePromptCard'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { Flame, Plus, MessageCircle } from 'lucide-react'

const ChatLogModal = dynamic(() => import('../chat/ChatLogModal').then(m => m.ChatLogModal), { ssr: false })

interface Props {
  profile: Profile
  initialLogs: FoodLog[]
  streakDays: number
}

export function DashboardClient({ profile, initialLogs, streakDays }: Props) {
  const { user } = useUser()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)
  const [showChat, setShowChat] = useState(false)

  const totals = useMemo(
    () => logs.reduce(
      (acc, l) => {
        acc.kcal      += l.kcal
        acc.protein_g += l.protein_g
        acc.carbs_g   += l.carbs_g
        acc.fat_g     += l.fat_g
        return acc
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    ),
    [logs]
  )

  const target = profile.daily_calorie_target
  const hasLogs = logs.length > 0
  const recent = logs.slice(0, 3) // logs arrive newest-first
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[13px] font-medium text-ink-3">{todayDate}</p>
          <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">Today</h1>
        </div>
        {streakDays > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-surface px-[13px] py-[7px]" style={{ boxShadow: 'var(--shadow-air)' }}>
            <Flame className="h-[15px] w-[15px] text-brand" strokeWidth={2} />
            <span className="text-[13.5px] font-semibold tabular-nums text-ink">{streakDays}</span>
          </div>
        )}
      </div>

      {/* ── Calorie hero ── */}
      <div className="mt-4">
        <CalorieHeroCard
          eaten={Math.round(totals.kcal)}
          target={target}
          proteinEaten={totals.protein_g}
          carbsEaten={totals.carbs_g}
          fatEaten={totals.fat_g}
          proteinTarget={profile.protein_g_target ?? 0}
          carbsTarget={profile.carbs_g_target ?? 0}
          fatTarget={profile.fat_g_target ?? 0}
        />
      </div>

      {/* ── Recently logged ── */}
      <div className="mb-3 mt-6 flex items-baseline justify-between px-0.5">
        <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Recently logged</p>
        {hasLogs && (
          <Link href="/log" className="text-[13px] font-semibold text-brand-ink tap-scale">See all</Link>
        )}
      </div>

      {hasLogs ? (
        <div className="flex flex-col gap-2.5">
          {recent.map((log) => (
            <RecentMealCard key={log.id} log={log} onClick={() => setEditingLog(log)} />
          ))}
          <Link
            href="/log?search=1"
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[16px] border border-dashed border-brand-ring py-[13px] text-[13px] font-semibold text-brand-ink tap-scale"
          >
            <Plus className="h-4 w-4" /> Add food manually
          </Link>
        </div>
      ) : (
        <EmptyMeals />
      )}

      {/* Play Store rating ask — renders only inside the installed Play build */}
      <RatePromptCard streakDays={streakDays} />

      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
        />
      )}

      {/* Floating chat entry — describe a meal in free text instead of searching/scanning */}
      <button
        type="button"
        onClick={() => setShowChat(true)}
        aria-label="Log a meal by describing it"
        className="fixed right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-surface tap-scale"
        style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))', boxShadow: 'var(--shadow-float)' }}
      >
        <MessageCircle className="h-5 w-5 text-brand" strokeWidth={2} />
      </button>

      {showChat && <ChatLogModal onClose={() => setShowChat(false)} />}
    </>
  )
}
