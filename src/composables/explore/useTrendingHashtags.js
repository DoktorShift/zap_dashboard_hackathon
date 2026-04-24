/**
 * useTrendingHashtags — rolling hashtag popularity from kind:1 notes.
 *
 * Scope is honest: "trending on the user's connected relays in the last
 * two hours". Not a global index. When a global aggregator is available
 * in the future, swap the subscription/ingest for that source — the
 * public shape (trending ref with [{ tag, count }]) stays identical.
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { cacheManager } from '../../services/nostr/CacheManager.js'
import { extractHashtags } from '../../utils/nostr/extractHashtags.js'

const WINDOW_SECONDS = 2 * 60 * 60      // 2h sliding window
const NOTE_LIMIT = 500                   // backlog cap on subscription open
const RECOMPUTE_INTERVAL_MS = 30 * 1000
const TOP_N = 15
const STOP_GRACE_MS = 30 * 1000

const SNAP_KEY = 'explore:trending'

// notesByHashtag: Map<tag, Set<noteTimestampSeconds_and_noteId>>
// We store per-tag timestamped occurrences so the sliding window can
// evict accurately. Using "ts|noteId" composite keys to dedupe a single
// note's hashtag occurrences across identical events ingested twice.
const tagOccurrences = new Map()
const seenNoteIds = new Set()

const trending = ref([])          // [{ tag, count }]
const isLoading = ref(true)

let subscription = null
let refCount = 0
let recomputeTimer = null
let stopGraceTimer = null
let hydratedOnce = false

function nowSeconds() { return Math.floor(Date.now() / 1000) }

function ingestNote(event) {
  if (!event?.id || !event.content) return false
  if (seenNoteIds.has(event.id)) return false

  const ts = Number(event.created_at)
  if (!Number.isFinite(ts)) return false
  if (nowSeconds() - ts > WINDOW_SECONDS) return false

  const tags = extractHashtags(event.content)
  if (tags.length === 0) return false

  seenNoteIds.add(event.id)
  for (const tag of tags) {
    let set = tagOccurrences.get(tag)
    if (!set) { set = new Set(); tagOccurrences.set(tag, set) }
    set.add(`${ts}|${event.id}`)
  }
  return true
}

function recompute() {
  const cutoff = nowSeconds() - WINDOW_SECONDS

  // Evict expired occurrences; drop tags whose last occurrence fell out.
  for (const [tag, set] of tagOccurrences) {
    for (const key of set) {
      const ts = Number(key.split('|', 1)[0])
      if (ts < cutoff) set.delete(key)
    }
    if (set.size === 0) tagOccurrences.delete(tag)
  }

  const counted = [...tagOccurrences.entries()].map(([tag, set]) => ({
    tag,
    count: set.size,
  }))

  counted.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  trending.value = counted.slice(0, TOP_N)

  try {
    cacheManager.set('snapshots', SNAP_KEY, {
      list: trending.value,
      savedAt: Date.now(),
    })
  } catch { /* non-fatal */ }
}

function hydrateFromSnapshot() {
  if (hydratedOnce) return
  hydratedOnce = true
  const snap = cacheManager.get('snapshots', SNAP_KEY)
  if (snap?.list && Array.isArray(snap.list)) {
    trending.value = snap.list
  }
}

function openSubscription() {
  const since = nowSeconds() - WINDOW_SECONDS
  subscription = nostrService.subscribe(
    [{ kinds: [1], since, limit: NOTE_LIMIT }],
    {
      onevent: (event) => { ingestNote(event) },
      oneose: () => {
        isLoading.value = false
        recompute()
      },
      onclose: () => {},
    }
  )
}

function start() {
  refCount += 1
  if (stopGraceTimer) { clearTimeout(stopGraceTimer); stopGraceTimer = null }
  if (subscription) return

  hydrateFromSnapshot()
  openSubscription()

  if (!recomputeTimer) {
    recomputeTimer = setInterval(recompute, RECOMPUTE_INTERVAL_MS)
  }
}

function stop() {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) return
  if (stopGraceTimer) return

  stopGraceTimer = setTimeout(() => {
    stopGraceTimer = null
    if (refCount > 0) return
    try { subscription?.close?.() } catch { /* ignore */ }
    subscription = null
    if (recomputeTimer) { clearInterval(recomputeTimer); recomputeTimer = null }
  }, STOP_GRACE_MS)
}

export function useTrendingHashtags({ auto = true } = {}) {
  if (auto) {
    onMounted(start)
    onBeforeUnmount(stop)
  }
  return { trending, isLoading, start, stop }
}

export const __testing__ = {
  getTagOccurrences: () => tagOccurrences,
  resetAll() {
    tagOccurrences.clear()
    seenNoteIds.clear()
    trending.value = []
    isLoading.value = true
    hydratedOnce = false
    if (recomputeTimer) { clearInterval(recomputeTimer); recomputeTimer = null }
    if (stopGraceTimer) { clearTimeout(stopGraceTimer); stopGraceTimer = null }
    subscription = null
    refCount = 0
  },
  ingestNote,
  recompute,
  hydrateFromSnapshot,
}
