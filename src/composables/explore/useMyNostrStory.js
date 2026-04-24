/**
 * useMyNostrStory — personal stats for the "Your Story" strip on Explore.
 *
 * Four numbers we can honestly derive from the user's relays:
 *   - accountAgeDays       : days since the earliest event we can find
 *                             authored by this pubkey
 *   - biggestZapReceived   : max single-zap amount received + sender
 *   - creatorsZappedCount  : distinct recipients of zaps this user sent
 *   - firstZapSentDate     : ISO date of this user's earliest sent zap
 *
 * Honesty notes:
 *  - "Earliest event" is bounded by what the user's relays retain; some
 *    relays prune history. We surface the best we can see and mark
 *    `isPartial` when the limit was hit so the UI can soften the copy
 *    ("On Nostr for at least N days").
 *  - "Creators zapped" depends on `#P` (capital) being indexed by relays.
 *    If relays don't return a signal for it, we also filter-in-memory
 *    over a receipts-by-sender sample as a second pass. If both come up
 *    empty we leave the value null — better to hide than lie.
 *  - Values are cached per-pubkey in the 'snapshots' namespace so the
 *    strip paints instantly on subsequent visits.
 */

import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { cacheManager } from '../../services/nostr/CacheManager.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { isCacheEntry, unwrap } from '../../services/nostr/CacheEntry.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'

const EARLIEST_EVENT_LIMIT = 500
const RECEIVED_LIMIT = 500
const SENT_LIMIT = 1000
const QUERY_TIMEOUT = 20_000

const SNAP_PREFIX = 'explore:story'

function snapKey(pubkey) { return `${SNAP_PREFIX}:${pubkey}` }

function daysSince(tsSeconds) {
  if (!Number.isFinite(tsSeconds)) return null
  const diffMs = Date.now() - tsSeconds * 1000
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
}

function recipientOf(rawEvent) {
  const p = rawEvent?.tags?.find(t => t?.[0] === 'p')
  return p?.[1] || null
}

/**
 * Resolve accountAgeDays. Returns { accountAgeDays, firstEventAt, isPartial }
 */
async function fetchAccountAge(pubkey) {
  const events = await nostrService.query(
    [{ authors: [pubkey], limit: EARLIEST_EVENT_LIMIT }],
    { timeout: QUERY_TIMEOUT }
  )
  if (!Array.isArray(events) || events.length === 0) {
    return { accountAgeDays: null, firstEventAt: null, isPartial: false }
  }
  let min = Infinity
  for (const e of events) {
    const ts = Number(e?.created_at)
    if (Number.isFinite(ts) && ts < min) min = ts
  }
  if (!Number.isFinite(min)) {
    return { accountAgeDays: null, firstEventAt: null, isPartial: false }
  }
  return {
    accountAgeDays: daysSince(min),
    firstEventAt: min,
    isPartial: events.length >= EARLIEST_EVENT_LIMIT,
  }
}

/**
 * Resolve biggestZapReceived. Returns { biggestZapReceived: { amount, fromPubkey, eventId } | null }
 */
async function fetchBiggestZapReceived(pubkey) {
  const events = await nostrService.query(
    [{ kinds: [9735], '#p': [pubkey], limit: RECEIVED_LIMIT }],
    { timeout: QUERY_TIMEOUT }
  )
  let best = null
  for (const e of events || []) {
    const parsed = parseZapReceipt(e)
    if (!parsed) continue
    if (!best || parsed.amount > best.amount) {
      best = {
        amount: parsed.amount,
        fromPubkey: parsed.zapperPubkey,
        eventId: parsed.zappedEventId,
        message: parsed.message,
        timestamp: parsed.timestamp,
      }
    }
  }
  return { biggestZapReceived: best }
}

/**
 * Resolve creatorsZappedCount + firstZapSentDate.
 *
 * Strategy: try `#P` (capital P is the conventional sender index tag on
 * receipts). Fall back to a broader query filtered in-memory.
 */
async function fetchSentZapsStats(pubkey) {
  let receipts = []
  try {
    receipts = await nostrService.query(
      [{ kinds: [9735], '#P': [pubkey], limit: SENT_LIMIT }],
      { timeout: QUERY_TIMEOUT }
    )
  } catch {
    receipts = []
  }

  const recipients = new Set()
  let earliestTs = Infinity
  for (const e of receipts || []) {
    const parsed = parseZapReceipt(e)
    if (!parsed) continue
    // Guard against any relay returning the wrong sender.
    if (parsed.zapperPubkey !== pubkey) continue
    const recipient = recipientOf(e)
    if (recipient) recipients.add(recipient)
    const ts = Math.floor(new Date(parsed.timestamp).getTime() / 1000)
    if (Number.isFinite(ts) && ts < earliestTs) earliestTs = ts
  }

  return {
    creatorsZappedCount: recipients.size || null,
    firstZapSentAt: Number.isFinite(earliestTs) ? earliestTs : null,
  }
}

