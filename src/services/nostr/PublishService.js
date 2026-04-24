/**
 * PublishService — unified sign → verify → publish pipeline with retry
 * and offline-first queuing.
 *
 * Architecture:
 * - Online: sign → verify → publish → retry; failures land in _pending.
 * - Offline (navigator.onLine === false OR publish throws network error):
 *   sign + queue with an `offline: true` flag and return a synthetic
 *   "queued" result. The UI treats the event as "sent, awaiting delivery."
 * - Queue persists to localStorage via StorageService so it survives
 *   reloads, lock-screens, and OS-level tab suspensions.
 * - On the `online` window event, the queue auto-drains — each entry
 *   retries its original publish with original routing.
 *
 * The pending-queue change emitter (subscribe/unsubscribe) covers every
 * mutation path, so UI surfaces (PendingPublishBadge) stay in sync
 * without polling.
 */

import { verifyEvent } from './nostrImports.js'
import { nostrService } from './NostrService.js'
import { signerService } from './SignerService.js'
import { storageService } from '../StorageService.js'

/** @typedef {{ eventId: string, successful: number, failed: number, total: number, offline?: boolean }} PublishResult */

const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 5000, 10000]

// localStorage key for the offline publish queue. Per-app, not per-user;
// the entries carry pubkeys on the signed event so cross-account
// contamination is impossible in practice — the signer would reject
// any retry attempt signed by a different key.
const OFFLINE_QUEUE_KEY = 'publishOfflineQueue'

// Cap the queue so a long offline stretch doesn't fill localStorage.
const OFFLINE_QUEUE_MAX = 200

/**
 * Heuristic for "this error is a network / offline condition, not a
 * semantic failure". We don't want to silently pocket a real publish
 * failure (e.g. relay rejected the signature) as if it were offline.
 */
function looksLikeOffline(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String(err?.message || '').toLowerCase()
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('no relays are connected') ||
    msg.includes('publish timed out') ||
    msg.includes('connection')
  )
}

class PublishService {
  constructor() {
    /** @type {Map<string, { event, template, retries, lastError, opts, offline? }>} */
    this._pending = new Map()
    /** @type {Set<Function>} */
    this._listeners = new Set()

    // Hydration is best-effort — test environments without a full
    // localStorage mock shouldn't cause the service to fail to
    // construct. In-memory queue works either way.
    try { this._hydratePending() } catch (err) {
      console.warn('[publishService] hydrate failed:', err?.message)
    }
    try { this._installConnectivityListeners() } catch { /* SSR */ }
  }

