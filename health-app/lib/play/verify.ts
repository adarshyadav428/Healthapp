import { getPlayAccessToken } from './google-auth'
import type { Subscription } from '../../types/index'

// Server-side verification against the Google Play Developer API
// (purchases.subscriptionsv2). Used by /api/play/verify (purchase) and
// /api/play/rtdn (lifecycle updates).

const API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'

// The RTDN handler always answers 200 to avoid Pub/Sub retry storms, so a hung
// Play API there would consume the whole invocation and drop the notification
// with nothing to show for it. On the /api/play/verify path it's the user
// waiting on their purchase to unlock. Both want a bound.
const PLAY_API_TIMEOUT_MS = 10_000

function packageName(): string {
  const pkg = process.env.ANDROID_PACKAGE_NAME
  if (!pkg) throw new Error('Missing ANDROID_PACKAGE_NAME')
  return pkg
}

// subscriptionsv2 states → our shared `subscriptions.status` vocabulary.
type PlayState =
  | 'SUBSCRIPTION_STATE_ACTIVE'
  | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_STATE_ON_HOLD'
  | 'SUBSCRIPTION_STATE_PAUSED'
  | 'SUBSCRIPTION_STATE_CANCELED'
  | 'SUBSCRIPTION_STATE_EXPIRED'
  | 'SUBSCRIPTION_STATE_PENDING'
  | 'SUBSCRIPTION_STATE_UNSPECIFIED'

export type PlaySubscription = {
  /** Raw subscriptionState from Play. */
  state: PlayState | string
  /** Mapped to our shared status vocabulary. */
  status: NonNullable<Subscription['status']>
  /** True while the user should have Pro access. */
  entitled: boolean
  /** ISO expiry of the current billing period, if known. */
  expiryTime: string | null
  /** Whether Play still needs an acknowledgement from us. */
  needsAcknowledgement: boolean
  /** True if the latest order is in a trial / free period. */
  inTrial: boolean
}

type SubscriptionsV2Response = {
  subscriptionState?: string
  acknowledgementState?: string
  lineItems?: Array<{
    expiryTime?: string
    offerDetails?: { offerId?: string }
    // A line item carries `offerDetails` only when an intro/trial offer applies.
  }>
}

function mapStatus(state: string): { status: NonNullable<Subscription['status']>; entitled: boolean } {
  switch (state) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return { status: 'active', entitled: true }
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return { status: 'past_due', entitled: true } // still has access during grace
    case 'SUBSCRIPTION_STATE_ON_HOLD':
    case 'SUBSCRIPTION_STATE_PAUSED':
      return { status: 'past_due', entitled: false }
    case 'SUBSCRIPTION_STATE_CANCELED':
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return { status: 'canceled', entitled: false }
    default:
      return { status: 'canceled', entitled: false }
  }
}

/** Fetch + parse the current state of a Play subscription purchase token. */
export async function getPlaySubscription(purchaseToken: string): Promise<PlaySubscription> {
  const token = await getPlayAccessToken()
  const url = `${API_BASE}/${packageName()}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(PLAY_API_TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Play API ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as SubscriptionsV2Response
  const state = data.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED'
  const { status, entitled } = mapStatus(state)

  const expiryTime =
    data.lineItems?.map((li) => li.expiryTime).filter(Boolean).sort().pop() ?? null
  const inTrial = Boolean(data.lineItems?.some((li) => li.offerDetails?.offerId))

  // A trial that is otherwise active maps to our 'trialing' status.
  const finalStatus = entitled && inTrial && status === 'active' ? 'trialing' : status

  return {
    state,
    status: finalStatus,
    entitled,
    expiryTime,
    needsAcknowledgement: data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    inTrial,
  }
}

/** Acknowledge a subscription purchase so Play does not auto-refund after 3 days. */
export async function acknowledgePlaySubscription(productId: string, purchaseToken: string): Promise<void> {
  const token = await getPlayAccessToken()
  const url = `${API_BASE}/${packageName()}/purchases/subscriptions/${encodeURIComponent(
    productId,
  )}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(PLAY_API_TIMEOUT_MS),
  })
  // 200 = acknowledged; ignore "already acknowledged" style failures.
  if (!res.ok && res.status !== 400) {
    const body = await res.text().catch(() => '')
    throw new Error(`Play acknowledge ${res.status}: ${body.slice(0, 200)}`)
  }
}
