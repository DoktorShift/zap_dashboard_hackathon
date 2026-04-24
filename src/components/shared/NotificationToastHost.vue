<script setup>
import { inject, onBeforeUnmount, watch, ref } from 'vue'
import {
  IconX,
  IconArrowRight,
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../../composables/core/useNotifications.js'
import { ERROR_TYPES } from '../../utils/notifications/types.js'
import { getVisual, getAccentClasses } from '../../utils/notifications/format.js'

/**
 * Stacked in-app toast host.
 *
 * Responsibilities:
 * 1. Render the transient toast queue (auto-dismiss, hover-pause).
 * 2. Bridge OS-notification clicks → in-app navigation by watching the
 *    `pendingAction` ref on the composable. The composable has no router
 *    access, so this host (which does, via injected `changePage`) acts as
 *    the resolver.
 *
 * Errors are sticky (no TTL) — they represent a failed user action and
 * should stay until acknowledged.
 */

const TOAST_TTL = 6000

const { toasts, dismissToast, markAsRead, pendingAction } = useNotifications()
const changePage = inject('changePage', null)

// ── OS-notification click bridge ──────────────────────────────────────
watch(pendingAction, (action) => {
  if (!action || !changePage) return
  changePage(action.page, action.tab || null, action.query ? { query: action.query } : {})
  pendingAction.value = null
}, { immediate: true })

// ── TTL management ────────────────────────────────────────────────────
const timers = new Map()
// Reactive so the "paused" pill / animation-play-state re-renders on mutation.
// We swap the whole Set for each change because Vue can't track Set internals.
const pausedIds = ref(new Set())
const isPaused = (id) => pausedIds.value.has(id)

const isSticky = (toast) => ERROR_TYPES.includes(toast.type)

const scheduleDismiss = (toast) => {
  if (timers.has(toast.id)) return
  if (isSticky(toast)) return
  const t = setTimeout(() => {
    if (!pausedIds.value.has(toast.id)) dismissToast(toast.id)
    timers.delete(toast.id)
  }, TOAST_TTL)
  timers.set(toast.id, t)
}

// New toasts enter the queue via composable emit — schedule whenever the ref changes
watch(toasts, (next) => {
  for (const toast of next) scheduleDismiss(toast)
}, { immediate: true, deep: true })

const onEnter = (id) => {
  pausedIds.value = new Set([...pausedIds.value, id])
}
const onLeave = (id) => {
  const next = new Set(pausedIds.value); next.delete(id)
  pausedIds.value = next
  const existing = timers.get(id)
  if (existing) { clearTimeout(existing); timers.delete(id) }
  const toast = toasts.value.find(t => t.id === id)
  if (toast) scheduleDismiss(toast)
}

const cleanup = (id) => {
  const t = timers.get(id); if (t) { clearTimeout(t); timers.delete(id) }
  if (pausedIds.value.has(id)) {
    const next = new Set(pausedIds.value); next.delete(id)
    pausedIds.value = next
  }
}

const onActivate = (toast) => {
  markAsRead(toast.id)
  cleanup(toast.id)
  dismissToast(toast.id)
  const action = toast.action
  if (!action || !changePage) return
  changePage(action.page, action.tab || null, action.query ? { query: action.query } : {})
}

const onDismiss = (e, id) => {
  e.stopPropagation()
  cleanup(id)
  dismissToast(id)
}

onBeforeUnmount(() => {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
})
</script>

<template>
  <Teleport to="body">
    <!--
      Positioning:
        - Desktop: bottom-right, column-reverse so the newest stays closest to the eye
        - Mobile (sm): top-center, full width with safe-area padding so the bottom
          tab bar stays clickable
    -->
    <div
      class="fixed z-[9998] flex flex-col-reverse gap-2 pointer-events-none
             sm:bottom-4 sm:right-4 sm:items-end sm:max-w-sm
             inset-x-0 top-0 items-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
      aria-live="polite"
      aria-atomic="false"
    >
      <transition-group name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          @mouseenter="onEnter(toast.id)"
          @mouseleave="onLeave(toast.id)"
          @focusin="onEnter(toast.id)"
          @focusout="onLeave(toast.id)"
          @click="onActivate(toast)"
          role="alertdialog"
          :aria-labelledby="`toast-${toast.id}-title`"
          :aria-describedby="`toast-${toast.id}-body`"
          tabindex="0"
          class="pointer-events-auto w-full sm:w-[360px] max-w-[calc(100vw-1rem)]
                 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden
                 hover:shadow-2xl transition-shadow
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          :class="toast.action ? 'cursor-pointer' : 'cursor-default'"
        >
          <div class="flex items-start gap-3 p-3.5">
            <div
              :class="[
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                getAccentClasses(getVisual(toast.type).accent).tile,
              ]"
            >
              <component :is="getVisual(toast.type).icon" class="w-5 h-5" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h4
                  :id="`toast-${toast.id}-title`"
                  class="text-sm font-semibold text-gray-900 leading-tight truncate"
                >
                  {{ toast.title }}
                </h4>
                <button
                  @click="(e) => onDismiss(e, toast.id)"
                  class="text-gray-400 hover:text-gray-600 p-0.5 rounded -mr-1 -mt-0.5 flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <IconX class="w-4 h-4" />
                </button>
              </div>
              <p
                :id="`toast-${toast.id}-body`"
                class="text-xs text-gray-600 mt-0.5 line-clamp-2"
              >
                {{ toast.message }}
              </p>

              <div class="mt-1.5 flex items-center justify-between gap-2">
                <span
                  v-if="toast.data?.amount"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-700"
                >
                  {{ toast.data.amount.toLocaleString() }} sats
                </span>
                <span
                  v-if="toast.action"
                  class="inline-flex items-center gap-0.5 text-[11px] font-semibold text-orange-600 ml-auto"
                >
                  Open
                  <IconArrowRight class="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>

          <!-- TTL progress bar (hidden for sticky errors) -->
          <div v-if="!isSticky(toast)" class="h-1 bg-gray-100">
            <div
              :class="['h-full', getAccentClasses(getVisual(toast.type).accent).dot]"
              :style="isPaused(toast.id)
                ? 'width: 100%; animation-play-state: paused'
                : 'animation: toast-progress 6s linear forwards'"
            />
          </div>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes toast-progress {
  from { width: 100%; }
  to   { width: 0%; }
}

.toast-enter-active {
  transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
  transition: all 0.22s ease;
}
/* Default (mobile): slide in from top */
.toast-enter-from {
  opacity: 0;
  transform: translateY(-40px) scale(0.96);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-40px) scale(0.96);
}
.toast-move {
  transition: transform 0.3s ease;
}
/* Desktop: slide in from right */
@media (min-width: 640px) {
  .toast-enter-from {
    transform: translateX(40px) scale(0.96);
  }
  .toast-leave-to {
    transform: translateX(40px) scale(0.96);
  }
}
</style>
