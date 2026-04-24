import { onMounted, onBeforeUnmount, nextTick } from 'vue'

/**
 * useScrollRestore — preserve scroll position across page navigation.
 *
 * Twitter/FB behavior: leave a feed mid-scroll, come back to the same
 * position. Our app swaps page components via `<component :is>` so
 * the DOM remounts on navigation — without this composable, every
 * return scrolls to top.
 *
 * Session-scoped (sessionStorage). Cleared on tab close — matches the
 * mainstream "within a session" expectation. Use cacheManager if you
 * want cross-reload persistence for a specific feed.
 *
 * Pattern: pass a ref to the scrollable element + a stable storage
 * key. The composable saves position on unmount and restores it on
 * mount after one tick (so async-loaded items render first). If the
 * list is shorter on restore, we cap at the new max.
 *
 * Handles window-scroll (no containerRef passed) and element-scroll
 * alike.
 *
 * @param {string} key — stable id for this view (e.g. 'notes-feed')
 * @param {import('vue').Ref<HTMLElement|null>} [containerRef]
 */
export function useScrollRestore(key, containerRef = null) {
  if (!key) return {}

  const storageKey = `scrollPos:${key}`

  const getScroller = () => {
    if (containerRef?.value) return containerRef.value
    return typeof window !== 'undefined' ? window : null
  }

  const save = () => {
    const el = getScroller()
    if (!el) return
    const pos = el === window ? window.scrollY : el.scrollTop
    try { sessionStorage.setItem(storageKey, String(pos)) } catch { /* private mode */ }
  }

  const restore = () => {
    let stored
    try { stored = sessionStorage.getItem(storageKey) } catch { return }
    if (stored == null) return
    const target = parseInt(stored, 10)
    if (!Number.isFinite(target) || target <= 0) return

    // Defer to next tick so any async-hydrated list items have a chance
    // to render — restoring before content paints would clamp to 0.
    // Two nextTick passes empirically cover the common case where
    // a snapshot-hydrate + reactive list update both need to settle.
    nextTick(() => nextTick(() => {
      const el = getScroller()
      if (!el) return
      const maxScroll = el === window
        ? document.documentElement.scrollHeight - window.innerHeight
        : el.scrollHeight - el.clientHeight
      const clamped = Math.min(target, Math.max(0, maxScroll))
      if (el === window) window.scrollTo({ top: clamped, behavior: 'auto' })
      else el.scrollTop = clamped
    }))
  }

  /** Clear the saved position — use on explicit pull-to-refresh / "go to top". */
  const reset = () => {
    try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
  }

  onMounted(restore)
  onBeforeUnmount(save)

  return { save, restore, reset }
}
