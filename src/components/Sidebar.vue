<script setup>
import { ref, inject, computed } from 'vue'
import { 
  IconDashboard, 
  IconBolt, 
  IconChartBar, 
  IconWallet, 
  IconMessageCircle, 
  IconFileText, 
  IconGift, 
  IconShoppingCart, 
  IconSettings,
  IconEdit,
  IconUsers
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'

const currentPage = inject('currentPage')
const emit = defineEmits(['change-page'])

// Use Nostr authentication to get user profile
const { isAuthenticated, userProfile } = useNostrAuth()

// Get user name with Nostr profile fallback
const getUserName = computed(() => {
  if (isAuthenticated.value && userProfile.value?.name) {
    return userProfile.value.name
  }
  return 'Creator'
})

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { id: 'zap-feed', label: 'Zap Feed', icon: IconBolt },
  { id: 'analytics', label: 'Analytics', icon: IconChartBar },
  { id: 'wallet', label: 'Wallet', icon: IconWallet },
  { id: 'chat-zaps', label: 'Chat + Zaps', icon: IconMessageCircle },
  { id: 'content', label: 'Content', icon: IconFileText },
  { id: 'notes', label: 'Notes', icon: IconEdit },
  { id: 'audience', label: 'Audience', icon: IconUsers },
  // { id: 'donations', label: 'Donations', icon: IconGift },
  // { id: 'mini-pos', label: 'Mini PoS', icon: IconShoppingCart },
  // { id: 'finances', label: 'Finances', icon: IconWallet },
  { id: 'settings', label: 'Settings', icon: IconSettings }
]

const handlePageChange = (pageId) => {
  emit('change-page', pageId)
}
</script>

<template>
  <div class="h-full bg-white/90 backdrop-blur-sm border-r border-orange-100/50 flex flex-col">
    <!-- Logo/Brand -->
    <div class="p-4 sm:p-6 border-b border-orange-100/50">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-orange-400 to-amber-400 rounded-lg flex items-center justify-center shadow-sm">
          <IconBolt class="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <h1 class="text-lg sm:text-xl font-bold text-gray-900">ZapTracker</h1>
          <p class="text-xs text-gray-600 hidden sm:block">Lightning Dashboard</p>
        </div>
      </div>
    </div>
    
    <!-- Welcome Message -->
    <div class="px-4 sm:px-6 py-3 border-b border-orange-100/50 bg-gradient-to-r from-orange-50/50 to-amber-50/50">
      <p class="text-sm text-gray-700">
        Welcome back, <span class="font-medium text-orange-600">{{ getUserName }}</span>!
      </p>
    </div>
    
    <!-- Navigation Menu -->
    <nav class="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto scrollbar-thin">
      <button
        v-for="item in menuItems"
        :key="item.id"
        @click="handlePageChange(item.id)"
        :class="[
          'w-full flex items-center space-x-3 px-3 py-3 sm:py-3 rounded-lg text-left transition-all duration-200 touch-target group',
          currentPage === item.id
            ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-md transform scale-105'
            : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700 hover:shadow-sm hover:scale-105'
        ]"
      >
        <component 
          :is="item.icon" 
          :class="[
            'w-5 h-5 transition-all duration-200',
            currentPage === item.id 
              ? 'text-white' 
              : 'text-gray-500 group-hover:text-orange-600 group-hover:scale-110'
          ]" 
        />
        <span class="font-medium text-sm sm:text-base">{{ item.label }}</span>
      </button>
    </nav>
    
    <!-- Footer -->
    <div class="p-3 sm:p-4 border-t border-orange-100/50 bg-gradient-to-r from-orange-50/30 to-amber-50/30">
      <div class="text-center">
        <p class="text-xs text-gray-500 mb-2">Made with ⚡ by</p>
        <div class="flex items-center justify-center space-x-2">
          <a 
            href="https://github.com/pratik227" 
            target="_blank" 
            rel="noopener noreferrer"
            class="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
          >
            Pratik
          </a>
          <span class="text-xs text-gray-400">&</span>
          <a 
            href="https://github.com/DoktorShift" 
            target="_blank" 
            rel="noopener noreferrer"
            class="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
          >
            DoktorShift
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure proper touch targets on mobile */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Smooth hover animations */
.group:hover .group-hover\:scale-110 {
  transform: scale(1.1);
}

.group:hover .group-hover\:text-orange-600 {
  color: #ea580c;
}

/* Active state animations */
.transform.scale-105 {
  transform: scale(1.05);
}

/* Custom scrollbar for navigation */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 2px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .touch-target {
    min-height: 48px; /* Larger touch targets on mobile */
  }
}

/* Accessibility improvements */
button:focus-visible {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .transition-all,
  .group:hover .group-hover\:scale-110,
  .transform.scale-105 {
    transition: none !important;
    transform: none !important;
  }
}
</style>