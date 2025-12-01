<script setup>
import { inject, ref, onMounted, watch, computed } from 'vue'
import { getNWCClient, getBalance, getWalletInfo } from '../utils/nwcClient.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import {
  IconDashboard,
  IconBolt,
  IconChartBar,
  IconMessageCircle,
  IconFileText,
  IconTarget,
  IconShoppingCart,
  IconWallet,
  IconCreditCard,
  IconUsers,
  IconSettings,
  IconEdit,
  IconCalendar,
  IconLock,
  IconWorld
} from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const combinedZapData = inject('combinedZapData')
const emit = defineEmits(['change-page', 'show-help'])

// Get authentication state
const { isAuthenticated } = useNostrAuth()

// Real-time wallet data
const walletBalance = ref(0)
const walletInfo = ref(null)
const isLoading = ref(false)

// Fetch real wallet data
async function fetchWalletData() {
  const client = getNWCClient()
  if (!client) return

  isLoading.value = true
  try {
    const [balance, info] = await Promise.all([
      getBalance(),
      getWalletInfo()
    ])

    if (balance) {
      walletBalance.value = Math.floor(balance.balance / 1000)
    }

    if (info) {
      walletInfo.value = info
    }
  } catch (error) {
    console.error('Failed to fetch wallet data:', error)
  } finally {
    isLoading.value = false
  }
}

// Watch for zapData changes to refresh wallet data
watch(() => combinedZapData.value.length, (newLength) => {
  if (newLength > 0) {
    fetchWalletData()
  }
}, { immediate: true })

onMounted(() => {
  fetchWalletData()
})

// Make totalZaps and totalSats reactive computed properties
const totalZaps = computed(() => {
  return combinedZapData.value.filter(zap => zap.eventId).length
})
const totalSats = computed(() => {
  return combinedZapData.value
    .filter(zap => zap.eventId)
    .reduce((sum, zap) => sum + zap.amount, 0)
})

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: IconDashboard,
    requiresAuth: false,
    tooltip: 'View Lightning Network statistics and your personal dashboard'
  },
  {
    id: 'zap-feed',
    label: 'Zap Feed',
    icon: IconBolt,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to view your real-time zap feed'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: IconChartBar,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to access detailed earnings analytics'
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: IconWallet,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to manage your Lightning wallet'
  },
  {
    id: 'chat-zaps',
    label: 'Chat',
    icon: IconMessageCircle,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to chat and send zaps'
  },
  {
    id: 'content',
    label: 'Content',
    icon: IconFileText,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to create and monetize content'
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: IconEdit,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to write and publish notes'
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: IconTarget,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to create fundraising campaigns'
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: IconCalendar,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to manage events and schedule'
  },
  {
    id: 'audience',
    label: 'Audience',
    icon: IconUsers,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to view and manage your audience'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: IconSettings,
    requiresAuth: true,
    tooltip: 'Connect with Nostr to configure your account settings'
  }
]

// Track hover state for tooltips
const hoveredItem = ref(null)

const handlePageChange = (item) => {
  // If item requires auth and user is not authenticated, do nothing
  if (item.requiresAuth && !isAuthenticated.value) {
    return
  }

  emit('change-page', item.id)
}

const isItemDisabled = (item) => {
  return item.requiresAuth && !isAuthenticated.value
}
</script>

