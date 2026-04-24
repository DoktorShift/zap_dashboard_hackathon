/**
 * useDeskInteractions — Deterministic interaction tracking for SocialDesk.
 *
 * Architecture:
 * - Counts are DERIVED from normalized per-author maps, not incremented.
 *   Reactions and reposts are indexed by pubkey so multiple events from the
 *   same author collapse to one count (NIP-25 latest-reaction-wins).
 *   Resubscribe replays fall into the same map slot — no inflation.
 * - Kind:5 deletion events retract matching reactions/reposts/replies so
 *   deleted interactions don't remain counted.
 * - Reference-counted consumers: the shared subscription is only closed when
 *   the last consumer unmounts.
 * - Replies validated via NIP-10 (`nip10.parseThread`).
 * - Zap receipts gated on `bolt11`/`description` tag presence.
 */

import { reactive, onUnmounted } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { nip10 } from '../../services/nostr/nostrImports.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'

// ── Constants ───────────────────────────────────────────────────
const CHUNK_SIZE = 50
const RESUBSCRIBE_DEBOUNCE = 1500
const TRACKED_IDS_MAX = 300

// ── Singleton state ─────────────────────────────────────────────
//
// eventIndex: Map<postId, {
//   reactionsByAuthor: Map<pubkey, { id, created_at }>,   // latest per author
//   repostsByAuthor:   Map<pubkey, { id, created_at }>,
//   replies:           Set<eventId>,                      // dedup by event id
//   zaps:              Set<eventId>,
//   myReaction: boolean,
//   myRepost:   boolean,
// }>
// reactionEventIndex: Map<eventId, { postId, authorPubkey, kind }>
//   Reverse index for kind:5 deletion retraction.
// postAddressIndex: Map<postId, string>
//   postId → "kind:pubkey:d-tag" coordinate for NIP-33 addressable events
//   (articles, calendar events). Lets us also subscribe to reactions
//   that reference the article by `#a` tag instead of `#e`.
// addressToPostId: Map<string, string>
//   Reverse lookup so classifyEvent can resolve an `a` tag back to its
//   tracked post in O(1).
//
const eventIndex = new Map()
const reactionEventIndex = new Map()
const trackedIds = new Set()
const trackRefCounts = new Map()
const postAddressIndex = new Map()
const addressToPostId = new Map()
let subscription = null
let resubscribeTimer = null
let consumerCount = 0

function getOrCreateEntry(postId) {
  if (!eventIndex.has(postId)) {
    eventIndex.set(postId, {
      reactionsByAuthor: new Map(),
      repostsByAuthor: new Map(),
      replies: new Set(),
      zaps: new Set(),
      myReaction: false,
      myRepost: false,
    })
  }
  return eventIndex.get(postId)
}

/**
 * Derive plain counts. Reactions/reposts count distinct AUTHORS (per NIP-25
 * "latest reaction wins"); replies/zaps count distinct event ids.
 */
function deriveCounts(postId) {
  const entry = eventIndex.get(postId)
  if (!entry) {
    return { reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false }
  }
  return {
    reactions: entry.reactionsByAuthor.size,
    reposts: entry.repostsByAuthor.size,
    replies: entry.replies.size,
    zaps: entry.zaps.size,
    myReaction: entry.myReaction,
    myRepost: entry.myRepost,
  }
}

// ── Reactive counts layer ───────────────────────────────────────
// We use a reactive Map that the UI reads. It's updated after indexing events.
const countsMap = reactive(new Map())

function refreshCounts(postId) {
  countsMap.set(postId, deriveCounts(postId))
}

// ── Event classification ────────────────────────────────────────

