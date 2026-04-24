import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockQuery, mockProfileGet, mockCacheGet, mockCacheSet,
        mockCoreParse, mockCoreValidate, mockBolt11Decode } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProfileGet: vi.fn().mockResolvedValue(null),
  mockCacheGet: vi.fn(() => undefined),
  mockCacheSet: vi.fn(),
  mockCoreParse: vi.fn(),
  mockCoreValidate: vi.fn(),
  mockBolt11Decode: vi.fn(),
}))

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: { query: mockQuery },
}))

vi.mock('../../src/services/nostr/ProfileService.js', () => ({
  profileService: { get: mockProfileGet },
}))

vi.mock('../../src/services/nostr/CacheManager.js', () => ({
  cacheManager: { get: mockCacheGet, set: mockCacheSet },
}))

vi.mock('../../src/services/nostr/CacheEntry.js', () => ({
  isCacheEntry: () => false,
  unwrap: (v) => v,
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  parseZapReceipt: mockCoreParse,
  validateZapReceipt: mockCoreValidate,
  bolt11: { decode: mockBolt11Decode },
}))

// auth mock — not used in pure-fn tests, only to keep module import happy
vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({
    currentUser: { value: null },
    isAuthenticated: { value: false },
  }),
}))

let __testing__

beforeEach(async () => {
  vi.resetModules()
  mockQuery.mockReset()
  mockProfileGet.mockReset().mockResolvedValue(null)
  mockCoreParse.mockReset()
  mockBolt11Decode.mockReset()
  const mod = await import('../../src/composables/explore/useMyNostrStory.js')
  __testing__ = mod.__testing__
})

function verifiedReceipt({ id, sender = 'me', recipient = 'recipient-x', amountMsat = 21000000, createdAt = 1700000000 }) {
  const zapRequest = {
    pubkey: sender, content: '',
    tags: [['p', recipient], ['amount', String(amountMsat)]],
  }
  return {
    id, kind: 9735, pubkey: 'relay-zapper', created_at: createdAt, sig: 'sig', content: '',
    tags: [
      ['p', recipient],
      ['bolt11', 'lnbc_' + id],
      ['description', JSON.stringify(zapRequest)],
    ],
  }
}

function primeParseMock() {
  // The core parseZapReceipt is mocked to return a minimal valid shape so
  // the wrapper's bolt11 verification succeeds.
  mockCoreParse.mockImplementation((ev) => {
    const desc = ev.tags.find(t => t[0] === 'description')?.[1]
    const request = JSON.parse(desc)
    const bolt11 = ev.tags.find(t => t[0] === 'bolt11')?.[1]
    return {
      senderPubkey: request.pubkey,
      eventId: null,
      amount: Number(request.tags.find(t => t[0] === 'amount')[1]),
      bolt11,
    }
  })
  mockBolt11Decode.mockImplementation((inv) => ({
    amountMsat: 21000000,
    paymentHash: 'h-' + inv,
  }))
}

describe('useMyNostrStory — daysSince', () => {
  it('returns whole-day difference', () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60 - 60
    expect(__testing__.daysSince(twoDaysAgo)).toBe(2)
  })

  it('clamps negative values to 0', () => {
    const future = Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60
    expect(__testing__.daysSince(future)).toBe(0)
  })

  it('returns null for non-finite input', () => {
    expect(__testing__.daysSince(NaN)).toBe(null)
    expect(__testing__.daysSince(undefined)).toBe(null)
  })
})