<template>
  <div class="w-full h-full bg-white/80 backdrop-blur-sm border-r border-orange-100/50 flex flex-col">
    <!-- Logo -->
    <div class="p-4 sm:p-6 border-b border-orange-100/50">
      <div class="flex items-center space-x-3">
        <div class="w-12 h-12 flex items-center justify-center">
          <img
            src="/new_logo3.png"
            alt="ZapTracker Logo"
            class="w-13 h-13 object-contain"
          />
        </div>
        <div>
          <h1 class="text-lg font-bold text-gray-800">ZapTracker</h1>
          <p class="text-xs text-gray-600">Lightning Insights</p>
        </div>
      </div>
    </div>

    <!-- Pre-Auth Help Banner -->
    <div v-if="!isAuthenticated" class="mx-3 mt-4 mb-2">
      <div class="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3">
        <div class="flex items-start space-x-2 mb-2">
          <IconWorld class="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <div class="text-sm font-semibold text-gray-900 mb-1">Explore Network Stats</div>
            <p class="text-xs text-gray-600 leading-relaxed">
              Some features require Nostr authentication. Click "How to Start" to learn more.
            </p>
          </div>
        </div>
        <button
          @click="emit('show-help')"
          class="w-full mt-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-all duration-200"
        >
          How to Get Started
        </button>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-3 sm:p-4 overflow-y-auto">
      <ul class="space-y-1">
        <li
          v-for="item in menuItems"
          :key="item.id"
          class="relative"
          @mouseenter="hoveredItem = item.id"
          @mouseleave="hoveredItem = null"
        >
          <button
            @click="handlePageChange(item)"
            :disabled="isItemDisabled(item)"
            :class="[
              'w-full flex items-center space-x-3 px-2 py-2 rounded-lg text-left transition-all duration-200 touch-target group relative',
              currentPage === item.id && !isItemDisabled(item)
                ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm'
                : isItemDisabled(item)
                ? 'text-gray-400 cursor-not-allowed opacity-60'
                : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer'
            ]"
          >
            <component
              :is="item.icon"
              :class="[
                'w-5 h-5 transition-all duration-200 flex-shrink-0',
                currentPage === item.id && !isItemDisabled(item)
                  ? 'text-white'
                  : isItemDisabled(item)
                  ? 'text-gray-400'
                  : 'text-gray-500 group-hover:text-orange-600'
              ]"
            />
            <span class="font-medium flex-1">{{ item.label }}</span>
            <IconLock
              v-if="isItemDisabled(item)"
              class="w-4 h-4 text-gray-400 flex-shrink-0"
            />
          </button>

          <!-- Tooltip for disabled items -->
          <div
            v-if="isItemDisabled(item) && hoveredItem === item.id"
            class="absolute left-full ml-2 top-0 z-50 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none"
          >
            <div class="font-semibold mb-1 flex items-center space-x-2">
              <IconLock class="w-4 h-4" />
              <span>Authentication Required</span>
            </div>
            <p class="text-gray-300 leading-relaxed">
              {{ item.tooltip }}
            </p>
          </div>
        </li>
      </ul>
    </nav>

    <!-- Stats Summary - Only show when authenticated -->
    <div v-if="isAuthenticated" class="p-3 sm:p-4 border-t border-orange-100/50">
      <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-3 sm:p-4 rounded-lg shadow-sm">
        <div class="text-sm font-medium mb-1">Total Zaps</div>
        <div class="text-xl sm:text-2xl font-bold">{{ totalZaps.toLocaleString() }}</div>
        <div class="text-xs opacity-90 mt-1">{{ totalSats.toLocaleString() }} sats</div>
        <div class="mt-2 pt-2 border-t border-white/20">
          <div class="text-xs opacity-90">
            Tracking your Lightning activity
          </div>
        </div>
      </div>
    </div>

    <!-- Pre-Auth Footer -->
    <div v-else class="p-3 sm:p-4 border-t border-orange-100/50">
      <div class="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 text-gray-800 p-3 sm:p-4 rounded-lg">
        <div class="flex items-start space-x-2 mb-2">
          <IconWorld class="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <div class="text-sm font-semibold mb-1">Lightning Network</div>
            <div class="text-xs text-gray-600">
              Explore global statistics on the Dashboard
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth transitions */
button {
  transition: all 0.2s ease-in-out;
}

button:disabled {
  cursor: not-allowed;
}

/* Tooltip arrow (optional enhancement) */
.absolute.left-full::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 12px;
  border: 6px solid transparent;
  border-right-color: #1f2937;
}
</style>