function classifyEvent(event, myPubkey) {
  // Kind:5 deletion — retract previously-counted reactions/reposts from
  // this author, regardless of which post they targeted.
  if (event.kind === 5) {
    applyDeletion(event)
    return
  }

  const eTags = event.tags.filter(t => t[0] === 'e')
  const qTags = event.tags.filter(t => t[0] === 'q')
  const aTags = event.tags.filter(t => t[0] === 'a')
  let _thread = null
  const threadRef = () => _thread ?? (_thread = nip10.parseThread(event))

  // Resolve addressable-event references (`a` tag) back to tracked posts.
  // Articles (kind:30023) and other parameterized-replaceable events
  // are often referenced by `kind:pubkey:d-tag` rather than event id,
  // especially when a client reacts to the "latest version".
  const resolvedFromA = new Set()
  for (const aTag of aTags) {
    const addr = aTag[1]
    if (!addr) continue
    const postId = addressToPostId.get(addr)
    if (postId && trackedIds.has(postId)) {
      resolvedFromA.add(postId)
    }
  }

  for (const eTag of eTags) {
    const postId = eTag[1]
    if (!trackedIds.has(postId)) continue

    const entry = getOrCreateEntry(postId)

    switch (event.kind) {
      case 7: {
        // NIP-25: latest reaction per author wins. Older reactions from
        // the same author are replaced, so the count reflects distinct
        // authors not raw event count.
        const prev = entry.reactionsByAuthor.get(event.pubkey)
        if (!prev || event.created_at >= prev.created_at) {
          if (prev) reactionEventIndex.delete(prev.id)
          entry.reactionsByAuthor.set(event.pubkey, { id: event.id, created_at: event.created_at })
          reactionEventIndex.set(event.id, { postId, authorPubkey: event.pubkey, kind: 7 })
        }
        if (myPubkey && event.pubkey === myPubkey) entry.myReaction = true
        refreshCounts(postId)
        break
      }

      case 6:
      case 16: {
        // Reposts: one per author counted (same rationale as reactions).
        const prev = entry.repostsByAuthor.get(event.pubkey)
        if (!prev || event.created_at >= prev.created_at) {
          if (prev) reactionEventIndex.delete(prev.id)
          entry.repostsByAuthor.set(event.pubkey, { id: event.id, created_at: event.created_at })
          reactionEventIndex.set(event.id, { postId, authorPubkey: event.pubkey, kind: event.kind })
        }
        if (myPubkey && event.pubkey === myPubkey) entry.myRepost = true
        refreshCounts(postId)
        break
      }

      case 1: {
        // Reply via NIP-10 (nostr-core handles marker + positional).
        const thread = threadRef()
        const isReply =
          thread.root?.id === postId ||
          thread.reply?.id === postId
        if (isReply) {
          entry.replies.add(event.id)
          reactionEventIndex.set(event.id, { postId, authorPubkey: event.pubkey, kind: 1 })
          refreshCounts(postId)
        }
        break
      }

      case 9735: {
        // NIP-57 zap receipt. Deeper verification lives in parseZapReceipt;
        // here we only gate on shape to avoid counting non-zap kind-9735 noise.
        const hasBolt11 = event.tags.some(t => t[0] === 'bolt11')
        const hasDescription = event.tags.some(t => t[0] === 'description')
        if (hasBolt11 || hasDescription) {
          entry.zaps.add(event.id)
          refreshCounts(postId)
        }
        break
      }
    }
  }

  // Quote posts (NIP-18 via q-tag) counted once per author same as reposts.
  if (event.kind === 1) {
    for (const qTag of qTags) {
      const postId = qTag[1]
      if (!trackedIds.has(postId)) continue

      const entry = getOrCreateEntry(postId)
      const prev = entry.repostsByAuthor.get(event.pubkey)
      if (!prev || event.created_at >= prev.created_at) {
        if (prev) reactionEventIndex.delete(prev.id)
        entry.repostsByAuthor.set(event.pubkey, { id: event.id, created_at: event.created_at })
        reactionEventIndex.set(event.id, { postId, authorPubkey: event.pubkey, kind: 1 })
      }
      if (myPubkey && event.pubkey === myPubkey) entry.myRepost = true
      refreshCounts(postId)
    }
  }

  // `a` tag resolution: events reacting to the article's address (not
  // its event id) count against the resolved post. Skip posts already
  // counted via the `e`-tag loop to avoid double-counting when the
  // event has BOTH `e` and `a` tags pointing at the same post.
  for (const postId of resolvedFromA) {
    if (eTags.some(t => t[1] === postId)) continue
    const entry = getOrCreateEntry(postId)

    if (event.kind === 7) {
      const prev = entry.reactionsByAuthor.get(event.pubkey)
      if (!prev || event.created_at >= prev.created_at) {
        if (prev) reactionEventIndex.delete(prev.id)
        entry.reactionsByAuthor.set(event.pubkey, { id: event.id, created_at: event.created_at })
        reactionEventIndex.set(event.id, { postId, authorPubkey: event.pubkey, kind: 7 })
      }
      if (myPubkey && event.pubkey === myPubkey) entry.myReaction = true
      refreshCounts(postId)
    } else if (event.kind === 6 || event.kind === 16) {
      const prev = entry.repostsByAuthor.get(event.pubkey)
      if (!prev || event.created_at >= prev.created_at) {
        if (prev) reactionEventIndex.delete(prev.id)
        entry.repostsByAuthor.set(event.pubkey, { id: event.id, created_at: event.created_at })
        reactionEventIndex.set(event.id, { postId, authorPubkey: event.pubkey, kind: event.kind })
      }
      if (myPubkey && event.pubkey === myPubkey) entry.myRepost = true
      refreshCounts(postId)
    } else if (event.kind === 9735) {
      const hasBolt11 = event.tags.some(t => t[0] === 'bolt11')
      const hasDescription = event.tags.some(t => t[0] === 'description')
      if (hasBolt11 || hasDescription) {
        entry.zaps.add(event.id)
        refreshCounts(postId)
      }
    }
  }
}

