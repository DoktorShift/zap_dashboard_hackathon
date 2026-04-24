import { cacheManager } from '../../../services/nostr/CacheManager.js'

/**
 * useNotesSnapshot — persistent cold-start paint for the user's notes.
 * Writes the most recent N notes to cacheManager's 'snapshots' namespace
 * (7d TTL, localStorage-backed) so the Notes page is never blank on
 * return visits.
 *
 * Consumer-level debounce (400ms) coalesces a cold fetch of 500 notes
 * into ONE filter/sort/slice pass. CacheManager's own 2s write-to-
 * localStorage debounce sits downstream, so the whole burst becomes
 * a single setItem.
 *
 * The `notes` ref is passed in by the caller — the snapshot module
 * doesn't own the note state, it just reads from it.
 */

const SNAPSHOT_KEY = 'userNotes'
const SNAPSHOT_MAX = 100
const DEBOUNCE_MS = 400

let _debounceTimer = null

/**
 * @param {import('vue').Ref<Array<object>>} notesRef
 * @returns {{
 *   hydrate: (pubkey: string) => void,
 *   persist: (pubkey: string) => void,
 *   flush: (pubkey: string) => void,
 * }}
 */
export function useNotesSnapshot(notesRef, processedIdsSet = null) {
  const hydrate = (pubkey) => {
    if (!pubkey || notesRef.value.length > 0) return
    const snap = cacheManager.get('snapshots', `${SNAPSHOT_KEY}:${pubkey}`)
    if (!Array.isArray(snap) || snap.length === 0) return
    notesRef.value = snap.slice()
    // Seed the dedupe set if the consumer gave us one, so the live
    // subscription's replay of already-cached notes doesn't duplicate
    // them into the UI.
    if (processedIdsSet) {
      for (const n of snap) processedIdsSet.add(n.id)
    }
  }

  const persist = (pubkey) => {
    if (!pubkey) return
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      const snap = notesRef.value
        .filter(n => n.pubkey === pubkey)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, SNAPSHOT_MAX)
        .map(({ sig, ...rest }) => rest) // strip sig to shrink payload
      cacheManager.set('snapshots', `${SNAPSHOT_KEY}:${pubkey}`, snap)
    }, DEBOUNCE_MS)
  }

  /**
   * Force the debounced write immediately. Use on logout so the write
   * doesn't fire after the auth watcher clears notes.value to [].
   */
  const flush = (pubkey) => {
    if (!pubkey || !_debounceTimer) return
    clearTimeout(_debounceTimer)
    _debounceTimer = null
    const snap = notesRef.value
      .filter(n => n.pubkey === pubkey)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, SNAPSHOT_MAX)
      .map(({ sig, ...rest }) => rest)
    cacheManager.set('snapshots', `${SNAPSHOT_KEY}:${pubkey}`, snap)
  }

  return { hydrate, persist, flush }
}
