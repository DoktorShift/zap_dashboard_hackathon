import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSubscribe, mockBatch, mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(() => ({ close: vi.fn() })),
  mockBatch: vi.fn().mockResolvedValue(0),
  mockCacheGet: vi.fn(() => undefined),
  mockCacheSet: vi.fn(),
}))

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: { subscribe: mockSubscribe, query: vi.fn(), queryOne: vi.fn() },
}))

vi.mock('../../src/services/nostr/ProfileService.js', () => ({
  profileService: { batch: mockBatch, get: vi.fn() },
}))

vi.mock('../../src/services/nostr/CacheManager.js', () => ({
  cacheManager: { get: mockCacheGet, set: mockCacheSet },
}))

vi.mock('../../src/services/nostr/CacheEntry.js', () => ({
  isCacheEntry: () => false,
  unwrap: (v) => v,
}))

let __testing__
let useNetworkZapActivity

beforeEach(async () => {
  vi.resetModules()
  mockSubscribe.mockClear()
  mockBatch.mockClear()
  mockCacheGet.mockReset()
  mockCacheGet.mockReturnValue(undefined)
  mockCacheSet.mockClear()
  const mod = await import('../../src/composables/explore/useNetworkZapActivity.js')
  useNetworkZapActivity = mod.useNetworkZapActivity
  __testing__ = mod.__testing__
  __testing__.resetAll()
})

afterEach(() => {
  vi.useRealTimers()
})

function fakeParsed({ id, amount, zapper = 'zapper-a', recipient = 'recip-a', tsSeconds = Math.floor(Date.now() / 1000), eventId = null, message = '' } = {}) {
  return {
    id,
    amount,
    zapperPubkey: zapper,
    zappedEventId: eventId,
    message,
    timestamp: new Date(tsSeconds * 1000).toISOString(),
    rawZapEvent: { tags: [['p', recipient]] },
  }
}

describe('useNetworkZapActivity — ingest + commit', () => {
  it('dedupes by id across ingest calls', () => {
    const a = fakeParsed({ id: 'z1', amount: 100 })
    expect(__testing__.ingestParsed(a)).toBe(true)
    expect(__testing__.ingestParsed(a)).toBe(false)
    __testing__.commit()
    expect(__testing__.getZapsById().size).toBe(1)
  })

  it('drops zaps with no recipient p-tag', () => {
    const bad = {
      id: 'z-bad', amount: 10, zapperPubkey: 'z',
      timestamp: new Date().toISOString(), rawZapEvent: { tags: [] },
    }
    expect(__testing__.ingestParsed(bad)).toBe(false)
  })

  it('excludes zaps older than 7d', () => {
    const oldTs = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60
    expect(__testing__.ingestParsed(fakeParsed({ id: 'old', amount: 99, tsSeconds: oldTs }))).toBe(false)
  })
})

describe('useNetworkZapActivity — last24hTotal decay', () => {
  it('counts only zaps within the last 24h', () => {
    const now = Math.floor(Date.now() / 1000)
    __testing__.ingestParsed(fakeParsed({ id: 'recent', amount: 1000, tsSeconds: now - 60 }))
    __testing__.ingestParsed(fakeParsed({ id: 'older',  amount: 5000, tsSeconds: now - 48 * 3600 }))
    __testing__.commit()
    const { last24hTotal } = useNetworkZapActivity({ auto: false })
    expect(last24hTotal.value).toBe(1000)
  })

  it('recomputes totals after commit (deterministic across commits)', () => {
    const now = Math.floor(Date.now() / 1000)
    __testing__.ingestParsed(fakeParsed({ id: 'a', amount: 100, tsSeconds: now - 10 }))
    __testing__.commit()
    __testing__.ingestParsed(fakeParsed({ id: 'b', amount: 250, tsSeconds: now - 20 }))
    __testing__.commit()
    const { last24hTotal } = useNetworkZapActivity({ auto: false })
    expect(last24hTotal.value).toBe(350)
  })
})

describe('useNetworkZapActivity — leaderboards', () => {
  it('topZappers7d sorts descending by totalSats and caps at 10', () => {
    const now = Math.floor(Date.now() / 1000)
    for (let i = 0; i < 12; i++) {
      __testing__.ingestParsed(fakeParsed({
        id: `z${i}`, amount: (i + 1) * 100, zapper: `zapper-${i}`, tsSeconds: now - i,
      }))
    }
    __testing__.commit()
    const { topZappers7d } = useNetworkZapActivity({ auto: false })
    expect(topZappers7d.value).toHaveLength(10)
    expect(topZappers7d.value[0].pubkey).toBe('zapper-11')
    expect(topZappers7d.value[0].totalSats).toBe(1200)
    expect(topZappers7d.value[9].totalSats).toBeGreaterThan(topZappers7d.value[10]?.totalSats ?? 0)
  })

  it('topCreators7d aggregates by recipient, sums sats, dedupes note count', () => {
    const now = Math.floor(Date.now() / 1000)
    __testing__.ingestParsed(fakeParsed({ id: 'a', amount: 100, zapper: 'x', recipient: 'author', eventId: 'note-1', tsSeconds: now }))
    __testing__.ingestParsed(fakeParsed({ id: 'b', amount: 50,  zapper: 'y', recipient: 'author', eventId: 'note-1', tsSeconds: now }))
    __testing__.ingestParsed(fakeParsed({ id: 'c', amount: 25,  zapper: 'z', recipient: 'author', eventId: 'note-2', tsSeconds: now }))
    __testing__.commit()
    const { topCreators7d } = useNetworkZapActivity({ auto: false })
    expect(topCreators7d.value).toEqual([
      { pubkey: 'author', totalSats: 175, zapCount: 3, noteCount: 2 },
    ])
  })
})

describe('useNetworkZapActivity — wire feed', () => {
  it('caps at 30 most-recent entries, sorted desc by timestamp', () => {
    const now = Math.floor(Date.now() / 1000)
    for (let i = 0; i < 40; i++) {
      __testing__.ingestParsed(fakeParsed({ id: `w${i}`, amount: 1, tsSeconds: now - i }))
    }
    __testing__.commit()
    const { wireFeed } = useNetworkZapActivity({ auto: false })
    expect(wireFeed.value).toHaveLength(30)
    expect(wireFeed.value[0].id).toBe('w0')
    expect(wireFeed.value[29].id).toBe('w29')
  })
})

describe('useNetworkZapActivity — snapshots', () => {
  it('persists snapshots on commit', () => {
    __testing__.ingestParsed(fakeParsed({ id: 'snap', amount: 42 }))
    __testing__.commit()
    const namespaces = mockCacheSet.mock.calls.map(c => `${c[0]}:${c[1]}`)
    expect(namespaces).toContain('snapshots:explore:zaps24h')
    expect(namespaces).toContain('snapshots:explore:leaderboards7d')
    expect(namespaces).toContain('snapshots:explore:wire')
  })

  it('hydrates from snapshots when present', () => {
    mockCacheGet.mockImplementation((ns, key) => {
      if (ns !== 'snapshots') return undefined
      if (key === 'explore:zaps24h') return { total: 9999, savedAt: Date.now() }
      if (key === 'explore:leaderboards7d') return { zappers: [{ pubkey: 'p', totalSats: 1, zapCount: 1 }], creators: [] }
      if (key === 'explore:wire') return []
      return undefined
    })
    __testing__.hydrateFromSnapshots()
    const { last24hTotal, topZappers7d } = useNetworkZapActivity({ auto: false })
    expect(last24hTotal.value).toBe(9999)
    expect(topZappers7d.value[0].pubkey).toBe('p')
  })
})
