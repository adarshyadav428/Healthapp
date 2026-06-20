'use client'

import type { DailyTotals, Profile } from '../../types/index'
import Link from 'next/link'
import { Lightbulb } from 'lucide-react'

type Insight = {
  emoji: string
  title: string
  body: string
  cta?: { label: string; href: string }
  color: string
  darkColor: string
  bg: string
  darkBg: string
  border: string
  darkBorder: string
}

function getInsight(totals: DailyTotals, profile: Profile): Insight {
  const { kcal, protein_g, carbs_g, fat_g } = totals
  const { daily_calorie_target: calorieTarget, protein_g_target: proteinTarget, carbs_g_target: carbsTarget, fat_g_target: fatTarget, goal } = profile

  if (kcal === 0) return {
    emoji: '🌅', title: 'Start your day right',
    body: 'Log your first meal to see personalized nutrition insights here.',
    cta: { label: 'Log food', href: '/log' },
    color: 'text-orange-700', darkColor: 'dark:text-amber-300',
    bg: 'bg-orange-50', darkBg: 'dark:bg-amber-950/30',
    border: 'border-orange-100', darkBorder: 'dark:border-amber-900/30',
  }

  const kcalPct = calorieTarget > 0 ? kcal / calorieTarget : 0
  const proteinPct = proteinTarget > 0 ? protein_g / proteinTarget : 0

  if (kcalPct > 1.1) return {
    emoji: '⚠️', title: 'Over your calorie goal',
    body: `You've eaten ${Math.round(kcal - calorieTarget)} kcal more than your target. A light dinner will help.`,
    color: 'text-rose-700', darkColor: 'dark:text-rose-300',
    bg: 'bg-rose-50', darkBg: 'dark:bg-rose-950/30',
    border: 'border-rose-100', darkBorder: 'dark:border-rose-900/30',
  }

  if (kcalPct < 0.3 && calorieTarget > 0) return {
    emoji: '🍽️', title: 'Time to eat!',
    body: `Only ${Math.round(kcal)} kcal so far — ${Math.round(calorieTarget - kcal)} kcal still to go.`,
    cta: { label: 'Log a meal', href: '/log' },
    color: 'text-amber-700', darkColor: 'dark:text-amber-300',
    bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/30',
    border: 'border-amber-100', darkBorder: 'dark:border-amber-900/30',
  }

  if (proteinPct < 0.5 && proteinTarget > 0) return {
    emoji: '💪', title: 'Protein needs a boost',
    body: `At ${Math.round(protein_g)}g of ${proteinTarget}g protein. Try paneer, dal, dahi, or eggs.`,
    cta: { label: 'Log protein', href: '/log' },
    color: 'text-blue-700', darkColor: 'dark:text-blue-300',
    bg: 'bg-blue-50', darkBg: 'dark:bg-blue-950/30',
    border: 'border-blue-100', darkBorder: 'dark:border-blue-900/30',
  }

  if (proteinPct >= 0.9) return {
    emoji: '🏆', title: 'Protein goal crushed!',
    body: `${Math.round(protein_g)}g protein today — great for muscle retention and satiety.`,
    color: 'text-emerald-700', darkColor: 'dark:text-emerald-300',
    bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/30',
    border: 'border-emerald-100', darkBorder: 'dark:border-emerald-900/30',
  }

  if (carbsTarget > 0 && carbs_g > carbsTarget * 1.2 && goal === 'lose') return {
    emoji: '🫓', title: 'High carb day',
    body: `${Math.round(carbs_g - carbsTarget)}g over carb target. Try protein or veggies for your next meal.`,
    color: 'text-amber-700', darkColor: 'dark:text-amber-300',
    bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/30',
    border: 'border-amber-100', darkBorder: 'dark:border-amber-900/30',
  }

  if (fatTarget > 0 && fat_g > fatTarget * 1.3) return {
    emoji: '🫒', title: 'Fat intake is high',
    body: `${Math.round(fat_g)}g fat (target: ${fatTarget}g). Try steaming or grilling instead of frying.`,
    color: 'text-rose-700', darkColor: 'dark:text-rose-300',
    bg: 'bg-rose-50', darkBg: 'dark:bg-rose-950/30',
    border: 'border-rose-100', darkBorder: 'dark:border-rose-900/30',
  }

  if (kcalPct >= 0.7 && kcalPct <= 0.95 && proteinPct >= 0.6) {
    const msgs = ["You're perfectly on track — keep it up!", 'Great macro balance today!', 'Solid nutrition day — finishing strong!']
    return {
      emoji: '✅', title: 'Looking great!',
      body: msgs[Math.floor(Date.now() / 86400000) % msgs.length],
      color: 'text-emerald-700', darkColor: 'dark:text-emerald-300',
      bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/30',
      border: 'border-emerald-100', darkBorder: 'dark:border-emerald-900/30',
    }
  }

  return {
    emoji: '📊', title: 'Stay consistent',
    body: `${Math.round(calorieTarget - kcal)} kcal remaining for the day.`,
    cta: { label: 'Log food', href: '/log' },
    color: 'text-orange-700', darkColor: 'dark:text-amber-300',
    bg: 'bg-orange-50', darkBg: 'dark:bg-amber-950/30',
    border: 'border-orange-100', darkBorder: 'dark:border-amber-900/30',
  }
}

export function DailyInsight({ totals, profile }: { totals: DailyTotals; profile: Profile }) {
  const insight = getInsight(totals, profile)

  return (
    <div className={`rounded-3xl border ${insight.border} ${insight.darkBorder} ${insight.bg} ${insight.darkBg} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white/60 dark:bg-white/10 text-lg">
          {insight.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Lightbulb className={`h-3.5 w-3.5 ${insight.color} ${insight.darkColor}`} />
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${insight.color} ${insight.darkColor}`}>Daily insight</p>
          </div>
          <p className={`text-sm font-bold ${insight.color} ${insight.darkColor}`}>{insight.title}</p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">{insight.body}</p>
          {insight.cta && (
            <Link href={insight.cta.href} className={`mt-2 inline-block text-xs font-bold ${insight.color} ${insight.darkColor} underline underline-offset-2`}>
              {insight.cta.label} →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
