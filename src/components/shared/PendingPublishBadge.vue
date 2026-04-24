<script setup>
/**
 * PendingPublishBadge — surfaces events waiting for delivery so the
 * user can retry or discard them. Two distinct states:
 *
 *   offline — the user signed events while offline; they'll auto-drain
 *     when connectivity returns. Styled BLUE (informational, no action
 *     needed). Auto-retry is already running.
 *
 *   failed — online attempts exhausted retries; a relay rejected the
 *     event or the network stayed flaky through the full retry budget.
 *     Styled AMBER (needs attention). User can retry manually.
 *
 * Subscribes to publishService queue changes via push listener — no
 * polling. Also subscribes to `online`/`offline` window events so the
 * icon reflects the live connectivity state for screen-reader users.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  IconAlertTriangle,
  IconRefresh,
  IconX,
  IconCloudOff,
} from '@iconify-prerendered/vue-tabler'
import { publishService } from '../../services/nostr/PublishService.js'

const pending = ref([])
const isOpen = ref(false)
const retrying = ref(new Set())
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

let unsubscribe = null

const hasPending = computed(() => pending.value.length > 0)

const offlineCount = computed(() => pending.value.filter(p => p.offline).length)
const failedCount  = computed(() => pending.value.filter(p => !p.offline).length)

// Priority: failed > offline. A mixed queue shows the amber warning
// icon because those items need user attention; offline-only shows
// the neutral cloud-off icon.
const mode = computed(() => {
  if (failedCount.value > 0) return 'failed'
  if (offlineCount.value > 0) return 'offline'
  return null
})

const badgeTitle = computed(() => {
  if (failedCount.value > 0 && offlineCount.value > 0) {
    return `${failedCount.value} failed, ${offlineCount.value} queued for delivery`
  }
  if (failedCount.value > 0) {
    return `${failedCount.value} event${failedCount.value === 1 ? '' : 's'} failed — tap to retry`
  }
  return `${offlineCount.value} event${offlineCount.value === 1 ? '' : 's'} queued for delivery`
})

const retry = async (eventId) => {
  retrying.value.add(eventId)
  try {
    await publishService.retry(eventId)
  } catch {
    // Queue stays populated — listener will re-render.
  } finally {
    retrying.value.delete(eventId)
  }
}

const retryAll = async () => {
  try { await publishService.drainPending() } catch { /* per-item handled */ }
}

const discard = (eventId) => {
  publishService.removePending(eventId)
}

const kindLabel = (kind) => {
  switch (kind) {
    case 1:     return 'Note'
    case 3:     return 'Contact list'
    case 4:     return 'DM'
    case 5:     return 'Deletion'
    case 6:     return 'Repost'
    case 7:     return 'Reaction'
    case 1059:  return 'Private DM'
    case 9734:  return 'Zap request'
    case 10002: return 'Relay list'
    case 30023: return 'Article'
    default:    return `Kind ${kind}`
  }
}

const formatTime = (ts) => {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const handleOnline = () => { isOnline.value = true }
const handleOffline = () => { isOnline.value = false }

onMounted(() => {
  unsubscribe = publishService.subscribe(snapshot => {
    pending.value = snapshot
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }
})

onBeforeUnmount(() => {
  unsubscribe?.()
  unsubscribe = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
})
</script>

<template>
  <div v-if="hasPending" class="relative">
    <button
      @click="isOpen = !isOpen"
      :class="[
        'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
        mode === 'failed'
          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
          : 'bg-blue-50 hover:bg-blue-100 text-blue-700',
      ]"
      :title="badgeTitle"
      role="status"
      aria-live="polite"
    >
      <IconAlertTriangle v-if="mode === 'failed'" class="w-4 h-4" />
      <IconCloudOff v-else class="w-4 h-4" />
      <span>{{ pending.length }}</span>
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      :class="[
        'absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 overflow-hidden',
        mode === 'failed' ? 'border-amber-100' : 'border-blue-100',
      ]"
    >
      <div
        :class="[
          'px-4 py-3 border-b',
          mode === 'failed' ? 'border-amber-100 bg-amber-50/50' : 'border-blue-100 bg-blue-50/50',
        ]"
      >
        <p
          :class="[
            'text-sm font-semibold',
            mode === 'failed' ? 'text-amber-900' : 'text-blue-900',
          ]"
        >
          <span v-if="mode === 'failed'">Pending delivery</span>
          <span v-else>Queued — awaiting network</span>
        </p>
        <p
          :class="[
            'text-xs mt-0.5',
            mode === 'failed' ? 'text-amber-700/80' : 'text-blue-700/80',
          ]"
        >
          <span v-if="mode === 'failed'">
            Some events didn't reach enough relays. Retry or discard.
          </span>
          <span v-else-if="isOnline">
            Reconnected — events send automatically.
          </span>
          <span v-else>
            You're offline. Events send when connectivity returns.
          </span>
        </p>

        <!-- Retry-all action when the queue is big enough to warrant one tap. -->
        <button
          v-if="pending.length > 1"
          @click="retryAll"
          class="mt-2 text-xs underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100"
        >
          Retry all
        </button>
      </div>

      <ul class="max-h-80 overflow-y-auto divide-y divide-gray-100">
        <li
          v-for="item in pending"
          :key="item.eventId"
          class="px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-gray-900 truncate">
                  {{ kindLabel(item.kind) }}
                </p>
                <span
                  v-if="item.offline"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700"
                >
                  queued
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ formatTime(item.createdAt) }}
              </p>
              <p
                v-if="item.lastError && !item.offline"
                class="text-xs text-amber-700 mt-1 truncate"
              >
                {{ item.lastError }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                @click="retry(item.eventId)"
                :disabled="retrying.has(item.eventId)"
                class="p-1.5 rounded hover:bg-orange-50 text-orange-600 disabled:opacity-50 transition-colors"
                title="Retry now"
              >
                <IconRefresh
                  class="w-4 h-4"
                  :class="retrying.has(item.eventId) ? 'animate-spin' : ''"
                />
              </button>
              <button
                @click="discard(item.eventId)"
                class="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors"
                title="Discard"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
