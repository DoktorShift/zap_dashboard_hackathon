import { describe, it, expect } from 'vitest'
import { NOTIFICATION_TYPES } from '../../src/utils/notifications/types.js'
import { dedupeKeyFor } from '../../src/utils/notifications/dedupeKey.js'
import { resolveAction } from '../../src/utils/notifications/action.js'
import { toSats, formatRelativeTime } from '../../src/utils/notifications/format.js'

describe('dedupeKeyFor', () => {
  it('derives the same key for the same Lightning payment hash', () => {
    const a = dedupeKeyFor(NOTIFICATION_TYPES.ZAP_RECEIVED_NWC, { paymentHash: 'abc123' })
    const b = dedupeKeyFor(NOTIFICATION_TYPES.ZAP_RECEIVED_NWC, { paymentHash: 'abc123', timestamp: 999 })
    expect(a).toBe(b)
  })

  it('differentiates NWC vs Nostr zap sharing the same hash field', () => {
    const nwc = dedupeKeyFor(NOTIFICATION_TYPES.ZAP_RECEIVED_NWC, { paymentHash: 'h' })
    const nostr = dedupeKeyFor(NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR, { paymentHash: 'h' })
    expect(nwc).not.toBe(nostr)
  })

  it('returns null for NWC receipt without a payment hash', () => {
    expect(dedupeKeyFor(NOTIFICATION_TYPES.ZAP_RECEIVED_NWC, {})).toBeNull()
  })

  it('time-buckets success/error keys so a single click cannot double-fire', () => {
    const ts = 1_700_000_000_000
    const a = dedupeKeyFor(NOTIFICATION_TYPES.PAYMENT_SUCCESS, { timestamp: ts })
    const b = dedupeKeyFor(NOTIFICATION_TYPES.PAYMENT_SUCCESS, { timestamp: ts + 500 })
    expect(a).toBe(b) // within the 2-second bucket
  })

  it('differentiates balance changes across connections', () => {
    const a = dedupeKeyFor(NOTIFICATION_TYPES.BALANCE_CHANGE, { oldBalance: 100, newBalance: 200, connectionId: 'alby' })
    const b = dedupeKeyFor(NOTIFICATION_TYPES.BALANCE_CHANGE, { oldBalance: 100, newBalance: 200, connectionId: 'mutiny' })
    expect(a).not.toBe(b)
  })

  it('keys calendar invite/start by event id', () => {
    expect(dedupeKeyFor(NOTIFICATION_TYPES.CALENDAR_INVITE, { eventId: 'ev42' })).toMatch(/ev42/)
    expect(dedupeKeyFor(NOTIFICATION_TYPES.CALENDAR_EVENT_START, { eventId: 'ev42' })).toMatch(/ev42/)
    expect(dedupeKeyFor(NOTIFICATION_TYPES.CALENDAR_INVITE, { eventId: 'ev42' }))
      .not.toBe(dedupeKeyFor(NOTIFICATION_TYPES.CALENDAR_EVENT_START, { eventId: 'ev42' }))
  })
})

describe('resolveAction', () => {
  it('routes Nostr zap to the zap feed by default', () => {
    const action = resolveAction({ type: NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR, data: {} })
    expect(action).toEqual({ page: 'zap-feed' })
  })

  it('routes Nostr zap with a known campaign eventId to the campaign view', () => {
    const action = resolveAction({
      type: NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR,
      data: { campaignEventId: 'campaign-1' },
    })
    expect(action).toEqual({ page: 'campaign-view', query: { eventId: 'campaign-1' } })
  })

  it('routes wallet-class notifications to the wallet page', () => {
    for (const type of [
      NOTIFICATION_TYPES.ZAP_RECEIVED_NWC,
      NOTIFICATION_TYPES.ZAP_SENT,
      NOTIFICATION_TYPES.BALANCE_CHANGE,
      NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      NOTIFICATION_TYPES.PAYMENT_ERROR,
      NOTIFICATION_TYPES.WALLET_ERROR,
    ]) {
      expect(resolveAction({ type, data: {} })).toEqual({ page: 'wallet' })
    }
  })

  it('routes calendar notifications to the calendar with the event id', () => {
    const action = resolveAction({
      type: NOTIFICATION_TYPES.CALENDAR_INVITE,
      data: { eventId: 'ev7' },
    })
    expect(action).toEqual({ page: 'calendar', query: { eventId: 'ev7' } })
  })

  it('routes connection notifications to settings/wallets tab', () => {
    expect(resolveAction({ type: NOTIFICATION_TYPES.CONNECTION_SUCCESS, data: {} }))
      .toEqual({ page: 'settings', tab: 'wallets' })
    expect(resolveAction({ type: NOTIFICATION_TYPES.CONNECTION_ERROR, data: {} }))
      .toEqual({ page: 'settings', tab: 'wallets' })
  })

  it('returns null for unknown types', () => {
    expect(resolveAction({ type: 'nope', data: {} })).toBeNull()
    expect(resolveAction(null)).toBeNull()
  })
})

describe('toSats', () => {
  it('passes through small-to-mid sats values unchanged', () => {
    expect(toSats(500)).toBe(500)
    expect(toSats(999_999)).toBe(999_999)
  })

  it('coerces large values (heuristic msats) to sats', () => {
    // 1 BTC in msats = 100_000_000_000 — should become 100M sats
    expect(toSats(100_000_000_000)).toBe(100_000_000)
  })

  it('respects explicit assumeMsats hint', () => {
    expect(toSats(500, { assumeMsats: true })).toBe(0) // 500 msats floors to 0
    expect(toSats(500_000, { assumeMsats: true })).toBe(500)
  })

  it('handles null / NaN / negative defensively', () => {
    expect(toSats(null)).toBe(0)
    expect(toSats(NaN)).toBe(0)
    expect(toSats(undefined)).toBe(0)
  })
})

describe('formatRelativeTime', () => {
  it('returns "Just now" for very recent timestamps', () => {
    expect(formatRelativeTime(Date.now())).toBe('Just now')
  })

  it('returns m/h/d for increasing deltas', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5m ago')
    expect(formatRelativeTime(now - 2 * 3_600_000)).toBe('2h ago')
    expect(formatRelativeTime(now - 3 * 86_400_000)).toBe('3d ago')
  })

  it('handles missing/future timestamps gracefully', () => {
    expect(formatRelativeTime(null)).toBe('')
    expect(formatRelativeTime(Date.now() + 60_000)).toBe('In the future')
  })
})
