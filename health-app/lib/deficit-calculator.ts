/**
 * lib/deficit-calculator.ts
 *
 * Science:
 *   1 kg of fat = 7,700 kcal
 *   Daily deficit = TDEE (maintenance) - calories eaten
 *   Weekly target deficit = pace_kg_per_week × 7,700
 */

export interface DailyDeficit {
  date: string
  calories_eaten: number
  tdee: number
  deficit: number            // positive = deficit, negative = surplus
  cumulative_deficit: number
}

export interface WeeklyDeficitSummary {
  week_start: string
  total_deficit: number
  target_deficit: number
  fat_loss_achieved_kg: number
  fat_loss_target_kg: number
  progress_percent: number
  days_logged: number
  average_daily_deficit: number
  projected_weekly_loss_kg: number
  status: 'on_track' | 'ahead' | 'behind' | 'surplus'
  insight: string
}

export function calculateWeeklyDeficit(
  dailyLogs: { date: string; calories: number }[],
  tdee: number,
  weeklyGoalKg: number
): WeeklyDeficitSummary {
  const targetDeficit = weeklyGoalKg * 7700
  const targetDailyDeficit = targetDeficit / 7
  const daysLogged = dailyLogs.length
  const daysRemaining = Math.max(1, 7 - daysLogged)

  let totalDeficit = 0
  const dailyDeficits: DailyDeficit[] = []

  for (const log of dailyLogs) {
    const dayDeficit = tdee - log.calories
    totalDeficit += dayDeficit
    dailyDeficits.push({
      date: log.date,
      calories_eaten: log.calories,
      tdee,
      deficit: dayDeficit,
      cumulative_deficit: totalDeficit,
    })
  }

  const avgDailyDeficit = daysLogged > 0 ? totalDeficit / daysLogged : 0
  const projectedWeeklyLoss = (avgDailyDeficit * 7) / 7700
  const fatLossAchieved = Math.max(0, totalDeficit / 7700)
  const progressPercent = targetDeficit > 0
    ? Math.min(120, (totalDeficit / targetDeficit) * 100)
    : 0

  let status: WeeklyDeficitSummary['status']
  if (totalDeficit < 0) status = 'surplus'
  else if (progressPercent >= 110) status = 'ahead'
  else if (progressPercent >= 80) status = 'on_track'
  else status = 'behind'

  const calBehind = Math.max(0, targetDeficit - totalDeficit)
  const neededPerDay = Math.round(calBehind / daysRemaining)

  const insights: Record<typeof status, string> = {
    surplus: `You are in a calorie surplus this week. Cut ${Math.round(Math.abs(avgDailyDeficit))} kcal/day to get back on track.`,
    ahead:   `You are ahead of schedule — ${projectedWeeklyLoss.toFixed(2)} kg of fat loss projected this week. Keep it up!`,
    on_track: `On track! Maintain your ${Math.round(targetDailyDeficit)} kcal/day deficit to hit your ${weeklyGoalKg} kg goal.`,
    behind:  `${Math.round(calBehind)} kcal behind target. Need a ${neededPerDay} kcal deficit each remaining day to hit your goal.`,
  }

  return {
    week_start: dailyLogs[0]?.date ?? new Date().toISOString().slice(0, 10),
    total_deficit: Math.round(totalDeficit),
    target_deficit: Math.round(targetDeficit),
    fat_loss_achieved_kg: Math.round(fatLossAchieved * 1000) / 1000,
    fat_loss_target_kg: weeklyGoalKg,
    progress_percent: Math.round(Math.max(0, progressPercent)),
    days_logged: daysLogged,
    average_daily_deficit: Math.round(avgDailyDeficit),
    projected_weekly_loss_kg: Math.round(projectedWeeklyLoss * 1000) / 1000,
    status,
    insight: insights[status],
  }
}