/**
 * Apply a NIP-09 deletion event. Only the author who published the
 * original event is allowed to retract it, so we require matching pubkeys.
 */
function applyDeletion(deletion) {
  const targetIds = deletion.tags.filter(t => t[0] === 'e').map(t => t[1])
  for (const targetId of targetIds) {
    const ref = reactionEventIndex.get(targetId)
    if (!ref) continue
    if (ref.authorPubkey !== deletion.pubkey) continue // unauthorized deletion

    const entry = eventIndex.get(ref.postId)
    if (!entry) continue

    if (ref.kind === 7) {
      const current = entry.reactionsByAuthor.get(ref.authorPubkey)
      if (current?.id === targetId) {
        entry.reactionsByAuthor.delete(ref.authorPubkey)
        if (ref.authorPubkey && entry.myReaction) entry.myReaction = false
      }
    } else if (ref.kind === 6 || ref.kind === 16) {
      const current = entry.repostsByAuthor.get(ref.authorPubkey)
      if (current?.id === targetId) {
        entry.repostsByAuthor.delete(ref.authorPubkey)
        entry.myRepost = false
      }
    } else if (ref.kind === 1) {
      entry.replies.delete(targetId)
    }

    reactionEventIndex.delete(targetId)
    refreshCounts(ref.postId)
  }
}

// ── Subscription management ─────────────────────────────────────

