<script setup>
import { computed } from 'vue'
import {
  IconBolt,
  IconX,
  IconMailOpened,
  IconArrowUpRight,
  IconTrendingUp,
  IconTrendingDown,
} from '@iconify-prerendered/vue-tabler'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { NOTIFICATION_TYPES } from '../../utils/notifications/types.js'
import {
  getVisual,
  getAccentClasses,
  formatRelativeTime,
  formatAbsoluteTime,
} from '../../utils/notifications/format.js'

/**
 * One notification row. Activation model:
 *   - Click the row body        → `select`   (mark as read, no navigation)
 *   - Click the "Open" button   → `open`     (navigate + let parent decide to close)
 *   - Click the ✕ button        → `remove`   (dismiss)
 *   - Click ↺ button            → `mark-unread`
 *
 * Two clicks, two different intents. The separation is what keeps the
 * dropdown open while the user triages — matching inbox-style tray UX.
 *
 * Content layering (no duplication):
 *   - title: the action (verb-led)
 *   - message: context (source, recipient) — never amount, never zap comment
 *   - amount badge: the sats value
 *   - blockquote: the zap comment (only rendered for ZAP_RECEIVED_NOSTR with a message)
 *   - actor chip: "by/with Bob" — suppressed when the actor is already in the title
 */

const props = defineProps({
  notification: { type: Object, required: true },
  density: { type: String, default: 'comfortable' },
})

const emit = defineEmits(['select', 'open', 'remove', 'mark-unread'])

const visual = computed(() => getVisual(props.notification.type))
const accent = computed(() => getAccentClasses(visual.value.accent))
const isCompact = computed(() => props.density === 'compact')

const relativeTime = computed(() => formatRelativeTime(props.notification.timestamp))
const absoluteTime = computed(() => formatAbsoluteTime(props.notification.timestamp))

// Actor: only present for types where we have a human counterparty
const actor = computed(() => {
  const data = props.notification.data || {}
  if (data.sender?.pubkey) {
    return {
      pubkey: data.sender.pubkey,
      name: data.sender.name || 'Anonymous',
      picture: data.sender.picture || data.sender.avatar || generateAvatar(data.sender.pubkey),
    }
  }
  if (data.organizer) {
    return {
      pubkey: data.organizer,
      name: data.organizerProfile?.name || `user:${data.organizer.substring(0, 8)}`,
      picture: data.organizerProfile?.picture || generateAvatar(data.organizer),
    }
  }
  return null
})

// When the actor name is already carried by the title (Nostr zap has
// "⚡ Bob zapped you"), suppress the duplicate "from Bob" hint below.
const actorAlreadyInTitle = computed(() =>
  props.notification.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR
)

function imgFallback(e) {
  const a = actor.value
  if (a) e.target.src = generateAvatar(a.pubkey)
}

const zapMessage = computed(() => {
  if (props.notification.type !== NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR) return null
  const msg = props.notification.data?.message
  return msg ? String(msg).trim() : null
})

const amount = computed(() => {
  const a = props.notification.data?.amount
  return typeof a === 'number' && a > 0 ? a : null
})

// Signed direction (balance change) so the badge can render ↑/↓ instead of
// repeating the "increased/decreased" wording carried by the title.
const signedDirection = computed(() => {
  if (props.notification.type !== NOTIFICATION_TYPES.BALANCE_CHANGE) return null
  const sign = props.notification.data?.signed
  if (typeof sign !== 'number') return null
  return sign >= 0 ? 'up' : 'down'
})

const eventMetaLine = computed(() => {
  if (
    props.notification.type !== NOTIFICATION_TYPES.CALENDAR_INVITE
    && props.notification.type !== NOTIFICATION_TYPES.CALENDAR_EVENT_START
  ) return null
  const start = props.notification.data?.eventStart
  if (!start) return null
  const d = typeof start === 'number' ? new Date(start * 1000) : new Date(start)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
})

const hasAction = computed(() => Boolean(props.notification.action))

const openLabel = computed(() => {
  const t = props.notification.type
  if (t === NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR) return 'View zap'
  if (t === NOTIFICATION_TYPES.ZAP_RECEIVED_NWC
   || t === NOTIFICATION_TYPES.ZAP_SENT
   || t === NOTIFICATION_TYPES.BALANCE_CHANGE
   || t === NOTIFICATION_TYPES.PAYMENT_SUCCESS
   || t === NOTIFICATION_TYPES.PAYMENT_ERROR
   || t === NOTIFICATION_TYPES.WALLET_ERROR) return 'Open wallet'
  if (t === NOTIFICATION_TYPES.CALENDAR_INVITE
   || t === NOTIFICATION_TYPES.CALENDAR_EVENT_START) return 'View event'
  if (t === NOTIFICATION_TYPES.CONNECTION_SUCCESS
   || t === NOTIFICATION_TYPES.CONNECTION_ERROR) return 'Open settings'
  return 'Open'
})

// ── Events ────────────────────────────────────────────────────────────
const onRowClick = () => emit('select', props.notification)

const onRowKey = (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('select', props.notification)
  } else if (e.key.toLowerCase() === 'o' && hasAction.value) {
    e.preventDefault()
    emit('open', props.notification)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    emit('remove', props.notification.id)
  } else if (e.key.toLowerCase() === 'u' && props.notification.read) {
    e.preventDefault()
    emit('mark-unread', props.notification.id)
  }
}

