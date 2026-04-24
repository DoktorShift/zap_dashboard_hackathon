import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Outbox-model contract tests for NostrService:
 * - fetchRelayList queries discovery tier first, falls back to own read pool.
 * - _buildOutboxRoute partitions authors per write relay, ranks by coverage,
 *   caps globally, and surfaces unrouted authors.
 * - URL normalization is applied on every ingest path.
 * - buildOwnRelayListTemplate produces a valid kind 10002 template via nip65.
 */

// ── Mocks ────────────────────────────────────────────────────────

const { poolQuerySync, poolSubscribe, poolEnsureRelay } = vi.hoisted(() => ({
  poolQuerySync: vi.fn(),
  poolSubscribe: vi.fn(() => ({ close: vi.fn() })),
  poolEnsureRelay: vi.fn(() => Promise.resolve()),
}))

class MockRelayPool {
  querySync(...args) { return poolQuerySync(...args) }
  subscribe(...args) { return poolSubscribe(...args) }
  ensureRelay(...args) { return poolEnsureRelay(...args) }
  publish() { return Promise.resolve([]) }
  close() {}
}

vi.mock('../../src/services/nostr/nostrImports.js', async () => {
  const actual = await vi.importActual('../../src/services/nostr/nostrImports.js')
  return {
    ...actual,
    RelayPool: MockRelayPool,
    // Keep nip65/verifyEvent/normalizeURL real so parsing + routing logic
    // is tested end-to-end.
  }
})

