/**
 * NostrService — network abstraction layer powered by nostr-core RelayPool.
 *
 * This is the ONLY file that touches the relay/pool layer.
 * All composables import from here instead of nostrRelayManager.
 *
 * Manages: relay connections, health checks, backoff, subscription
 * concurrency, event caching, publishing, and event listeners.
 */

import { RelayPool, verifyEvent, nip11, nip65, normalizeURL } from './nostrImports.js'
import { cacheManager } from './CacheManager.js'
import { fetchWithCache, isCacheEntry, unwrap } from './CacheEntry.js'
import { SubscriptionBroker } from './SubscriptionBroker.js'
import {
  RELAY_CONNECTION_TIMEOUT, RELAY_MAX_RETRIES, RELAY_RETRY_DELAY,
  RELAY_HEALTH_CHECK_INTERVAL, RELAY_HEALTH_CHECK_TIMEOUT, RELAY_MAX_BACKOFF,
  DEFERRED_SUB_TIMEOUT, PUBLISH_TIMEOUT,
  DEFAULT_RELAY_CONFIGS, MAX_CONCURRENT_SUBS,
  SUBSCRIBE_TIMEOUT, SUBSCRIBE_EOSE_GRACE,
  OUTBOX_RELAY_LIST_TTL, OUTBOX_MAX_RELAYS_PER_PUBKEY,
  OUTBOX_MAX_RELAYS_GLOBAL, OUTBOX_DM_INBOX_TTL,
  DISCOVERY_RELAYS, RELAY_INFO_TTL,
} from '../../utils/constants.js'

/**
 * Safe URL normalization — trims, lowercases host, removes trailing slash,
 * ensures wss:// scheme. Falls back to the raw input on parse error so we
 * don't lose a relay just because nostr-core is strict.
 */
function safeNormalizeURL(url) {
  if (!url || typeof url !== 'string') return url
  try {
    return normalizeURL(url.trim())
  } catch {
    return url.trim()
  }
}

/**
 * Deterministic cache key from a filter object.
 */
function stableCacheKey(filter) {
  return JSON.stringify(filter, Object.keys(filter).sort())
}

class NostrService {
  constructor() {
    this.pool = new RelayPool()
    this._initialized = false
    this._eventListeners = new Set()
    this._createReadyGate()

    // Relay metadata
    this.relayConnections = new Map()   // url → { url, config, connectedAt }
    this.relayStatuses = new Map()      // url → { url, status, config, error, ... }
    this._connectionPromises = new Map() // url → Promise (dedup concurrent connects)
    this.defaultRelays = DEFAULT_RELAY_CONFIGS

    // Health checks
    this._healthCheckTimer = null

    // Backoff tracking
    this._relayBackoff = new Map() // url → { backoffMs, lastFail }

    // Subscription concurrency
    this._activeSubscriptions = new Set()
    this._subscriptionQueue = []

    // Subscription registry — tracks live subscriptions for re-open on reconnect
    // Map<id, { filters, callbacks, options, sub, closed }>
    this._subscriptionRegistry = new Map()
    this._subIdCounter = 0

    // Outbox model: NIP-65 relay list + NIP-17 DM inbox caches now live in
    // cacheManager ('relayLists' / 'dmInbox' namespaces) so they persist
    // across reloads. See CacheManager.js NAMESPACE_DEFAULTS.

    // NIP-11 relay info cache (short-lived, memory only)
    // url → { info: RelayInfo, fetchedAt: timestamp }
    this._relayInfoCache = new Map()

    // Filter-level subscription brokers — one for plain subscribe, one
    // for subscribeOutbox. Both dedupe identical concurrent filter sets
    // into ONE upstream sub with handler fan-out. Two brokers (not one)
    // because the backends are different: plain subscribe uses our read
    // pool, outbox subscribe does per-author route resolution. A single
    // broker keyed on filters alone would conflate them and serve the
    // wrong relay set.
    //
    // Each "backend" is an object that forwards to the real method so
    // the broker can't recurse back into the public API.
    this._broker = new SubscriptionBroker({
      subscribe: (filters, callbacks, options) =>
        this._realSubscribe(filters, callbacks, options),
    })
    this._outboxBroker = new SubscriptionBroker({
      subscribe: (filters, callbacks, options) =>
        this._realSubscribeOutbox(filters, callbacks, options),
    })
  }

