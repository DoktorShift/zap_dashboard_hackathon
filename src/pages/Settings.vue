<script setup>
import { ref, onMounted, watch } from 'vue'
import { IconSettings, IconBolt, IconBell, IconShield, IconUser, IconRefresh, IconTrash } from '@iconify-prerendered/vue-tabler'
import SettingsConnections from '../components/SettingsConnections.vue'
import NotificationSettings from '../components/NotificationSettings.vue'
import NostrSettings from '../components/NostrSettings.vue'
import AccountReset from '../components/AccountReset.vue'

// Define props to receive the initial tab from parent
const props = defineProps({
  initialTab: {
    type: String,
    default: 'nostr'
  }
})

const emit = defineEmits(['change-page'])

const activeTab = ref('nostr')

const tabs = [
  { id: 'nostr', label: 'Nostr', icon: IconUser },
  { id: 'wallet', label: 'Wallet', icon: IconBolt },
  { id: 'alerts', label: 'Notifications', icon: IconBell },
  { id: 'reset', label: 'Reset', icon: IconRefresh }
  // { id: 'privacy', label: 'Privacy', icon: IconShield }
]

// Set initial tab on mount
onMounted(() => {
  if (props.initialTab) {
    activeTab.value = props.initialTab
  }
})

// Watch for changes to initialTab prop and update activeTab
watch(() => props.initialTab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
<!--    <div>-->
<!--      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">-->
<!--        <IconSettings class="w-6 h-6 text-orange-600" />-->
<!--        <span>Settings</span>-->
<!--      </h1>-->
<!--      <p class="text-gray-600">Manage your zap dashboard preferences and integrations</p>-->
<!--    </div>-->
    
    <!-- Settings Tabs -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <!-- Tab Navigation - Swipeable on Mobile -->
      <div class="border-b border-gray-100">
        <nav class="flex space-x-1 px-4 sm:px-6 overflow-x-auto scrollbar-hide" aria-label="Settings tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'flex items-center space-x-2 py-3 px-4 font-medium text-sm whitespace-nowrap transition-all duration-200 relative flex-shrink-0',
              activeTab === tab.id
                ? 'text-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            ]"
          >
            <component :is="tab.icon" class="w-5 h-5" />
            <span>{{ tab.label }}</span>
            <!-- Active indicator -->
            <div v-if="activeTab === tab.id" class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-orange-600"></div>
          </button>
        </nav>
      </div>
      
      <!-- Tab Content -->
      <div class="p-4 sm:p-6">
        <!-- Nostr Settings -->
        <div v-if="activeTab === 'nostr'">
          <NostrSettings @change-page="emit('change-page', $event)" />
        </div>
        
        <!-- Wallet Settings -->
        <div v-if="activeTab === 'wallet'">
          <SettingsConnections @change-page="emit('change-page', $event)" />
        </div>
        
        <!-- Notification Settings -->
        <div v-if="activeTab === 'alerts'">
          <NotificationSettings />
        </div>
        
        <!-- Reset Settings -->
        <div v-if="activeTab === 'reset'">
          <AccountReset />
        </div>
        
        <!-- Privacy Settings -->
        <div v-if="activeTab === 'privacy'" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Privacy & Security</h3>
            <p class="text-gray-600 text-sm mb-4">Control your privacy settings and data sharing preferences</p>
            
            <div class="bg-gray-50 rounded-lg p-8 text-center">
              <IconShield class="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h4 class="text-lg font-medium text-gray-900 mb-2">Privacy Controls</h4>
              <p class="text-gray-600 mb-4">Manage data privacy, security settings, and sharing preferences.</p>
              <button class="btn-primary">
                <IconShield class="w-4 h-4" />
                Privacy Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar for mobile swipe navigation */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Smooth scroll behavior for tabs */
nav {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
</style>