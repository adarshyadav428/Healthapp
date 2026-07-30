import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getIstDayRange, istDateStr, istDaysAgoStart } from '../../../../lib/dateUtils'
import { computeRecapStats, recapFallbackMessage, recapWeekStart, type RecapStats } from '../../../../lib/weeklyRecap'
import { sendBudgetedPush } from '../../../../lib/push/budgetedSend'
import { processInBatches, CRON_TIME_BUDGET_MS } from '../../../../lib/cronBatch'
import { isProStatus } from '../../../../lib/subscription'
import { computeWrappedStats } from '../../../../lib/wrappedStats'
import {
  isMonthlyWrapWindow, previousMonthStart, istDayStartInstant, monthLabel, MIN_DAYS_FOR_WRAP,
} from '../../../../lib/monthlyWrapped'
import type { FoodLog } from '../../../../types/index'

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

  const startedAt = Date.now()
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

  // Names, weigh-ins, entitlements, and who's already been done this week —
  // all batched, so the per-user loop below makes no extra queries.
  const [{ data: profiles }, { data: weights }, { data: subs }, { data: alreadyDone }] = await Promise.all([
    admin.from('profiles').select('id, display_name').in('id', userIds),
    admin.from('weight_logs').select('user_id, weight_kg, measured_at')
      .in('user_id', userIds).gte('measured_at', windowStart).lt('measured_at', windowEnd)
      .order('measured_at', { ascending: true }),
    admin.from('subscriptions').select('user_id, status').in('user_id', userIds),
    admin.from('weekly_recaps').select('user_id').eq('week_start', weekStart).in('user_id', userIds),
  ])
  const proUsers = new Set(
    (subs ?? []).filter((s) => isProStatus(s.status as string)).map((s) => s.user_id as string)
  )
  // Resumability. If a previous run timed out partway, its completed users
  // already have a row for this week — skipping them means the next invocation
  // continues rather than redoing work and re-pushing to the same people.
  const done = new Set((alreadyDone ?? []).map((r) => r.user_id as string))
  const nameOf = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]))
  const weighByUser = new Map<string, number[]>()
  for (const w of weights ?? []) {
    const arr = weighByUser.get(w.user_id as string) ?? []
    arr.push(w.weight_kg as number)
    weighByUser.set(w.user_id as string, arr)
  }

  let stored = 0
  let sent = 0

  const pending = userIds.filter((uid) => !done.has(uid))

  const outcome = await processInBatches(pending, async (uid) => {
    const dayKcals = [...(byUser.get(uid)?.kcalByDay.values() ?? [])]
    const weighs = weighByUser.get(uid) ?? []
    const stats = computeRecapStats(
      dayKcals,
      weighs.length >= 2 ? weighs[0] : null,
      weighs.length >= 2 ? weighs[weighs.length - 1] : null
    )
    const firstName = (nameOf.get(uid) ?? '').trim().split(/\s+/)[0] || undefined
    // AI-written copy is a Pro benefit. recapFallbackMessage is deterministic,
    // tested and genuinely warm, so free users lose nothing readable — and the
    // Gemini bill scales with subscribers rather than with signups.
    const message = proUsers.has(uid)
      ? await buildMessage(stats, firstName)
      : recapFallbackMessage(stats, firstName)

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

    const result = await sendBudgetedPush(uid, 'weekly-recap', {
      title: 'Your week in review 📊',
      body: message.length > 120 ? message.slice(0, 117) + '…' : message,
      url: '/dashboard',
      tag: 'weekly-recap',
    })
    if (result.sent > 0) sent += 1
  }, { deadline: startedAt + CRON_TIME_BUDGET_MS })

  // ── Monthly Wrapped ───────────────────────────────────────────────────
  // Rides inside this cron rather than being its own schedule: vercel.json
  // declares two crons and the Hobby plan caps there, so a third would cost a
  // plan upgrade to run one job a month. Runs on any Sunday in the first
  // fortnight; users already wrapped are skipped, so the second Sunday only
  // mops up whoever the deadline cut off.
  const monthly = isMonthlyWrapWindow(new Date())
    ? await generateMonthlyWraps(admin, proUsers, startedAt)
    : null

  // `remaining` is reported rather than swallowed: a cron that quietly does 60%
  // of its job looks identical to one that did all of it, which is how the old
  // serial loop would have failed.
  return NextResponse.json({
    users: userIds.length,
    skipped: userIds.length - pending.length,
    stored,
    sent,
    remaining: outcome.remaining,
    timedOut: outcome.timedOut,
    failed: outcome.failed,
    monthly,
  })
}