function openSubscription(myPubkey) {
  if (subscription) {
    subscription.close()
    subscription = null
  }

  if (trackedIds.size === 0) return

  const allIds = Array.from(trackedIds)
  const filters = []

  for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
    const chunk = allIds.slice(i, i + CHUNK_SIZE)
    filters.push(
      // Counts dedupe per-author, so the filter limit only needs to cover
      // one latest event per reactor — bumping these matters for
      // popular posts where distinct-author count can exceed the default.
      { kinds: [7], '#e': chunk, limit: 2000 },
      { kinds: [6, 16], '#e': chunk, limit: 1000 },
      { kinds: [1], '#e': chunk, limit: 500 },
      { kinds: [1], '#q': chunk, limit: 500 },
      { kinds: [9735], '#e': chunk, limit: 1000 },
      // NIP-09 deletions so retractions are honored.
      { kinds: [5], '#e': chunk, limit: 500 }
    )
  }

  // Addressable-event interactions (#a). Only emit if any tracked post
  // registered an address — avoids sending unbounded #a filters for a
  // feed of plain notes.
  const addresses = Array.from(addressToPostId.keys())
  if (addresses.length > 0) {
    for (let i = 0; i < addresses.length; i += CHUNK_SIZE) {
      const chunk = addresses.slice(i, i + CHUNK_SIZE)
      filters.push(
        { kinds: [7], '#a': chunk, limit: 2000 },
        { kinds: [6, 16], '#a': chunk, limit: 1000 },
        { kinds: [9735], '#a': chunk, limit: 1000 }
      )
    }
  }

  try {
    subscription = nostrService.subscribe(filters, {
      onevent: (event) => classifyEvent(event, myPubkey),
      oneose: () => { /* initial batch complete */ },
      onclose: () => { subscription = null }
    })
  } catch {
    // Subscription failed — counts stay at 0, safe fallback
  }
}

function scheduleResubscribe(myPubkey) {
  if (resubscribeTimer) clearTimeout(resubscribeTimer)
  resubscribeTimer = setTimeout(() => {
    resubscribeTimer = null
    openSubscription(myPubkey)
  }, RESUBSCRIBE_DEBOUNCE)
}

// ── Public API ──────────────────────────────────────────────────

