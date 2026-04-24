<script setup>
import { ref, computed, watch } from 'vue'
import {
  IconBell,
  IconBellRinging,
  IconBolt,
  IconCalendar,
  IconCheck,
} from '@iconify-prerendered/vue-tabler'
import NotificationItem from './NotificationItem.vue'
import { ZAP_TYPES, CALENDAR_TYPES } from '../../utils/notifications/types.js'

/**
 * Shared notification list renderer.
 *
 * Used by both the dropdown (compact) and the modal (comfortable) so filter
 * tabs, date grouping, empty states, and infinite scroll are defined in one
 * place. Emits semantic events upward — the surface decides how to route:
 *
 *   select       → row clicked (mark as read; stay open)
 *   open         → explicit navigate action (parent navigates and may close)
 *   mark-unread  → flip read → unread
 *   remove       → dismiss from the list
 */

const props = defineProps({
  notifications: { type: Array, required: true },
  density: {
    type: String,
    default: 'comfortable',
    validator: v => ['compact', 'comfortable'].includes(v),
  },
  initialCount: { type: Number, default: 50 },
  pageSize: { type: Number, default: 50 },
  maxHeight: { type: String, default: 'auto' },
  emptyTitle: { type: String, default: 'No notifications' },
  emptyHint: { type: String, default: "You're all caught up!" },
})

const emit = defineEmits(['select', 'open', 'mark-unread', 'remove'])

const filterType = ref('all')
const displayCount = ref(props.initialCount)
watch(filterType, () => { displayCount.value = props.initialCount })

const filterOptions = [
  { value: 'all', label: 'All', icon: IconBell },
  { value: 'unread', label: 'Unread', icon: IconBellRinging },
  { value: 'zaps', label: 'Zaps', icon: IconBolt },
  { value: 'calendar', label: 'Calendar', icon: IconCalendar },
]

// Per-filter counts rendered on the tab pills — Linear/GitHub style
const counts = computed(() => {
  const list = props.notifications
  return {
    all: list.length,
    unread: list.filter(n => !n.read).length,
    zaps: list.filter(n => ZAP_TYPES.includes(n.type)).length,
    calendar: list.filter(n => CALENDAR_TYPES.includes(n.type)).length,
  }
})

const filtered = computed(() => {
  const list = props.notifications
  switch (filterType.value) {
    case 'unread': return list.filter(n => !n.read)
    case 'zaps': return list.filter(n => ZAP_TYPES.includes(n.type))
    case 'calendar': return list.filter(n => CALENDAR_TYPES.includes(n.type))
    default: return list
  }
})

const visible = computed(() => filtered.value.slice(0, displayCount.value))
const hasMore = computed(() => filtered.value.length > visible.value.length)
const unreadInFiltered = computed(() => filtered.value.filter(n => !n.read).length)

const grouped = computed(() => {
  const groups = { today: [], yesterday: [], thisWeek: [], older: [] }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const oneDay = 86_400_000

  for (const n of visible.value) {
    const d = new Date(n.timestamp)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const delta = today - day
    if (delta === 0) groups.today.push(n)
    else if (delta === oneDay) groups.yesterday.push(n)
    else if (delta < 7 * oneDay) groups.thisWeek.push(n)
    else groups.older.push(n)
  }
  return groups
})

const groupMeta = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'older', label: 'Older' },
]

const onScroll = (e) => {
  const el = e.target
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 120 && hasMore.value) {
    displayCount.value += props.pageSize
  }
}

const onSelect = (n) => emit('select', n)
const onOpen = (n) => emit('open', n)
const onMarkUnread = (id) => emit('mark-unread', id)
const onRemove = (id) => emit('remove', id)

defineExpose({ filterType })
</script>

<template>
  <div class="flex flex-col min-h-0">
    <!-- Filter tabs with count badges -->
    <div class="px-4 pt-3 pb-2 bg-white border-b border-gray-100 flex-shrink-0">
      <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-xl" role="tablist">
        <button
          v-for="filter in filterOptions"
          :key="filter.value"
          role="tab"
          :aria-selected="filterType === filter.value"
          @click="filterType = filter.value"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
            filterType === filter.value
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          <component :is="filter.icon" class="w-4 h-4" />
          <span>{{ filter.label }}</span>
          <span
            v-if="counts[filter.value] > 0"
            :class="[
              'min-w-[18px] px-1 h-[16px] rounded-full text-[10px] font-bold flex items-center justify-center',
              filterType === filter.value
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-200 text-gray-600'
            ]"
          >
            {{ counts[filter.value] > 99 ? '99+' : counts[filter.value] }}
          </span>
        </button>
      </div>

      <div class="mt-2.5 flex items-center justify-between text-xs">
        <span class="text-gray-600">
          <span class="font-semibold text-gray-900">{{ filtered.length }}</span>
          {{ filterType === 'all' ? 'total' : filterType }}
        </span>
        <span v-if="unreadInFiltered > 0" class="text-orange-600 font-semibold">
          {{ unreadInFiltered }} unread
        </span>
        <span v-else class="text-emerald-600 font-semibold flex items-center gap-1">
          <IconCheck class="w-3.5 h-3.5" />
          All caught up!
        </span>
      </div>
    </div>

    <!-- Scrollable list -->
    <div
      @scroll="onScroll"
      class="overflow-y-auto flex-1 min-h-0"
      :style="{ maxHeight }"
    >
      <div v-if="filtered.length === 0" class="p-10 text-center">
        <div class="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
          <IconBell class="w-8 h-8 text-gray-300" />
        </div>
        <h4 class="text-base font-semibold text-gray-900 mb-1">{{ emptyTitle }}</h4>
        <p class="text-gray-500 text-sm">
          {{ filterType === 'all' ? emptyHint : `No ${filterType} notifications` }}
        </p>
      </div>

      <template v-else>
        <template v-for="section in groupMeta" :key="section.key">
          <template v-if="grouped[section.key].length > 0">
            <div class="sticky top-0 bg-gray-50/95 backdrop-blur-sm px-4 py-1.5 border-b border-gray-200 z-10">
              <h4 class="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                {{ section.label }}
              </h4>
            </div>
            <NotificationItem
              v-for="n in grouped[section.key]"
              :key="n.id"
              :notification="n"
              :density="density"
              @select="onSelect"
              @open="onOpen"
              @mark-unread="onMarkUnread"
              @remove="onRemove"
            />
          </template>
        </template>

        <div v-if="hasMore" class="p-3 text-center bg-gray-50/60 border-t border-gray-200">
          <button
            @click="displayCount += pageSize"
            class="text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            Show {{ Math.min(pageSize, filtered.length - visible.length) }} more
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