describe('useMyNostrStory — fetchAccountAge', () => {
  it('returns null fields when no events', async () => {
    mockQuery.mockResolvedValueOnce([])
    const result = await __testing__.fetchAccountAge('me')
    expect(result).toEqual({ accountAgeDays: null, firstEventAt: null, isPartial: false })
  })

  it('picks the earliest created_at across events', async () => {
    const now = Math.floor(Date.now() / 1000)
    const tenDaysAgo = now - 10 * 24 * 60 * 60
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60
    mockQuery.mockResolvedValueOnce([
      { created_at: tenDaysAgo },
      { created_at: thirtyDaysAgo },
      { created_at: tenDaysAgo - 100 },
    ])
    const result = await __testing__.fetchAccountAge('me')
    expect(result.firstEventAt).toBe(thirtyDaysAgo)
    expect(result.accountAgeDays).toBe(30)
    expect(result.isPartial).toBe(false)
  })

  it('marks isPartial true when returned event count hits the limit', async () => {
    const events = Array.from({ length: 500 }, (_, i) => ({ created_at: 1700000000 + i }))
    mockQuery.mockResolvedValueOnce(events)
    const result = await __testing__.fetchAccountAge('me')
    expect(result.isPartial).toBe(true)
  })
})

describe('useMyNostrStory — fetchBiggestZapReceived', () => {
  beforeEach(() => { primeParseMock() })

  it('returns null when no receipts', async () => {
    mockQuery.mockResolvedValueOnce([])
    const result = await __testing__.fetchBiggestZapReceived('recipient-x')
    expect(result.biggestZapReceived).toBeNull()
  })

  it('picks the max-amount receipt', async () => {
    // Receipts carry varied amounts. The inner zap request's `amount` tag
    // must equal the bolt11-decoded amountMsat or parseZapReceipt returns
    // null (amount-spoofing guard). Align them per-fixture.
    mockBolt11Decode
      .mockImplementationOnce(() => ({ amountMsat: 5000000,  paymentHash: 'h1' }))
      .mockImplementationOnce(() => ({ amountMsat: 50000000, paymentHash: 'h2' }))
      .mockImplementationOnce(() => ({ amountMsat: 10000000, paymentHash: 'h3' }))
    mockCoreParse
      .mockReturnValueOnce({ senderPubkey: 'alice', eventId: null, amount: 5000000,  bolt11: 'i1' })
      .mockReturnValueOnce({ senderPubkey: 'bob',   eventId: null, amount: 50000000, bolt11: 'i2' })
      .mockReturnValueOnce({ senderPubkey: 'carol', eventId: null, amount: 10000000, bolt11: 'i3' })
    mockQuery.mockResolvedValueOnce([
      verifiedReceipt({ id: 'r1', sender: 'alice', recipient: 'recipient-x', amountMsat: 5000000 }),
      verifiedReceipt({ id: 'r2', sender: 'bob',   recipient: 'recipient-x', amountMsat: 50000000 }),
      verifiedReceipt({ id: 'r3', sender: 'carol', recipient: 'recipient-x', amountMsat: 10000000 }),
    ])
    const result = await __testing__.fetchBiggestZapReceived('recipient-x')
    expect(result.biggestZapReceived.amount).toBe(50000)
    expect(result.biggestZapReceived.fromPubkey).toBe('bob')
  })
})

describe('useMyNostrStory — fetchSentZapsStats', () => {
  beforeEach(() => { primeParseMock() })

  it('counts distinct recipients and earliest timestamp', async () => {
    const t1 = 1700000000
    const t2 = 1700000500
    const t3 = 1700001000
    mockQuery.mockResolvedValueOnce([
      verifiedReceipt({ id: 'a', sender: 'me', recipient: 'author-1', createdAt: t2 }),
      verifiedReceipt({ id: 'b', sender: 'me', recipient: 'author-2', createdAt: t3 }),
      verifiedReceipt({ id: 'c', sender: 'me', recipient: 'author-1', createdAt: t1 }),
    ])
    const result = await __testing__.fetchSentZapsStats('me')
    expect(result.creatorsZappedCount).toBe(2)
    expect(result.firstZapSentAt).toBe(t1)
  })

  it('ignores receipts whose inner sender mismatches the user', async () => {
    mockQuery.mockResolvedValueOnce([
      verifiedReceipt({ id: 'wrong', sender: 'someoneElse', recipient: 'a' }),
    ])
    const result = await __testing__.fetchSentZapsStats('me')
    expect(result.creatorsZappedCount).toBeNull()
    expect(result.firstZapSentAt).toBeNull()
  })
})
