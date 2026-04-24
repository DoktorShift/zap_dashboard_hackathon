import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Offline-first queue contract:
 * - When navigator.onLine === false, signAndPublish does NOT hit relays;
 *   it queues the signed event and returns a synthetic offline result.
 * - When a publish throws a network-shaped error on the first attempt,
 *   the service pivots to the offline path instead of burning retries.
 * - On the `online` window event, drainPending retries each queued entry.
 * - Queue is persisted to storageService (best-effort) and re-hydrated
 *   at construction time.
 */

const { mockPublish, mockPublishInbox, mockSignEvent, mockVerifyEvent } = vi.hoisted(() => ({
  mockPublish: vi.fn(),
  mockPublishInbox: vi.fn(),
  mockSignEvent: vi.fn((t) => ({ ...t, id: 'signed-' + (t.content || 'x'), sig: 's', pubkey: 'pk' })),
  mockVerifyEvent: vi.fn(() => true),
}))

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: { publish: mockPublish, publishInbox: mockPublishInbox },
}))
vi.mock('../../src/services/nostr/SignerService.js', () => ({
  signerService: { signEvent: mockSignEvent },
}))
vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  verifyEvent: mockVerifyEvent,
}))

// Real-enough localStorage so hydration/persist paths exercise the
// storageService for real.
function installLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial))
  const mock = {
    get length() { return store.size },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    clear: () => { store.clear() },
    _dump: () => Object.fromEntries(store),
  }
  vi.stubGlobal('localStorage', mock)
  return mock
}

async function fresh() {
  vi.resetModules()
  const mod = await import('../../src/services/nostr/PublishService.js')
  return mod.publishService
}

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

beforeEach(() => {
  mockPublish.mockReset()
  mockPublishInbox.mockReset()
  mockVerifyEvent.mockReset().mockReturnValue(true)
  installLocalStorage()
  setOnline(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Leave navigator.onLine alone — it's on the real object.
})

describe('PublishService offline queue', () => {
  it('queues instead of publishing when navigator.onLine is false', async () => {
    setOnline(false)
    const svc = await fresh()

    const { event, result } = await svc.signAndPublish({ kind: 1, content: 'subway tweet', tags: [] })

    expect(mockPublish).not.toHaveBeenCalled()
    expect(result.offline).toBe(true)
    expect(result.successful).toBe(0)
    expect(svc.getPending()).toHaveLength(1)
    expect(svc.getPending()[0].offline).toBe(true)
    expect(event.id).toBeDefined()
  })

  it('pivots to queue on first-attempt network-shaped error', async () => {
    mockPublish.mockRejectedValueOnce(new Error('failed to fetch'))
    const svc = await fresh()

    const { result } = await svc.signAndPublish(
      { kind: 1, content: 'online but flaky', tags: [] },
      { retries: 3 }
    )

    // Only ONE attempt — the rest got short-circuited because the
    // error looked like an offline condition.
    expect(mockPublish).toHaveBeenCalledTimes(1)
    expect(result.offline).toBe(true)
    expect(svc.getPending()).toHaveLength(1)
    expect(svc.getPending()[0].offline).toBe(true)
  })

  it('still retries on real publish failures (not network-shaped)', async () => {
    // "Invalid event" is a semantic error, not offline — must retry.
    mockPublish.mockRejectedValue(new Error('relay rejected: invalid sig'))
    const svc = await fresh()

    await expect(
      svc.signAndPublish({ kind: 1, content: 'bad', tags: [] }, { retries: 1 })
    ).rejects.toThrow()

    // retries=1 → 2 attempts total.
    expect(mockPublish).toHaveBeenCalledTimes(2)
    // Queued as a retry-exhausted entry, NOT offline-flagged.
    const pending = svc.getPending()
    expect(pending).toHaveLength(1)
    expect(pending[0].offline).toBe(false)
  }, 30_000)

  it('drainPending retries each entry sequentially', async () => {
    setOnline(false)
    const svc = await fresh()

    await svc.signAndPublish({ kind: 1, content: 'a', tags: [] })
    await svc.signAndPublish({ kind: 1, content: 'b', tags: [] })
    expect(svc.getPending()).toHaveLength(2)

    // Back online + drain → both publish.
    setOnline(true)
    mockPublish.mockResolvedValue({ successful: 1, failed: 0, total: 1 })
    await svc.drainPending()

    expect(mockPublish).toHaveBeenCalledTimes(2)
    expect(svc.getPending()).toHaveLength(0)
  })

  it('drainPending keeps entries that still fail', async () => {
    setOnline(false)
    const svc = await fresh()
    await svc.signAndPublish({ kind: 1, content: 'stubborn', tags: [] })

    setOnline(true)
    // Fail ALL attempts — retry exhausts without success.
    mockPublish.mockRejectedValue(new Error('relay rejected: too old'))
    await svc.drainPending()

    // Still in queue. Entry flipped from offline:true to offline:false
    // because the drain attempted a real publish that failed semantically.
    expect(svc.getPending()).toHaveLength(1)
  }, 30_000)

  it('persists offline-flagged entries and re-hydrates on construction', async () => {
    setOnline(false)
    const svc1 = await fresh()
    await svc1.signAndPublish({ kind: 1, content: 'persistent', tags: [] })
    expect(svc1.getPending()).toHaveLength(1)

    // The key was persisted to localStorage. Creating a fresh service
    // instance (simulates page reload) should rehydrate the entry.
    expect(localStorage.getItem('publishOfflineQueue')).not.toBeNull()

    const svc2 = await fresh()
    expect(svc2.getPending()).toHaveLength(1)
    expect(svc2.getPending()[0].offline).toBe(true)
  })

  it('does not persist retry-exhausted (non-offline) entries', async () => {
    mockPublish.mockRejectedValue(new Error('relay rejected'))
    const svc = await fresh()

    await expect(
      svc.signAndPublish({ kind: 1, content: 'x', tags: [] }, { retries: 1 })
    ).rejects.toThrow()

    expect(svc.getPending()).toHaveLength(1)
    // Session-local only — should NOT be written to the offline key.
    expect(localStorage.getItem('publishOfflineQueue')).toBeNull()
  }, 30_000)

  it('drops corrupt stored entries on hydration', async () => {
    localStorage.setItem('publishOfflineQueue', '{not-json')
    const svc = await fresh()
    // Didn't crash, didn't load anything.
    expect(svc.getPending()).toHaveLength(0)
  })

  it('removes the storage key when the queue drains empty', async () => {
    setOnline(false)
    const svc = await fresh()
    await svc.signAndPublish({ kind: 1, content: 'a', tags: [] })
    expect(localStorage.getItem('publishOfflineQueue')).not.toBeNull()

    setOnline(true)
    mockPublish.mockResolvedValue({ successful: 1, failed: 0, total: 1 })
    await svc.drainPending()
    expect(localStorage.getItem('publishOfflineQueue')).toBeNull()
  })
})
