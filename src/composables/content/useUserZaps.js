import { ref, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { cacheManager } from '../../services/nostr/CacheManager.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { markStale, markFresh } from '../core/useStaleness.js'
import { useUnread } from '../core/useUnread.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'

const SNAPSHOT_KEY = 'userZaps'
const SNAPSHOT_MAX = 200

// Module-scope state (shared across all component instances).
// `zapsById` is the single source of truth; `seenZapIds` is a DERIVED
// view over its keys — never mutated independently. This keeps dedup
// idempotent across resubscribe (remount produces identical state).
const userZaps = ref([])
const isLoading = ref(false)
const zapsById = new Map()
let liveSubscription = null
let subNonce = 0

const hasSeen = (id) => zapsById.has(id)
const recordZap = (id, enriched) => { zapsById.set(id, enriched) }
const refreshList = () => {
  const list = Array.from(zapsById.values())
  list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  userZaps.value = list
}

/**
 * Hydrate zapsById synchronously from the persistent cache. Called on
 * first tracker start (per pubkey) so the Dashboard paints instantly
 * with the last known zaps while the fresh subscription catches up.
 */
const hydrateFromSnapshot = (pubkey) => {
  if (!pubkey || zapsById.size > 0) return
  const snap = cacheManager.get('snapshots', `${SNAPSHOT_KEY}:${pubkey}`)
  if (!Array.isArray(snap)) return
  for (const z of snap) {
    if (z?.id) zapsById.set(z.id, z)
  }
  refreshList()
}

const persistSnapshot = (pubkey) => {
  if (!pubkey) return
  const snap = Array.from(zapsById.values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, SNAPSHOT_MAX)
  cacheManager.set('snapshots', `${SNAPSHOT_KEY}:${pubkey}`, snap)
}

// Enrich a parsed zap with profile data, returning the shape App.vue expects
const enrichZap = (parsed, profile) => {
  return {
    id: parsed.id,
    amount: parsed.amount,
    timestamp: parsed.timestamp,
    sender: {
      pubkey: parsed.zapperPubkey,
      name: profile?.name || `user:${parsed.zapperPubkey.substring(0, 8)}`,
      picture: profile?.picture || generateAvatar(parsed.zapperPubkey),
      avatar: profile?.picture || generateAvatar(parsed.zapperPubkey),
      nip05: profile?.nip05 || null,
      about: profile?.about || null
    },
    note: parsed.message || 'Zap',
    noteType: 'original',
    client: 'nostr',
    source: 'nip57',
    eventId: parsed.zappedEventId
  }
}

export function useUserZaps() {
  const { currentUser, isAuthenticated } = useNostrAuth()
  // Unread tracker — live zap arrivals flip the sidebar dot until the
  // user opens the Zap Feed page.
  const { trackArrival } = useUnread(currentUser)

  const startTracking = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) return
    if (isLoading.value) return

    const pubkey = currentUser.value.pubkey
    // Paint last known zaps immediately from the persistent cache so
    // the Dashboard is never blank on return visits.
    hydrateFromSnapshot(pubkey)
    isLoading.value = true

    try {
      // Phase 1: Historical fetch — outbox-routed via recipient's inbox
      // (other people's zap receipts for me live on their write relays,
      //  but #p filter routing still helps narrow the fan-out).
      const rawZapEvents = await nostrService.queryOutbox(
        [{ kinds: [9735], '#p': [pubkey], limit: 500 }],
        { timeout: 12_000, eoseGrace: 1_500 }
      )

      // Phase 2: Parse (parseZapReceipt now cross-verifies bolt11 vs
      // zap request; forged receipts return null). Dedup is idempotent
      // because zapsById is the source of truth.
      const newParsed = []
      for (const zapEvent of rawZapEvents) {
        const parsed = parseZapReceipt(zapEvent)
        if (!parsed) continue
        if (hasSeen(parsed.id)) continue
        newParsed.push(parsed)
      }

      // Phase 3: Batch fetch profiles for unique zappers in this batch.
      const uniquePubkeys = [...new Set(newParsed.map(z => z.zapperPubkey))]
      await profileService.batch(uniquePubkeys)

      // Phase 4: Enrich + commit. Writing to zapsById is atomic per-id.
      for (const parsed of newParsed) {
        const cached = profileService.getCached(parsed.zapperPubkey)
        recordZap(parsed.id, enrichZap(parsed, cached || null))
      }

      // Cap zapsById to most recent 1000 (LRU by timestamp).
      if (zapsById.size > 1000) {
        const entries = Array.from(zapsById.entries())
          .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
          .slice(0, 1000)
        zapsById.clear()
        for (const [id, z] of entries) zapsById.set(id, z)
      }

      refreshList()
      persistSnapshot(pubkey)

      // Phase 5: Open live subscription for new incoming zaps
      if (liveSubscription) {
        liveSubscription.close()
        liveSubscription = null
      }

      const nonce = ++subNonce
      liveSubscription = nostrService.subscribeOutbox(
        [{ kinds: [9735], '#p': [pubkey], since: Math.floor(Date.now() / 1000) }],
        {
          _nonce: nonce,
          onevent: async (zapEvent) => {
            const parsed = parseZapReceipt(zapEvent)
            if (!parsed) return
            if (hasSeen(parsed.id)) return

            let profile = null
            try {
              profile = await profileService.get(parsed.zapperPubkey)
            } catch { /* fallback profile */ }

            recordZap(parsed.id, enrichZap(parsed, profile))
            refreshList()
            persistSnapshot(pubkey)
            // Unread dot — zapEvent.created_at is seconds; useUnread
            // compares against the per-channel lastSeen timestamp.
            trackArrival('zaps', zapEvent.created_at)
          },
          oneose: () => {},
          onclose: () => { liveSubscription = null }
        }
      )

      // Fetch succeeded and the live sub is open — clear any previous
      // staleness flag so the TopBar drops the indicator.
      markFresh('zaps')
    } catch (err) {
      console.error('[useUserZaps] Failed to start tracking:', err)
      // User still sees the cold-paint snapshot — make sure they know
      // it's cached, not live.
      markStale('zaps', getUserFriendlyError(err))
    } finally {
      isLoading.value = false
    }
  }

  const stopTracking = () => {
    if (liveSubscription) {
      liveSubscription.close()
      liveSubscription = null
    }
    userZaps.value = []
    zapsById.clear()
    markFresh('zaps')
  }

  // Auto-start when authenticated
  watch(isAuthenticated, (auth) => {
    if (auth) {
      startTracking().catch(err => {
        markStale('zaps', getUserFriendlyError(err))
        console.warn('[useUserZaps] Start tracking failed:', err?.message)
      })
    } else {
      stopTracking()
    }
  }, { immediate: true })

  return {
    userZaps: computed(() => userZaps.value),
    isLoading: computed(() => isLoading.value),
    startTracking,
    stopTracking
  }
}
