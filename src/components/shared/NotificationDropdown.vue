<script setup>
import { ref, inject, onMounted, onUnmounted, watch } from 'vue'
import {
  IconBell,
  IconBellRinging,
  IconCheck,
  IconTrash,
  IconSettings,
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../../composables/core/useNotifications.js'
import NotificationList from './NotificationList.vue'
import NotificationModal from './NotificationModal.vue'

/**
 * Notification bell + popover.
 *
 * Badge reflects UNSEEN (not unread) — opening the panel clears it while
 * leaving unread items visually distinct inside. Activating an item delegates
 * to the injected `changePage` for in-app navigation.
 */

const {
  notifications,
  unseenCount,
  unreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  markAllSeen,
  clearAllNotifications,
  removeNotification,
} = useNotifications()

const changePage = inject('changePage', null)

const showDropdown = ref(false)
const showModal = ref(false)
const dropdownRef = ref(null)

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

// Clear the badge as soon as the panel becomes visible
watch(showDropdown, (open) => {
  if (open) markAllSeen()
})

// Row click: mark as read, stay open for triage
const onSelect = (notification) => {
  markAsRead(notification.id)
}

// Explicit "Open" button: navigate + close the dropdown (user asked to go)
const onOpen = (notification) => {
  markAsRead(notification.id)
  showDropdown.value = false
  showModal.value = false
  const action = notification.action
  if (action && changePage) {
    changePage(action.page, action.tab || null, action.query ? { query: action.query } : {})
  }
}

const openAllModal = () => {
  showDropdown.value = false
  showModal.value = true
}

// Close on outside click
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showDropdown.value = false
  }
}
const handleEscape = (event) => {
  if (event.key === 'Escape') showDropdown.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="toggleDropdown"
      :aria-label="`Notifications${unseenCount ? `, ${unseenCount} new` : ''}`"
      :aria-expanded="showDropdown"
      aria-haspopup="menu"
      class="relative text-gray-500 hover:text-orange-600 p-2 rounded-xl transition-all duration-200 hover:bg-orange-50 group flex items-center justify-center"
    >
      <IconBellRinging
        v-if="unseenCount > 0"
        class="w-5 h-5 text-orange-600 animate-bell"
      />
      <IconBell v-else class="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />

      <span
        v-if="unseenCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-red-500 to-red-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-red-500/40 ring-2 ring-white"
      >
        {{ unseenCount > 99 ? '99+' : unseenCount }}
      </span>
    </button>

    <transition name="dropdown">
      <div
        v-if="showDropdown"
        role="menu"
        class="absolute right-0 top-full mt-2 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden"
        style="max-height: calc(100vh - 120px);"
      >
        <div class="px-4 pt-4 pb-2 flex-shrink-0 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
              <IconBell class="w-5 h-5 text-orange-600" />
              Notifications
            </h3>
            <div class="flex items-center gap-0.5">
              <button
                v-if="unreadCount > 0"
                @click="markAllAsRead"
                class="text-xs text-gray-600 hover:text-orange-600 font-medium px-2 py-1.5 rounded-lg hover:bg-orange-50 flex items-center gap-1"
                title="Mark all as read"
              >
                <IconCheck class="w-4 h-4" />
              </button>
              <button
                v-if="notifications.length > 0"
                @click="clearAllNotifications"
                class="text-xs text-gray-500 hover:text-red-600 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1"
                title="Clear all"
              >
                <IconTrash class="w-4 h-4" />
              </button>
              <button
                v-if="changePage"
                @click="() => { showDropdown = false; changePage('settings', 'alerts') }"
                class="text-xs text-gray-500 hover:text-orange-600 font-medium px-2 py-1.5 rounded-lg hover:bg-orange-50 flex items-center gap-1"
                title="Notification settings"
              >
                <IconSettings class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <NotificationList
          :notifications="notifications"
          :initial-count="50"
          :page-size="50"
          density="compact"
          max-height="calc(100vh - 280px)"
          empty-title="No notifications"
          empty-hint="You're all caught up!"
          @select="onSelect"
          @open="onOpen"
          @mark-unread="markAsUnread"
          @remove="removeNotification"
        />

        <div
          v-if="notifications.length > 0"
          class="p-2.5 text-center border-t border-gray-200 bg-gray-50/80 flex-shrink-0"
        >
          <button
            @click="openAllModal"
            class="text-xs font-semibold text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-50"
          >
            View all notifications
          </button>
        </div>
      </div>
    </transition>

    <NotificationModal
      v-if="showModal"
      :show="showModal"
      @close="showModal = false"
      @open="onOpen"
    />
  </div>
</template>

<style scoped>
.dropdown-enter-active {
  animation: dropdown-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.dropdown-leave-active {
  animation: dropdown-out 0.18s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-12px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes dropdown-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(-8px) scale(0.97); }
}

@keyframes bell-swing {
  0%, 100% { transform: rotate(0); }
  15%      { transform: rotate(-12deg); }
  30%      { transform: rotate(10deg); }
  45%      { transform: rotate(-8deg); }
  60%      { transform: rotate(6deg); }
  75%      { transform: rotate(-4deg); }
}
.animate-bell {
  animation: bell-swing 1.4s ease-in-out 1;
  transform-origin: 50% 4px;
}
</style>
