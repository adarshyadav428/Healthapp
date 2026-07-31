/**
 * The couplings that make a chosen reminder hour real.
 *
 * The schedule logic itself is pure and tested in reminderSchedule.test.ts.
 * What that cannot see is whether the pieces are still wired to each other —
 * and every failure mode of this feature is a silent one:
 *
 *   * the cron stops passing `slot`, so every hourly tick serves everybody;
 *   * the Vercel cron time moves, so REMINDER_HOURS offers hours that can never
 *     fire;
 *   * the hourly workflow stops asking for `slot=hourly`, so it behaves as a
 *     second catch-all and the chosen hour is ignored;
 *   * the workflow calls a different route than the one that reads the setting.
 *
 * None of those throw. None fail a type check. The user just never gets the
 * reminder at the time they picked, and nothing anywhere says so.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATCH_ALL_IST_HOUR, REMINDER_HOURS, istHour } from '../lib/reminderSchedule'

const ROOT = join(__dirname, '..')
const cron = readFileSync(join(ROOT, 'app', 'api', 'cron', 'push-reminders', 'route.ts'), 'utf8')
const vercelJson = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
  crons: { path: string; schedule: string }[]
}
// The workflow lives above the Next app, beside the repo's .git.
const workflow = readFileSync(
  join(ROOT, '..', '.github', 'workflows', 'reminder-tick.yml'),
  'utf8'
)

describe('the catch-all cron and the offered hours agree', () => {
  const reminderCron = vercelJson.crons.find((c) => c.path === '/api/cron/push-reminders')

  it('still declares the reminder cron in vercel.json', () => {
    expect(reminderCron, 'the catch-all is the floor — it must exist').toBeTruthy()
  })

  /**
   * The coupling that keeps the picker honest. REMINDER_HOURS stops at
   * CATCH_ALL_IST_HOUR because an hourly tick after the catch-all finds the
   * day's push already spent. If the cron schedule moves, this fails — which is
   * the point, because CATCH_ALL_IST_HOUR must move with it.
   */
  it('runs at exactly the IST hour CATCH_ALL_IST_HOUR claims', () => {
    const [minute, hour] = reminderCron!.schedule.split(' ')
    expect(minute).toBe('0')
    const utcHour = Number(hour)
    expect(Number.isInteger(utcHour)).toBe(true)

    const asIst = istHour(new Date(Date.UTC(2026, 6, 31, utcHour, 0, 0)))
    expect(asIst).toBe(CATCH_ALL_IST_HOUR)
    expect(Math.max(...REMINDER_HOURS)).toBe(asIst)
  })

  it('still runs daily, not on a narrower schedule', () => {
    // `0 15 * * *` — any day, any month, any weekday. A narrowed schedule would
    // leave users unreminded on the excluded days with nothing to signal it.
    const [, , dom, month, dow] = reminderCron!.schedule.split(' ')
    expect([dom, month, dow]).toEqual(['*', '*', '*'])
  })
})

describe('the cron distinguishes its two callers', () => {
  it('reads the slot from the query string', () => {
    expect(cron).toMatch(/searchParams\.get\('slot'\)/)
  })

  it('defaults to the catch-all rather than to hourly', () => {
    // Vercel's cron sends no `slot`. Defaulting to 'hourly' would mean the daily
    // run served only users whose hour happened to be 20:30 — silently dropping
    // everyone else's reminder.
    expect(cron).toMatch(/=== 'hourly' \? 'hourly' : 'catch-all'/)
  })

  it('filters the send list through isReminderDue', () => {
    expect(cron).toContain('isReminderDue({')
  })

  it('reads each user’s chosen hour rather than assuming one', () => {
    expect(cron).toMatch(/select\('id, reminder_hour'\)/)
  })

  it('fails the run when the reminder-hour read fails', () => {
    // A silent fallback would push everyone whose default matches the current
    // hour — a mass mistimed send that looks like a normal run.
    expect(cron).toMatch(/hourError/)
    expect(cron).toMatch(/if \(hourError\) return NextResponse\.json/)
  })
})

describe('the hourly workflow', () => {
  it('asks for the hourly slot, not the catch-all', () => {
    expect(workflow).toContain('slot=hourly')
  })

  it('targets the route that actually reads the setting', () => {
    expect(workflow).toContain('/api/cron/push-reminders')
  })

  it('runs every hour on the hour', () => {
    expect(workflow).toMatch(/cron:\s*'0 \* \* \* \*'/)
  })

  it('authenticates with the same bearer the route requires', () => {
    expect(workflow).toContain('Authorization: Bearer ${CRON_SECRET}')
    expect(cron).toMatch(/Bearer \$\{process\.env\.CRON_SECRET\}/)
  })

  it('does nothing rather than calling an unauthenticated endpoint when unconfigured', () => {
    // A repo without the secrets set must skip, not fire an unauthorised request
    // every hour forever.
    expect(workflow).toMatch(/if \[ -z "\$\{CRON_SECRET\}" \]/)
  })
})
