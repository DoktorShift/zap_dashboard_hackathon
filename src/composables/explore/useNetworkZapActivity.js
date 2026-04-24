/**
 * useNetworkZapActivity — global kind:9735 activity for the Explore page.
 *
 * Opens a single subscription against the relays the user is already
 * connected to and feeds four reactive views from one event stream:
 *   - last24hTotal   : running sum of sats in the 24h sliding window
 *   - topZappers7d   : top 10 senders by sats in the last 7 days
 *   - topCreators7d  : top 10 recipients by sats in the last 7 days
 *   - wireFeed       : ring buffer of the most recent 30 zaps
 *
 * Honesty notes:
 *  - "Global" means "observable on the user's connected relays". That is
 *    all the rest of ZapTracker sees, and matches our local-first stance.
 *  - UI commits are throttled (1/s) and leaderboards are recomputed from
 *    the underlying Map, so late-arriving events that fall inside the
 *    window update totals deterministically rather than double-counting.
 *  - The subscription is reference-counted so mounting several Explore
 *    sub-components shares one upstream sub; unmount has a 30s grace so
 *    quick route changes don't thrash relays.
 */

import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { cacheManager } from '../../services/nostr/CacheManager.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { isCacheEntry, unwrap } from '../../services/nostr/CacheEntry.js'

const SEVEN_DAYS_S = 7 * 24 * 60 * 60
const TWENTY_FOUR_H_S = 24 * 60 * 60

const WIRE_CAP = 30
const LEADERBOARD_CAP = 10
const COMMIT_INTERVAL_MS = 1000
const DECAY_INTERVAL_MS = 60 * 1000
const PROFILE_BATCH_DEBOUNCE_MS = 250
const PROFILE_BATCH_SIZE = 50
const STOP_GRACE_MS = 30 * 1000

const SNAP_24H = 'explore:zaps24h'
const SNAP_BOARDS = 'explore:leaderboards7d'
const SNAP_WIRE = 'explore:wire'

// ── Module-level shared state ────────────────────────────────────────

// id → { ts (unix seconds), amount, zapper, recipient, eventId, message }
const zapsById = new Map()

const last24hTotal = ref(0)
const topZappers7d = ref([])
const topCreators7d = ref([])
const wireFeed = ref([])
const profiles = reactive(new Map())
const isLoading = ref(true)

let subscription = null
let refCount = 0
let commitTimer = null
let decayTimer = null
let stopGraceTimer = null
let profileBatchTimer = null
let hydratedOnce = false
const pendingProfilePubkeys = new Set()

// ── Helpers ──────────────────────────────────────────────────────────

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function recipientOf(rawEvent) {
  if (!rawEvent?.tags) return null
  const p = rawEvent.tags.find(t => t?.[0] === 'p')
  return p?.[1] || null
}

function ingestParsed(parsed) {
  if (!parsed || !parsed.id) return false
  if (zapsById.has(parsed.id)) return false

  const recipient = recipientOf(parsed.rawZapEvent)
  if (!recipient) return false

  const tsSeconds = Math.floor(new Date(parsed.timestamp).getTime() / 1000)
  if (!Number.isFinite(tsSeconds)) return false

  // Drop anything older than the 7d window — belt-and-braces; the
  // subscription filter already includes `since` but snapshots may carry
  // older entries.
  if (nowSeconds() - tsSeconds > SEVEN_DAYS_S) return false

  zapsById.set(parsed.id, {
    id: parsed.id,
    ts: tsSeconds,
    amount: Number(parsed.amount) || 0,
    zapper: parsed.zapperPubkey,
    recipient,
    eventId: parsed.zappedEventId || null,
    message: parsed.message || '',
  })

  // Surface new pubkeys to the profile batcher.
  if (parsed.zapperPubkey) queueProfileFetch(parsed.zapperPubkey)
  queueProfileFetch(recipient)
  return true
}

