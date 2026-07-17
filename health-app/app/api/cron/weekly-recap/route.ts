import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getIstDayRange, istDateStr, istDaysAgoStart } from '../../../../lib/dateUtils'
import { computeRecapStats, recapFallbackMessage, recapWeekStart, type RecapStats } from '../../../../lib/weeklyRecap'
import { sendPushToUser } from '../../../../lib/push/send'

export const runtime = 'nodejs'

// Sunday 7 PM IST (= 13:30 UTC Sun) via vercel.json. For every user who logged
// at least once in the last 7 IST days: compute their week, write a recap row
// (Pro dashboard card reads it), and send a free push. Secret-guarded like the
// daily reminder cron (Vercel sends `Authorization: Bearer $CRON_SECRET`).
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const windowStart = istDaysAgoStart(7)
  const { end: windowEnd } = getIstDayRange()
  const weekStart = recapWeekStart(istDateStr())

  // Active users = anyone with a food log in the window.
  const { data: logRows, error: logErr } = await admin
    .from('food_logs')
    .select('user_id, kcal, logged_at')
    .gte('logged_at', windowStart)
    .lt('logged_at', windowEnd)
  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 })

  const byUser = new Map<string, { kcalByDay: Map<string, number> }>()
  for (const row of logRows ?? []) {
    const uid = row.user_id as string
    const day = istDateStr(new Date(row.logged_at as string))
    const entry = byUser.get(uid) ?? { kcalByDay: new Map<string, number>() }
    entry.kcalByDay.set(day, (entry.kcalByDay.get(day) ?? 0) + (row.kcal as number))
    byUser.set(uid, entry)
  }

  const userIds = [...byUser.keys()]
  if (userIds.length === 0) return NextResponse.json({ users: 0, sent: 0 })

  // Names + weigh-ins for the window, batched.
  const [{ data: profiles }, { data: weights }] = await Promise.all([
    admin.from('profiles').select('id, display_name').in('id', userIds),
    admin.from('weight_logs').select('user_id, weight_kg, measured_at')
      .in('user_id', userIds).gte('measured_at', windowStart).lt('measured_at', windowEnd)
      .order('measured_at', { ascending: true }),
  ])
  const nameOf = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]))
  const weighByUser = new Map<string, number[]>()
  for (const w of weights ?? []) {
    const arr = weighByUser.get(w.user_id as string) ?? []
    arr.push(w.weight_kg as number)
    weighByUser.set(w.user_id as string, arr)
  }

  let stored = 0
  let sent = 0

  for (const uid of userIds) {
    const dayKcals = [...(byUser.get(uid)?.kcalByDay.values() ?? [])]
    const weighs = weighByUser.get(uid) ?? []
    const stats = computeRecapStats(
      dayKcals,
      weighs.length >= 2 ? weighs[0] : null,
      weighs.length >= 2 ? weighs[weighs.length - 1] : null
    )
    const firstName = (nameOf.get(uid) ?? '').trim().split(/\s+/)[0] || undefined
    const message = await buildMessage(stats, firstName)

    const { error: upErr } = await admin.from('weekly_recaps').upsert(
      {
        user_id: uid,
        week_start: weekStart,
        avg_kcal: stats.avgKcal,
        days_logged: stats.daysLogged,
        weight_delta_kg: stats.weightDeltaKg,
        message,
      },
      { onConflict: 'user_id,week_start' }
    )
    if (!upErr) stored += 1

    const result = await sendPushToUser(uid, {
      title: 'Your week in review 📊',
      body: message.length > 120 ? message.slice(0, 117) + '…' : message,
      url: '/dashboard',
      tag: 'weekly-recap',
    })
    if (result.sent > 0) sent += 1
  }

  return NextResponse.json({ users: userIds.length, stored, sent })
}

/** One warm sentence from Gemini; falls back to the deterministic template on
 *  any failure so the cron never hard-fails on an AI hiccup. */
async function buildMessage(stats: RecapStats, firstName?: string): Promise<string> {
  const fallback = recapFallbackMessage(stats, firstName)
  if (!process.env.GEMINI_API_KEY) return fallback
  try {
    const prompt =
      `Write ONE warm, specific sentence (max 25 words, at most one emoji) summarising this week for a ` +
      `weight-loss app user${firstName ? ` named ${firstName}` : ''}. Data: ${stats.daysLogged} days logged, ` +
      `average ${stats.avgKcal} kcal/day` +
      (stats.weightDeltaKg != null ? `, weight change ${stats.weightDeltaKg} kg` : '') +
      `. Be encouraging and honest; no medical claims. Return only the sentence.`
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 80, temperature: 0.7 },
        }),
      }
    )
    if (!res.ok) return fallback
    const json = await res.json()
    const text = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().replace(/^["']|["']$/g, '')
    return text || fallback
  } catch {
    return fallback
  }
}
