<template>
  <div class="h-full flex flex-col lg:flex-row bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="p-6">
      <div class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-start space-x-4">
            <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconUser class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
              <p class="text-purple-100 text-sm">
                Connect your Nostr identity to send and receive encrypted messages with Lightning zaps.
              </p>
            </div>
          </div>
          <button
            @click="handleNostrLogin"
            class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
          >
            <IconBolt class="w-4 h-4" />
            <span>Connect with Nostr</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Chat Interface -->
    <div v-else class="h-full flex flex-col lg:flex-row">
      <!-- Rest of the template content remains unchanged -->
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  IconMessageCircle, 
  IconPlus, 
  IconSearch, 
  IconSend, 
  IconBolt, 
  IconUser, 
  IconX, 
  IconDots, 
  IconCopy, 
  IconTrash, 
  IconUserX,
  IconLoader
} from '@iconify-prerendered/vue-tabler'
import { useNostrChat } from '../composables/useNostrChat.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrConnections } from '../composables/useNostrConnections.js'

// Rest of the script content remains unchanged
</script>

<style scoped>
/* Custom scrollbar for messages */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Message input auto-resize */
textarea {
  resize: none;
  overflow-y: auto;
}
</style>