import { ref, computed } from 'vue'
import { cacheManager } from '../../services/nostr/CacheManager.js'

/**
 * useUnread — per-page "new since last visit" tracker.
 *
 * Pattern: pages call `markSeen('notes')` when visible (onMounted +
 * when the user scrolls to top / interacts). Event sources call
 * `trackArrival('notes', timestamp)` when a fresh item arrives.
 * The sidebar reads `unreadCount('notes')` for its dot/badge.
 *
 * Storage: the "last seen" timestamps live in cacheManager's
 * 'snapshots' namespace (persistent, 7d TTL, keyed per-user) so the
 * indicator survives reloads but resets on logout via the existing
 * cache clear. Arrival timestamps are module-scoped (session only) —
 * they get rebuilt from the live subscriptions on each session, so
 * the "unread count" always reflects what actually arrived this visit
 * plus whatever the page snapshot paints.
 *
 * This is pure bookkeeping — it doesn't subscribe to relays itself;
 * the existing feed composables already know when new items arrive
 * and call trackArrival.
 */

const LAST_SEEN_KEY = 'unreadLastSeen'

// Map<channelKey, latestArrivalTimestamp>
const latestArrivals = ref(new Map())
// Map<channelKey, lastSeenTimestamp>  — hydrated from cache on first access
const lastSeen = ref(null)

function ensureLastSeenLoaded(pubkey) {
  if (lastSeen.value && lastSeen.value._pubkey === pubkey) return lastSeen.value
  const cached = cacheManager.get('snapshots', `${LAST_SEEN_KEY}:${pubkey}`)
  const m = new Map(Array.isArray(cached) ? cached : [])
  m._pubkey = pubkey
  lastSeen.value = m
  return m
}

function persistLastSeen(pubkey) {
  if (!lastSeen.value || lastSeen.value._pubkey !== pubkey) return
  const entries = Array.from(lastSeen.value.entries())
    .filter(([k]) => typeof k === 'string' && !k.startsWith('_'))
  cacheManager.set('snapshots', `${LAST_SEEN_KEY}:${pubkey}`, entries)
}

/**
 * Factory. `pubkey` scopes the storage key so switching accounts
 * resets the unread state (a different user's "unread" doesn't bleed
 * across).
 *
 * @param {import('vue').Ref<{ pubkey?: string } | null> | (() => string|null)} pubkeyRef
 */
export function useUnread(pubkeyRef) {
  const getPubkey = () => {
    if (!pubkeyRef) return null
    if (typeof pubkeyRef === 'function') return pubkeyRef()
    const v = pubkeyRef.value
    return typeof v === 'string' ? v : v?.pubkey || null
  }

  /**
   * Record that a new item arrived for a channel. If multiple arrive
   * in quick succession we only keep the latest timestamp — the count
   * of unread is then derived from "latest arrival > last seen".
   */
  const trackArrival = (channel, timestamp) => {
    if (!channel || typeof timestamp !== 'number') return
    const prev = latestArrivals.value.get(channel) || 0
    if (timestamp > prev) {
      const next = new Map(latestArrivals.value)
      next.set(channel, timestamp)
      latestArrivals.value = next
    }
  }

  /**
   * Mark the channel as seen — call from the page's onMounted and
   * when the user returns to the top of the feed.
   */
  const markSeen = (channel) => {
    const pk = getPubkey()
    if (!pk || !channel) return
    const ls = ensureLastSeenLoaded(pk)
    const now = Math.floor(Date.now() / 1000)
    ls.set(channel, now)
    persistLastSeen(pk)
    // Force reactivity — Map mutations aren't tracked by Vue.
    lastSeen.value = new Map(ls)
    lastSeen.value._pubkey = pk
  }

  /**
   * Returns a reactive boolean — true when the channel has items
   * arrived after the user last saw it.
   */
  const hasUnread = (channel) => computed(() => {
    const pk = getPubkey()
    if (!pk) return false
    const ls = ensureLastSeenLoaded(pk)
    const seen = ls.get(channel) || 0
    const latest = latestArrivals.value.get(channel) || 0
    return latest > seen
  })

  /**
   * Reactive timestamp diff — useful for "N new" style badges when the
   * channel tracks item count instead of existence.
   */
  const unreadSince = (channel) => computed(() => {
    const pk = getPubkey()
    if (!pk) return 0
    const ls = ensureLastSeenLoaded(pk)
    return ls.get(channel) || 0
  })

  return {
    trackArrival,
    markSeen,
    hasUnread,
    unreadSince,
  }
}
