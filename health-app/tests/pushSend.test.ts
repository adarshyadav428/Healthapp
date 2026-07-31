/**
 * The push senders.
 *
 * `lib/pushBudget.ts` (pure) is tested. The half that talks to the database and
 * to web-push was not, and that is where the audit's P1-3 lived: the
 * subscription read discarded its error, so a DB failure returned `{ sent: 0 }`
 * — indistinguishable from "this user has no devices". That return feeds the
 * budget accounting and the cron summaries, so a blip read as a legitimate
 * no-op, which is the same shape as the swallowed count that disabled the AI
 * limit for weeks.
 *
 * Push also matters more than its size suggests. It is the app's only
 * re-engagement channel, and the thing the budget exists to protect is not
 * annoyance but permission revocation — an over-pushed user turns notifications
 * off wholesale and kills the streak-save nudge with them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'
import { IGNORED_BEFORE_BACKOFF, MAX_PUSHES_PER_DAY, PUSH_KINDS } from '../lib/pushBudget'

const createAdminClient = vi.fn()
const sendNotification = vi.fn()
const setVapidDetails = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createAdminClient: () => createAdminClient(),
  getApiUser: vi.fn(),
  getAuthedUser: vi.fn(),
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}))

const { sendPushToUser } = await import('../lib/push/send')
const { sendBudgetedPush } = await import('../lib/push/budgetedSend')

const USER = 'user-1'
const PAYLOAD = { title: 'Streak', body: 'Log something today' }
const DB_DOWN = { message: 'connection reset', code: '08006' }

function device(id: string) {
  return { id, endpoint: `https://push.example/${id}`, p256dh: 'key', auth: 'auth' }
}

/** A web-push rejection carrying an HTTP status, as web-push actually throws. */
function pushError(statusCode: number) {
  return Object.assign(new Error(`push failed ${statusCode}`), { statusCode })
}

function useAdmin(options: MockOptions = {}) {
  const mock = createSupabaseMock(options)
  createAdminClient.mockReturnValue(mock.client)
  return mock
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub'
  process.env.VAPID_PRIVATE_KEY = 'priv'
  process.env.VAPID_SUBJECT = 'mailto:a@b.com'
  sendNotification.mockResolvedValue(undefined)
})

