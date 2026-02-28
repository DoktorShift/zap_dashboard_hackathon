<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  IconBolt, IconBell, IconShield, IconUser, IconRefresh,
  IconAward, IconGlobe, IconExternalLink, IconCheck, IconCopy
} from '@iconify-prerendered/vue-tabler'
import * as nip19 from 'nostr-tools/nip19'
import SettingsConnections from '../components/settings/SettingsConnections.vue'
import NotificationSettings from '../components/settings/NotificationSettings.vue'
import NostrSettings from '../components/settings/NostrSettings.vue'
import AccountReset from '../components/settings/AccountReset.vue'
import BadgeList from '../components/badges/BadgeList.vue'
import BadgeDetailModal from '../components/badges/BadgeDetailModal.vue'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useBadges } from '../composables/social/useBadges.js'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'

const { currentUser, userProfile } = useNostrAuth()
const { getUserBadgeCount, initUserBadges } = useBadges()

// Define props to receive the initial tab from parent
const props = defineProps({
  initialTab: {
    type: String,
    default: 'profile'
  }
})

const emit = defineEmits(['change-page'])

const activeTab = ref('profile')

// Badge detail modal state
const showBadgeDetailModal = ref(false)
const selectedBadge = ref(null)
const copySuccess = ref('')

const handleBadgeClick = (badge) => {
  selectedBadge.value = badge
  showBadgeDetailModal.value = true
}

// Badge count
const badgeCount = computed(() => {
  return currentUser.value?.pubkey ? getUserBadgeCount(currentUser.value.pubkey) : 0
})

// Profile computed
const displayName = computed(() => {
  return userProfile.value?.name || userProfile.value?.display_name || 'Anonymous'
})

const userNpub = computed(() => {
  if (!currentUser.value?.pubkey) return ''
  try { return nip19.npubEncode(currentUser.value.pubkey) } catch { return '' }
})

const userAvatar = computed(() => {
  return userProfile.value?.picture || generateAvatar(currentUser.value?.pubkey)
})

const copyNpub = async () => {
  if (!userNpub.value) return
  try {
    await navigator.clipboard.writeText(userNpub.value)
    copySuccess.value = 'npub'
    setTimeout(() => { copySuccess.value = '' }, 2000)
  } catch (e) {
    console.error('Copy failed:', e)
  }
}

const tabs = [
  { id: 'profile', label: 'Profile', icon: IconUser },
  { id: 'nostr', label: 'Nostr', icon: IconGlobe },
  { id: 'wallet', label: 'Wallet', icon: IconBolt },
  { id: 'alerts', label: 'Notifications', icon: IconBell },
  { id: 'reset', label: 'Reset', icon: IconRefresh }
]

// Set initial tab on mount
onMounted(() => {
  if (props.initialTab) {
    activeTab.value = props.initialTab
  }
  // Initialize badges for current user
  if (currentUser.value?.pubkey) {
    initUserBadges(currentUser.value.pubkey)
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
    <!-- Elegant Settings Container -->
    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- Modern Tab Navigation -->
      <div class="border-b border-gray-100 bg-gray-50/50">
        <nav class="flex space-x-2 px-6 py-4 overflow-x-auto scrollbar-hide" aria-label="Settings tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'flex items-center gap-2.5 px-5 py-3 font-semibold text-sm whitespace-nowrap transition-all duration-300 rounded-2xl flex-shrink-0',
              activeTab === tab.id
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white'
            ]"
          >
            <component :is="tab.icon" class="w-5 h-5" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-6 sm:p-8">
        <!-- Profile Tab -->
        <div v-if="activeTab === 'profile'" class="space-y-8">
          <!-- Profile Header -->
          <div class="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
            <!-- Avatar -->
            <div class="relative flex-shrink-0">
              <div class="w-24 h-24 rounded-2xl overflow-hidden border-2 border-orange-200 shadow-lg">
                <img
                  :src="userAvatar"
                  :alt="displayName"
                  class="w-full h-full object-cover"
                  @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
                />
              </div>
              <div v-if="badgeCount > 0" class="absolute -bottom-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                {{ badgeCount }}
              </div>
            </div>

            <!-- Profile Info -->
            <div class="flex-1 text-center sm:text-left">
              <h2 class="text-2xl font-bold text-gray-900">{{ displayName }}</h2>
              <p v-if="userProfile?.nip05" class="text-sm text-blue-600 flex items-center justify-center sm:justify-start space-x-1 mt-1">
                <IconCheck class="w-4 h-4" />
                <span>{{ userProfile.nip05 }}</span>
              </p>
              <p v-if="userProfile?.about" class="text-sm text-gray-600 mt-2 max-w-lg">{{ userProfile.about }}</p>

              <!-- Npub -->
              <div v-if="userNpub" class="flex items-center justify-center sm:justify-start space-x-2 mt-3">
                <code class="text-xs text-gray-500 font-mono">{{ userNpub.substring(0, 20) }}...</code>
                <button
                  @click="copyNpub"
                  class="p-1 text-gray-400 hover:text-orange-600 rounded transition-colors"
                  title="Copy npub"
                >
                  <IconCheck v-if="copySuccess === 'npub'" class="w-3.5 h-3.5 text-green-600" />
                  <IconCopy v-else class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Quick Stats -->
              <div class="flex items-center justify-center sm:justify-start space-x-4 mt-3">
                <div v-if="userProfile?.lud16" class="flex items-center space-x-1 text-sm text-yellow-600">
                  <IconBolt class="w-4 h-4" />
                  <span class="text-xs">{{ userProfile.lud16 }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Badges Section -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <IconAward class="w-5 h-5 text-orange-600" />
                <h3 class="text-lg font-semibold text-gray-900">Badges</h3>
                <span v-if="badgeCount > 0" class="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{{ badgeCount }}</span>
              </div>
            </div>

            <div class="bg-gray-50 rounded-xl p-6">
              <BadgeList
                v-if="currentUser?.pubkey"
                :pubkey="currentUser.pubkey"
                size="large"
                :show-count="false"
                :show-view-all="false"
                layout="grid"
                @badge-click="handleBadgeClick"
              >
                <template #empty>
                  <div class="text-center py-6">
                    <IconAward class="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <h4 class="text-lg font-medium text-gray-900 mb-2">No Badges Yet</h4>
                    <p class="text-gray-500 text-sm mb-4">Earn badges from the Nostr community to showcase here.</p>
                  </div>
                </template>
              </BadgeList>
            </div>
          </div>

          <!-- BadgeBox Info -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
            <div class="flex items-start space-x-4">
              <div class="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconAward class="w-5 h-5 text-white" />
              </div>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900 mb-1">BadgeBox — Nostr Badge Manager</h4>
                <p class="text-sm text-gray-700 mb-3">
                  BadgeBox is a PWA for managing NIP-58 badges on Nostr. Create, issue, and display badges
                  to recognize community members and build reputation across the network.
                </p>
                <a
                  href="https://badgebox.rinbal.de"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                >
                  <IconExternalLink class="w-4 h-4" />
                  <span>Open BadgeBox</span>
                </a>
              </div>
            </div>
          </div>
        </div>

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

  <BadgeDetailModal
    :show="showBadgeDetailModal"
    :badge="selectedBadge"
    @close="showBadgeDetailModal = false; selectedBadge = null"
  />
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