  _createReadyGate() {
    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve, reject) => {
        this._readyResolve = resolve
        this._readyReject = reject
      })
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  async initialize(relays = []) {
    if (this._initialized) {
      console.warn('NostrService already initialized, use updateRelays()')
      return
    }

    try {
      const allRelays = this.mergeRelayLists(relays, this.defaultRelays)
      await this._connectToRelays(allRelays)
      this._startHealthCheck()

      this._initialized = true
      this._readyResolve()

      this.emit('initialized', {
        connectedRelays: this.getConnectedRelays().length,
        totalRelays: allRelays.length,
      })
    } catch (error) {
      this._readyReject(error)
      throw error
    }
  }

  ready() {
    if (this._initialized) return Promise.resolve()
    return this._readyPromise
  }

  get isInitialized() {
    return this._initialized
  }

  async updateRelays(newRelays = []) {
    if (!this._initialized) return this.initialize(newRelays)
    if (!newRelays?.length) return

    // Normalize both sides so `wss://Host/` and `wss://host/` don't
    // produce duplicate connections. Stored keys are already normalized
    // (mergeRelayLists / connectToRelay normalize on ingest).
    const existingUrls = new Set(this.relayConnections.keys())
    const toAdd = newRelays
      .map(r => ({ ...r, url: safeNormalizeURL(r.url) }))
      .filter(r => r.url && !existingUrls.has(r.url))
    if (toAdd.length === 0) return

    await this._connectToRelays(toAdd)
    this.emit('relaysUpdated', {
      addedRelays: toAdd.length,
      connectedRelays: this.getConnectedRelays().length,
    })
  }

  /**
   * Close all registered subscriptions without tearing down the service.
   * Use this on page navigation or when you want to stop all data flows.
   */
  closeAllSubscriptions() {
    for (const [id, entry] of this._subscriptionRegistry) {
      entry.closed = true
      for (const sub of entry.subs) {
        try { sub.close() } catch { /* ignore */ }
      }
    }
    this._subscriptionRegistry.clear()
    this._activeSubscriptions.clear()
    this._subscriptionQueue.length = 0
    this.emit('allSubscriptionsClosed', {})
  }

  /**
   * Get count of active subscriptions (for debugging/UI).
   */
  getActiveSubscriptionCount() {
    return this._subscriptionRegistry.size
  }

  async cleanup() {
    this._stopHealthCheck()
    this.closeAllSubscriptions()

    const allUrls = Array.from(this.relayStatuses.keys())
    if (allUrls.length > 0) {
      this.pool.close(allUrls)
    }

    this.relayConnections.clear()
    this.relayStatuses.clear()
    this._connectionPromises.clear()
    this._eventListeners.clear()
    this._relayBackoff.clear()
    this._relayInfoCache.clear()
    cacheManager.clear()

    this._initialized = false
    this._readyPromise = null
    this._readyResolve = null
    this._readyReject = null
    this._createReadyGate()
  }

  // ── Subscribe (streaming) ───────────────────────────────────────

  /**
   * Open a real-time subscription to events matching filters.
   * Supports deferred subscriptions (queued until ready), concurrency
   * control (max 20), and relay backoff.
   *
   * @param {Array<object>} filters — array of Nostr filter objects
   * @param {object} callbacks — { onevent, oneose?, onclose? }
   * @param {object} [options] — { maxWait }
   * @returns {{ close: Function }}
   */
  subscribe(filters, callbacks = {}, options = {}) {
    if (!this._initialized) {
      return this._deferSubscription(filters, callbacks, options)
    }

    const validFilters = this._validateFilters(filters)
    if (validFilters.length === 0) {
      return { close: () => {} }
    }

    // Route through the broker — identical filter sets from multiple
    // consumers fan out over a single upstream subscription.
    return this._broker.subscribe(validFilters, callbacks, options)
  }

  /**
   * The real subscribe path the broker delegates to. Keep the concurrency
   * gate + queue here so the broker's dedup happens BEFORE we consume a
   * concurrency slot (fewer real subs → fewer queue inserts).
   * @private
   */
  _realSubscribe(filters, callbacks, options) {
    if (this._activeSubscriptions.size >= MAX_CONCURRENT_SUBS) {
      return this._queueSubscription(filters, callbacks, options)
    }
    return this._openSubscription(filters, callbacks, options)
  }

  // ── Query (one-shot, promise-based) ─────────────────────────────

  /**
   * Collect events matching filters. Resolves after EOSE + grace period
   * or hard timeout — whichever comes first.
   *
   * @param {Array<object>} filters
   * @param {object} [opts]
   * @returns {Promise<Array>}
   */
  async query(filters, { timeout = SUBSCRIBE_TIMEOUT, eoseGrace = SUBSCRIBE_EOSE_GRACE, dedup = true } = {}) {
    await this.ready()

    return new Promise((resolve, reject) => {
      const events = []
      const seenIds = dedup ? new Set() : null
      let resolved = false

      const done = () => {
        if (resolved) return
        resolved = true
        clearTimeout(hardTimer)
        clearTimeout(graceTimer)
        try { sub?.close() } catch { /* ignore */ }
        resolve(events)
      }

      let graceTimer = null
      const hardTimer = setTimeout(done, timeout)

      let sub
      try {
        sub = this.subscribe(filters, {
          onevent: (event) => {
            if (resolved) return
            if (seenIds && seenIds.has(event.id)) return
            if (seenIds) seenIds.add(event.id)
            events.push(event)
          },
          oneose: () => {
            clearTimeout(hardTimer)
            graceTimer = setTimeout(done, eoseGrace)
          },
        })
      } catch (err) {
        clearTimeout(hardTimer)
        reject(err)
      }
    })
  }

  // ── QueryOne (single event, cached) ─────────────────────────────

  /**
   * Fetch a single event matching a filter. Uses centralized cache.
   *
   * @param {object} filter — single Nostr filter object
   * @returns {Promise<object|null>}
   */
  async queryOne(filter) {
    // Guard: legacy callers may pass an array
    if (Array.isArray(filter)) {
      filter = filter[0]
    }
    if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
      return null
    }

    await this.ready()

    const cacheKey = stableCacheKey(filter)
    const cached = cacheManager.get('events', cacheKey)
    if (cached !== undefined) return cached

    const readRelays = this._getHealthyReadRelayUrls()
    if (readRelays.length === 0) {
      // Return cached data if available, otherwise null — don't crash
      this.emit('noRelaysAvailable', { filter })
      return cached !== undefined ? cached : null
    }

    try {
      const events = await this.pool.querySync(readRelays, filter, { maxWait: 10_000 })
      const event = events?.[0] ?? null

      // Cache both hits and misses
      cacheManager.set('events', cacheKey, event)
      if (event) {
        readRelays.forEach(url => this._resetBackoff(url))
      }

      return event
    } catch (error) {
      readRelays.forEach(url => {
        if (error.message?.toLowerCase().includes('rate')) {
          this._markBackoff(url)
        }
      })
      throw error
    }
  }

  // ── Publish ─────────────────────────────────────────────────────

  /**
   * Publish an event to write-enabled relays.
   *
   * @param {object} event — signed Nostr event
   * @param {Array} [targetRelays] — specific relay objects to publish to
   * @returns {Promise<{successful: number, failed: number, total: number}>}
   */
  async publish(event, targetRelays = null) {
    await this.ready()

    if (!verifyEvent(event)) {
      throw new Error('Invalid event signature')
    }

    const relayUrls = targetRelays
      ? targetRelays.map(r => r.url || r)
      : this._getHealthyWriteRelayUrls()
    if (relayUrls.length === 0) {
      this.emit('noRelaysAvailable', { eventId: event.id })
      throw new Error('Cannot publish: no relays are connected. Check your internet connection and try again.')
    }

    let pubTimeoutId
    try {
      const publishPromise = this.pool.publish(relayUrls, event)
      const timeoutPromise = new Promise((_, reject) => {
        pubTimeoutId = setTimeout(() => reject(new Error('publish timed out')), PUBLISH_TIMEOUT)
      })

      const successfulUrls = await Promise.race([publishPromise, timeoutPromise])
      clearTimeout(pubTimeoutId)
      const successCount = successfulUrls?.length ?? 0
      const failCount = relayUrls.length - successCount

      this.emit('eventPublished', {
        eventId: event.id,
        successfulRelays: successCount,
        failedRelays: failCount,
        totalRelays: relayUrls.length,
      })

      return { successful: successCount, failed: failCount, total: relayUrls.length }
    } catch (error) {
      clearTimeout(pubTimeoutId)
      this.emit('publishFailed', { eventId: event.id, error: error.message })
      throw error
    }
  }

  // ── Relay Info ──────────────────────────────────────────────────

  getRelayStatuses() {
    return Array.from(this.relayStatuses.values())
  }

  getConnectedRelays() {
    return this.getRelayStatuses().filter(r => r.status === 'connected')
  }

  getWriteRelays() {
    return this.getConnectedRelays().filter(r => r.config?.write === true)
  }

  getReadRelays() {
    return this.getConnectedRelays().filter(r => r.config?.read === true)
  }

  getConnectionStats() {
    const statuses = this.getRelayStatuses()
    const connected = statuses.filter(r => r.status === 'connected').length
    const total = statuses.length
    return {
      total,
      connected,
      disconnected: total - connected,
      writeEnabled: this.getWriteRelays().length,
      readEnabled: this.getReadRelays().length,
      healthyPercentage: total > 0 ? Math.round((connected / total) * 100) : 0,
    }
  }

  /**
   * Get a health summary suitable for UI display.
   */
  getConnectionHealth() {
    const stats = this.getConnectionStats()
    const unhealthy = this.getRelayStatuses().filter(r => r.status === 'unhealthy')
    return {
      ...stats,
      status: stats.connected === 0 ? 'disconnected'
        : stats.healthyPercentage < 50 ? 'degraded'
        : 'healthy',
      unhealthyRelays: unhealthy.map(r => r.url),
    }
  }

  // ── Relay Management ────────────────────────────────────────────

  async addRelay(url, config = { read: true, write: true }) {
    await this.connectToRelay(url, config)
    this.emit('relayAdded', { url, config })
    return true
  }

  removeRelay(url) {
    url = safeNormalizeURL(url)
    this.relayConnections.delete(url)
    this.relayStatuses.delete(url)
    this._connectionPromises.delete(url)
    this.pool.close([url])
    this.emit('relayRemoved', { url })
  }

  async reconnectRelay(url) {
    url = safeNormalizeURL(url)
    const status = this.relayStatuses.get(url)
    if (!status) return
    this.relayConnections.delete(url)
    try {
      await this.connectToRelay(url, status.config)
    } catch (err) {
      console.warn(`Failed to reconnect to ${url}:`, err.message)
    }
  }

  // ── Outbox Model (NIP-65 + NIP-17) ──────────────────────────────

  /**
   * Query a well-known discovery tier directly, bypassing our own relay
   * pool. Used only for bootstrap data (kind 10002, 10050) so we can find
   * a user's relay list even when they aren't on any of our relays.
   * @private
   */
  async _queryDiscovery(filter, { maxWait = 6_000 } = {}) {
    try {
      const events = await this.pool.querySync(DISCOVERY_RELAYS, filter, { maxWait })
      return events || []
    } catch {
      return []
    }
  }

  /** Adapter shape so fetchWithCache can persist via cacheManager. */
  _cacheStoreFor(namespace) {
    return {
      get: (_ns, key) => cacheManager.get(namespace, key),
      set: (_ns, key, value, ttl) => cacheManager.set(namespace, key, value, ttl),
      has: (_ns, key) => cacheManager.has(namespace, key),
    }
  }

  /**
   * Fetch and cache a user's NIP-65 relay list (kind:10002).
   * Discovery tier first, then our own relays as fallback.
   * Cached in the persistent 'relayLists' namespace.
   * @param {string} pubkey — hex pubkey
   * @returns {Promise<Array<{url, read, write}>>}
   */
  async fetchRelayList(pubkey) {
    return fetchWithCache({
      namespace: 'relayLists',
      key: pubkey,
      store: this._cacheStoreFor('relayLists'),
      fetcher: async () => {
        const filter = { kinds: [10002], authors: [pubkey], limit: 1 }

        // 1. Discovery tier — reliable NIP-65 aggregators.
        let events = await this._queryDiscovery(filter, { maxWait: 6_000 })

        // 2. Fallback: our own relays, if discovery turned up nothing.
        if (events.length === 0) {
          await this.ready()
          const readRelays = this._getHealthyReadRelayUrls()
          if (readRelays.length > 0) {
            try {
              events = await this.pool.querySync(readRelays, filter, { maxWait: 8_000 })
            } catch {
              events = []
            }
          }
        }

        if (!events || events.length === 0) return null
        // Pick the newest if multiple relays returned versions.
        events.sort((a, b) => b.created_at - a.created_at)
        const parsed = nip65.parseRelayList(events[0])
        // Normalize URLs so dedup works downstream.
        return parsed.map(r => ({ ...r, url: safeNormalizeURL(r.url) }))
      },
      isEmpty: (v) => v == null,
      fallback: [],
      ttl: {
        hit: OUTBOX_RELAY_LIST_TTL,
        miss: OUTBOX_RELAY_LIST_TTL,
        error: 30_000,
      },
    })
  }

  /**
   * Fetch and cache a user's NIP-17 DM inbox relays (kind:10050).
   * Used for gift-wrapped DM delivery — distinct from NIP-65.
   * @param {string} pubkey
   * @returns {Promise<string[]>} inbox relay URLs
   */
  async fetchDMInbox(pubkey) {
    return fetchWithCache({
      namespace: 'dmInbox',
      key: pubkey,
      store: this._cacheStoreFor('dmInbox'),
      fetcher: async () => {
        const filter = { kinds: [10050], authors: [pubkey], limit: 1 }
        let events = await this._queryDiscovery(filter, { maxWait: 6_000 })
        if (events.length === 0) {
          await this.ready()
          const readRelays = this._getHealthyReadRelayUrls()
          if (readRelays.length > 0) {
            try {
              events = await this.pool.querySync(readRelays, filter, { maxWait: 8_000 })
            } catch {
              events = []
            }
          }
        }
        if (!events || events.length === 0) return null
        events.sort((a, b) => b.created_at - a.created_at)
        const urls = []
        for (const [name, value] of events[0].tags) {
          if (name === 'relay' && value) urls.push(safeNormalizeURL(value))
        }
        return urls.length > 0 ? urls : null
      },
      isEmpty: (v) => v == null,
      fallback: [],
      ttl: {
        hit: OUTBOX_DM_INBOX_TTL,
        miss: OUTBOX_DM_INBOX_TTL,
        error: 30_000,
      },
    })
  }

  /**
   * Build a per-relay filter map for reading events authored by the given
   * pubkeys (outbox routing). Relays are ranked by author coverage and
   * capped at OUTBOX_MAX_RELAYS_GLOBAL so a large follow graph doesn't
   * explode into 100+ connections.
   *
   * @param {string[]} pubkeys
   * @returns {Promise<{routeMap: Map<string, Set<string>>, unrouted: string[]}>}
   *   routeMap: relayUrl → Set of author pubkeys to request from it.
   *   unrouted: authors with no NIP-65 write relays — fall back to our read pool.
   */
  async _buildOutboxRoute(pubkeys) {
    const unique = Array.from(new Set(pubkeys))
    const lists = await Promise.allSettled(unique.map(pk => this.fetchRelayList(pk)))

    // relayUrl → Set<pubkey>
    const candidates = new Map()
    const unrouted = []

    unique.forEach((pk, idx) => {
      const result = lists[idx]
      const list = result.status === 'fulfilled' ? result.value : []
      const writeUrls = (list && list.length)
        ? nip65.getWriteRelays(list).slice(0, OUTBOX_MAX_RELAYS_PER_PUBKEY)
        : []
      if (writeUrls.length === 0) {
        unrouted.push(pk)
        return
      }
      for (const rawUrl of writeUrls) {
        const url = safeNormalizeURL(rawUrl)
        if (!url) continue
        let set = candidates.get(url)
        if (!set) { set = new Set(); candidates.set(url, set) }
        set.add(pk)
      }
    })

    // Rank by (!backedOff, coverage). Backed-off relays sink to the
    // bottom so a rate-limiting relay doesn't dominate the route map
    // just because it claims many authors.
    const ranked = Array.from(candidates.entries())
      .sort((a, b) => {
        const aOff = this._isBackedOff(a[0]) ? 1 : 0
        const bOff = this._isBackedOff(b[0]) ? 1 : 0
        if (aOff !== bOff) return aOff - bOff
        return b[1].size - a[1].size
      })
      .slice(0, OUTBOX_MAX_RELAYS_GLOBAL)

    return { routeMap: new Map(ranked), unrouted }
  }

  /**
   * Per-pubkey inbox relay selection for publishing. Uses read relays
   * from NIP-65. Falls back to NIP-65 write relays (recipient reads from
   * their own writes per spec), then our write relays.
   */
  async getInboxRelays(pubkeys) {
    const relayUrls = new Set()
    const lists = await Promise.allSettled(
      Array.from(new Set(pubkeys)).map(pk => this.fetchRelayList(pk))
    )
    for (const result of lists) {
      if (result.status !== 'fulfilled') continue
      const relays = result.value
      if (!relays || relays.length === 0) continue
      const readRelays = nip65.getReadRelays(relays)
      const source = readRelays.length > 0 ? readRelays : nip65.getWriteRelays(relays)
      for (const rawUrl of source.slice(0, OUTBOX_MAX_RELAYS_PER_PUBKEY)) {
        const url = safeNormalizeURL(rawUrl)
        if (url) relayUrls.add(url)
      }
    }
    return Array.from(relayUrls)
  }

  /**
   * Backwards-compatible helper — returns the union of per-pubkey write
   * relays. Prefer `_buildOutboxRoute` for actual routing.
   */
  async getOutboxRelays(pubkeys) {
    const { routeMap } = await this._buildOutboxRoute(pubkeys)
    return Array.from(routeMap.keys())
  }

  /**
   * Outbox-aware query. This is a TRUE req-router per Nostrify spec:
   *
   *   For each filter with `authors` or `#p`, partition those pubkeys by
   *   their write relays and issue ONE sub-filter per (relay, pubkeys)
   *   pair. Events dedup by id into a single result set.
   *
   * Filters without authors/#p go to our own read pool unchanged.
   *
   * @param {Array<object>} filters
   * @param {object} [opts] — { timeout, eoseGrace, dedup }
   * @returns {Promise<Array>}
   */
  async queryOutbox(filters, opts = {}) {
    await this.ready()

    const timeout = opts.timeout ?? SUBSCRIBE_TIMEOUT
    const eoseGrace = opts.eoseGrace ?? SUBSCRIBE_EOSE_GRACE

    // Collect the author/recipient targets across all filters.
    const pubkeys = new Set()
    for (const f of filters) {
      if (Array.isArray(f.authors)) f.authors.forEach(pk => pubkeys.add(pk))
      if (Array.isArray(f['#p'])) f['#p'].forEach(pk => pubkeys.add(pk))
    }

    if (pubkeys.size === 0) {
      // Nothing to route by author — use the default pool.
      return this.query(filters, opts)
    }

    const { routeMap, unrouted } = await this._buildOutboxRoute(Array.from(pubkeys))

    // Ensure outbox relays are connected (best-effort).
    const toConnect = Array.from(routeMap.keys())
      .filter(url => !this.relayConnections.has(url))
    if (toConnect.length > 0) {
      await Promise.allSettled(
        toConnect.map(url => this.connectToRelay(url, { read: true, write: false }))
      )
    }

    // For each route, narrow each filter to the authors served by that relay.
    // Unrouted authors (no NIP-65) fall back to our read pool as a single
    // "fallback" route.
    const results = []
    const seen = new Set()

    const runRoute = async (relayUrls, filterNarrower) => {
      if (!relayUrls || relayUrls.length === 0) return
      const narrowed = filters.map(filterNarrower).filter(Boolean)
      if (narrowed.length === 0) return

      const events = await new Promise((resolve) => {
        const events = []
        let resolved = false
        const done = () => {
          if (resolved) return
          resolved = true
          clearTimeout(hard)
          clearTimeout(grace)
          try { subs.forEach(s => s.close()) } catch {}
          resolve(events)
        }

        let grace
        const hard = setTimeout(done, timeout)
        let eoseCount = 0

        const subs = narrowed.map(f => this.pool.subscribe(relayUrls, f, {
          onevent: (ev) => {
            if (resolved) return
            if (seen.has(ev.id)) return
            seen.add(ev.id)
            events.push(ev)
          },
          oneose: () => {
            eoseCount++
            if (eoseCount >= narrowed.length) {
              clearTimeout(hard)
              grace = setTimeout(done, eoseGrace)
            }
          },
          onclose: () => {},
          maxWait: timeout,
        }))
      })

      results.push(...events)
    }

    const tasks = []

    // One task per outbox relay, scoped to its assigned authors.
    for (const [relayUrl, authorSet] of routeMap) {
      const authors = Array.from(authorSet)
      tasks.push(runRoute([relayUrl], (f) => {
        const next = { ...f }
        // Narrow authors/#p to only the ones this relay covers.
        if (Array.isArray(f.authors)) {
          const scoped = f.authors.filter(pk => authorSet.has(pk))
          if (scoped.length === 0 && !Array.isArray(f['#p'])) return null
          next.authors = scoped.length > 0 ? scoped : f.authors
        }
        if (Array.isArray(f['#p'])) {
          const scoped = f['#p'].filter(pk => authorSet.has(pk))
          if (scoped.length > 0) next['#p'] = scoped
        }
        return next
      }))
    }

    // Fallback for authors with no NIP-65 — use our own read pool.
    if (unrouted.length > 0) {
      const readRelays = this._getHealthyReadRelayUrls()
      const unroutedSet = new Set(unrouted)
      tasks.push(runRoute(readRelays, (f) => {
        const next = { ...f }
        if (Array.isArray(f.authors)) {
          const scoped = f.authors.filter(pk => unroutedSet.has(pk))
          if (scoped.length === 0 && !Array.isArray(f['#p'])) return null
          next.authors = scoped.length > 0 ? scoped : f.authors
        }
        if (Array.isArray(f['#p'])) {
          const scoped = f['#p'].filter(pk => unroutedSet.has(pk))
          if (scoped.length > 0) next['#p'] = scoped
        }
        return next
      }))
    }

    await Promise.allSettled(tasks)
    return results
  }

  /**
   * Outbox-aware live subscription. Per-author filter partitioning
   * identical to queryOutbox, but keeps the streams open and exposes a
   * single composite `{close}` handle.
   *
   * Routes through the outbox broker — two consumers subscribing with
   * identical filter sets (same kinds + same author array up to order)
   * share ONE upstream route resolution + one set of pool subs. Fan-out
   * to each consumer's callbacks; real sub closes when the last consumer
   * releases. See SubscriptionBroker for the contract.
   *
   * @param {Array<object>} filters
   * @param {{onevent?, oneose?, onclose?, maxWait?}} callbacks
   * @returns {{close: Function}}
   */
  subscribeOutbox(filters, callbacks = {}, options = {}) {
    return this._outboxBroker.subscribe(filters, callbacks, options)
  }

  /**
   * The real subscribeOutbox implementation. Called by the outbox broker
   * (and nothing else) to open ONE upstream route set per distinct
   * filter fingerprint. Handler fan-out to multiple consumers happens
   * at the broker layer above.
   *
   * Registers with `_subscriptionRegistry` so `_reopenSubscriptions`
   * can re-run the route resolution + sub open flow when a relay
   * disconnects and returns. Without that, every live outbox sub
   * would silently die on the first relay hiccup.
   *
   * @private
   */
  _realSubscribeOutbox(filters, callbacks = {}, options = {}) {
    const pubkeys = new Set()
    for (const f of filters) {
      if (Array.isArray(f.authors)) f.authors.forEach(pk => pubkeys.add(pk))
      if (Array.isArray(f['#p'])) f['#p'].forEach(pk => pubkeys.add(pk))
    }

    // No author hint — delegate to the plain subscribe path (which has
    // its own broker in front of it for cross-consumer dedup).
    if (pubkeys.size === 0) {
      return this.subscribe(filters, callbacks, options)
    }

    // Registry entry. The `seen` Set persists across reopens so a
    // reconnected relay replaying its history doesn't re-emit events
    // the consumer already processed.
    const registryId = ++this._subIdCounter
    const entry = {
      type: 'outbox',
      filters,
      pubkeys: Array.from(pubkeys),
      callbacks,
      options,
      subs: [],
      seen: new Set(),
      eoseFired: false,
      closed: false,
    }
    this._subscriptionRegistry.set(registryId, entry)

    this._openOutboxEntry(entry).catch(err => {
      if (entry.closed) return
      console.warn('[subscribeOutbox] setup failed:', err?.message)
      callbacks.onclose?.(err?.message || 'subscribeOutbox setup failed')
    })

    return {
      close: () => {
        if (entry.closed) return
        entry.closed = true
        this._subscriptionRegistry.delete(registryId)
        for (const s of entry.subs) {
          try { s.close() } catch {}
        }
        entry.subs = []
      },
    }
  }

  /**
   * Resolve the outbox routing for an entry and open pool subs.
   * Idempotent — safe to call on reconnect. Callers guard on `entry.closed`.
   * @private
   */
  async _openOutboxEntry(entry) {
    await this.ready()
    if (entry.closed) return

    // Close any stale sub handles from a previous open attempt. We
    // keep the `seen` set untouched so replays dedupe across cycles.
    if (entry.subs.length > 0) {
      for (const s of entry.subs) {
        try { s.close() } catch {}
      }
      entry.subs = []
    }

    const { routeMap, unrouted } = await this._buildOutboxRoute(entry.pubkeys)
    if (entry.closed) return

    const toConnect = Array.from(routeMap.keys())
      .filter(url => !this.relayConnections.has(url))
    if (toConnect.length > 0) {
      await Promise.allSettled(
        toConnect.map(url => this.connectToRelay(url, { read: true, write: false }))
      )
    }
    if (entry.closed) return

    const routeTasks = this._buildRouteTasks(entry.filters, routeMap, unrouted)
    const expectedEose = routeTasks.length

    if (expectedEose === 0) {
      // Every route was narrowed away — nothing to sub. Fire EOSE once
      // (no-op if already fired from a prior cycle) so the consumer's
      // loading state clears.
      if (!entry.eoseFired) {
        entry.eoseFired = true
        entry.callbacks.oneose?.()
      }
      return
    }

    let eoseCount = 0
    const wrapEvent = (ev) => {
      if (entry.closed) return
      if (entry.seen.has(ev.id)) return
      entry.seen.add(ev.id)
      entry.callbacks.onevent?.(ev)
    }
    const wrapEose = () => {
      eoseCount++
      if (eoseCount >= expectedEose && !entry.eoseFired) {
        entry.eoseFired = true
        entry.callbacks.oneose?.()
      }
    }

    let openedCount = 0
    for (const { relayUrls, filter } of routeTasks) {
      if (entry.closed) break
      try {
        const sub = this.pool.subscribe(relayUrls, filter, {
          onevent: wrapEvent,
          oneose: wrapEose,
          onclose: () => { /* reconnect handled centrally */ },
          maxWait: entry.options.maxWait || 10_000,
        })
        entry.subs.push(sub)
        openedCount++
      } catch (err) {
        console.warn('[subscribeOutbox] route open failed:', err?.message)
      }
    }

    // If every route failed to open, surface it so the consumer can
    // clear their loading state / show an error instead of hanging.
    if (openedCount === 0 && !entry.closed) {
      entry.callbacks.onclose?.('no outbox routes could be opened')
    }
  }

  /**
   * Build the per-relay (relayUrls, filter) task list from a route map.
   * Each output filter narrows `authors`/`#p` to pubkeys the relay
   * actually covers. Authors with no NIP-65 list fall back to our own
   * read pool as a single "fallback" route.
   * @private
   */
  _buildRouteTasks(filters, routeMap, unrouted) {
    const tasks = []

    for (const [relayUrl, authorSet] of routeMap) {
      for (const f of filters) {
        const next = { ...f }
        if (Array.isArray(f.authors)) {
          const scoped = f.authors.filter(pk => authorSet.has(pk))
          if (scoped.length === 0 && !Array.isArray(f['#p'])) continue
          next.authors = scoped.length > 0 ? scoped : f.authors
        }
        if (Array.isArray(f['#p'])) {
          const scoped = f['#p'].filter(pk => authorSet.has(pk))
          if (scoped.length > 0) next['#p'] = scoped
        }
        tasks.push({ relayUrls: [relayUrl], filter: next })
      }
    }

    if (unrouted.length > 0) {
      const readRelays = this._getHealthyReadRelayUrls()
      if (readRelays.length > 0) {
        const unroutedSet = new Set(unrouted)
        for (const f of filters) {
          const next = { ...f }
          if (Array.isArray(f.authors)) {
            const scoped = f.authors.filter(pk => unroutedSet.has(pk))
            if (scoped.length === 0 && !Array.isArray(f['#p'])) continue
            next.authors = scoped.length > 0 ? scoped : f.authors
          }
          if (Array.isArray(f['#p'])) {
            const scoped = f['#p'].filter(pk => unroutedSet.has(pk))
            if (scoped.length > 0) next['#p'] = scoped
          }
          tasks.push({ relayUrls: readRelays, filter: next })
        }
      }
    }

    return tasks
  }

  /**
   * Publish with inbox model. Prefers the recipient's NIP-17 DM inbox
   * (kind:10050) when the event is DM-shaped (kind 1059), otherwise the
   * NIP-65 read relays. Always unions with our own write relays as a
   * delivery floor.
   *
   * @param {object} event — signed Nostr event
   * @param {string[]} recipientPubkeys
   * @returns {Promise<{successful, failed, total}>}
   */
  async publishInbox(event, recipientPubkeys = []) {
    await this.ready()

    if (recipientPubkeys.length === 0) {
      return this.publish(event)
    }

    // Gift-wrapped DMs (NIP-17) use the kind:10050 inbox.
    const useDMInbox = event?.kind === 1059
    const inboxFetches = recipientPubkeys.map(pk =>
      useDMInbox ? this.fetchDMInbox(pk) : this.fetchRelayList(pk)
    )
    const results = await Promise.allSettled(inboxFetches)

    const inboxUrls = new Set()
    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value) continue
      if (useDMInbox) {
        for (const url of r.value) inboxUrls.add(safeNormalizeURL(url))
      } else {
        const relays = r.value
        const readRelays = nip65.getReadRelays(relays)
        const source = readRelays.length > 0 ? readRelays : nip65.getWriteRelays(relays)
        for (const url of source.slice(0, OUTBOX_MAX_RELAYS_PER_PUBKEY)) {
          inboxUrls.add(safeNormalizeURL(url))
        }
      }
    }

    const toConnect = Array.from(inboxUrls).filter(url => !this.relayConnections.has(url))
    if (toConnect.length > 0) {
      await Promise.allSettled(
        toConnect.map(url => this.connectToRelay(url, { read: false, write: true }))
      )
    }

    const allWriteUrls = new Set([
      ...this._getHealthyWriteRelayUrls(),
      ...inboxUrls,
    ])
    const targetRelays = Array.from(allWriteUrls).map(url => ({ url }))
    return this.publish(event, targetRelays)
  }

  /**
   * Build a NIP-65 relay list event template from the CURRENT connected
   * relays. Caller is responsible for signing + publishing (via
   * publishService.signAndPublish). Returns null if no relays configured.
   */
  buildOwnRelayListTemplate() {
    const relays = this.getConnectedRelays().map(r => ({
      url: safeNormalizeURL(r.url),
      read: r.config?.read !== false,
      write: r.config?.write !== false,
    }))
    if (relays.length === 0) return null
    return nip65.createRelayListEventTemplate(relays)
  }

  /**
   * Check whether a given pubkey has a NIP-65 relay list on discovery
   * relays. Used at login to decide whether we should auto-publish.
   */
  async hasPublishedRelayList(pubkey) {
    const list = await this.fetchRelayList(pubkey)
    return Array.isArray(list) && list.length > 0
  }

  // ── NIP-11: Relay Information ─────────────────────────────────

  /**
   * Fetch relay information document (NIP-11).
   * Caches results for 1 hour.
   * @param {string} relayUrl — wss:// relay URL
   * @returns {Promise<object|null>} RelayInfo or null
   */
  async fetchRelayInfo(relayUrl) {
    const cached = this._relayInfoCache.get(relayUrl)
    if (cached && (Date.now() - cached.fetchedAt) < RELAY_INFO_TTL) {
      return cached.info
    }

    try {
      const info = await nip11.fetchRelayInfo(relayUrl)
      this._relayInfoCache.set(relayUrl, { info, fetchedAt: Date.now() })
      return info
    } catch (err) {
      console.warn(`Failed to fetch NIP-11 info for ${relayUrl}:`, err.message)
      return null
    }
  }

  /**
   * Check if a relay supports a specific NIP.
   * @param {string} relayUrl
   * @param {number} nipNumber
   * @returns {Promise<boolean>}
   */
  async relaySupportsNip(relayUrl, nipNumber) {
    const info = await this.fetchRelayInfo(relayUrl)
    if (!info) return false
    return nip11.supportsNip(info, nipNumber)
  }

  /**
   * Fetch NIP-11 info for all connected relays.
   * @returns {Promise<Map<string, object>>} url → RelayInfo
   */
  async fetchAllRelayInfo() {
    const connected = this.getConnectedRelays()
    const results = new Map()

    await Promise.allSettled(
      connected.map(async (relay) => {
        const info = await this.fetchRelayInfo(relay.url)
        if (info) results.set(relay.url, info)
      })
    )

    return results
  }

  // ── Event Cache ─────────────────────────────────────────────────

  clearEventCache(filter) {
    cacheManager.invalidate('events', stableCacheKey(filter))
  }

  // ── Event Listeners ─────────────────────────────────────────────

  addEventListener(callback) {
    if (typeof callback !== 'function') return () => {}
    this._eventListeners.add(callback)
    return () => this._eventListeners.delete(callback)
  }

  emit(type, data) {
    for (const listener of this._eventListeners) {
      try {
        listener({ type, data, timestamp: new Date().toISOString() })
      } catch (err) {
        console.error('NostrService event listener error:', err)
      }
    }
  }

  // ── Internal: Connection ────────────────────────────────────────

  mergeRelayLists(userRelays, defaultRelays) {
    const map = new Map()
    for (const r of defaultRelays) {
      const url = safeNormalizeURL(r.url)
      map.set(url, { ...r, url })
    }
    for (const r of userRelays) {
      const url = safeNormalizeURL(r.url)
      map.set(url, { ...r, url })
    }
    return Array.from(map.values())
  }

  async _connectToRelays(relayConfigs) {
    const results = await Promise.allSettled(
      relayConfigs.map(cfg => this.connectToRelay(cfg.url, cfg))
    )

    let ok = 0
    let fail = 0
    for (const r of results) {
      if (r.status === 'fulfilled') ok++
      else fail++
    }

    if (ok === 0 && relayConfigs.length > 0) {
      throw new Error('Failed to connect to any relays')
    }
    return { successCount: ok, failureCount: fail }
  }

  async connectToRelay(url, config = { read: true, write: true }, retryCount = 0) {
    url = safeNormalizeURL(url)
    // Dedup concurrent connection attempts to the same relay
    if (this._connectionPromises.has(url)) {
      return this._connectionPromises.get(url)
    }

    this.setRelayStatus(url, 'connecting', config)

    const promise = this._attemptConnection(url, config, retryCount)
    this._connectionPromises.set(url, promise)

    try {
      const result = await promise
      return result
    } finally {
      this._connectionPromises.delete(url)
    }
  }

  async _attemptConnection(url, config, retryCount) {
    let timeoutId
    try {
      const relayPromise = this.pool.ensureRelay(url, {
        connectionTimeout: RELAY_CONNECTION_TIMEOUT,
      })
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Connection timeout')), RELAY_CONNECTION_TIMEOUT)
      })

      await Promise.race([relayPromise, timeoutPromise])
      clearTimeout(timeoutId)

      this.relayConnections.set(url, {
        url,
        config,
        connectedAt: new Date().toISOString(),
      })
      this.setRelayStatus(url, 'connected', config)
      this.emit('relayConnected', { url, config })

      return { url, config }
    } catch (error) {
      if (retryCount < RELAY_MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RELAY_RETRY_DELAY))
        return this._attemptConnection(url, config, retryCount + 1)
      }

      this.setRelayStatus(url, 'failed', config, error.message)
      this.emit('relayFailed', { url, config, error: error.message })
      throw new Error(`Failed to connect to ${url} after ${RELAY_MAX_RETRIES + 1} attempts: ${error.message}`)
    }
  }

  setRelayStatus(url, status, config = null, error = null) {
    const current = this.relayStatuses.get(url) || {}
    this.relayStatuses.set(url, {
      ...current,
      url,
      status,
      config: config || current.config,
      error,
      lastUpdated: new Date().toISOString(),
      lastConnected: status === 'connected' ? new Date().toISOString() : current.lastConnected,
    })
  }

  // ── Internal: Health Checks ─────────────────────────────────────

  _startHealthCheck() {
    this._stopHealthCheck()
    this._healthCheckTimer = setInterval(
      () => this._performHealthCheck(),
      RELAY_HEALTH_CHECK_INTERVAL
    )
  }

  _stopHealthCheck() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer)
      this._healthCheckTimer = null
    }
  }

  async _performHealthCheck() {
    let hadRecovery = false
    const statuses = this.getRelayStatuses()

    await Promise.allSettled(statuses.map(async (relayStatus) => {
      try {
        if (!this.relayConnections.has(relayStatus.url)) {
          await this.reconnectRelay(relayStatus.url)
          hadRecovery = true
          return
        }

        let hcTimeout
        const timeout = new Promise((_, reject) => {
          hcTimeout = setTimeout(() => reject(new Error('Health check timeout')), RELAY_HEALTH_CHECK_TIMEOUT)
        })
        try {
          await Promise.race([
            this.pool.ensureRelay(relayStatus.url),
            timeout,
          ])
        } finally {
          clearTimeout(hcTimeout)
        }

        if (relayStatus.status !== 'connected') {
          this.setRelayStatus(relayStatus.url, 'connected', relayStatus.config)
          this.emit('relayHealthy', { url: relayStatus.url })
          hadRecovery = true
        }
      } catch (error) {
        // Mark relay as disconnected (not just unhealthy) so UI shows accurate state
        this.relayConnections.delete(relayStatus.url)
        this.setRelayStatus(relayStatus.url, 'disconnected', relayStatus.config, error.message)
        this.emit('relayDisconnected', { url: relayStatus.url, error: error.message })
        setTimeout(() => this.reconnectRelay(relayStatus.url), RELAY_RETRY_DELAY)
      }
    }))

    // After health check, re-open any subscriptions that were waiting for relays
    if (hadRecovery) {
      this._reopenSubscriptions()
    }
  }

  /**
   * Re-open subscriptions that were registered but had no relays,
   * or whose relays disconnected. Called after a relay reconnects.
   *
   * Handles two entry shapes:
   * - `type: 'outbox'` — delegates to `_openOutboxEntry` which re-runs
   *   the NIP-65 route resolution (important: the set of write relays
   *   for a given author may have changed while we were offline).
   * - default (plain subscribe) — re-subscribes against the current
   *   healthy read pool using the same filters/callbacks.
   */
  _reopenSubscriptions() {
    const healthyRelays = this._getHealthyReadRelayUrls()
    if (healthyRelays.length === 0) return

    for (const [id, entry] of this._subscriptionRegistry) {
      if (entry.closed) {
        this._subscriptionRegistry.delete(id)
        continue
      }

      if (entry.type === 'outbox') {
        // Re-run the outbox pipeline. `_openOutboxEntry` closes stale
        // sub handles, refreshes routes, and re-opens. The persisted
        // `seen` Set dedupes any events the upstream relays replay.
        this._openOutboxEntry(entry).then(() => {
          this.emit('subscriptionReopened', { id, type: 'outbox', filters: entry.filters })
        }).catch(err => {
          console.warn(`Failed to reopen outbox subscription ${id}:`, err?.message)
        })
        continue
      }

      // Plain subscribe path — only reopen if it has no live subs
      // (e.g. was created with 0 relays or onclose cleared it).
      if (entry.subs.length > 0) continue

      try {
        for (const sub of entry.subs) {
          try { sub.close() } catch { /* ignore */ }
        }
        entry.subs = []

        for (const filter of entry.filters) {
          const sub = this.pool.subscribe(healthyRelays, filter, {
            onevent: (event) => entry.callbacks.onevent?.(event),
            oneose: () => entry.callbacks.oneose?.(),
            onclose: () => {},
            maxWait: entry.options.maxWait || 10_000,
          })
          entry.subs.push(sub)
        }

        this.emit('subscriptionReopened', { id, filters: entry.filters })
      } catch (err) {
        console.warn(`Failed to reopen subscription ${id}:`, err.message)
      }
    }
  }

  // ── Internal: Backoff ───────────────────────────────────────────

  _isBackedOff(url) {
    const entry = this._relayBackoff.get(url)
    if (!entry) return false
    return Date.now() - entry.lastFail < entry.backoffMs
  }

  _markBackoff(url) {
    const entry = this._relayBackoff.get(url) || { backoffMs: 2000, lastFail: 0 }
    entry.backoffMs = Math.min(RELAY_MAX_BACKOFF, entry.backoffMs * 2)
    entry.lastFail = Date.now()
    this._relayBackoff.set(url, entry)
  }

  _resetBackoff(url) {
    this._relayBackoff.delete(url)
  }

  _getHealthyReadRelayUrls() {
    return this.getReadRelays()
      .filter(r => !this._isBackedOff(r.url))
      .map(r => r.url)
  }

  _getHealthyWriteRelayUrls() {
    return this.getWriteRelays()
      .filter(r => !this._isBackedOff(r.url))
      .map(r => r.url)
  }

  // ── Internal: Filter Validation ─────────────────────────────────

  _validateFilters(filters) {
    if (!Array.isArray(filters)) return []
    return filters.filter(f =>
      f && typeof f === 'object' && !Array.isArray(f) && Object.keys(f).length > 0
    )
  }

  // ── Internal: Subscription Management ───────────────────────────

  _deferSubscription(filters, callbacks, options) {
    let realSub = null
    let closed = false

    const deferTimeout = setTimeout(() => {
      if (!closed) {
        closed = true
        console.warn('Deferred subscription timed out after', DEFERRED_SUB_TIMEOUT, 'ms')
        callbacks.onclose?.('deferred subscription timed out')
      }
    }, DEFERRED_SUB_TIMEOUT)

    this._readyPromise.then(() => {
      clearTimeout(deferTimeout)
      if (!closed) {
        try {
          realSub = this.subscribe(filters, callbacks, options)
        } catch (e) {
          console.warn('Deferred subscription failed:', e.message)
        }
      }
    }).catch(() => {
      clearTimeout(deferTimeout)
      closed = true
    })

    return {
      close: () => {
        closed = true
        clearTimeout(deferTimeout)
        realSub?.close()
      },
    }
  }

  _queueSubscription(filters, callbacks, options) {
    let realSub = null
    const proxy = {
      close: () => { proxy._closed = true; realSub?.close() },
      _closed: false,
    }
    this._subscriptionQueue.push({
      filters, callbacks, options, proxy,
      setReal: (s) => { realSub = s },
    })
    return proxy
  }

  /**
   * Open a subscription across healthy read relays.
   *
   * nostr-core RelayPool.subscribe takes a single Filter, not an array.
   * For multiple filters, we open one pool subscription per filter and
   * aggregate EOSE across all of them.
   *
   * Registered in the subscription registry so it can be re-opened
   * after a relay reconnects.
   */
  _openSubscription(filters, callbacks, options) {
    const relayUrls = this._getHealthyReadRelayUrls()
    if (relayUrls.length === 0) {
      // Instead of throwing, return a no-op sub and emit a warning.
      // The subscription is still registered so it can be opened
      // when relays come back online.
      this.emit('noRelaysAvailable', { filters })
      const registryId = ++this._subIdCounter
      const entry = { filters, callbacks, options, subs: [], closed: false }
      this._subscriptionRegistry.set(registryId, entry)

      return {
        close: () => {
          entry.closed = true
          this._subscriptionRegistry.delete(registryId)
        },
      }
    }

    const subId = Symbol('sub')
    this._activeSubscriptions.add(subId)
    const registryId = ++this._subIdCounter

    let cleaned = false
    const cleanupSub = () => {
      if (cleaned) return
      cleaned = true
      this._activeSubscriptions.delete(subId)
      this._drainQueue()
    }

    // For multiple filters, open one pool.subscribe per filter.
    // Aggregate EOSE and onclose across all filter subs.
    // Dedup events across filters to prevent double-counting.
    const subs = []
    const totalFilters = filters.length
    const eoseCount = { value: 0 }
    const closeCount = { value: 0 }
    const seenIds = totalFilters > 1 ? new Set() : null

    for (const filter of filters) {
      const sub = this.pool.subscribe(relayUrls, filter, {
        onevent: (event) => {
          // Dedup across overlapping filters
          if (seenIds) {
            if (seenIds.has(event.id)) return
            seenIds.add(event.id)
          }
          callbacks.onevent?.(event)
        },
        oneose: () => {
          eoseCount.value++
          if (eoseCount.value >= totalFilters) {
            callbacks.oneose?.()
          }
        },
        onclose: (reason) => {
          closeCount.value++
          if (typeof reason === 'string' && reason.toLowerCase().includes('rate')) {
            relayUrls.forEach(url => this._markBackoff(url))
          }
          // Only fire consumer's onclose once (after all filter subs close)
          if (closeCount.value >= totalFilters) {
            cleanupSub()
            callbacks.onclose?.(reason)
          }
        },
        maxWait: options.maxWait || 10_000,
      })
      subs.push(sub)
    }

    // Register for potential re-open on reconnect
    const entry = { filters, callbacks, options, subs, closed: false }
    this._subscriptionRegistry.set(registryId, entry)

    // Composite close handle
    const compositeClose = () => {
      entry.closed = true
      this._subscriptionRegistry.delete(registryId)
      cleanupSub()
      for (const sub of subs) {
        try { sub.close() } catch { /* ignore */ }
      }
    }

    return { close: compositeClose }
  }

  _drainQueue() {
    while (this._subscriptionQueue.length > 0 && this._activeSubscriptions.size < MAX_CONCURRENT_SUBS) {
      const { filters, callbacks, options, proxy, setReal } = this._subscriptionQueue.shift()
      if (proxy._closed) continue
      try {
        const realSub = this._openSubscription(filters, callbacks, options)
        setReal(realSub)
        proxy.close = () => { proxy._closed = true; realSub.close() }
      } catch (e) {
        console.warn('Queued subscription failed:', e.message)
      }
    }
  }
}

// Singleton
export const nostrService = new NostrService()