// Use a mock localStorage so persistent cache doesn't leak between tests.
function installLocalStorage() {
  const store = new Map()
  vi.stubGlobal('localStorage', {
    get length() { return store.size },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

async function freshService() {
  vi.resetModules()
  installLocalStorage()
  const mod = await import('../../src/services/nostr/NostrService.js')
  const service = mod.nostrService
  // Mark as initialized so we can hit private methods directly without
  // spinning up the full init flow.
  service._initialized = true
  service._readyResolve?.()
  return service
}

function kind10002Event({ pubkey, relays }) {
  return {
    id: 'rlist-' + pubkey,
    kind: 10002,
    pubkey,
    created_at: 1700000000,
    content: '',
    tags: relays.map(r => {
      const tag = ['r', r.url]
      if (r.read && !r.write) tag.push('read')
      if (!r.read && r.write) tag.push('write')
      return tag
    }),
    sig: 'sig',
  }
}

beforeEach(() => {
  poolQuerySync.mockReset()
  poolSubscribe.mockReset().mockImplementation(() => ({ close: vi.fn() }))
  poolEnsureRelay.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── fetchRelayList ───────────────────────────────────────────────

describe('NostrService.fetchRelayList', () => {
  it('queries discovery relays first and caches the parsed list', async () => {
    poolQuerySync.mockResolvedValueOnce([
      kind10002Event({
        pubkey: 'alice',
        relays: [
          { url: 'wss://alice-write.example/', read: false, write: true },
          { url: 'wss://alice-both.example',  read: true,  write: true },
        ],
      }),
    ])

    const service = await freshService()
    const list = await service.fetchRelayList('alice')

    expect(Array.isArray(list)).toBe(true)
    expect(list.map(r => r.url)).toContain('wss://alice-write.example/')
    // Discovery tier used — first call was to our fixed discovery relays.
    const [relays] = poolQuerySync.mock.calls[0]
    expect(relays).toEqual(expect.arrayContaining(['wss://relay.nostr.band']))

    // Second call should hit the cache, not the network.
    poolQuerySync.mockClear()
    const cached = await service.fetchRelayList('alice')
    expect(cached).toEqual(list)
    expect(poolQuerySync).not.toHaveBeenCalled()
  })

  it('falls back to own read pool when discovery returns nothing', async () => {
    poolQuerySync
      .mockResolvedValueOnce([])  // discovery: empty
      .mockResolvedValueOnce([     // own pool: finds it
        kind10002Event({
          pubkey: 'bob',
          relays: [{ url: 'wss://bob-write.example', read: true, write: true }],
        }),
      ])

    const service = await freshService()
    // Give us a fake healthy read relay so fallback has somewhere to query.
    service.relayStatuses.set('wss://my-relay.example', {
      url: 'wss://my-relay.example', status: 'connected',
      config: { read: true, write: true },
    })
    service.relayConnections.set('wss://my-relay.example', { url: 'wss://my-relay.example' })

    const list = await service.fetchRelayList('bob')

    expect(list.map(r => r.url)).toEqual(['wss://bob-write.example/'])
    expect(poolQuerySync).toHaveBeenCalledTimes(2)
    // Second call targeted our own relays, not discovery.
    const [relays] = poolQuerySync.mock.calls[1]
    expect(relays).toContain('wss://my-relay.example')
  })

  it('picks the newest event when multiple relays return competing lists', async () => {
    poolQuerySync.mockResolvedValueOnce([
      { ...kind10002Event({ pubkey: 'carol', relays: [{ url: 'wss://old.example', read: true, write: true }] }), created_at: 1600000000 },
      { ...kind10002Event({ pubkey: 'carol', relays: [{ url: 'wss://new.example', read: true, write: true }] }), created_at: 1700000000 },
    ])

    const service = await freshService()
    const list = await service.fetchRelayList('carol')
    expect(list.map(r => r.url)).toEqual(['wss://new.example/'])
  })

  it('normalizes relay URLs in the parsed output', async () => {
    poolQuerySync.mockResolvedValueOnce([
      kind10002Event({
        pubkey: 'dave',
        relays: [{ url: 'wss://Dave.Example/', read: true, write: true }],
      }),
    ])

    const service = await freshService()
    const list = await service.fetchRelayList('dave')
    // nostr-core normalizeURL: lowercases host; preserves the root "/"
    // path (it's the canonical URL path — stripping it would corrupt
    // relays that disambiguate by path).
    expect(list[0].url).toBe('wss://dave.example/')
  })

  it('returns empty array and caches miss when no relay list exists anywhere', async () => {
    poolQuerySync.mockResolvedValue([]) // both tiers empty

    const service = await freshService()
    const list = await service.fetchRelayList('eve')
    expect(list).toEqual([])

    // Subsequent call hits cache (miss still counts as cached).
    poolQuerySync.mockClear()
    const again = await service.fetchRelayList('eve')
    expect(again).toEqual([])
    expect(poolQuerySync).not.toHaveBeenCalled()
  })
})

// ── _buildOutboxRoute ───────────────────────────────────────────

describe('NostrService._buildOutboxRoute', () => {
  it('partitions authors by their write relays', async () => {
    poolQuerySync.mockImplementation((_relays, filter) => {
      const pk = filter.authors[0]
      if (pk === 'alice') {
        return Promise.resolve([kind10002Event({
          pubkey: 'alice',
          relays: [{ url: 'wss://relay-a.example', read: false, write: true }],
        })])
      }
      if (pk === 'bob') {
        return Promise.resolve([kind10002Event({
          pubkey: 'bob',
          relays: [
            { url: 'wss://relay-a.example', read: false, write: true },
            { url: 'wss://relay-b.example', read: false, write: true },
          ],
        })])
      }
      return Promise.resolve([])
    })

    const service = await freshService()
    const { routeMap, unrouted } = await service._buildOutboxRoute(['alice', 'bob'])

    expect(unrouted).toEqual([])
    expect(routeMap.get('wss://relay-a.example/')).toEqual(new Set(['alice', 'bob']))
    expect(routeMap.get('wss://relay-b.example/')).toEqual(new Set(['bob']))
  })

  it('ranks relays by author coverage and caps at OUTBOX_MAX_RELAYS_GLOBAL', async () => {
    // 20 authors, each on a distinct single relay + 1 shared relay. The
    // shared relay covers all 20; each unique relay covers 1. After
    // capping at 12, the shared one must be kept.
    const sharedRelay = 'wss://shared.example/'
    poolQuerySync.mockImplementation((_relays, filter) => {
      const pk = filter.authors[0]
      return Promise.resolve([kind10002Event({
        pubkey: pk,
        // raw URLs — safeNormalizeURL is applied inside fetchRelayList.
        relays: [
          { url: 'wss://shared.example', read: false, write: true },
          { url: `wss://uniq-${pk}.example`, read: false, write: true },
        ],
      })])
    })

    const service = await freshService()
    const authors = Array.from({ length: 20 }, (_, i) => `pk${i}`)
    const { routeMap } = await service._buildOutboxRoute(authors)

    // At most 12 relays in the route.
    expect(routeMap.size).toBeLessThanOrEqual(12)
    // Highest-coverage relay must be included.
    expect(routeMap.has(sharedRelay)).toBe(true)
  })

  it('surfaces authors with no NIP-65 list in unrouted', async () => {
    poolQuerySync.mockResolvedValue([]) // nobody has a list

    const service = await freshService()
    const { routeMap, unrouted } = await service._buildOutboxRoute(['lonely'])

    expect(routeMap.size).toBe(0)
    expect(unrouted).toEqual(['lonely'])
  })

  it('dedupes the input pubkey list', async () => {
    poolQuerySync.mockResolvedValue([kind10002Event({
      pubkey: 'alice',
      relays: [{ url: 'wss://a.example', read: false, write: true }],
    })])

    const service = await freshService()
    await service._buildOutboxRoute(['alice', 'alice', 'alice'])
    // Should only fetch alice's list once (CacheEntry dedups inflight),
    // and the querySync call count should reflect at most one lookup.
    expect(poolQuerySync).toHaveBeenCalledTimes(1)
  })
})

// ── buildOwnRelayListTemplate ───────────────────────────────────

// ── subscribeOutbox reconnect semantics ─────────────────────────

describe('NostrService.subscribeOutbox reconnect', () => {
  it('registers with the subscription registry so reconnect can re-open it', async () => {
    poolQuerySync.mockResolvedValue([kind10002Event({
      pubkey: 'alice',
      relays: [{ url: 'wss://alice-write.example', read: false, write: true }],
    })])

    const service = await freshService()
    const sub = service.subscribeOutbox(
      [{ kinds: [1], authors: ['alice'] }],
      { onevent: vi.fn() }
    )

    // Resolve routes.
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    // Should have one registered outbox entry.
    expect(service._subscriptionRegistry.size).toBe(1)
    const entry = Array.from(service._subscriptionRegistry.values())[0]
    expect(entry.type).toBe('outbox')
    expect(entry.closed).toBe(false)

    sub.close()
    expect(service._subscriptionRegistry.size).toBe(0)
  })

  it('close() prevents re-opens during reconnect', async () => {
    poolQuerySync.mockResolvedValue([kind10002Event({
      pubkey: 'alice',
      relays: [{ url: 'wss://alice-write.example', read: false, write: true }],
    })])

    const service = await freshService()
    const sub = service.subscribeOutbox(
      [{ kinds: [1], authors: ['alice'] }],
      { onevent: vi.fn() }
    )
    sub.close()

    // _reopenSubscriptions should skip / remove closed entries.
    service.relayStatuses.set('wss://my-relay.example', {
      url: 'wss://my-relay.example', status: 'connected',
      config: { read: true, write: true },
    })
    service._reopenSubscriptions()
    expect(service._subscriptionRegistry.size).toBe(0)
  })

  it('fires onclose when every route fails to open', async () => {
    // Route resolution OK — one author with one relay.
    poolQuerySync.mockResolvedValue([kind10002Event({
      pubkey: 'alice',
      relays: [{ url: 'wss://alice-write.example', read: false, write: true }],
    })])

    // But pool.subscribe throws for every route.
    poolSubscribe.mockImplementation(() => { throw new Error('relay rejected') })

    const service = await freshService()
    const onclose = vi.fn()
    const sub = service.subscribeOutbox(
      [{ kinds: [1], authors: ['alice'] }],
      { onevent: vi.fn(), onclose }
    )

    // Let the async setup run to completion.
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    expect(onclose).toHaveBeenCalled()
    expect(onclose.mock.calls[0][0]).toMatch(/no outbox routes/i)

    sub.close()
  })

  it('persisted `seen` Set dedupes events across reconnect replays', async () => {
    // One author with one write relay — stable route across reopens.
    poolQuerySync.mockResolvedValue([kind10002Event({
      pubkey: 'alice',
      relays: [{ url: 'wss://alice-write.example', read: false, write: true }],
    })])

    // Capture the subscription's event handler so we can replay events.
    let capturedHandler = null
    poolSubscribe.mockImplementation((_relays, _filter, cbs) => {
      capturedHandler = cbs.onevent
      return { close: vi.fn() }
    })

    const service = await freshService()
    const onevent = vi.fn()
    const sub = service.subscribeOutbox(
      [{ kinds: [1], authors: ['alice'] }],
      { onevent }
    )
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    // First event arrives.
    capturedHandler({ id: 'evt-1', pubkey: 'alice', kind: 1 })
    expect(onevent).toHaveBeenCalledTimes(1)

    // Simulate a reconnect — _openOutboxEntry is re-run for the registered entry.
    const entry = Array.from(service._subscriptionRegistry.values())[0]
    await service._openOutboxEntry(entry)

    // Reconnected relay replays the same event from history.
    capturedHandler({ id: 'evt-1', pubkey: 'alice', kind: 1 })

    // Consumer only sees it ONCE, thanks to the persisted seen Set.
    expect(onevent).toHaveBeenCalledTimes(1)

    // A genuinely new event still reaches the consumer.
    capturedHandler({ id: 'evt-2', pubkey: 'alice', kind: 1 })
    expect(onevent).toHaveBeenCalledTimes(2)

    sub.close()
  })
})

describe('NostrService.buildOwnRelayListTemplate', () => {
  it('produces a kind:10002 template from connected relays', async () => {
    const service = await freshService()
    service.relayStatuses.set('wss://my-read.example', {
      url: 'wss://my-read.example', status: 'connected',
      config: { read: true, write: false },
    })
    service.relayStatuses.set('wss://my-write.example', {
      url: 'wss://my-write.example', status: 'connected',
      config: { read: false, write: true },
    })

    const tmpl = service.buildOwnRelayListTemplate()
    expect(tmpl).not.toBeNull()
    expect(tmpl.kind).toBe(10002)
    // Each connected relay should appear as an 'r' tag.
    const urls = tmpl.tags.filter(t => t[0] === 'r').map(t => t[1])
    expect(urls).toEqual(expect.arrayContaining([
      'wss://my-read.example/', 'wss://my-write.example/',
    ]))
  })

  it('returns null when nothing is connected', async () => {
    const service = await freshService()
    expect(service.buildOwnRelayListTemplate()).toBeNull()
  })
})
