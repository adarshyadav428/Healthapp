import { describe, it, expect, afterEach, vi } from 'vitest'
import { loadPlayBilling, getPlayPrices } from '../lib/play/billing'
import { PLAY_PRODUCTS } from '../lib/play/products'

/**
 * `available` and `sellable` are deliberately separate, and this file exists to
 * keep them that way. Treating "the Digital Goods API is present" as "Play will
 * take money" is what let a blocked merchant account render a working-looking
 * paywall whose button opened a purchase sheet that immediately died.
 */

type Details = Array<{ itemId: string; price?: { currency: string; value: string } }>

function stubPlay(getDetails: () => Promise<Details>) {
  ;(globalThis as unknown as { window: unknown }).window = {
    getDigitalGoodsService: async () => ({ getDetails, listPurchases: async () => [] }),
  }
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  vi.restoreAllMocks()
})

describe('loadPlayBilling', () => {
  it('reports unavailable off-Play, where Razorpay is the correct path', async () => {
    ;(globalThis as unknown as { window: unknown }).window = {}
    expect(await loadPlayBilling()).toEqual({ available: false, sellable: false, prices: {} })
  })

  it('is sellable when Play returns products, and formats the prices', async () => {
    stubPlay(async () => [
      { itemId: PLAY_PRODUCTS.monthly, price: { currency: 'INR', value: '299' } },
      { itemId: PLAY_PRODUCTS.annual, price: { currency: 'INR', value: '1999' } },
    ])

    const play = await loadPlayBilling()
    expect(play.available).toBe(true)
    expect(play.sellable).toBe(true)
    expect(play.prices[PLAY_PRODUCTS.monthly]).toContain('299')
    expect(play.prices[PLAY_PRODUCTS.annual]).toContain('1,999')
  })

  it('is available but NOT sellable when Play returns nothing', async () => {
    // What a pending merchant/payments verification looks like from the client:
    // the TWA is real, the products are not purchasable.
    stubPlay(async () => [])

    expect(await loadPlayBilling()).toEqual({ available: true, sellable: false, prices: {} })
  })

  it('treats a thrown lookup the same as an empty one', async () => {
    // A buyer can't tell the difference, so neither should the paywall.
    stubPlay(async () => {
      throw new Error('billing unavailable')
    })

    expect(await loadPlayBilling()).toEqual({ available: true, sellable: false, prices: {} })
  })

  it('still exposes prices through the original helper', async () => {
    stubPlay(async () => [{ itemId: PLAY_PRODUCTS.monthly, price: { currency: 'INR', value: '299' } }])

    expect(Object.keys(await getPlayPrices())).toEqual([PLAY_PRODUCTS.monthly])
  })
})
