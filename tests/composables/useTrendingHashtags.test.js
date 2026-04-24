import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSubscribe, mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(() => ({ close: vi.fn() })),
  mockCacheGet: vi.fn(() => undefined),
  mockCacheSet: vi.fn(),
}))

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: { subscribe: mockSubscribe },
}))

vi.mock('../../src/services/nostr/CacheManager.js', () => ({
  cacheManager: { get: mockCacheGet, set: mockCacheSet },
}))

let __testing__
let useTrendingHashtags

beforeEach(async () => {
  vi.resetModules()
  mockSubscribe.mockClear()
  mockCacheGet.mockReset()
  mockCacheGet.mockReturnValue(undefined)
  mockCacheSet.mockClear()
  const mod = await import('../../src/composables/explore/useTrendingHashtags.js')
  useTrendingHashtags = mod.useTrendingHashtags
  __testing__ = mod.__testing__
  __testing__.resetAll()
})

function note({ id, content, createdAt = Math.floor(Date.now() / 1000) }) {
  return { id, content, created_at: createdAt }
}

describe('useTrendingHashtags — ingest', () => {
  it('extracts hashtags and counts occurrences across notes', () => {
    __testing__.ingestNote(note({ id: 'n1', content: 'hello #nostr #btc' }))
    __testing__.ingestNote(note({ id: 'n2', content: 'gm #nostr' }))
    __testing__.recompute()
    const { trending } = useTrendingHashtags({ auto: false })
    const counts = Object.fromEntries(trending.value.map(t => [t.tag, t.count]))
    expect(counts.nostr).toBe(2)
    expect(counts.btc).toBe(1)
  })

  it('dedupes a tag used twice in one note (counts as one)', () => {
    __testing__.ingestNote(note({ id: 'n1', content: '#nostr #nostr #nostr' }))
    __testing__.recompute()
    const { trending } = useTrendingHashtags({ auto: false })
    expect(trending.value[0]).toEqual({ tag: 'nostr', count: 1 })
  })

  it('dedupes the same note re-ingested twice', () => {
    const n = note({ id: 'n1', content: '#nostr' })
    __testing__.ingestNote(n)
    __testing__.ingestNote(n)
    __testing__.recompute()
    const { trending } = useTrendingHashtags({ auto: false })
    expect(trending.value[0]).toEqual({ tag: 'nostr', count: 1 })
  })

  it('drops notes outside the 2h window', () => {
    const threeHoursAgo = Math.floor(Date.now() / 1000) - 3 * 3600
    __testing__.ingestNote(note({ id: 'old', content: '#ancient', createdAt: threeHoursAgo }))
    __testing__.recompute()
    const { trending } = useTrendingHashtags({ auto: false })
    expect(trending.value).toEqual([])
  })

  it('evicts tags whose only occurrences age out on recompute', () => {
    const now = Math.floor(Date.now() / 1000)
    __testing__.ingestNote(note({ id: 'a', content: '#soonGone', createdAt: now - 5 }))
    __testing__.recompute()
    expect(useTrendingHashtags({ auto: false }).trending.value.length).toBe(1)

    // Jump time forward past the window.
    vi.useFakeTimers()
    vi.setSystemTime(new Date((now + 3 * 3600) * 1000))
    __testing__.recompute()
    expect(useTrendingHashtags({ auto: false }).trending.value).toEqual([])
    vi.useRealTimers()
  })
})

describe('useTrendingHashtags — sorting + cap', () => {
  it('returns top 15 sorted desc by count, alphabetic tiebreak', () => {
    const now = Math.floor(Date.now() / 1000)
    for (let i = 0; i < 20; i++) {
      __testing__.ingestNote(note({ id: `n${i}`, content: `#tag${i}`, createdAt: now - i }))
    }
    // Give one tag a runaway lead
    __testing__.ingestNote(note({ id: 'big1', content: '#lead', createdAt: now - 30 }))
    __testing__.ingestNote(note({ id: 'big2', content: '#lead', createdAt: now - 31 }))
    __testing__.ingestNote(note({ id: 'big3', content: '#lead', createdAt: now - 32 }))
    __testing__.recompute()
    const { trending } = useTrendingHashtags({ auto: false })
    expect(trending.value.length).toBe(15)
    expect(trending.value[0].tag).toBe('lead')
    expect(trending.value[0].count).toBe(3)
  })
})

describe('useTrendingHashtags — snapshot persistence', () => {
  it('writes snapshot on recompute', () => {
    __testing__.ingestNote(note({ id: 'n1', content: '#nostr' }))
    __testing__.recompute()
    const call = mockCacheSet.mock.calls.find(c => c[0] === 'snapshots' && c[1] === 'explore:trending')
    expect(call).toBeDefined()
    expect(call[2].list[0]).toEqual({ tag: 'nostr', count: 1 })
  })

  it('hydrates from snapshot on first start', () => {
    mockCacheGet.mockImplementation((ns, key) => {
      if (ns === 'snapshots' && key === 'explore:trending') {
        return { list: [{ tag: 'seeded', count: 7 }], savedAt: Date.now() }
      }
      return undefined
    })
    __testing__.hydrateFromSnapshot()
    const { trending } = useTrendingHashtags({ auto: false })
    expect(trending.value).toEqual([{ tag: 'seeded', count: 7 }])
  })
})
