/**
 * CacheManager — centralized cache with namespaces, TTL, LRU eviction,
 * and optional localStorage persistence for cold-start paint.
 *
 * Persistent namespaces (profiles, contacts, relayLists, dmInbox) are
 * hydrated synchronously from StorageService at construction time and
 * written back on set() with a 2s debounce. On schema bumps (CACHE_VERSION
 * changes) all persistent namespaces are flushed.
 *
 * Non-persistent namespaces (events, search, badges) remain in-memory only —
 * they churn too fast to justify localStorage I/O.
 */

import {
  EVENT_CACHE_TTL, EVENT_CACHE_MAX,
  PROFILE_CACHE_TTL, PROFILE_CACHE_MAX,
  OUTBOX_RELAY_LIST_TTL, OUTBOX_DM_INBOX_TTL,
  CACHE_VERSION, CACHE_PERSIST_DEBOUNCE,
} from '../../utils/constants.js'

// ── Namespace configs ─────────────────────────────────────────────
// `persistent: true` → hydrated from localStorage on boot, written back debounced.
const NAMESPACE_DEFAULTS = {
  events:     { maxEntries: EVENT_CACHE_MAX,   ttl: EVENT_CACHE_TTL,        persistent: false },
  profiles:   { maxEntries: PROFILE_CACHE_MAX, ttl: PROFILE_CACHE_TTL,      persistent: true  },
  contacts:   { maxEntries: 500,               ttl: 5 * 60 * 1000,          persistent: true  },
  search:     { maxEntries: 200,               ttl: 2 * 60 * 1000,          persistent: false },
  badges:     { maxEntries: 500,               ttl: 10 * 60 * 1000,         persistent: false },
  relayLists: { maxEntries: 2_000,             ttl: OUTBOX_RELAY_LIST_TTL,  persistent: true  },
  dmInbox:    { maxEntries: 2_000,             ttl: OUTBOX_DM_INBOX_TTL,    persistent: true  },
  // Snapshots for cold-start cached paint (7d TTL — live subs refresh content
  // immediately after hydration, the snapshot is just the "seed" for the UI).
  snapshots:  { maxEntries: 50,                ttl: 7 * 24 * 60 * 60 * 1000, persistent: true },
}

const STORAGE_PREFIX = 'zt_cache:v' + CACHE_VERSION + ':'
const VERSION_KEY = 'zt_cache:version'

class CacheManager {
  constructor() {
    /** @type {Map<string, Map<string, object>>} namespace → entries */
    this._namespaces = new Map()
    /** @type {Map<string, number>} namespace → debounce timer id */
    this._persistTimers = new Map()

    this._checkVersion()

    for (const ns of Object.keys(NAMESPACE_DEFAULTS)) {
      const store = new Map()
      this._namespaces.set(ns, store)
      if (NAMESPACE_DEFAULTS[ns].persistent) {
        this._hydrate(ns, store)
      }
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  get(namespace, key) {
    const store = this._getStore(namespace)
    const entry = store.get(key)
    if (!entry) return undefined

    const ttl = entry.ttl ?? this._getTtl(namespace)
    if (Date.now() - entry.createdAt > ttl) {
      store.delete(key)
      this._schedulePersist(namespace)
      return undefined
    }

    entry.lastAccessed = Date.now()
    return entry.value
  }

  set(namespace, key, value, ttl) {
    const store = this._getStore(namespace)

    store.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      ...(ttl !== undefined ? { ttl } : {}),
    })

    this._evictIfNeeded(namespace)
    this._schedulePersist(namespace)
  }

  has(namespace, key) {
    return this.get(namespace, key) !== undefined
  }

  invalidate(namespace, key) {
    const store = this._getStore(namespace)
    if (store.delete(key)) this._schedulePersist(namespace)
  }

  clear(namespace) {
    if (namespace) {
      const store = this._namespaces.get(namespace)
      if (store) {
        store.clear()
        this._persistNow(namespace)
      }
    } else {
      for (const [ns, store] of this._namespaces) {
        store.clear()
        this._persistNow(ns)
      }
    }
  }

  stats() {
    const result = {}
    for (const [ns, store] of this._namespaces) {
      const config = NAMESPACE_DEFAULTS[ns] || {}
      result[ns] = {
        entries: store.size,
        maxEntries: config.maxEntries || 500,
        ttl: config.ttl || 60_000,
        persistent: !!config.persistent,
      }
    }
    return result
  }

  // ── Persistence ─────────────────────────────────────────────────

