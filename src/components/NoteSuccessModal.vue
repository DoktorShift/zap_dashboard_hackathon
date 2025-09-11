<template>
  <Teleport to="#modal-root">
    <transition name="success-modal">
      <div v-if="show" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all duration-500">
          <!-- Success Animation Container -->
          <div class="relative bg-gradient-to-br from-green-400 via-emerald-400 to-teal-400 p-8 text-center">
            <!-- Animated Background Pattern -->
            <div class="absolute inset-0 opacity-20">
              <div class="absolute top-4 left-4 w-8 h-8 bg-white/30 rounded-full animate-float-1"></div>
              <div class="absolute top-8 right-6 w-4 h-4 bg-white/20 rounded-full animate-float-2"></div>
              <div class="absolute bottom-6 left-8 w-6 h-6 bg-white/25 rounded-full animate-float-3"></div>
              <div class="absolute bottom-4 right-4 w-3 h-3 bg-white/30 rounded-full animate-float-1"></div>
            </div>
            
            <!-- Main Success Icon with ZapTracker Branding -->
            <div class="relative mb-6">
              <!-- Outer Ring Animation -->
              <div class="absolute inset-0 w-24 h-24 mx-auto">
                <div class="w-full h-full border-4 border-white/30 rounded-full animate-ping"></div>
              </div>
              
              <!-- Success Checkmark -->
              <div class="relative w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl">
                <div class="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center animate-scale-in">
                  <svg class="w-8 h-8 text-white animate-check-draw" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            
            <!-- Success Message -->
            <h2 class="text-3xl font-bold text-white mb-3 animate-fade-in-up">
              Note Published! 🎉
            </h2>
            <p class="text-white/90 text-lg leading-relaxed animate-fade-in-up-delay">
              Your note is now spreading across the Nostr network
            </p>
          </div>
          
          <!-- Details Section -->
          <div class="p-8 bg-white">
            <!-- Network Stats -->
            <div class="grid grid-cols-3 gap-4 mb-8">
              <div class="text-center">
                <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <svg class="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"></path>
                  </svg>
                </div>
                <div class="text-2xl font-bold text-gray-900 animate-count-up">{{ publishResult?.successfulRelays || 0 }}</div>
                <div class="text-xs text-gray-600">Relays</div>
              </div>
              
              <div class="text-center">
                <div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <svg class="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <div class="text-2xl font-bold text-gray-900 animate-count-up-delay">∞</div>
                <div class="text-xs text-gray-600">Reach</div>
              </div>
              
              <div class="text-center">
                <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <div class="text-2xl font-bold text-gray-900 animate-count-up-delay-2">✓</div>
                <div class="text-xs text-gray-600">Verified</div>
              </div>
            </div>
            
            <!-- Note Preview -->
            <div class="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
              <div class="flex items-start space-x-3">
                <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
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
            
            <!-- Action Buttons -->
            <div class="space-y-3">
              <!-- View on Nostr Clients -->
              <div class="grid grid-cols-2 gap-3">
                <a
                  :href="getNostrClientUrl('primal', publishResult?.event?.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span class="text-orange-200">🌐</span>
                  <span>View on Primal</span>
                </a>
                
                <a
                  :href="getNostrClientUrl('yakihonne', publishResult?.event?.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span class="text-purple-200">🍜</span>
                  <span>View on Yakihonne</span>
                </a>
              </div>
              
              <!-- Continue Button -->
              <button
                @click="closeModal"
                class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <span>Continue</span>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- ZapTracker Branding Footer -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-100 px-6 py-4">
            <div class="flex items-center justify-center space-x-2 text-gray-600">
              <img 
                src="/new_logo3.png"
                alt="ZapTracker" 
                class="w-5 h-5 object-contain"
              />
              <span class="text-sm font-medium">Powered by ZapTracker</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
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

// Get URL for different Nostr clients
const getNostrClientUrl = (client, noteId) => {
  if (!noteId) return '#'
  
  try {
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${noteId}`
      case 'yakihonne':
        return `https://yakihonne.com/e/${nip19.neventEncode({ id: noteId })}`
      default:
        return `https://primal.net/e/${noteId}`
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
}

// Close modal
const closeModal = () => {
  emit('close')
}
</script>

<style scoped>
/* Success modal entrance animation */
.success-modal-enter-active {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.success-modal-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.success-modal-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(40px);
}

.success-modal-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

/* Floating animation for background elements */
@keyframes float-1 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-10px) rotate(120deg); }
  66% { transform: translateY(5px) rotate(240deg); }
}

@keyframes float-2 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(180deg); }
}

@keyframes float-3 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(90deg); }
  75% { transform: translateY(8px) rotate(270deg); }
}

.animate-float-1 {
  animation: float-1 6s ease-in-out infinite;
}

.animate-float-2 {
  animation: float-2 4s ease-in-out infinite;
}

.animate-float-3 {
  animation: float-3 5s ease-in-out infinite;
}

/* Scale in animation for checkmark */
@keyframes scale-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-in {
  animation: scale-in 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
}

/* Checkmark drawing animation */
@keyframes check-draw {
  0% {
    stroke-dasharray: 0 20;
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dasharray: 20 20;
    stroke-dashoffset: 0;
  }
}

.animate-check-draw {
  animation: check-draw 0.6s ease-out 0.8s both;
}

/* Fade in up animations */
@keyframes fade-in-up {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out 0.5s both;
}

.animate-fade-in-up-delay {
  animation: fade-in-up 0.6s ease-out 0.7s both;
}

/* Count up animations */
@keyframes count-up {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-count-up {
  animation: count-up 0.8s ease-out 1s both;
}

.animate-count-up-delay {
  animation: count-up 0.8s ease-out 1.2s both;
}

.animate-count-up-delay-2 {
  animation: count-up 0.8s ease-out 1.4s both;
}

/* Ping animation for outer ring */
@keyframes ping {
  75%, 100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.animate-ping {
  animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

/* Line clamp utility */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Button hover effects */
button:not(:disabled),
a {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states for accessibility */
button:focus-visible,
a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .text-3xl {
    font-size: 1.875rem;
  }
  
  .text-lg {
    font-size: 1.125rem;
  }
  
  button, a {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .animate-float-1,
  .animate-float-2,
  .animate-float-3,
  .animate-scale-in,
  .animate-check-draw,
  .animate-fade-in-up,
  .animate-fade-in-up-delay,
  .animate-count-up,
  .animate-count-up-delay,
  .animate-count-up-delay-2,
  .animate-ping {
    animation: none;
  }
  
  button:hover,
  a:hover {
    transform: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .bg-gradient-to-br {
    background: #10b981; /* Solid green for high contrast */
  }
  
  .bg-gradient-to-r {
    background: #f97316; /* Solid orange for high contrast */
  }
}
</style>