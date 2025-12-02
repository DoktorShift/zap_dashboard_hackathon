<script setup>
import { inject, computed, ref } from 'vue'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import {
  IconDashboard,
  IconBolt,
  IconChartBar,
  IconWallet,
  IconFileText,
  IconEdit,
  IconTarget,
  IconCalendar,
  IconUsers,
  IconSettings,
  IconChevronDown,
  IconChevronRight,
  IconActivity
} from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const combinedZapData = inject('combinedZapData')
const emit = defineEmits(['change-page', 'show-help'])

const { isAuthenticated } = useNostrAuth()
const dashboardSubmenuOpen = ref(false)

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
    hasSubmenu: true,
    submenuItems: [
      { id: 'dashboard', label: 'ZapTracker Dashboard', icon: IconDashboard },
      { id: 'lightning-explorer', label: 'Lightning Explorer', icon: IconActivity }
    ]
  },
  { id: 'zap-feed', label: 'Zap Feed', icon: IconBolt, requiresAuth: true },
  { id: 'analytics', label: 'Analytics', icon: IconChartBar, requiresAuth: true },
  { id: 'wallet', label: 'Wallet', icon: IconWallet, requiresAuth: true },
  { id: 'content', label: 'Content', icon: IconFileText, requiresAuth: true },
  { id: 'notes', label: 'Notes', icon: IconEdit, requiresAuth: true },
  { id: 'campaigns', label: 'Campaigns', icon: IconTarget, requiresAuth: true },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar, requiresAuth: true },
  { id: 'audience', label: 'Audience', icon: IconUsers, requiresAuth: true },
  { id: 'settings', label: 'Settings', icon: IconSettings, requiresAuth: false }
]

const toggleDashboardSubmenu = () => {
  dashboardSubmenuOpen.value = !dashboardSubmenuOpen.value
}

const handlePageChange = (item) => {
  if (item.requiresAuth && !isAuthenticated.value) return

  // If clicking on dashboard parent and logged in, toggle submenu
  if (item.hasSubmenu && isAuthenticated.value) {
    toggleDashboardSubmenu()
    return
  }

  // If not logged in, go directly to dashboard (lightning explorer)
  emit('change-page', item.id)
}

const handleSubmenuClick = (subItem) => {
  emit('change-page', subItem.id)
}

const isItemDisabled = (item) => {
  return item.requiresAuth && !isAuthenticated.value
}

const handleShowHelp = () => {
  emit('show-help')
}
</script>

<template>
  <aside class="h-screen w-72 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
    <!-- Logo Section -->
    <div class="flex-shrink-0 px-6 py-6 border-b border-gray-100">
      <div class="flex items-center space-x-4">
        <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
          <IconBolt class="w-7 h-7 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="text-lg font-bold text-gray-900 leading-tight truncate">ZapTracker</h1>
          <p class="text-xs text-gray-500 truncate">Lightning Analytics</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 overflow-y-auto">
      <ul class="space-y-1">
        <li v-for="item in menuItems" :key="item.id">
          <!-- Main Menu Item -->
          <button
            @click="handlePageChange(item)"
            :disabled="isItemDisabled(item)"
            :class="[
              'w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200',
              (currentPage === item.id || (item.hasSubmenu && (currentPage === 'dashboard' || currentPage === 'lightning-explorer')))
                ? 'bg-orange-50 text-orange-600 font-medium shadow-sm'
                : isItemDisabled(item)
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            ]"
          >
            <component
              :is="item.icon"
              :class="[
                'w-5 h-5 flex-shrink-0',
                (currentPage === item.id || (item.hasSubmenu && (currentPage === 'dashboard' || currentPage === 'lightning-explorer')))
                  ? 'text-orange-500'
                  : isItemDisabled(item)
                  ? 'text-gray-300'
                  : 'text-gray-500'
              ]"
            />
            <span class="text-sm truncate flex-1">{{ item.label }}</span>
            <component
              v-if="item.hasSubmenu && isAuthenticated"
              :is="dashboardSubmenuOpen ? IconChevronDown : IconChevronRight"
              class="w-4 h-4 flex-shrink-0 text-gray-400"
            />
          </button>

          <!-- Submenu Items -->
          <ul
            v-if="item.hasSubmenu && isAuthenticated && dashboardSubmenuOpen"
            class="mt-1 ml-4 space-y-1"
          >
            <li v-for="subItem in item.submenuItems" :key="subItem.id">
              <button
                @click="handleSubmenuClick(subItem)"
                :class="[
                  'w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200',
                  currentPage === subItem.id
                    ? 'bg-orange-100 text-orange-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                ]"
              >
                <component
                  :is="subItem.icon"
                  :class="[
                    'w-4 h-4 flex-shrink-0',
                    currentPage === subItem.id
                      ? 'text-orange-600'
                      : 'text-gray-400'
                  ]"
                />
                <span class="text-xs truncate">{{ subItem.label }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </nav>

    <!-- Stats Section (Only when authenticated) -->
    <div v-if="isAuthenticated && combinedZapData.length > 0" class="flex-shrink-0 px-4 py-4 border-t border-gray-100">
      <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4">
        <p class="text-xs font-semibold text-gray-700 mb-3">Your Activity</p>
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-600">Total Zaps</span>
            <span class="text-sm font-bold text-gray-900 tabular-nums">{{ totalZaps.toLocaleString() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-600">Total Sats</span>
            <span class="text-sm font-bold text-orange-600 tabular-nums">{{ totalSats.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Help Button (Only when not authenticated) -->
    <div v-if="!isAuthenticated" class="flex-shrink-0 px-4 py-5 border-t border-gray-100">
      <button
        @click="handleShowHelp"
        class="w-full px-5 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
      >
        How to Get Started
      </button>
    </div>

    <!-- Footer -->
    <div class="flex-shrink-0 px-6 py-4 border-t border-gray-100">
      <p class="text-xs text-gray-500 text-center truncate">
        © 2024 ZapTracker
      </p>
    </div>
  </aside>
</template>

<style scoped>
aside {
  -webkit-user-select: none;
  user-select: none;
}

button:disabled {
  pointer-events: none;
}
</style>
