<script setup>
import { ref, computed, onMounted } from 'vue'
import { IconX } from '@iconify-prerendered/vue-tabler'
import ThreadsIcon from '../../assets/ThreadsIcon.vue'

const props = defineProps({
  variant: {
    type: String,
    required: true,
    validator: (value) => ['notes', 'zapfeed', 'menu'].includes(value)
  }
})

const isDismissed = ref(false)
const isVisible = ref(false)

const storageKey = computed(() => {
  return `threads_promo_dismissed_${props.variant}`
})

const showDismissButton = computed(() => {
  return props.variant !== 'menu'
})

onMounted(() => {
  if (props.variant !== 'menu') {
    const dismissed = localStorage.getItem(storageKey.value)
    isDismissed.value = dismissed === 'true'
  }

  setTimeout(() => {
    isVisible.value = true
  }, 100)
})

const handleDismiss = () => {
  isVisible.value = false
  setTimeout(() => {
    isDismissed.value = true
    localStorage.setItem(storageKey.value, 'true')
  }, 300)
}

const handleClick = () => {
  window.open('https://nostrthreads.com', '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <!-- Notes Variant: Compact banner below compose area -->
  <transition name="fade-slide">
    <div
      v-if="variant === 'notes' && !isDismissed && isVisible"
      class="relative bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-lg flex items-center justify-center shadow-sm">
            <ThreadsIcon size="20" class="text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-gray-900">Organize your notes into Threads</h4>
            <p class="text-xs text-gray-600 mt-0.5">Track conversations and engagement in one place</p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            @click="handleClick"
            class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg whitespace-nowrap"
          >
            Try Threads
          </button>
          <button
            v-if="showDismissButton"
            @click.stop="handleDismiss"
            class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-orange-100 rounded-lg transition-colors"
            title="Dismiss"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- ZapFeed Variant: Integrated card in feed -->
  <transition name="fade-slide">
    <div
      v-if="variant === 'zapfeed' && !isDismissed && isVisible"
      @click="handleClick"
      class="bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-2xl border-2 border-orange-300/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1 relative group"
    >
      <button
        v-if="showDismissButton"
        @click.stop="handleDismiss"
        class="absolute top-3 right-3 p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 z-10 backdrop-blur-sm"
        title="Dismiss"
      >
        <IconX class="w-5 h-5" />
      </button>

      <div class="p-6 relative">
        <div class="flex items-start gap-4 mb-4">
          <div class="flex-shrink-0 w-14 h-14 bg-white/90 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
            <ThreadsIcon size="32" class="text-orange-600" />
          </div>
          <div class="flex-1 min-w-0 pt-1">
            <div class="inline-flex items-center gap-2 mb-2">
              <h3 class="text-xl font-bold text-white drop-shadow-sm">Discover Threads</h3>
              <span class="px-2 py-0.5 bg-white/90 text-orange-600 text-xs font-bold rounded-full shadow-sm">NEW</span>
            </div>
            <p class="text-orange-50 text-sm leading-relaxed drop-shadow-sm">
              Organize conversations and track engagement across your Nostr content
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 text-white/90 text-sm">
            <div class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
              </svg>
              <span class="drop-shadow-sm">Thread Management</span>
            </div>
            <div class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
              <span class="drop-shadow-sm">Analytics</span>
            </div>
          </div>

          <button
            class="px-5 py-2.5 bg-white text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 group-hover:gap-3"
          >
            <span>Explore Threads</span>
            <svg class="w-4 h-4 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
    </div>
  </transition>

  <!-- Menu Variant: Dropdown menu item -->
  <button
    v-if="variant === 'menu'"
    @click="handleClick"
    class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors duration-200 group"
  >
    <div class="flex items-center space-x-3">
      <ThreadsIcon size="16" class="text-orange-600 group-hover:scale-110 transition-transform duration-200" />
      <span class="font-medium">Try Threads</span>
    </div>
    <span class="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-bold rounded-full group-hover:bg-orange-200 transition-colors">
      NEW
    </span>
  </button>
</template>

<style scoped>
.fade-slide-enter-active {
  transition: all 0.4s ease-out;
}

.fade-slide-leave-active {
  transition: all 0.3s ease-in;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