/**
 * Write the previous month's Wrapped for everyone who logged enough of it.
 *
 * Deliberately reads its own window rather than reusing the weekly one: a
 * Wrapped covers a calendar month that has ended, and the snapshot it stores is
 * what the story renders forever after. Recomputing later against edited logs
 * would let a keepsake quietly rewrite itself.
 */
async function generateMonthlyWraps(
  admin: ReturnType<typeof createAdminClient>,
  proUsers: Set<string>,
  startedAt: number
) {
  const monthStart = previousMonthStart(new Date())
  const from = istDayStartInstant(monthStart)
  const [y, m] = monthStart.split('-').map(Number)
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  const to = istDayStartInstant(nextMonth)

  const [{ data: logs }, { data: weights }, { data: done }] = await Promise.all([
    admin.from('food_logs').select('user_id, kcal, protein_g, logged_at, food:foods(name)')
      .gte('logged_at', from).lt('logged_at', to),
    admin.from('weight_logs').select('user_id, weight_kg, measured_at')
      .gte('measured_at', from).lt('measured_at', to),
    admin.from('monthly_wraps').select('user_id').eq('month_start', monthStart),
  ])

  const alreadyWrapped = new Set((done ?? []).map((r) => r.user_id as string))

  const logsByUser = new Map<string, FoodLog[]>()
  for (const row of logs ?? []) {
    const uid = row.user_id as string
    const arr = logsByUser.get(uid) ?? []
    arr.push(row as unknown as FoodLog)
    logsByUser.set(uid, arr)
  }

  const weighsByUser = new Map<string, { weight_kg: number; measured_at: string }[]>()
  for (const row of weights ?? []) {
    const uid = row.user_id as string
    const arr = weighsByUser.get(uid) ?? []
    arr.push({ weight_kg: row.weight_kg as number, measured_at: row.measured_at as string })
    weighsByUser.set(uid, arr)
  }

  const candidates = [...logsByUser.keys()].filter((uid) => !alreadyWrapped.has(uid))
  let written = 0
  let pushed = 0

  const outcome = await processInBatches(candidates, async (uid) => {
    const stats = computeWrappedStats({
      logs: logsByUser.get(uid) ?? [],
      weighIns: weighsByUser.get(uid) ?? [],
      proteinTargetG: null,
    })

    // A month with almost nothing in it isn't a story, it's a reminder that you
    // stopped using the app — and pushing that is how you lose someone for good.
    if (stats.daysLogged < MIN_DAYS_FOR_WRAP) return

    const message = `${stats.daysLogged} days logged in ${monthLabel(monthStart)}.`

    const { error } = await admin.from('monthly_wraps').upsert(
      { user_id: uid, month_start: monthStart, stats, message, was_pro: proUsers.has(uid) },
      { onConflict: 'user_id,month_start' }
    )
    if (error) throw new Error(error.message)
    written += 1

    // Free users get the push too: the Wrapped is the best advert Pro has, and
    // it's an advert made entirely of the user's own month.
    const result = await sendBudgetedPush(uid, 'monthly-wrapped', {
      title: `Your ${monthLabel(monthStart)} is ready 📖`,
      body: proUsers.has(uid) ? message : `${message} See the whole story.`,
      url: '/wrapped',
      tag: 'monthly-wrapped',
    })
    if (result.sent > 0) pushed += 1
  }, { deadline: startedAt + CRON_TIME_BUDGET_MS })

  return {
    monthStart,
    candidates: candidates.length,
    written,
    pushed,
    remaining: outcome.remaining,
    timedOut: outcome.timedOut,
  }
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