function scheduleCommit() {
  if (commitTimer) return
  commitTimer = setTimeout(() => {
    commitTimer = null
    commit()
  }, COMMIT_INTERVAL_MS)
}

function commit() {
  const now = nowSeconds()
  const cutoff7d = now - SEVEN_DAYS_S
  const cutoff24h = now - TWENTY_FOUR_H_S

  let total24h = 0
  const senderMap = new Map()
  const recipMap = new Map()
  const wire = []

  // Single pass over all tracked zaps — evict out-of-window entries.
  for (const [id, z] of zapsById) {
    if (z.ts < cutoff7d) {
      zapsById.delete(id)
      continue
    }
    if (z.ts >= cutoff24h) total24h += z.amount

    // 7d sender aggregate
    let s = senderMap.get(z.zapper)
    if (!s) { s = { pubkey: z.zapper, totalSats: 0, zapCount: 0 }; senderMap.set(z.zapper, s) }
    s.totalSats += z.amount
    s.zapCount += 1

    // 7d recipient aggregate — noteCount counts distinct zappedEventIds.
    let r = recipMap.get(z.recipient)
    if (!r) {
      r = { pubkey: z.recipient, totalSats: 0, zapCount: 0, noteCount: 0, _events: new Set() }
      recipMap.set(z.recipient, r)
    }
    r.totalSats += z.amount
    r.zapCount += 1
    if (z.eventId && !r._events.has(z.eventId)) {
      r._events.add(z.eventId)
      r.noteCount += 1
    }

    wire.push(z)
  }

  last24hTotal.value = total24h

  topZappers7d.value = [...senderMap.values()]
    .sort((a, b) => b.totalSats - a.totalSats)
    .slice(0, LEADERBOARD_CAP)

  topCreators7d.value = [...recipMap.values()]
    .map(({ _events, ...rest }) => rest)
    .sort((a, b) => b.totalSats - a.totalSats)
    .slice(0, LEADERBOARD_CAP)

  wire.sort((a, b) => b.ts - a.ts)
  wireFeed.value = wire.slice(0, WIRE_CAP)

  persistSnapshots()
}

function persistSnapshots() {
  try {
    cacheManager.set('snapshots', SNAP_24H, {
      total: last24hTotal.value,
      savedAt: Date.now(),
    })
    cacheManager.set('snapshots', SNAP_BOARDS, {
      zappers: topZappers7d.value,
      creators: topCreators7d.value,
      savedAt: Date.now(),
    })
    cacheManager.set('snapshots', SNAP_WIRE, wireFeed.value)
  } catch {
    // non-fatal — snapshots are just cold-start seed
  }
}

function hydrateFromSnapshots() {
  if (hydratedOnce) return
  hydratedOnce = true

  const saved24h = cacheManager.get('snapshots', SNAP_24H)
  if (saved24h && typeof saved24h.total === 'number') {
    last24hTotal.value = saved24h.total
  }

  const boards = cacheManager.get('snapshots', SNAP_BOARDS)
  if (boards?.zappers) topZappers7d.value = boards.zappers
  if (boards?.creators) topCreators7d.value = boards.creators

  const wire = cacheManager.get('snapshots', SNAP_WIRE)
  if (Array.isArray(wire)) {
    wireFeed.value = wire
    // Seed zapsById so live events don't re-process cached entries.
    for (const z of wire) {
      if (z?.id && !zapsById.has(z.id)) zapsById.set(z.id, z)
    }
  }
}

// ── Profile batching ────────────────────────────────────────────────

function queueProfileFetch(pubkey) {
  if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64) return
  if (profiles.has(pubkey)) return
  // If cache already has an envelope for this pubkey, materialize it and
  // skip the network.
  const cached = cacheManager.get('profiles', pubkey)
  if (isCacheEntry(cached)) {
    const v = unwrap(cached)
    if (v) { profiles.set(pubkey, v); return }
  }
  pendingProfilePubkeys.add(pubkey)
  if (profileBatchTimer) return
  profileBatchTimer = setTimeout(flushProfileBatch, PROFILE_BATCH_DEBOUNCE_MS)
}

