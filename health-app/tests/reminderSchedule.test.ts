/**
 * The reminder schedule.
 *
 * The risk in this feature is a setting that lies: a user picks 8 AM, nothing
 * arrives at 8 AM, and the app has quietly taught them their preferences are
 * decorative. The tests below pin the two things that prevent it — the picker
 * only offers hours the transport can actually honour, and the catch-all
 * guarantees nobody's reminder disappears by opting in.
 */

import { describe, expect, it } from 'vitest'
import {
  CATCH_ALL_IST_HOUR,
  DEFAULT_REMINDER_HOUR,
  REMINDER_HOURS,
  formatReminderHour,
  isReminderDue,
  istHour,
  normaliseReminderHour,
} from '../lib/reminderSchedule'

describe('the hours we offer', () => {
  /**
   * The coupling that keeps the setting honest. An hourly tick after the
   * catch-all arrives once the day's push is already spent, so the budget
   * suppresses it and the chosen hour silently never fires.
   */
  it('never offers an hour later than the catch-all can honour', () => {
    expect(Math.max(...REMINDER_HOURS)).toBe(CATCH_ALL_IST_HOUR)
  })

  it('does not offer the middle of the night', () => {
    // A "you haven't logged today" nudge at 4am is an alarm clock.
    expect(Math.min(...REMINDER_HOURS)).toBe(6)
  })

  it('offers every hour in between, with no gaps', () => {
    for (let h = 6; h <= CATCH_ALL_IST_HOUR; h++) expect(REMINDER_HOURS).toContain(h)
    expect(REMINDER_HOURS).toHaveLength(CATCH_ALL_IST_HOUR - 5)
  })

  it('defaults to the hour the old fixed nudge used', () => {
    // So a user who never opens the setting sees no change whatsoever.
    expect(DEFAULT_REMINDER_HOUR).toBe(CATCH_ALL_IST_HOUR)
    expect(REMINDER_HOURS).toContain(DEFAULT_REMINDER_HOUR)
  })
})

describe('isReminderDue', () => {
  it('sends on the hourly tick that matches the chosen hour', () => {
    expect(isReminderDue({ reminderHour: 8, nowIstHour: 8, slot: 'hourly' })).toBe(true)
  })

  it('stays quiet on every other hourly tick', () => {
    expect(isReminderDue({ reminderHour: 8, nowIstHour: 9, slot: 'hourly' })).toBe(false)
    expect(isReminderDue({ reminderHour: 8, nowIstHour: 19, slot: 'hourly' })).toBe(false)
  })

  /**
   * The floor. Whatever the user chose, and whatever the hourly trigger did or
   * didn't do, the daily run still nudges someone who hasn't logged — which is
   * precisely the pre-036 behaviour. Opting into a time can only improve the
   * timing, never cost you the reminder.
   */
  it('serves everyone on the catch-all, whatever hour they chose', () => {
    for (const hour of REMINDER_HOURS) {
      expect(
        isReminderDue({ reminderHour: hour, nowIstHour: CATCH_ALL_IST_HOUR, slot: 'catch-all' }),
        `hour ${hour}`
      ).toBe(true)
    }
  })

  it('serves the catch-all even at an hour nobody could have chosen', () => {
    expect(isReminderDue({ reminderHour: 3, nowIstHour: 20, slot: 'catch-all' })).toBe(true)
  })

  it('treats a corrupt stored hour as the default rather than as never', () => {
    // A NULL or out-of-range value must not mean "this user is never reminded".
    expect(
      isReminderDue({
        reminderHour: 99,
        nowIstHour: DEFAULT_REMINDER_HOUR,
        slot: 'hourly',
      })
    ).toBe(true)
  })
})

describe('normaliseReminderHour', () => {
  it('keeps a valid hour', () => {
    expect(normaliseReminderHour(0)).toBe(0)
    expect(normaliseReminderHour(23)).toBe(23)
  })

  it.each([null, undefined, 'eight', 8.5, -1, 24, NaN])(
    'falls back to the default for %s',
    (value) => {
      expect(normaliseReminderHour(value)).toBe(DEFAULT_REMINDER_HOUR)
    }
  )
})

describe('istHour', () => {
  it('reads the hour in IST, not UTC', () => {
    // 20:00 UTC is 01:30 IST the next day — the same boundary logs and streaks use.
    expect(istHour(new Date('2026-07-31T20:00:00Z'))).toBe(1)
    expect(istHour(new Date('2026-07-31T15:00:00Z'))).toBe(20)
  })

  it('puts the catch-all cron at the hour the constant claims', () => {
    // vercel.json runs it at 15:00 UTC. If that schedule moves, this fails and
    // CATCH_ALL_IST_HOUR (and therefore REMINDER_HOURS) must move with it.
    expect(istHour(new Date('2026-07-31T15:00:00Z'))).toBe(CATCH_ALL_IST_HOUR)
  })
})

describe('formatReminderHour', () => {
  it.each([
    [6, '6:00 AM'],
    [9, '9:00 AM'],
    [12, '12:00 PM'],
    [13, '1:00 PM'],
    [20, '8:00 PM'],
    [0, '12:00 AM'],
  ])('renders %i as %s', (hour, expected) => {
    expect(formatReminderHour(hour)).toBe(expected)
  })
})
