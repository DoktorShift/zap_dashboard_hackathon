<script setup>
import { ref, toRef, onMounted, onUnmounted } from 'vue'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'
import {
  IconBell,
  IconCheck,
  IconTrash,
  IconX,
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../../composables/core/useNotifications.js'
import NotificationList from './NotificationList.vue'

/**
 * Full-screen "All notifications" modal.
 *
 * Reuses NotificationList — same filter/group/item rendering as the dropdown.
 * Emits `activate` upward so the mount point (currently the dropdown) can
 * perform navigation + close.
 */

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'open'])

const {
  notifications,
  unreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  clearAllNotifications,
  removeNotification,
} = useNotifications()

const modalRoot = ref(null)
useFocusTrap(toRef(props, 'show'), modalRoot)

const onEscape = (e) => { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onEscape))
onUnmounted(() => document.removeEventListener('keydown', onEscape))

// Row click in the modal marks-as-read and stays open. Only the explicit
// "Open" action bubbles up for navigation + close.
const onSelect = (notification) => {
  markAsRead(notification.id)
}

const onOpen = (notification) => {
  markAsRead(notification.id)
  emit('open', notification)
  emit('close')
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal">
      <div
        v-if="show"
        ref="modalRoot"
        class="fixed inset-0 bg-black/50 backdrop-blur-lg z-[9999] flex items-center justify-center p-4"
        @click.self="emit('close')"
        tabindex="-1"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[85vh] flex flex-col overflow-hidden">
          <div class="px-4 pt-4 pb-2 border-b border-gray-100 flex-shrink-0">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <IconBell class="w-5 h-5 text-orange-600" />
                All Notifications
              </h2>
              <div class="flex items-center gap-1">
                <button
                  v-if="unreadCount > 0"
                  @click="markAllAsRead"
                  class="text-xs text-orange-600 hover:text-orange-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-50 flex items-center gap-1.5"
                >
                  <IconCheck class="w-4 h-4" />
                  Mark all
                </button>
                <button
                  v-if="notifications.length > 0"
                  @click="clearAllNotifications"
                  class="text-xs text-gray-500 hover:text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
                >
                  <IconTrash class="w-4 h-4" />
                  Clear
                </button>
                <button
                  @click="emit('close')"
                  class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 ml-1"
                  aria-label="Close"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <NotificationList
            :notifications="notifications"
            :initial-count="100"
            :page-size="100"
            density="comfortable"
            max-height="calc(85vh - 150px)"
            empty-title="No notifications"
            empty-hint="You're all caught up!"
            @select="onSelect"
            @open="onOpen"
            @mark-unread="markAsUnread"
            @remove="removeNotification"
          />
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active { transition: opacity 0.3s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active > div { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-leave-active > div { transition: transform 0.2s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from > div { transform: scale(0.96) translateY(8px); }
.modal-leave-to { opacity: 0; }
.modal-leave-to > div { transform: scale(0.96) translateY(8px); }
</style>
