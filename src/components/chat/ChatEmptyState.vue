<script setup>
import { IconMessageCircle, IconPlus, IconMessages } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  type: {
    type: String,
    default: 'no-selection',
    validator: (v) => ['no-conversations', 'no-messages', 'no-selection'].includes(v)
  }
})

const emit = defineEmits(['add-connection'])
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-6">
    <div class="text-center max-w-xs">
      <!-- No conversations -->
      <template v-if="type === 'no-conversations'">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl shadow-lg mb-4">
          <IconMessageCircle class="w-8 h-8 text-white" />
        </div>
        <h4 class="text-lg font-semibold text-gray-900 mb-2">Start Messaging</h4>
        <p class="text-sm text-gray-500 mb-5 leading-relaxed">
          Add a Nostr contact to send encrypted messages with Lightning zaps
        </p>
        <button
          @click="emit('add-connection')"
          class="btn-primary inline-flex"
        >
          <IconPlus class="w-4 h-4" />
          <span>Add Connection</span>
        </button>
      </template>

      <!-- No messages in conversation -->
      <template v-else-if="type === 'no-messages'">
        <div class="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-2xl mb-4">
          <IconMessages class="w-7 h-7 text-gray-400" />
        </div>
        <h4 class="text-base font-medium text-gray-900 mb-1">No messages yet</h4>
        <p class="text-sm text-gray-400">Send the first message to start the conversation</p>
      </template>

      <!-- No selection -->
      <template v-else>
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-2xl mb-4">
          <IconMessageCircle class="w-8 h-8 text-gray-300" />
        </div>
        <h4 class="text-base font-medium text-gray-700 mb-1">Select a conversation</h4>
        <p class="text-sm text-gray-400">Choose a contact from the sidebar to start chatting</p>
      </template>
    </div>
  </div>
</template>
