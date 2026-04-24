import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * CacheManager persistence round-trip: writes to localStorage under
 * a versioned prefix and hydrates on instantiation. Non-persistent
 * namespaces (events, search, badges) stay memory-only.
 */

// Stub localStorage so each test gets a clean slate.
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

async function freshCacheManager() {
  // Re-import so the module-level singleton re-runs its constructor
  // against the current localStorage mock.
  vi.resetModules()
  const mod = await import('../../src/services/nostr/CacheManager.js')
  return mod.cacheManager
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1700000000000 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CacheManager persistence', () => {
  it('writes persistent namespaces to localStorage after debounce', async () => {
    const ls = installLocalStorage()
    const cm = await freshCacheManager()

    cm.set('profiles', 'pk1', { value: { name: 'Alice' }, _forTest: true })

    // Not written yet — debounced.
    expect(ls.getItem('zt_cache:v1:profiles')).toBeNull()

    // Flush the debounce window.
    await vi.advanceTimersByTimeAsync(3_000)

    const raw = ls.getItem('zt_cache:v1:profiles')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw)
    expect(parsed.entries[0][0]).toBe('pk1')
  })

  it('hydrates persistent namespaces on construction', async () => {
    const now = Date.now()
    const payload = {
      entries: [
        ['pk1', { value: { name: 'Alice' }, createdAt: now, lastAccessed: now }],
      ],
    }
    installLocalStorage({
      'zt_cache:version': '1',
      'zt_cache:v1:profiles': JSON.stringify(payload),
    })

    const cm = await freshCacheManager()
    expect(cm.get('profiles', 'pk1')).toEqual({ name: 'Alice' })
  })

  it('drops expired entries during hydration', async () => {
    const longAgo = Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days
    installLocalStorage({
      'zt_cache:version': '1',
      'zt_cache:v1:contacts': JSON.stringify({
        entries: [
          ['pk-expired', { value: ['x'], createdAt: longAgo, lastAccessed: longAgo }],
        ],
      }),
    })

    const cm = await freshCacheManager()
    expect(cm.get('contacts', 'pk-expired')).toBeUndefined()
  })

  it('wipes cache on CACHE_VERSION mismatch', async () => {
    installLocalStorage({
      'zt_cache:version': '0', // stale version
      'zt_cache:v0:profiles': JSON.stringify({ entries: [['pk1', { value: {} }]] }),
      'zt_cache:v1:profiles': JSON.stringify({
        entries: [['pk1', { value: { name: 'Alice' }, createdAt: Date.now(), lastAccessed: Date.now() }]],
      }),
    })

    await freshCacheManager()
    // version bumped
    expect(localStorage.getItem('zt_cache:version')).toBe('1')
    // old-version keys wiped
    expect(localStorage.getItem('zt_cache:v0:profiles')).toBeNull()
  })

  it('does NOT write non-persistent namespaces to localStorage', async () => {
    const ls = installLocalStorage()
    const cm = await freshCacheManager()

    cm.set('events', 'filter-key', { some: 'event' })
    await vi.advanceTimersByTimeAsync(3_000)

    expect(ls.getItem('zt_cache:v1:events')).toBeNull()
  })

  it('recovers from corrupt localStorage payload without throwing', async () => {
    installLocalStorage({
      'zt_cache:version': '1',
      'zt_cache:v1:profiles': '{not valid json',
    })

    const cm = await freshCacheManager()
    // still usable
    cm.set('profiles', 'pk1', { name: 'Bob' })
    expect(cm.get('profiles', 'pk1')).toEqual({ name: 'Bob' })
  })

  it('persistNow removes flushed timer and writes immediately on clear', async () => {
    const ls = installLocalStorage()
    const cm = await freshCacheManager()

    cm.set('contacts', 'pk1', ['a', 'b'])
    cm.clear('contacts')

    // Clear issues an immediate persist — no debounce wait needed.
    const raw = ls.getItem('zt_cache:v1:contacts')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw)
    expect(parsed.entries).toEqual([])
  })
})