async function flushProfileBatch() {
  profileBatchTimer = null
  if (pendingProfilePubkeys.size === 0) return
  const batch = [...pendingProfilePubkeys]
  pendingProfilePubkeys.clear()

  for (let i = 0; i < batch.length; i += PROFILE_BATCH_SIZE) {
    const slice = batch.slice(i, i + PROFILE_BATCH_SIZE)
    try {
      await profileService.batch(slice)
    } catch {
      // ignore — profiles stay as fallbacks
    }
    // Materialize results into the reactive map regardless of fetch
    // outcome so the UI can render a name/fallback.
    for (const pk of slice) {
      const cached = cacheManager.get('profiles', pk)
      const v = unwrap(cached)
      if (v) profiles.set(pk, v)
    }
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────

function openSubscription() {
  const sinceSeconds = nowSeconds() - SEVEN_DAYS_S
  subscription = nostrService.subscribe(
    [{ kinds: [9735], since: sinceSeconds }],
    {
      onevent: (event) => {
        const parsed = parseZapReceipt(event)
        if (ingestParsed(parsed)) scheduleCommit()
      },
      oneose: () => {
        isLoading.value = false
        // Force a commit after EOSE even if throttled.
        if (commitTimer) { clearTimeout(commitTimer); commitTimer = null }
        commit()
      },
      onclose: () => {
        // If relays drop us we keep the state and simply stop adding.
        // Caller may choose to start() again; start is idempotent.
      },
    }
  )
}

function start() {
  refCount += 1
  if (stopGraceTimer) {
    clearTimeout(stopGraceTimer)
    stopGraceTimer = null
  }
  if (subscription) return

  hydrateFromSnapshots()
  openSubscription()

  if (!decayTimer) {
    decayTimer = setInterval(commit, DECAY_INTERVAL_MS)
  }
}

function stop() {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) return
  if (stopGraceTimer) return

  // Grace period: if the same page remounts during navigation we avoid
  // tearing down and re-opening the upstream subscription.
  stopGraceTimer = setTimeout(() => {
    stopGraceTimer = null
    if (refCount > 0) return
    try { subscription?.close?.() } catch { /* ignore */ }
    subscription = null
    if (commitTimer) { clearTimeout(commitTimer); commitTimer = null }
    if (decayTimer)  { clearInterval(decayTimer); decayTimer = null }
  }, STOP_GRACE_MS)
}

// ── Exposed composable ──────────────────────────────────────────────

export function useNetworkZapActivity({ auto = true } = {}) {
  if (auto) {
    onMounted(start)
    onBeforeUnmount(stop)
  }

  return {
    last24hTotal,
    topZappers7d,
    topCreators7d,
    wireFeed,
    profiles,
    isLoading,
    profileOf: (pubkey) => profiles.get(pubkey) || null,
    start,
    stop,
  }
}

// ── Test hooks (non-public) ─────────────────────────────────────────

export const __testing__ = {
  getZapsById: () => zapsById,
  resetAll() {
    zapsById.clear()
    pendingProfilePubkeys.clear()
    profiles.clear()
    last24hTotal.value = 0
    topZappers7d.value = []
    topCreators7d.value = []
    wireFeed.value = []
    isLoading.value = true
    hydratedOnce = false
    if (commitTimer) { clearTimeout(commitTimer); commitTimer = null }
    if (decayTimer) { clearInterval(decayTimer); decayTimer = null }
    if (stopGraceTimer) { clearTimeout(stopGraceTimer); stopGraceTimer = null }
    if (profileBatchTimer) { clearTimeout(profileBatchTimer); profileBatchTimer = null }
    subscription = null
    refCount = 0
  },
  ingestParsed,
  commit,
  hydrateFromSnapshots,
  queueProfileFetch,
  flushProfileBatch,
}
