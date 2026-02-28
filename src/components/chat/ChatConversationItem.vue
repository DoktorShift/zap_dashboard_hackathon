<script setup>
import { computed } from 'vue'
import { IconUser, IconBolt } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  conversation: { type: Object, required: true },
  isActive: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const displayName = computed(() => {
  return props.conversation.profile?.name || props.conversation.pubkey?.substring(0, 12) + '...'
})

const timeAgo = computed(() => {
  if (!props.conversation.lastMessageTime) return ''
  const diff = Date.now() - props.conversation.lastMessageTime
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
  return new Date(props.conversation.lastMessageTime).toLocaleDateString()
})

const lastMessagePreview = computed(() => {
  if (!props.conversation.lastMessage) return ''
  const msg = props.conversation.lastMessage
  return msg.length > 40 ? msg.substring(0, 40) + '...' : msg
})
</script>

<template>
  <div
    @click="emit('select', conversation)"
    :class="[
      'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
      isActive ? 'bg-orange-50 border-r-2 border-orange-400' : 'hover:bg-gray-50'
    ]"
  >
    <!-- Avatar -->
    <div class="relative flex-shrink-0">
      <div class="w-10 h-10 rounded-full overflow-hidden">
        <img
          v-if="conversation.profile?.picture"
          :src="conversation.profile.picture"
          :alt="displayName"
          class="w-full h-full object-cover"
          @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
        />
        <div
          class="w-full h-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center"
          :style="{ display: conversation.profile?.picture ? 'none' : 'flex' }"
        >
          <IconUser class="w-5 h-5 text-white" />
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between mb-0.5">
        <span class="font-medium text-gray-900 truncate text-sm">{{ displayName }}</span>
        <span v-if="timeAgo" class="text-[11px] text-gray-400 flex-shrink-0 ml-2">{{ timeAgo }}</span>
      </div>
      <div class="flex items-center justify-between">
        <p class="text-[13px] text-gray-500 truncate">
          <template v-if="lastMessagePreview">{{ lastMessagePreview }}</template>
          <template v-else-if="conversation.profile?.lud16">
            <span class="flex items-center gap-1">
              <IconBolt class="w-3 h-3 text-yellow-500" />
              <span class="truncate">{{ conversation.profile.lud16 }}</span>
            </span>
          </template>
        </p>
        <!-- Unread badge -->
        <div
          v-if="conversation.unreadCount > 0"
          class="w-5 h-5 bg-orange-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center flex-shrink-0 ml-2"
        >
          {{ conversation.unreadCount > 9 ? '9+' : conversation.unreadCount }}
        </div>
      </div>
    </div>
  </div>
</template>
