import { ref, computed } from 'vue'

/**
 * useStaleness — tracks which background-refresh sources are currently
 * failing so the UI can surface a "showing cached data" indicator
 * instead of silently presenting stale content as fresh.
 *
 * Pattern: a composable that's in the background-fetch cycle calls
 * `markStale('notes', err.message)` when its fetch errors, and
 * `markFresh('notes')` when it recovers. The TopBar reads `isStale`
 * and shows a subtle pill with the reason if the set is non-empty.
 *
 * Module-scoped so every consumer sees the same set.
 */

const staleSources = ref(new Map()) // Map<sourceKey, { reason, since }>

export function markStale(source, reason = 'Background refresh failed') {
  if (!source) return
  // Preserve the original `since` if the source is already marked —
  // tracking the first-detected time is more useful than the latest.
  const existing = staleSources.value.get(source)
  staleSources.value.set(source, {
    reason,
    since: existing?.since ?? Date.now(),
  })
  // Re-assign to trigger reactivity on Map mutations (Vue doesn't track them).
  staleSources.value = new Map(staleSources.value)
}

export function markFresh(source) {
  if (!source) return
  if (!staleSources.value.has(source)) return
  staleSources.value.delete(source)
  staleSources.value = new Map(staleSources.value)
}

export function useStaleness() {
  const isStale = computed(() => staleSources.value.size > 0)
  const sources = computed(() =>
    Array.from(staleSources.value.entries()).map(([key, meta]) => ({
      key,
      reason: meta.reason,
      since: meta.since,
    }))
  )
  const primaryReason = computed(() => {
    const list = sources.value
    if (list.length === 0) return ''
    if (list.length === 1) return list[0].reason
    return `${list.length} sources lagging (${list.map(s => s.key).join(', ')})`
  })

  return { isStale, sources, primaryReason, markStale, markFresh }
}
