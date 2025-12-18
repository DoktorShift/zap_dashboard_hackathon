<script setup>
import { inject, computed, ref, watch } from 'vue'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
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
  IconActivity,
  IconCoins,
  IconSparkles,
  IconVideo,
  IconMessageCircle
} from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const combinedZapData = inject('combinedZapData')
const activeConnection = inject('activeConnection')
const isWalletConnected = inject('isWalletConnected')
const emit = defineEmits(['change-page', 'show-help'])

const { isAuthenticated } = useNostrAuth()
const dashboardSubmenuOpen = ref(true)
const studioSubmenuOpen = ref(false)
const audienceSubmenuOpen = ref(false)

const totalZaps = computed(() => {
  return combinedZapData.value.filter(zap => zap.eventId).length
})

const totalSats = computed(() => {
  return combinedZapData.value
    .filter(zap => zap.eventId)
    .reduce((sum, zap) => sum + zap.amount, 0)
})

const checkAndOpenParentMenu = () => {
  const dashboardPages = ['dashboard', 'lightning-explorer']
  const studioPages = ['content', 'notes', 'campaigns']
  const audiencePages = ['audience', 'chat-zaps']

  if (dashboardPages.includes(currentPage.value)) {
    dashboardSubmenuOpen.value = true
  }
  if (studioPages.includes(currentPage.value)) {
    studioSubmenuOpen.value = true
  }
  if (audiencePages.includes(currentPage.value)) {
    audienceSubmenuOpen.value = true
  }
}

checkAndOpenParentMenu()

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: IconDashboard,
    requiresAuth: false,
    hasSubmenu: true,
    submenuKey: 'dashboard',
    submenuItems: [
      { id: 'dashboard', label: 'ZapTracker Dashboard', icon: IconDashboard },
      { id: 'lightning-explorer', label: 'Lightning Explorer', icon: IconActivity }
    ]
  },
  { id: 'zap-feed', label: 'Zap Feed', icon: IconBolt, requiresAuth: true },
  { id: 'wallet', label: 'Wallet', icon: IconWallet, requiresAuth: true },
  { id: 'analytics', label: 'Analytics', icon: IconChartBar, requiresAuth: true },
  {
    id: 'studio',
    label: 'Studio',
    icon: IconVideo,
    requiresAuth: true,
    hasSubmenu: true,
    submenuKey: 'studio',
    submenuItems: [
      { id: 'content', label: 'Content', icon: IconFileText },
      { id: 'notes', label: 'Notes', icon: IconEdit },
      { id: 'campaigns', label: 'Campaigns', icon: IconTarget }
    ]
  },
  {
    id: 'audience',
    label: 'Audience',
    icon: IconUsers,
    requiresAuth: true,
    hasSubmenu: true,
    submenuKey: 'audience',
    submenuItems: [
      { id: 'audience', label: 'Your Audience', icon: IconUsers },
      { id: 'chat-zaps', label: 'Chat', icon: IconMessageCircle }
    ]
  },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar, requiresAuth: true },
  { id: 'settings', label: 'Settings', icon: IconSettings, requiresAuth: false }
]

const toggleSubmenu = (submenuKey) => {
  if (submenuKey === 'dashboard') {
    dashboardSubmenuOpen.value = !dashboardSubmenuOpen.value
  } else if (submenuKey === 'studio') {
    studioSubmenuOpen.value = !studioSubmenuOpen.value
  } else if (submenuKey === 'audience') {
    audienceSubmenuOpen.value = !audienceSubmenuOpen.value
  }
}

const isSubmenuOpen = (submenuKey) => {
  if (submenuKey === 'dashboard') return dashboardSubmenuOpen.value
  if (submenuKey === 'studio') return studioSubmenuOpen.value
  if (submenuKey === 'audience') return audienceSubmenuOpen.value
  return false
}

const isParentActive = (item) => {
  if (!item.hasSubmenu) return false
  return item.submenuItems.some(subItem => subItem.id === currentPage.value)
}

const handlePageChange = (item) => {
  if (item.requiresAuth && !isAuthenticated.value) return
  if (item.hasSubmenu) {
    if (item.submenuKey === 'dashboard' && !isAuthenticated.value) {
      emit('change-page', 'lightning-explorer')
      return
    }
    toggleSubmenu(item.submenuKey)
    return
  }
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

watch(currentPage, () => {
  checkAndOpenParentMenu()
})
</script>

<template>
  <aside
    class="h-screen w-64 sm:w-72 lg:w-80 bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 flex flex-col overflow-hidden shadow-xl"
  >
    <!-- Logo Section -->
    <div class="flex-shrink-0 px-6 py-6 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div class="flex items-center space-x-3">
        <img src="/new_logo3.png" alt="ZapTracker Logo" class="w-14 h-14 object-contain" />
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent leading-tight truncate">
            ZapTracker
          </h1>
          <p class="text-xs text-gray-500 truncate">Lightning Analytics</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
      <!-- unverändert -->
      <!-- … kompletter Inhalt bleibt exakt gleich … -->