  _checkVersion() {
    if (typeof localStorage === 'undefined') return
    try {
      const stored = localStorage.getItem(VERSION_KEY)
      const current = String(CACHE_VERSION)
      if (stored !== current) {
        // Schema bump — wipe all prefixed entries.
        const toRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith('zt_cache:')) toRemove.push(k)
        }
        toRemove.forEach(k => localStorage.removeItem(k))
        localStorage.setItem(VERSION_KEY, current)
      }
    } catch {
      // localStorage unavailable (private mode, quota) — fall back to memory only.
    }
  }

  _storageKey(namespace) {
    return STORAGE_PREFIX + namespace
  }

  _hydrate(namespace, store) {
    if (typeof localStorage === 'undefined') return
    let raw
    try {
      raw = localStorage.getItem(this._storageKey(namespace))
      if (!raw) return
    } catch {
      return
    }

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Corrupt entry — drop it.
      try { localStorage.removeItem(this._storageKey(namespace)) } catch {}
      return
    }

    if (!parsed || !Array.isArray(parsed.entries)) return

    const ttl = this._getTtl(namespace)
    const now = Date.now()
    let loaded = 0
    for (const [key, entry] of parsed.entries) {
      if (!entry || typeof entry.createdAt !== 'number') continue
      const entryTtl = entry.ttl ?? ttl
      if (now - entry.createdAt > entryTtl) continue
      store.set(key, entry)
      loaded++
    }

    // Prune if hydration exceeded maxEntries (boot-time consistency).
    const max = this._getMaxEntries(namespace)
    if (store.size > max) this._evict(namespace, store.size - max)

    if (loaded > 0) {
      // eslint-disable-next-line no-console
      console.debug(`[CacheManager] Hydrated ${loaded} entries for "${namespace}"`)
    }
  }

  _schedulePersist(namespace) {
    const config = NAMESPACE_DEFAULTS[namespace]
    if (!config?.persistent) return
    if (typeof localStorage === 'undefined') return

    const existing = this._persistTimers.get(namespace)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this._persistTimers.delete(namespace)
      this._persistNow(namespace)
    }, CACHE_PERSIST_DEBOUNCE)
    this._persistTimers.set(namespace, timer)
  }

  _persistNow(namespace) {
    const config = NAMESPACE_DEFAULTS[namespace]
    if (!config?.persistent) return
    if (typeof localStorage === 'undefined') return

    const store = this._namespaces.get(namespace)
    if (!store) return

    // Serialize as [[key, entry], ...]. Entry is already a plain object.
    const payload = { entries: Array.from(store.entries()) }
    try {
      localStorage.setItem(this._storageKey(namespace), JSON.stringify(payload))
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        // Quota hit — aggressively evict half the namespace and retry once.
        this._evict(namespace, Math.ceil(store.size / 2))
        try {
          localStorage.setItem(
            this._storageKey(namespace),
            JSON.stringify({ entries: Array.from(store.entries()) })
          )
        } catch {
          // Give up — leave memory cache working, persistent layer is best-effort.
        }
      }
    }
  }

  /** Force all pending debounced writes (call on logout/reset). */
  flushPersist() {
    for (const [ns, timer] of this._persistTimers) {
      clearTimeout(timer)
      this._persistNow(ns)
    }
    this._persistTimers.clear()
  }

  // ── Internals ───────────────────────────────────────────────────

  _getStore(namespace) {
    let store = this._namespaces.get(namespace)
    if (!store) {
      store = new Map()
      this._namespaces.set(namespace, store)
    }
    return store
  }

  _getTtl(namespace) {
    return NAMESPACE_DEFAULTS[namespace]?.ttl ?? 60_000
  }

  _getMaxEntries(namespace) {
    return NAMESPACE_DEFAULTS[namespace]?.maxEntries ?? 500
  }

  _evictIfNeeded(namespace) {
    const store = this._getStore(namespace)
    const max = this._getMaxEntries(namespace)
    if (store.size <= max) return
    this._evict(namespace, Math.max(1, Math.ceil(max * 0.2)))
  }

  _evict(namespace, count) {
    const store = this._getStore(namespace)
    const entries = Array.from(store.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    for (let i = 0; i < count && i < entries.length; i++) {
      store.delete(entries[i][0])
    }
  }
}

// Singleton
export const cacheManager = new CacheManager()

// Flush on pagehide so in-flight debounced writes aren't lost.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => cacheManager.flushPersist())
}