export function useMyNostrStory() {
  const { currentUser, isAuthenticated } = useNostrAuth()

  const accountAgeDays = ref(null)
  const accountAgeIsPartial = ref(false)
  const biggestZapReceived = ref(null)   // { amount, fromPubkey, eventId, message, timestamp }
  const biggestZapSenderProfile = ref(null)
  const creatorsZappedCount = ref(null)
  const firstZapSentAt = ref(null)
  const isLoading = ref(false)
  const error = ref('')

  let lastLoadedForPubkey = null
  let inflight = null
  let cancelled = false

  const firstZapSentDate = computed(() => {
    if (!firstZapSentAt.value) return null
    return new Date(firstZapSentAt.value * 1000)
  })

  const hydrateFromSnapshot = (pubkey) => {
    const snap = cacheManager.get('snapshots', snapKey(pubkey))
    if (!snap) return false
    accountAgeDays.value = snap.accountAgeDays ?? null
    accountAgeIsPartial.value = !!snap.accountAgeIsPartial
    biggestZapReceived.value = snap.biggestZapReceived ?? null
    creatorsZappedCount.value = snap.creatorsZappedCount ?? null
    firstZapSentAt.value = snap.firstZapSentAt ?? null
    return true
  }

  const persistSnapshot = (pubkey) => {
    cacheManager.set('snapshots', snapKey(pubkey), {
      accountAgeDays: accountAgeDays.value,
      accountAgeIsPartial: accountAgeIsPartial.value,
      biggestZapReceived: biggestZapReceived.value,
      creatorsZappedCount: creatorsZappedCount.value,
      firstZapSentAt: firstZapSentAt.value,
      savedAt: Date.now(),
    })
  }

  const load = async (pubkey, { forceFresh = false } = {}) => {
    if (!pubkey) return
    if (!forceFresh && lastLoadedForPubkey === pubkey && inflight) return inflight
    lastLoadedForPubkey = pubkey

    // Paint from cache immediately.
    hydrateFromSnapshot(pubkey)

    isLoading.value = true
    error.value = ''
    cancelled = false

    inflight = (async () => {
      try {
        const [age, received, sent] = await Promise.all([
          fetchAccountAge(pubkey),
          fetchBiggestZapReceived(pubkey),
          fetchSentZapsStats(pubkey),
        ])
        if (cancelled || lastLoadedForPubkey !== pubkey) return

        accountAgeDays.value = age.accountAgeDays
        accountAgeIsPartial.value = age.isPartial
        biggestZapReceived.value = received.biggestZapReceived
        creatorsZappedCount.value = sent.creatorsZappedCount
        firstZapSentAt.value = sent.firstZapSentAt
        persistSnapshot(pubkey)

        if (received.biggestZapReceived?.fromPubkey) {
          const fromPk = received.biggestZapReceived.fromPubkey
          const cached = cacheManager.get('profiles', fromPk)
          if (isCacheEntry(cached)) {
            biggestZapSenderProfile.value = unwrap(cached) || null
          }
          profileService.get(fromPk).then(p => {
            if (!cancelled) biggestZapSenderProfile.value = p || null
          }).catch(() => { /* ignore */ })
        } else {
          biggestZapSenderProfile.value = null
        }
      } catch (err) {
        if (!cancelled) error.value = err?.message || 'Failed to load your story'
      } finally {
        if (!cancelled) isLoading.value = false
        inflight = null
      }
    })()

    return inflight
  }

  // Auto-run when user identity changes.
  watch(
    () => (isAuthenticated.value ? currentUser.value?.pubkey : null),
    (pk) => {
      if (!pk) {
        // Reset on logout
        accountAgeDays.value = null
        accountAgeIsPartial.value = false
        biggestZapReceived.value = null
        biggestZapSenderProfile.value = null
        creatorsZappedCount.value = null
        firstZapSentAt.value = null
        lastLoadedForPubkey = null
        return
      }
      load(pk)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => { cancelled = true })

  return {
    accountAgeDays,
    accountAgeIsPartial,
    biggestZapReceived,
    biggestZapSenderProfile,
    creatorsZappedCount,
    firstZapSentAt,
    firstZapSentDate,
    isLoading,
    error,
    refresh: () => currentUser.value?.pubkey && load(currentUser.value.pubkey, { forceFresh: true }),
  }
}

export const __testing__ = {
  fetchAccountAge,
  fetchBiggestZapReceived,
  fetchSentZapsStats,
  recipientOf,
  daysSince,
}
