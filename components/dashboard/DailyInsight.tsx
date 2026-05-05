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
  bg: string
  border: string
}

function getInsight(totals: DailyTotals, profile: Profile): Insight {
  const { kcal, protein_g, carbs_g, fat_g } = totals
  const {
    daily_calorie_target: calorieTarget,
    protein_g_target: proteinTarget,
    carbs_g_target: carbsTarget,
    fat_g_target: fatTarget,
    goal,
  } = profile

  // Nothing logged yet
  if (kcal === 0) {
    return {
      emoji: '🌅',
      title: 'Start your day right',
      body: 'Log your first meal to see personalized nutrition insights here.',
      cta: { label: 'Log food', href: '/log' },
      color: 'text-orange-700',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
    }
  }

  const kcalPct = calorieTarget > 0 ? kcal / calorieTarget : 0
  const proteinPct = proteinTarget > 0 ? protein_g / proteinTarget : 0

  // Over calorie goal
  if (kcalPct > 1.1) {
    return {
      emoji: '⚠️',
      title: 'Over your calorie goal',
      body: `You've eaten ${Math.round(kcal - calorieTarget)} kcal more than your target. A light dinner will help balance the day.`,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
    }
  }

  // Very low calories (less than 40% of goal by afternoon/evening logic)
  if (kcalPct < 0.3 && calorieTarget > 0) {
    return {
      emoji: '🍽️',
      title: 'Time to eat!',
      body: `You've only had ${Math.round(kcal)} kcal so far. Make sure you're fuelling your body properly — ${Math.round(calorieTarget - kcal)} kcal still to go.`,
      cta: { label: 'Log a meal', href: '/log' },
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    }
  }

  // Low protein (less than 50% of target)
  if (proteinPct < 0.5 && proteinTarget > 0) {
    const desiOptions = 'paneer, dal, dahi, eggs, or chicken'
    return {
      emoji: '💪',
      title: 'Protein needs a boost',
      body: `You're at ${Math.round(protein_g)}g of your ${proteinTarget}g protein goal. Try adding ${desiOptions} to your next meal.`,
      cta: { label: 'Log protein', href: '/log' },
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    }
  }

  // Great protein intake
  if (proteinPct >= 0.9) {
    return {
      emoji: '🏆',
      title: 'Protein goal crushed!',
      body: `You've hit ${Math.round(protein_g)}g of protein today — great for muscle retention and satiety.`,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    }
  }

  // High carbs (over target) + trying to lose
  if (carbsTarget > 0 && carbs_g > carbsTarget * 1.2 && goal === 'lose') {
    return {
      emoji: '🫓',
      title: 'High carb day',
      body: `You're ${Math.round(carbs_g - carbsTarget)}g over your carb target. Opt for protein or veggies for your next meal.`,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    }
  }

  // High fat
  if (fatTarget > 0 && fat_g > fatTarget * 1.3) {
    return {
      emoji: '🫒',
      title: 'Fat intake is high',
      body: `At ${Math.round(fat_g)}g fat today (target: ${fatTarget}g). Try steaming or grilling instead of frying.`,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
    }
  }

  // On track (70-95% of calorie target with decent protein)
  if (kcalPct >= 0.7 && kcalPct <= 0.95 && proteinPct >= 0.6) {
    const messages = [
      "You're perfectly on track — keep it up!",
      'Great balance of macros so far today.',
      'Solid nutrition day — finishing strong!',
    ]
    return {
      emoji: '✅',
      title: 'Looking great!',
      body: messages[Math.floor(Date.now() / 86400000) % messages.length],
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    }
  }

  // Default / moderate progress
  return {
    emoji: '📊',
    title: 'Stay consistent',
    body: `${Math.round(calorieTarget - kcal)} kcal remaining for the day. Log all meals for accurate tracking.`,
    cta: { label: 'Log food', href: '/log' },
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  }
}

export function DailyInsight({ totals, profile }: { totals: DailyTotals; profile: Profile }) {
  const insight = getInsight(totals, profile)

  return (
    <div className={`rounded-3xl border ${insight.border} ${insight.bg} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white/60 text-lg">
          {insight.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Lightbulb className={`h-3.5 w-3.5 ${insight.color}`} />
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${insight.color}`}>Daily insight</p>
          </div>
          <p className={`text-sm font-bold ${insight.color}`}>{insight.title}</p>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{insight.body}</p>
          {insight.cta && (
            <Link
              href={insight.cta.href}
              className={`mt-2 inline-block text-xs font-bold ${insight.color} underline underline-offset-2`}
            >
              {insight.cta.label} →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