export function useDeskInteractions() {
  const { currentUser } = useNostrAuth()

  // Reference counting: track how many consumers are active
  consumerCount++

  /**
   * Get reactive interaction counts for a post.
   * Returns a plain object from the reactive countsMap.
   */
  function getInteractions(eventId) {
    if (!countsMap.has(eventId)) {
      countsMap.set(eventId, { reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false })
    }
    return countsMap.get(eventId)
  }

  /**
   * Start tracking interactions for a batch of post IDs.
   */
  function trackPosts(eventIds) {
    let added = false
    for (const id of eventIds) {
      if (!id) continue

      const nextRefCount = (trackRefCounts.get(id) || 0) + 1
      trackRefCounts.set(id, nextRefCount)
      if (nextRefCount > 1) continue

      // Cap tracked IDs — evict oldest + purge its reverse-index entries
      // so the reverse index doesn't grow unbounded.
      if (trackedIds.size >= TRACKED_IDS_MAX) {
        const oldest = trackedIds.values().next().value
        trackedIds.delete(oldest)
        trackRefCounts.delete(oldest)
        const evicted = eventIndex.get(oldest)
        if (evicted) {
          for (const { id: rId } of evicted.reactionsByAuthor.values()) reactionEventIndex.delete(rId)
          for (const { id: rId } of evicted.repostsByAuthor.values()) reactionEventIndex.delete(rId)
          for (const replyId of evicted.replies) reactionEventIndex.delete(replyId)
        }
        const evictedAddr = postAddressIndex.get(oldest)
        if (evictedAddr) {
          addressToPostId.delete(evictedAddr)
          postAddressIndex.delete(oldest)
        }
        eventIndex.delete(oldest)
        countsMap.delete(oldest)
      }

      trackedIds.add(id)
      getOrCreateEntry(id)
      if (!countsMap.has(id)) {
        countsMap.set(id, { reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false })
      }
      added = true
    }

    if (added) {
      scheduleResubscribe(currentUser.value?.pubkey)
    }
  }

  /**
   * Stop tracking interactions for a batch of post IDs.
   */
  function untrackPosts(eventIds) {
    let removed = false
    for (const id of eventIds) {
      const refCount = trackRefCounts.get(id)
      if (!refCount) continue

      if (refCount > 1) {
        trackRefCounts.set(id, refCount - 1)
        continue
      }

      trackRefCounts.delete(id)
      if (trackedIds.delete(id)) {
        const evicted = eventIndex.get(id)
        if (evicted) {
          for (const { id: rId } of evicted.reactionsByAuthor.values()) reactionEventIndex.delete(rId)
          for (const { id: rId } of evicted.repostsByAuthor.values()) reactionEventIndex.delete(rId)
          for (const replyId of evicted.replies) reactionEventIndex.delete(replyId)
        }
        const evictedAddr = postAddressIndex.get(id)
        if (evictedAddr) {
          addressToPostId.delete(evictedAddr)
          postAddressIndex.delete(id)
        }
        eventIndex.delete(id)
        countsMap.delete(id)
        removed = true
      }
    }
    if (removed) {
      scheduleResubscribe(currentUser.value?.pubkey)
    }
  }

  /**
   * Optimistically add a single event to the index.
   * Used after user publishes a reaction/repost — adds the event ID
   * so it's already deduped when the subscription replays it.
   */
  /**
   * Optimistically record an event we just published. Must pass the
   * real signed event id so the live subscription's replay dedups
   * correctly (per-author map entries are keyed on pubkey, so a random
   * fallback id would be harmless for reactions/reposts but corrupt
   * the reverse index). Falls back to a throwaway id only when we
   * truly don't have one.
   */
  function recordLocalEvent(postId, kind, eventId) {
    const entry = getOrCreateEntry(postId)
    const myPubkey = currentUser.value?.pubkey
    const id = eventId || `local-${Date.now()}`
    const now = Math.floor(Date.now() / 1000)

    switch (kind) {
      case 7:
        if (myPubkey) {
          entry.reactionsByAuthor.set(myPubkey, { id, created_at: now })
          reactionEventIndex.set(id, { postId, authorPubkey: myPubkey, kind: 7 })
        }
        entry.myReaction = true
        break
      case 6:
      case 16:
        if (myPubkey) {
          entry.repostsByAuthor.set(myPubkey, { id, created_at: now })
          reactionEventIndex.set(id, { postId, authorPubkey: myPubkey, kind })
        }
        entry.myRepost = true
        break
      case 1:
        entry.replies.add(id)
        if (myPubkey) {
          reactionEventIndex.set(id, { postId, authorPubkey: myPubkey, kind: 1 })
        }
        break
      case 9735:
        entry.zaps.add(id)
        break
    }
    refreshCounts(postId)
  }

  // Cleanup: only close subscription when last consumer unmounts
  onUnmounted(() => {
    consumerCount--
    if (consumerCount <= 0) {
      consumerCount = 0
      if (subscription) { subscription.close(); subscription = null }
      if (resubscribeTimer) { clearTimeout(resubscribeTimer); resubscribeTimer = null }
    }
  })

  /**
   * Register an addressable-event coordinate for a tracked post so
   * interactions referencing the article by `#a` (not `#e`) are also
   * counted. Call alongside trackPosts for kind:30023 articles and
   * other NIP-33 parameterized-replaceable events.
   *
   * @param {string} postId        — event id already passed to trackPosts
   * @param {string} addressCoord  — "kind:pubkey:d-tag"
   */
  function trackPostAddress(postId, addressCoord) {
    if (!postId || !addressCoord) return
    if (!trackedIds.has(postId)) return // must trackPosts() first
    if (postAddressIndex.get(postId) === addressCoord) return // idempotent

    // Clear any prior mapping so reassignments don't leak.
    const previous = postAddressIndex.get(postId)
    if (previous) addressToPostId.delete(previous)

    postAddressIndex.set(postId, addressCoord)
    addressToPostId.set(addressCoord, postId)

    // Kick the resubscribe so new `#a` filters are included.
    scheduleResubscribe(currentUser.value?.pubkey)
  }

  return {
    getInteractions,
    trackPosts,
    untrackPosts,
    trackPostAddress,
    recordLocalEvent
  }
}