const onOpen = (e) => {
  e.stopPropagation()
  emit('open', props.notification)
}
const onRemove = (e) => {
  e.stopPropagation()
  emit('remove', props.notification.id)
}
const onMarkUnread = (e) => {
  e.stopPropagation()
  emit('mark-unread', props.notification.id)
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="`${notification.title}. ${notification.message}. ${relativeTime}`"
    :class="[
      'group relative border-b border-gray-100 cursor-pointer transition-colors outline-none',
      'focus-visible:bg-orange-50 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-inset',
      !notification.read
        ? 'bg-orange-50/40 hover:bg-orange-50/70'
        : 'hover:bg-gray-50',
      isCompact ? 'px-4 py-3' : 'px-4 py-3.5',
    ]"
    @click="onRowClick"
    @keydown="onRowKey"
  >
    <!-- Unread dot -->
    <span
      v-if="!notification.read"
      :class="[
        'absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full',
        isCompact ? 'w-1.5 h-1.5' : 'w-2 h-2',
        accent.dot
      ]"
      aria-hidden="true"
    />

    <div :class="['flex items-start gap-3', isCompact ? 'pl-2.5' : 'pl-3']">
      <!-- Actor avatar with type badge, OR type icon tile -->
      <div class="relative flex-shrink-0">
        <template v-if="actor">
          <img
            :src="actor.picture"
            :alt="actor.name"
            :class="[
              'rounded-full object-cover ring-2 ring-white',
              isCompact ? 'w-9 h-9' : 'w-10 h-10'
            ]"
            @error="imgFallback"
          />
          <span
            :class="[
              'absolute -bottom-1 -right-1 rounded-full ring-2 ring-white flex items-center justify-center',
              accent.tile,
              isCompact ? 'w-4 h-4' : 'w-5 h-5',
            ]"
          >
            <component :is="visual.icon" :class="isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'" />
          </span>
        </template>
        <template v-else>
          <div
            :class="[
              'rounded-xl flex items-center justify-center',
              accent.tile,
              isCompact ? 'w-9 h-9' : 'w-10 h-10',
            ]"
          >
            <component :is="visual.icon" :class="isCompact ? 'w-4 h-4' : 'w-5 h-5'" />
          </div>
        </template>
      </div>

      <!-- Content column -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <h4 class="text-sm font-semibold text-gray-900 leading-tight truncate">
            {{ notification.title }}
          </h4>
          <time
            :datetime="notification.timestamp"
            :title="absoluteTime"
            class="text-xs text-gray-500 font-medium whitespace-nowrap flex-shrink-0"
          >
            {{ relativeTime }}
          </time>
        </div>

        <!-- Context line — stays short and never repeats amount/comment -->
        <p
          v-if="notification.message"
          class="text-sm text-gray-600 leading-snug mt-0.5 line-clamp-2"
        >
          {{ notification.message }}
        </p>

        <!-- Zap comment: ONLY place the user's quote appears -->
        <blockquote
          v-if="zapMessage"
          class="mt-2 pl-3 border-l-2 border-orange-300 text-xs italic text-gray-600"
          :class="isCompact ? 'line-clamp-2' : 'line-clamp-3'"
        >
          {{ zapMessage }}
        </blockquote>

        <!-- Event start time for calendar notifs -->
        <p v-if="eventMetaLine" class="mt-1.5 text-xs font-medium text-gray-500">
          {{ eventMetaLine }}
        </p>

        <!-- Metadata + actions row -->
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <!-- Amount badge: the sole carrier of sats value -->
          <span
            v-if="amount"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-700"
          >
            <IconTrendingUp v-if="signedDirection === 'up'" class="w-3 h-3" />
            <IconTrendingDown v-else-if="signedDirection === 'down'" class="w-3 h-3" />
            <IconBolt v-else class="w-3 h-3" />
            {{ amount.toLocaleString() }} sats
          </span>

          <!-- Actor chip (only when not already in title) -->
          <span
            v-if="actor && !actorAlreadyInTitle"
            class="text-[11px] text-gray-500"
          >
            {{ notification.type === NOTIFICATION_TYPES.CALENDAR_INVITE ? 'by' : 'with' }}
            <span class="text-gray-700 font-medium">{{ actor.name }}</span>
          </span>

          <!-- Open button — the ONLY thing that navigates -->
          <button
            v-if="hasAction"
            @click="onOpen"
            class="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 transition-colors"
            :title="`${openLabel} (O)`"
          >
            {{ openLabel }}
            <IconArrowUpRight class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Secondary actions: always visible in comfortable, hover in compact -->
      <div
        :class="[
          'flex flex-col items-end gap-1 flex-shrink-0 transition-opacity',
          isCompact
            ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
            : 'opacity-60 group-hover:opacity-100',
        ]"
      >
        <button
          v-if="notification.read"
          @click="onMarkUnread"
          class="text-gray-400 hover:text-orange-600 p-1 rounded-md hover:bg-orange-50"
          title="Mark as unread (U)"
          aria-label="Mark as unread"
        >
          <IconMailOpened class="w-4 h-4" />
        </button>
        <button
          @click="onRemove"
          class="text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50"
          title="Dismiss (Delete)"
          aria-label="Dismiss notification"
        >
          <IconX class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
