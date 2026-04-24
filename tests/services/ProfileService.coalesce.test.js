import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Multi-key coalescing: overlapping concurrent batches share in-flight
 * promises per-pubkey instead of re-querying.
 */

const { mockQueryOutbox } = vi.hoisted(() => ({ mockQueryOutbox: vi.fn() }))

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: { queryOutbox: mockQueryOutbox },
}))

// Use a mock localStorage so cache doesn't bleed between tests.
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
  const mod = await import('../../src/services/nostr/ProfileService.js')
  return mod.profileService
}

function profileEvent(pubkey, name) {
  return {
    id: 'p-' + pubkey,
    kind: 0,
    pubkey,
    created_at: 1700000000,
    tags: [],
    content: JSON.stringify({ name }),
    sig: 'sig',
  }
}

const PK_A = 'a'.repeat(64)
const PK_B = 'b'.repeat(64)
const PK_C = 'c'.repeat(64)
const PK_D = 'd'.repeat(64)

beforeEach(() => {
  mockQueryOutbox.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProfileService.batch coalescing', () => {
  it('overlapping concurrent batches fetch each pubkey only once', async () => {
    // Gate the queryOutbox resolution so we can observe that both callers
    // share the same in-flight promise.
    let release
    const pending = new Promise(r => { release = r })
    mockQueryOutbox.mockImplementation(async (filters) => {
      await pending
      const authors = filters[0].authors
      return authors.map(pk => profileEvent(pk, `name-${pk}`))
    })

    const service = await freshService()
    const p1 = service.batch([PK_A, PK_B, PK_C])
    const p2 = service.batch([PK_B, PK_C, PK_D])

    // Let microtasks run so p2 can observe p1's in-flight registrations.
    await Promise.resolve()
    await Promise.resolve()

    release()
    const [n1, n2] = await Promise.all([p1, p2])

    // queryOutbox called twice total: once for p1's [A,B,C], once for p2's
    // truly-missing [D] only (B and C came from p1's in-flight promises).
    expect(mockQueryOutbox).toHaveBeenCalledTimes(2)
    const firstCallAuthors = mockQueryOutbox.mock.calls[0][0][0].authors.sort()
    const secondCallAuthors = mockQueryOutbox.mock.calls[1][0][0].authors.sort()
    expect(firstCallAuthors).toEqual([PK_A, PK_B, PK_C])
    expect(secondCallAuthors).toEqual([PK_D])

    expect(n1).toBe(3)
    expect(n2).toBe(1)
  })

  it('subsequent call skips keys already cached', async () => {
    mockQueryOutbox.mockResolvedValueOnce([profileEvent(PK_A, 'Alice')])

    const service = await freshService()
    const n1 = await service.batch([PK_A])
    expect(n1).toBe(1)

    // Second call for same pubkey — cache hit, no network.
    mockQueryOutbox.mockClear()
    const n2 = await service.batch([PK_A])
    expect(n2).toBe(0)
    expect(mockQueryOutbox).not.toHaveBeenCalled()
  })

  it('marks unfound pubkeys as miss so they do not thrash the network', async () => {
    mockQueryOutbox.mockResolvedValueOnce([profileEvent(PK_A, 'Alice')]) // only Alice

    const service = await freshService()
    await service.batch([PK_A, PK_B])

    // Alice = hit, Bob = miss. A second batch for Bob should NOT requery.
    mockQueryOutbox.mockClear()
    await service.batch([PK_B])
    expect(mockQueryOutbox).not.toHaveBeenCalled()
  })

  it('dedupes repeated pubkeys within a single call', async () => {
    mockQueryOutbox.mockResolvedValueOnce([profileEvent(PK_A, 'Alice')])

    const service = await freshService()
    await service.batch([PK_A, PK_A, PK_A])

    const authors = mockQueryOutbox.mock.calls[0][0][0].authors
    expect(authors).toEqual([PK_A])
  })

  it('ignores malformed pubkeys without crashing', async () => {
    mockQueryOutbox.mockResolvedValueOnce([])

    const service = await freshService()
    const n = await service.batch(['short', null, undefined, 42, PK_A])
    // Only PK_A is valid; it missed; no throws.
    expect(n).toBe(0)
  })
})
