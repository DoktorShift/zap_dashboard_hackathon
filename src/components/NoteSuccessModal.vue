<template>
  <Teleport to="#modal-root">
    <transition name="modal-fade">
      <div 
        v-if="show" 
        class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        @click="handleBackdropClick"
      >
        <div class="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
          <!-- Close Button -->
          <button
            @click="closeModal"
            class="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          
          <!-- Header -->
          <div class="p-6 text-center border-b border-gray-100" @click.stop>
            <!-- Clean Checkmark -->
            <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            
            <!-- Success Message -->
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Your post is live</h2>
            <p class="text-gray-600">Published to {{ publishResult?.successfulRelays || 0 }} relays</p>
          </div>
          
          <!-- Note Preview -->
          <div class="p-6" @click.stop>
            <div class="flex items-start space-x-3 bg-gray-50 rounded-xl p-4">
              <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                <img 
                  :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                  :alt="userProfile?.name || 'You'"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 mb-1">{{ userProfile?.name || 'You' }}</div>
                <p class="text-gray-700 text-sm leading-relaxed line-clamp-3">
                  {{ noteContent }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="px-6 pb-6" @click.stop>
            <div class="grid grid-cols-2 gap-3 mb-4">
              <a
                :href="getNostrClientUrl('primal', publishResult?.event?.id)"
                target="_blank"
                rel="noopener noreferrer"
                class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <span>🌐</span>
                <span>Primal</span>
              </a>
              
              <a
                :href="getNostrClientUrl('yakihonne', publishResult?.event?.id)"
                target="_blank"
                rel="noopener noreferrer"
                class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <span>🍜</span>
                <span>Yakihonne</span>
              </a>
            </div>
            
            <!-- Auto-close indicator -->
            <div class="text-center">
              <div class="w-full bg-gray-200 rounded-full h-1 mb-2">
                <div class="bg-orange-400 h-1 rounded-full animate-countdown"></div>
              </div>
              <p class="text-xs text-gray-500">Closing automatically...</p>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  noteContent: {
    type: String,
    default: ''
  },
  publishResult: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const { userProfile } = useNostrAuth()

// Auto-close timer management
let autoCloseTimer = null

// Set up auto-close timer
const startAutoCloseTimer = () => {
  // Clear any existing timer
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
  }
  
  autoCloseTimer = setTimeout(() => {
    emit('close')
  }, 5000) // 5 seconds
}

// Clear the auto-close timer
const clearAutoCloseTimer = () => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
}

// Manual close function
const closeModal = () => {
  clearAutoCloseTimer()
  emit('close')
}

// Handle backdrop click (close when clicking outside)
const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget) {
    closeModal()
  }
}

// Handle escape key
const handleKeydown = (event) => {
  if (event.key === 'Escape' && props.show) {
    closeModal()
  }
}

// Watch for show prop changes to start/stop timer
watch(() => props.show, (show) => {
  if (props.show) {
    startAutoCloseTimer()
  } else {
    clearAutoCloseTimer()
  }
})

// Get URL for different Nostr clients
// Get URL for different Nostr clients
const getNostrClientUrl = (client, noteId) => {
  if (!noteId) return '#'
  
  try {
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${noteId}`
      case 'yakihonne':
        return `https://yakihonne.com/notes/${nip19.neventEncode({ id: noteId })}`
      default:
        return `https://primal.net/e/${noteId}`
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  if (props.show) {
    startAutoCloseTimer()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  clearAutoCloseTimer()
})
</script>

<style scoped>
/* Modal fade transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s ease-out;
}

.modal-fade-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}

/* Auto-close countdown animation */
.animate-countdown {
  animation: countdown 5s linear forwards;
}

@keyframes countdown {
  from { width: 100%; }
  to { width: 0%; }
}

/* Line clamp utility */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Clean button transitions */
button, a {
  transition: all 0.2s ease-out;
}

/* Focus states for accessibility */
button:focus-visible,
a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  button, a {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>