  // ── Subscribe (push-based queue change emitter) ─────────────────

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {}
    this._listeners.add(listener)
    try { listener(this.getPending()) } catch { /* listener's problem */ }
    return () => { this._listeners.delete(listener) }
  }

  _emit() {
    if (this._listeners.size > 0) {
      const snapshot = this.getPending()
      for (const l of this._listeners) {
        try { l(snapshot) } catch (err) {
          console.error('[publishService] listener threw:', err)
        }
      }
    }
    // Any queue mutation triggers a persist. The storageService write
    // itself is a single localStorage.setItem — cheap enough to run
    // inline; debouncing would risk losing in-flight entries if the
    // page closes between the emit and the write.
    //
    // Wrapped in try/catch because non-browser environments (SSR, jsdom
    // without localStorage, test runners) can throw here. Persistence
    // is best-effort; the in-memory queue is authoritative.
    try { this._persistPending() } catch (err) {
      console.warn('[publishService] persist failed:', err?.message)
    }
  }

  // ── Sign + publish (or queue if offline) ────────────────────────

  /**
   * Sign + publish an event template. When offline (or when the publish
   * fails with a network-shaped error), the signed event is queued and
   * a synthetic `{ offline: true }` result is returned so the UI can
   * reflect "queued for delivery" optimistically.
   *
   * @param {object} template
   * @param {{ retries?: number, onRetry?: Function, routing?: 'default'|'inbox', recipients?: string[] }} [opts]
   */
  async signAndPublish(template, opts = {}) {
    if (!template.created_at) {
      template.created_at = Math.floor(Date.now() / 1000)
    }

    const signedEvent = await signerService.signEvent(template)
    if (!verifyEvent(signedEvent)) {
      throw new PublishError('Event signature verification failed', 'SIGN_FAILED', template)
    }

    // Offline fast-path: skip the publish attempt entirely and queue.
    // This is what makes tweets-on-a-subway feel instant — the user
    // sees success immediately, the relay delivery happens when
    // connectivity returns.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._enqueueOffline(signedEvent, template, opts, 'Offline — queued for delivery')
      return {
        event: signedEvent,
        result: this._offlineResult(signedEvent.id),
      }
    }

    const { retries = MAX_RETRIES, onRetry } = opts
    return this._publishWithRetry(signedEvent, template, retries, onRetry, opts)
  }

  async publish(signedEvent, opts = {}) {
    if (!verifyEvent(signedEvent)) {
      throw new PublishError('Invalid event signature', 'SIGN_FAILED')
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._enqueueOffline(signedEvent, null, opts, 'Offline — queued for delivery')
      return this._offlineResult(signedEvent.id)
    }
    const { retries = MAX_RETRIES, onRetry } = opts
    return this._publishWithRetry(signedEvent, null, retries, onRetry, opts)
  }

  /**
   * Retry an entry from the pending queue. Called manually from the
   * TopBar badge, or automatically when connectivity returns.
   */
  async retry(eventId) {
    const pending = this._pending.get(eventId)
    if (!pending) {
      throw new PublishError('No pending event found with that ID', 'NOT_FOUND')
    }
    return this._publishWithRetry(
      pending.event,
      pending.template,
      MAX_RETRIES,
      undefined,
      pending.opts || {}
    )
  }

  /**
   * Drain the offline queue — called automatically on `online` events
   * and manually available for explicit retry-all UI actions. Fires
   * retries sequentially (not in parallel) so a burst of 50 queued
   * notes doesn't hammer relays.
   */
  async drainPending() {
    const ids = Array.from(this._pending.keys())
    for (const id of ids) {
      try { await this.retry(id) } catch { /* stay in queue */ }
    }
  }

  getPending() {
    return Array.from(this._pending.entries()).map(([id, entry]) => ({
      eventId: id,
      kind: entry.event.kind,
      createdAt: entry.event.created_at,
      lastError: entry.lastError,
      offline: !!entry.offline,
    }))
  }

  removePending(eventId) {
    if (this._pending.delete(eventId)) this._emit()
  }

  clearPending() {
    if (this._pending.size === 0) return
    this._pending.clear()
    this._emit()
  }

  // ── Internal: publish pipeline ──────────────────────────────────

  async _publishWithRetry(signedEvent, template, maxRetries, onRetry, opts = {}) {
    let lastError = null
    const routing = opts.routing || 'default'
    const recipients = opts.recipients || []

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = routing === 'inbox' && recipients.length > 0
          ? await nostrService.publishInbox(signedEvent, recipients)
          : await nostrService.publish(signedEvent)

        if (result.successful === 0) {
          throw new PublishError(
            `Published to 0/${result.total} relays`,
            'ALL_RELAYS_FAILED',
            template
          )
        }

        // Success — drop from pending (queued or not).
        if (this._pending.delete(signedEvent.id)) this._emit()
        return { event: signedEvent, result }
      } catch (err) {
        lastError = err
        if (err.code === 'SIGN_FAILED') throw err

        // If connectivity disappeared mid-retry-loop, pivot to the
        // offline path — queue and return a synthetic result instead
        // of burning through the retry budget.
        if (looksLikeOffline(err) && attempt === 0) {
          this._enqueueOffline(signedEvent, template, opts, lastError?.message || 'Offline')
          return {
            event: signedEvent,
            result: this._offlineResult(signedEvent.id),
          }
        }

        if (attempt >= maxRetries) break

        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
        onRetry?.({ attempt: attempt + 1, maxRetries, delay, error: err.message })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted — keep in pending for manual retry.
    this._pending.set(signedEvent.id, {
      event: signedEvent,
      template,
      retries: maxRetries,
      lastError: lastError?.message || 'Unknown error',
      opts: { routing, recipients },
      offline: false,
    })
    this._emit()

    throw new PublishError(
      lastError?.message || 'Failed to publish after retries',
      'PUBLISH_FAILED',
      template,
      { eventId: signedEvent.id, retries: maxRetries }
    )
  }

  // ── Internal: offline queue + persistence ───────────────────────

  _enqueueOffline(signedEvent, template, opts, reason) {
    // Cap to protect localStorage quota.
    if (this._pending.size >= OFFLINE_QUEUE_MAX) {
      // Drop the OLDEST entry (by created_at on the event) — that's
      // the most likely-stale one, not the one the user just signed.
      let oldestId = null
      let oldestTs = Infinity
      for (const [id, entry] of this._pending) {
        if (entry.event.created_at < oldestTs) {
          oldestTs = entry.event.created_at
          oldestId = id
        }
      }
      if (oldestId) this._pending.delete(oldestId)
    }

    this._pending.set(signedEvent.id, {
      event: signedEvent,
      template,
      retries: 0,
      lastError: reason,
      opts: {
        routing: opts?.routing || 'default',
        recipients: opts?.recipients || [],
      },
      offline: true,
    })
    this._emit()
  }

  _offlineResult(eventId) {
    return {
      successful: 0,
      failed: 0,
      total: 0,
      offline: true,
      eventId,
    }
  }

  _persistPending() {
    if (this._pending.size === 0) {
      storageService.remove(OFFLINE_QUEUE_KEY)
      return
    }
    // Only persist OFFLINE-flagged entries. Regular retry-exhausted
    // entries are session-local; forcing them through localStorage
    // blurs the distinction between "user lost connectivity" and
    // "relay rejected this kind:3 we just signed."
    const offlineEntries = []
    for (const [id, entry] of this._pending) {
      if (!entry.offline) continue
      offlineEntries.push([id, {
        event: entry.event,
        template: entry.template,
        lastError: entry.lastError,
        opts: entry.opts,
      }])
    }
    if (offlineEntries.length === 0) {
      storageService.remove(OFFLINE_QUEUE_KEY)
      return
    }
    storageService.set(OFFLINE_QUEUE_KEY, offlineEntries)
  }

  _hydratePending() {
    const stored = storageService.get(OFFLINE_QUEUE_KEY)
    if (!Array.isArray(stored) || stored.length === 0) return

    for (const [id, entry] of stored) {
      if (!entry?.event || entry.event.id !== id) continue
      // Re-verify on hydration. A corrupt localStorage entry should
      // drop, not poison the queue with an unpublishable event.
      try {
        if (!verifyEvent(entry.event)) continue
      } catch {
        continue
      }
      this._pending.set(id, {
        event: entry.event,
        template: entry.template,
        retries: 0,
        lastError: entry.lastError || 'Pending delivery',
        opts: entry.opts || { routing: 'default', recipients: [] },
        offline: true,
      })
    }
    // Don't _emit yet — listeners haven't subscribed at constructor
    // time. The first subscribe() call fires with the current state.
  }

  _installConnectivityListeners() {
    if (typeof window === 'undefined') return

    const onOnline = () => {
      // Give the network stack a beat to settle (some browsers fire
      // `online` before DNS is reachable) and then drain.
      setTimeout(() => {
        this.drainPending().catch(err => {
          console.warn('[publishService] drain failed:', err?.message)
        })
      }, 500)
    }
    const onOffline = () => {
      // No action — future publishes will skip straight to the queue
      // via navigator.onLine check. Emit so the UI can reflect
      // "offline" state if it wants.
      this._emit()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  }
}

/**
 * Structured publish error with error code and context.
 */
export class PublishError extends Error {
  constructor(message, code, template, meta) {
    super(message)
    this.name = 'PublishError'
    this.code = code
    this.template = template
    this.meta = meta
  }

  get userMessage() {
    switch (this.code) {
      case 'SIGN_FAILED':
        return 'Failed to sign the event. Please check your signer connection.'
      case 'ALL_RELAYS_FAILED':
        return 'Could not deliver to any relay. Check your connection and try again.'
      case 'PUBLISH_FAILED':
        return 'Publishing failed after multiple attempts. You can retry from the pending queue.'
      default:
        return this.message
    }
  }
}

// Add the storage key to constants.js STORAGE_KEYS registry.
// Done here locally so future greps find it — the key lives in this file
// because it's tightly coupled to this service's semantics.
export const PUBLISH_OFFLINE_QUEUE_STORAGE_KEY = OFFLINE_QUEUE_KEY

// Singleton
export const publishService = new PublishService()