describe('sendPushToUser', () => {
  it('sends to every device the user has registered', async () => {
    useAdmin({ tables: { push_subscriptions: { data: [device('d1'), device('d2')] } } })

    const result = await sendPushToUser(USER, PAYLOAD)
    expect(result).toEqual({ sent: 2, removed: 0 })
    expect(sendNotification).toHaveBeenCalledTimes(2)
  })

  it('sends the payload as JSON to the subscription’s own keys', async () => {
    useAdmin({ tables: { push_subscriptions: { data: [device('d1')] } } })
    await sendPushToUser(USER, PAYLOAD)

    const [subscription, body] = sendNotification.mock.calls[0]
    expect(subscription).toEqual({
      endpoint: 'https://push.example/d1',
      keys: { p256dh: 'key', auth: 'auth' },
    })
    expect(JSON.parse(body as string)).toEqual(PAYLOAD)
  })

  it('reads only this user’s subscriptions', async () => {
    const mock = useAdmin({ tables: { push_subscriptions: { data: [] } } })
    await sendPushToUser(USER, PAYLOAD)
    expect(mock.callTo('push_subscriptions')?.filters).toContainEqual(['eq', 'user_id', USER])
  })

  it('reports nothing sent for a user with no devices', async () => {
    useAdmin({ tables: { push_subscriptions: { data: [] } } })
    expect(await sendPushToUser(USER, PAYLOAD)).toEqual({ sent: 0, removed: 0 })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  /**
   * P1-3. "We could not find out" must not be reported as "there is nobody to
   * send to" — the two are identical at the call site otherwise, and the caller
   * uses the number for budget accounting.
   */
  it('throws rather than returning a zero it cannot stand behind', async () => {
    useAdmin({ tables: { push_subscriptions: { data: null, error: DB_DOWN } } })
    await expect(sendPushToUser(USER, PAYLOAD)).rejects.toThrow(/push_subscriptions read failed/)
  })

  it.each([404, 410])('deletes a subscription the push service rejects with %i', async (status) => {
    const mock = useAdmin({ tables: { push_subscriptions: { data: [device('d1')] } } })
    sendNotification.mockRejectedValueOnce(pushError(status))

    expect(await sendPushToUser(USER, PAYLOAD)).toEqual({ sent: 0, removed: 1 })

    const del = mock.callsTo('push_subscriptions').find((c) => c.operation === 'delete')
    expect(del?.filters).toContainEqual(['eq', 'id', 'd1'])
  })

  it('keeps a subscription that failed for a transient reason', async () => {
    // A 500 from the push service is not evidence the device is gone; deleting
    // on it would silently unsubscribe users during someone else's outage.
    const mock = useAdmin({ tables: { push_subscriptions: { data: [device('d1')] } } })
    sendNotification.mockRejectedValueOnce(pushError(500))

    expect(await sendPushToUser(USER, PAYLOAD)).toEqual({ sent: 0, removed: 0 })
    expect(mock.callsTo('push_subscriptions').some((c) => c.operation === 'delete')).toBe(false)
  })

  it('delivers to the healthy devices even when one is dead', async () => {
    useAdmin({ tables: { push_subscriptions: { data: [device('d1'), device('d2')] } } })
    sendNotification.mockRejectedValueOnce(pushError(410))

    expect(await sendPushToUser(USER, PAYLOAD)).toEqual({ sent: 1, removed: 1 })
  })

  // NOTE: the missing-VAPID guard is deliberately not tested. `configured` is a
  // module-level latch, so whether the guard runs at all depends on which test
  // touched the module first — an assertion on it would pass or fail by file
  // order rather than by behaviour. It fails closed (throws) and is three lines
  // read straight from env; a test that lies about why it is green is worse
  // than no test.
})

describe('sendBudgetedPush', () => {
  /** No sends today, nothing ignored — the unconstrained case. */
  const CLEAR = { push_sends: { select: [{ data: [] }, { data: [] }] } }

  it('sends when the budget allows', async () => {
    useAdmin({
      tables: { ...CLEAR, push_subscriptions: { data: [device('d1')] } },
    })
    expect(await sendBudgetedPush(USER, 'streak-save', PAYLOAD)).toEqual({ sent: 1, removed: 0 })
  })

  it('tags the notification with its kind so devices coalesce it', async () => {
    useAdmin({ tables: { ...CLEAR, push_subscriptions: { data: [device('d1')] } } })
    await sendBudgetedPush(USER, 'weekly-recap', PAYLOAD)

    const body = JSON.parse(sendNotification.mock.calls[0][1] as string)
    expect(body.tag).toBe('weekly-recap')
  })

  it('keeps an explicit tag the caller chose', async () => {
    useAdmin({ tables: { ...CLEAR, push_subscriptions: { data: [device('d1')] } } })
    await sendBudgetedPush(USER, 'weekly-recap', { ...PAYLOAD, tag: 'custom' })

    expect(JSON.parse(sendNotification.mock.calls[0][1] as string).tag).toBe('custom')
  })

  /** Same kind already sent: the cap is simply spent. */
  it('skips a repeat of a kind that already went out today', async () => {
    useAdmin({
      tables: {
        push_sends: { select: [{ data: [{ kind: 'daily-reminder' }] }, { data: [] }] },
        push_subscriptions: { data: [device('d1')] },
      },
    })

    expect(await sendBudgetedPush(USER, 'daily-reminder', PAYLOAD)).toEqual({
      sent: 0,
      removed: 0,
      skipped: 'daily_cap',
    })
    // The cap is only real if nothing reaches the device.
    expect(sendNotification).not.toHaveBeenCalled()
  })

  /** Something better already went out: this one loses on rank, not on count. */
  it('skips a lesser push when a more important one already went out', async () => {
    useAdmin({
      tables: {
        push_sends: { select: [{ data: [{ kind: 'streak-save' }] }, { data: [] }] },
        push_subscriptions: { data: [device('d1')] },
      },
    })

    expect(await sendBudgetedPush(USER, 'daily-reminder', PAYLOAD)).toMatchObject({
      skipped: 'outranked',
    })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  /**
   * The subtle one. A spent cap does NOT block a more important push — the
   * streak-save nudge displaces a daily reminder that already went out, because
   * the cap exists to limit how many a user *experiences*, and the one they
   * should get is the best one. Losing this is how the most effective retention
   * mechanism in the app gets silently outvoted by a generic reminder that
   * happened to run first.
   */
  it('lets a more important push displace one already sent today', async () => {
    useAdmin({
      tables: {
        push_sends: { select: [{ data: [{ kind: 'daily-reminder' }] }, { data: [] }] },
        push_subscriptions: { data: [device('d1')] },
      },
    })

    expect(await sendBudgetedPush(USER, 'streak-save', PAYLOAD)).toMatchObject({ sent: 1 })
  })

  it('backs off to the single most important kind after enough are ignored', async () => {
    const ignored = Array.from({ length: IGNORED_BEFORE_BACKOFF }, () => ({ opened_at: null }))
    const tables = {
      push_sends: { select: [{ data: [] }, { data: ignored }] },
      push_subscriptions: { data: [device('d1')] },
    }

    useAdmin({ tables })
    expect(await sendBudgetedPush(USER, 'daily-reminder', PAYLOAD)).toMatchObject({
      skipped: 'backoff',
    })

    // ...but the one that actually works still gets through.
    useAdmin({ tables })
    expect(await sendBudgetedPush(USER, PUSH_KINDS[0], PAYLOAD)).toMatchObject({ sent: 1 })
  })

  it('lets one opened push reset the back-off', async () => {
    // Newest first: an opened push stops the count, so a single re-engagement
    // clears it rather than holding it against someone forever.
    const recent = [
      { opened_at: null },
      { opened_at: '2026-07-30T10:00:00Z' },
      ...Array.from({ length: IGNORED_BEFORE_BACKOFF }, () => ({ opened_at: null })),
    ]
    useAdmin({
      tables: {
        push_sends: { select: [{ data: [] }, { data: recent }] },
        push_subscriptions: { data: [device('d1')] },
      },
    })

    expect(await sendBudgetedPush(USER, 'daily-reminder', PAYLOAD)).toMatchObject({ sent: 1 })
  })

  it('records a delivered push against the day’s budget', async () => {
    const mock = useAdmin({
      tables: { ...CLEAR, push_subscriptions: { data: [device('d1')] } },
    })
    await sendBudgetedPush(USER, 'streak-save', PAYLOAD, new Date('2026-07-31T18:00:00Z'))

    const insert = mock.callsTo('push_sends').find((c) => c.operation === 'insert')
    expect(insert?.payload).toMatchObject({ user_id: USER, kind: 'streak-save' })
    // IST day, not UTC — 18:00Z on the 31st is already 23:30 on the 31st in IST.
    expect((insert?.payload as any).sent_on).toBe('2026-07-31')
  })

  it('books a send against the IST day the user is actually living in', async () => {
    const mock = useAdmin({
      tables: { ...CLEAR, push_subscriptions: { data: [device('d1')] } },
    })
    // 20:00 UTC on the 31st is 01:30 IST on the 1st — tomorrow, for the user.
    await sendBudgetedPush(USER, 'streak-save', PAYLOAD, new Date('2026-07-31T20:00:00Z'))

    const insert = mock.callsTo('push_sends').find((c) => c.operation === 'insert')
    expect((insert?.payload as any).sent_on).toBe('2026-08-01')
  })

  it('does not spend the budget on a push that reached no device', async () => {
    const mock = useAdmin({ tables: { ...CLEAR, push_subscriptions: { data: [] } } })
    expect(await sendBudgetedPush(USER, 'streak-save', PAYLOAD)).toEqual({ sent: 0, removed: 0 })
    // Recording an undelivered push would silently starve the user of tomorrow's.
    expect(mock.callsTo('push_sends').some((c) => c.operation === 'insert')).toBe(false)
  })

  it('still reports the send when the bookkeeping insert fails', async () => {
    useAdmin({
      tables: {
        push_sends: { select: [{ data: [] }, { data: [] }], insert: { error: DB_DOWN } },
        push_subscriptions: { data: [device('d1')] },
      },
    })
    // Losing the record is worth less than losing the notification; worst case
    // is one extra push.
    expect(await sendBudgetedPush(USER, 'streak-save', PAYLOAD)).toEqual({ sent: 1, removed: 0 })
  })

  it('propagates a subscription read failure instead of reporting a skip', async () => {
    useAdmin({
      tables: { ...CLEAR, push_subscriptions: { data: null, error: DB_DOWN } },
    })
    // The cron turns this into a per-user `failed`, which is the point of P1-3:
    // a broken read must not look like a user with no devices.
    await expect(sendBudgetedPush(USER, 'streak-save', PAYLOAD)).rejects.toThrow(
      /push_subscriptions read failed/
    )
  })

  it('enforces one push a day, as the constant declares', () => {
    // If this ever rises, every "skips a second push" test above is testing a
    // rule the app no longer has.
    expect(MAX_PUSHES_PER_DAY).toBe(1)
  })
})

/**
 * The budget only works if nothing can bypass it.
 *
 * `sendPushToUser` stays exported for the one legitimate case — a user-triggered
 * test send — but a scheduled notification that calls it directly is invisible
 * to the daily cap and the back-off, which is how a user ends up revoking
 * permission. This is the audit's §5 item 6.
 */
describe('nothing bypasses the budget', () => {
  function sourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) sourceFiles(full, acc)
      else if (/\.tsx?$/.test(entry)) acc.push(full)
    }
    return acc
  }

  it('imports sendPushToUser only from within lib/push', () => {
    const root = join(__dirname, '..')
    const offenders = [join(root, 'app'), join(root, 'lib'), join(root, 'components')]
      .flatMap((dir) => sourceFiles(dir))
      .filter((file) => !file.includes(join('lib', 'push')))
      .filter((file) => /\bsendPushToUser\b/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(root.length + 1))

    expect(offenders).toEqual([])
  })

  it('routes every scheduled push kind through sendBudgetedPush', () => {
    const root = join(__dirname, '..')
    const cronSource = sourceFiles(join(root, 'app', 'api', 'cron'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')

    // Any cron that pushes at all must do it through the budgeted sender.
    expect(cronSource).not.toMatch(/\bsendPushToUser\b/)
    expect(cronSource).toMatch(/\bsendBudgetedPush\b/)
  })
})
