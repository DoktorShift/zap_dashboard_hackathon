/**
 * SubscriptionBroker — filter-level deduplication for live subscriptions.
 *
 * Problem: two components opening the same filters (e.g. both mounting
 * code that tracks the current user's kind:7 reactions) produce two
 * upstream pool subscriptions, doubling bandwidth for no gain.
 *
 * Design:
 * - Stable key from filters (JSON-canonicalized — no map ordering pitfalls).
 * - First consumer per key triggers ONE real subscribe. Its callbacks
 *   fan out to all registered consumers.
 * - Per-consumer `close` decrements refcount; the real sub is closed
 *   when the last consumer releases.
 * - Late joiners get a synthetic `oneose()` immediately if the shared
 *   sub has already EOSE'd — their "done loading" signal stays correct.
 *
 * Scope: plain `subscribe` path only. `subscribeOutbox` performs route
 * resolution that makes filter-level dedup expensive/unclear; its
 * upstream load is already capped by OUTBOX_MAX_RELAYS_GLOBAL.
 */

/**
 * Produce a canonical string for a list of Nostr filters. Arrays are
 * sorted so `{authors: [A, B]}` and `{authors: [B, A]}` share a key.
 */
export function canonicalFilterKey(filters) {
  if (!Array.isArray(filters)) return null
  const norm = filters.map(canonicalFilter)
  // Sort filters too — the client doesn't care about filter order.
  return JSON.stringify(norm.sort((a, b) => a.__key.localeCompare(b.__key)))
}

function canonicalFilter(f) {
  if (!f || typeof f !== 'object') return { __key: '' }
  const out = {}
  const keys = Object.keys(f).sort()
  for (const k of keys) {
    const v = f[k]
    if (Array.isArray(v)) {
      // Stable sort — works for strings and numbers alike.
      const copy = v.slice().sort((a, b) =>
        typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
      )
      out[k] = copy
    } else {
      out[k] = v
    }
  }
  out.__key = JSON.stringify(out)
  return out
}

export class SubscriptionBroker {
  /**
   * @param {{ subscribe: Function }} backend — something that has
   *   `subscribe(filters, callbacks, options)` returning `{close}`.
   *   Typically `NostrService` itself (wrapping its underlying subscribe).
   */
  constructor(backend) {
    this.backend = backend
    /** @type {Map<string, SharedSub>} */
    this._shared = new Map()
    this._consumerCounter = 0
  }

  /**
   * Dedup-aware subscribe. When another consumer is already subscribed
   * with the same filters, this call attaches to the shared sub and
   * the backend is NOT called again.
   *
   * @param {Array<object>} filters
   * @param {{onevent?, oneose?, onclose?}} callbacks
   * @param {object} [options] — passed through to the backend on first call.
   * @returns {{close: Function}}
   */
  subscribe(filters, callbacks = {}, options = {}) {
    const key = canonicalFilterKey(filters)
    if (!key) {
      // Unkeyable filters → bypass the broker, go direct.
      return this.backend.subscribe(filters, callbacks, options)
    }

    let shared = this._shared.get(key)
    if (!shared) {
      shared = this._createShared(key, filters, options)
    }

    const consumerId = ++this._consumerCounter
    shared.consumers.set(consumerId, callbacks)

    // Late joiner — if EOSE already fired, synthesize it so the
    // consumer's loading indicator clears.
    if (shared.eosed && typeof callbacks.oneose === 'function') {
      // Defer to the next microtask so the caller finishes setting up
      // before we invoke their callback.
      queueMicrotask(() => {
        // Don't fire if the caller closed synchronously.
        if (shared.consumers.has(consumerId)) callbacks.oneose?.()
      })
    }

    return {
      close: () => {
        if (!shared.consumers.delete(consumerId)) return
        if (shared.consumers.size === 0) {
          // Last consumer released — close the real sub.
          try { shared.realSub?.close() } catch { /* ignore */ }
          this._shared.delete(key)
        }
      },
    }
  }

  /**
   * @returns {number} count of distinct shared subscriptions currently open.
   */
  get sharedCount() {
    return this._shared.size
  }

  /**
   * @returns {number} total consumer references across all shared subs.
   */
  get consumerCount() {
    let n = 0
    for (const s of this._shared.values()) n += s.consumers.size
    return n
  }

  _createShared(key, filters, options) {
    /** @type {SharedSub} */
    const shared = {
      key,
      filters,
      consumers: new Map(),
      realSub: null,
      eosed: false,
      closed: false,
    }
    this._shared.set(key, shared)

    const merged = {
      onevent: (ev) => {
        if (shared.closed) return
        // Iterate over a snapshot — a consumer may close during its
        // own callback, which mutates the map.
        for (const cb of Array.from(shared.consumers.values())) {
          try { cb.onevent?.(ev) } catch (err) { console.error('[broker] onevent handler threw:', err) }
        }
      },
      oneose: () => {
        if (shared.closed || shared.eosed) return
        shared.eosed = true
        for (const cb of Array.from(shared.consumers.values())) {
          try { cb.oneose?.() } catch (err) { console.error('[broker] oneose handler threw:', err) }
        }
      },
      onclose: (reason) => {
        shared.closed = true
        // Notify all consumers so they can retry/unsubscribe.
        for (const cb of Array.from(shared.consumers.values())) {
          try { cb.onclose?.(reason) } catch (err) { console.error('[broker] onclose handler threw:', err) }
        }
        // Drop the shared record — a future subscribe will recreate it.
        if (this._shared.get(key) === shared) this._shared.delete(key)
      },
    }

    shared.realSub = this.backend.subscribe(filters, merged, options)
    return shared
  }
}

/**
 * @typedef {{
 *   key: string,
 *   filters: Array<object>,
 *   consumers: Map<number, object>,
 *   realSub: { close: Function } | null,
 *   eosed: boolean,
 *   closed: boolean,
 * }} SharedSub
 */
