import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

/**
 * useUserZaps must produce identical state across resubscribe/remount.
 * `zapsById` Map is the source of truth; the old `seenZapIds` Set was
 * non-idempotent because it was reset on each resubscribe. This test
 * verifies the memory rule: resubscribe/remount produces same state.
 */

const { mockQueryOutbox, mockSubscribeOutbox, mockBatch, mockGetCached } = vi.hoisted(() => ({
  mockQueryOutbox: vi.fn(),
  mockSubscribeOutbox: vi.fn(() => ({ close: vi.fn() })),
  mockBatch: vi.fn().mockResolvedValue(0),
  mockGetCached: vi.fn(() => null),
}))

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: {
    queryOutbox: mockQueryOutbox,
    subscribeOutbox: mockSubscribeOutbox,
  },
}))

vi.mock('../../src/services/nostr/ProfileService.js', () => ({
  profileService: { batch: mockBatch, getCached: mockGetCached, get: vi.fn() },
}))

vi.mock('../../src/services/nostr/CacheManager.js', () => ({
  cacheManager: { get: vi.fn(() => undefined), set: vi.fn() },
}))

const currentUser = ref({ pubkey: 'viewer' })
const isAuthenticated = ref(true)
vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({ currentUser, isAuthenticated }),
}))

// Build a valid, cryptographically-verifiable zap so parseZapReceipt
// doesn't drop it. Reuse the same pattern as parseZapReceipt.test.js.
const { mockCoreParseZapReceipt, mockBolt11Decode, mockCoreValidateZapReceipt } = vi.hoisted(() => ({
  mockCoreParseZapReceipt: vi.fn(),
  mockBolt11Decode: vi.fn(),
  mockCoreValidateZapReceipt: vi.fn(),
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  parseZapReceipt: mockCoreParseZapReceipt,
  validateZapReceipt: mockCoreValidateZapReceipt,
  bolt11: { decode: mockBolt11Decode },
}))

// useUserZaps holds module-level state (zapsById Map). Re-import per
// test so each case starts with a clean slate.
async function freshUserZaps() {
  vi.resetModules()
  const mod = await import('../../src/composables/content/useUserZaps.js')
  return mod.useUserZaps()
}

// ── fixtures ─────────────────────────────────────────────────────

function verifiedZapEvent({ id, sender = 'sender_x', amountMsat = 21000000, paymentHash = 'h-' + id }) {
  const request = { pubkey: sender, content: '', tags: [['p', 'viewer'], ['amount', String(amountMsat)]] }
  return {
    id,
    kind: 9735,
    pubkey: 'relay_zapper_pub',
    created_at: 1700000000 + Number(id.slice(1)),
    tags: [
      ['p', 'viewer'],
      ['bolt11', 'lnbc_invoice_' + id],
      ['description', JSON.stringify(request)],
    ],
    content: '',
    sig: 'sig',
  }
}

beforeEach(() => {
  mockQueryOutbox.mockReset()
  mockSubscribeOutbox.mockReset().mockImplementation(() => ({ close: vi.fn() }))
  mockBatch.mockReset().mockResolvedValue(0)
  mockGetCached.mockReset().mockReturnValue(null)
  mockCoreParseZapReceipt.mockImplementation((ev) => ({
    senderPubkey: 'sender_x',
    recipientPubkey: 'viewer',
    eventId: null,
    amount: 21000000,
    bolt11: ev.tags.find(t => t[0] === 'bolt11')?.[1] ?? null,
  }))
  mockBolt11Decode.mockImplementation((inv) => ({
    amountMsat: 21000000,
    paymentHash: 'h-' + (inv?.replace('lnbc_invoice_', '') || 'unknown'),
  }))
})

afterEach(() => { vi.clearAllMocks() })

describe('useUserZaps resubscribe idempotency', () => {
  it('resubscribe with the same historical events produces identical state', async () => {
    // Seed historical fetch with 3 unique zaps.
    mockQueryOutbox.mockResolvedValue([
      verifiedZapEvent({ id: 'e1' }),
      verifiedZapEvent({ id: 'e2' }),
      verifiedZapEvent({ id: 'e3' }),
    ])

    const { userZaps, startTracking } = await freshUserZaps()

    await startTracking()
    const firstIds = userZaps.value.map(z => z.id).sort()
    const firstCount = userZaps.value.length

    // Start again — simulates remount. Same events returned.
    await startTracking()
    const secondIds = userZaps.value.map(z => z.id).sort()

    expect(secondIds).toEqual(firstIds)
    expect(userZaps.value.length).toBe(firstCount)
  })

  it('live events with duplicate id are not re-counted across resubscribes', async () => {
    mockQueryOutbox.mockResolvedValue([verifiedZapEvent({ id: 'e1' })])
    // Capture the live handler so we can push events into it.
    let handler
    mockSubscribeOutbox.mockImplementation((_filters, cbs) => { handler = cbs; return { close: vi.fn() } })

    const { userZaps, startTracking } = await freshUserZaps()
    await startTracking()
    expect(userZaps.value.length).toBe(1)

    // Live event arrives — same id as historical.
    await handler.onevent(verifiedZapEvent({ id: 'e1' }))
    expect(userZaps.value.length).toBe(1) // not doubled

    // Resubscribe. The live sub reopens, historical fetch returns same set.
    await startTracking()
    expect(userZaps.value.length).toBe(1)

    // A NEW live event arrives after resubscribe — should be added.
    await handler.onevent(verifiedZapEvent({ id: 'e2' }))
    expect(userZaps.value.length).toBe(2)
  })

  it('caps the snapshot at a bounded size under churn', async () => {
    // 1500 historical zaps.
    const events = Array.from({ length: 1500 }, (_, i) =>
      verifiedZapEvent({ id: 'z' + i })
    )
    mockQueryOutbox.mockResolvedValue(events)

    const { userZaps, startTracking } = await freshUserZaps()
    await startTracking()

    // zapsById caps at 1000 (most recent by timestamp).
    expect(userZaps.value.length).toBeLessThanOrEqual(1000)
  })
})
