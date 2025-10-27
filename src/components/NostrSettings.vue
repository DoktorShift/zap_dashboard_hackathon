<script setup>
import { ref, onMounted } from 'vue'
import {
  IconUser,
  IconPlugConnected,
  IconEdit,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconWifi,
  IconWifiOff,
  IconLoader,
  IconCopy,
  IconExternalLink,
  IconShield,
  IconKey,
  IconGlobe,
  IconBolt,
  IconChevronDown,
  IconChevronUp,
  IconSettings,
  IconUserCheck,
  IconUserX,
  IconLogout
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'
import NostrProfileEditor from './NostrProfileEditor.vue'

const {
  currentUser,
  isLoading,
  authError,
  userRelays,
  relayError,
  isAuthenticated,
  userProfile,
  connectedRelays,
  readRelays,
  writeRelays,
  login,
  logout,
  addRelay,
  removeRelay,
  checkRelayStatus,
  checkAllRelayStatuses,
  validateRelayUrl,
  initAuthAndRelays,
  refreshUserProfile
} = useNostrAuth()

// Local state
const newRelayUrl = ref('')
const addingRelay = ref(false)
const relayFormError = ref('')
const copySuccess = ref(false)
const refreshingProfile = ref(false)
const showProfileEditor = ref(false)
const showRelaySection = ref(false)
const refreshingRelays = ref(false)
const refreshingIndividualRelay = ref(new Set())

// Initialize on mount
onMounted(async () => {
  await initAuthAndRelays()
})

// Handle login
const handleLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Handle logout
const handleLogout = async () => {
  logout()
}

// Handle add relay
const handleAddRelay = async () => {
  if (!newRelayUrl.value.trim()) {
    relayFormError.value = 'Please enter a relay URL'
    return
  }

  const validation = validateRelayUrl(newRelayUrl.value.trim())
  if (validation) {
    relayFormError.value = validation
    return
  }

  relayFormError.value = ''
  try {
    await addRelay(newRelayUrl.value.trim())
    newRelayUrl.value = ''
  } catch (error) {
    relayFormError.value = error.message
  }
}

// Handle remove relay
const handleRemoveRelay = async (url) => {
  try {
    removeRelay(url)
  } catch (error) {
    console.error('Failed to remove relay:', error)
  }
}

// Handle refresh all relays
const handleRefreshRelays = async () => {
  await checkAllRelayStatuses()
}

// Handle refresh single relay
const handleRefreshRelay = async (url) => {
  refreshingIndividualRelay.value.add(url)
  try {
    await checkRelayStatus(url)
  } finally {
    refreshingIndividualRelay.value.delete(url)
  }
}

// Handle refresh profile
const handleRefreshProfile = async () => {
  if (!isAuthenticated.value) return

  try {
    await refreshUserProfile()
  } catch (error) {
    console.error('Failed to refresh profile:', error)
  }
}

// Copy to clipboard
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Get relay status color
const getRelayStatusColor = (status) => {
  switch (status) {
    case 'connected':
      return 'bg-green-500'
    case 'disconnected':
      return 'bg-gray-300'
    case 'checking':
      return 'bg-yellow-500'
    default:
      return 'bg-gray-300'
  }
}

// Format relay URL for display
const formatRelayUrl = (url) => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

// Get user avatar
const getUserAvatar = () => {
  return userProfile.value?.picture ||
         userProfile.value?.avatar ||
         'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
}

// Get short npub for display
const getShortNpub = () => {
  if (!currentUser.value?.npub) return ''
  return currentUser.value.npub.substring(0, 12) + '...' + currentUser.value.npub.substring(currentUser.value.npub.length - 4)
}

// Handle profile edit
const handleEditProfile = () => {
  showProfileEditor.value = true
}

// Handle profile update
const handleProfileUpdated = () => {
  showProfileEditor.value = false
  handleRefreshProfile()
}

// Toggle relay section
const toggleRelaySection = () => {
  showRelaySection.value = !showRelaySection.value
}
</script>

<template>
  <div class="space-y-8">
    <!-- Not Authenticated State -->
    <div v-if="!isAuthenticated" class="max-w-xl mx-auto">
      <div class="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
        <div class="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 bg-gradient-to-br from-orange-100 to-orange-50">
          <img
            src="/nostr-logo/nostr10.png"
            alt="Nostr Logo"
            class="w-14 h-14 object-contain"
          />
        </div>

        <h2 class="text-3xl font-semibold text-gray-900 mb-3">Connect Your Identity</h2>
        <p class="text-gray-500 text-base mb-8 max-w-md mx-auto leading-relaxed">
          Sign in with your Nostr identity to unlock social features and manage your profile.
        </p>

        <button
          @click="handleLogin"
          :disabled="isLoading"
          class="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-medium text-base hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          <IconLoader v-if="isLoading" class="w-5 h-5 animate-spin" />
          <IconUser v-else class="w-5 h-5" />
          {{ isLoading ? 'Connecting...' : 'Connect with Nostr' }}
        </button>

        <!-- Auth Error -->
        <div v-if="authError" class="mt-6 bg-red-50 border border-red-100 rounded-2xl p-4">
          <div class="flex items-center justify-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-500" />
            <span class="text-sm text-red-600">{{ authError }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Authenticated State -->
    <div v-else class="space-y-6">
      <!-- Elegant Profile Card -->
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Profile Header with Gradient Background -->
        <div class="h-32 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative">
          <div class="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
        </div>

        <!-- Profile Content -->
        <div class="px-8 pb-8">
          <!-- Avatar -->
          <div class="relative -mt-16 mb-6">
            <div class="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-white">
              <img
                :src="getUserAvatar()"
                :alt="userProfile?.name || 'User'"
                class="w-full h-full object-cover"
                @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
              />
            </div>
            <!-- Online Status -->
            <div class="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white shadow-lg"></div>
          </div>

          <!-- Profile Info -->
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-1">
              {{ userProfile?.name || 'Anonymous' }}
            </h2>
            <p class="text-gray-500 text-sm font-mono">{{ getShortNpub() }}</p>
          </div>

          <!-- Status Badges -->
          <div class="flex flex-wrap gap-2 mb-8">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold">
              <div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              Connected
            </span>
            <span v-if="userProfile?.nip05" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
              <IconShield class="w-3.5 h-3.5" />
              Verified
            </span>
            <span v-if="userProfile?.lud16" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold">
              <IconBolt class="w-3.5 h-3.5" />
              Zap Ready
            </span>
          </div>

          <!-- Profile Details -->
          <div class="space-y-4 mb-8">
            <!-- Public Key -->
            <div class="group flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-200">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <IconKey class="w-5 h-5 text-gray-700" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Public Key</p>
                  <code class="text-sm text-gray-900 font-mono truncate block">{{ getShortNpub() }}</code>
                </div>
              </div>
              <button
                @click="copyToClipboard(currentUser.npub)"
                class="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-white rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                title="Copy"
              >
                <IconCheck v-if="copySuccess" class="w-5 h-5 text-green-600" />
                <IconCopy v-else class="w-5 h-5" />
              </button>
            </div>

            <!-- Lightning Address -->
            <div v-if="userProfile?.lud16" class="group flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl hover:from-orange-100 hover:to-amber-100 transition-all duration-200">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <IconBolt class="w-5 h-5 text-orange-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-orange-900 uppercase tracking-wide mb-0.5">Lightning</p>
                  <p class="text-sm text-orange-700 font-medium truncate">{{ userProfile.lud16 }}</p>
                </div>
              </div>
              <button
                @click="copyToClipboard(userProfile.lud16)"
                class="w-10 h-10 flex items-center justify-center text-orange-400 hover:text-orange-600 hover:bg-white rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                title="Copy"
              >
                <IconCopy class="w-5 h-5" />
              </button>
            </div>

            <!-- Website -->
            <div v-if="userProfile?.website" class="group flex items-center justify-between p-4 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-all duration-200">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <IconGlobe class="w-5 h-5 text-blue-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-blue-900 uppercase tracking-wide mb-0.5">Website</p>
                  <p class="text-sm text-blue-700 font-medium truncate">{{ userProfile.website }}</p>
                </div>
              </div>
              <a
                :href="userProfile.website"
                target="_blank"
                rel="noopener noreferrer"
                class="w-10 h-10 flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                title="Visit"
              >
                <IconExternalLink class="w-5 h-5" />
              </a>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              @click="handleEditProfile"
              class="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 text-white rounded-2xl font-semibold hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-200 hover:scale-105"
            >
              <IconEdit class="w-5 h-5" />
              Edit Profile
            </button>

            <button
              @click="handleRefreshProfile"
              class="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-200 hover:scale-105"
            >
              <IconRefresh class="w-5 h-5" />
            </button>

            <button
              @click="handleLogout"
              class="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:scale-105"
            >
              <IconLogout class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Elegant Relay Section -->
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Collapsible Header -->
        <button
          @click="toggleRelaySection"
          class="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-all duration-200"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center">
              <IconPlugConnected class="w-6 h-6 text-blue-600" />
            </div>
            <div class="text-left">
              <h3 class="text-xl font-semibold text-gray-900">Relay Network</h3>
              <p class="text-sm text-gray-500 mt-0.5">
                {{ connectedRelays.length }}/{{ userRelays.length }} connected
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              @click.stop="handleRefreshRelays"
              class="w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
              title="Refresh"
            >
              <IconRefresh class="w-5 h-5" />
            </button>
            <component
              :is="showRelaySection ? IconChevronUp : IconChevronDown"
              class="w-6 h-6 text-gray-400 transition-transform duration-300"
            />
          </div>
        </button>

        <!-- Relay Content -->
        <transition
          enter-active-class="transition-all duration-300 ease-out"
          leave-active-class="transition-all duration-300 ease-in"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-[2000px]"
          leave-from-class="opacity-100 max-h-[2000px]"
          leave-to-class="opacity-0 max-h-0"
        >
          <div v-if="showRelaySection" class="px-6 pb-6">
            <!-- Relay Stats -->
            <div class="grid grid-cols-4 gap-3 mb-6">
              <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 text-center">
                <div class="text-2xl font-bold text-green-600">{{ connectedRelays.length }}</div>
                <div class="text-xs text-green-700 font-medium mt-1">Connected</div>
              </div>
              <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 text-center">
                <div class="text-2xl font-bold text-blue-600">{{ readRelays.length }}</div>
                <div class="text-xs text-blue-700 font-medium mt-1">Read</div>
              </div>
              <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 text-center">
                <div class="text-2xl font-bold text-purple-600">{{ writeRelays.length }}</div>
                <div class="text-xs text-purple-700 font-medium mt-1">Write</div>
              </div>
              <div class="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-4 text-center">
                <div class="text-2xl font-bold text-gray-600">{{ userRelays.length }}</div>
                <div class="text-xs text-gray-700 font-medium mt-1">Total</div>
              </div>
            </div>

            <!-- Add Relay Form -->
            <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-5 mb-6">
              <h4 class="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <IconPlus class="w-4 h-4 text-orange-600" />
                Add New Relay
              </h4>

              <div class="flex gap-3">
                <input
                  v-model="newRelayUrl"
                  type="text"
                  placeholder="wss://relay.example.com"
                  class="flex-1 px-4 py-3 border-0 bg-white rounded-xl focus:ring-2 focus:ring-orange-500 text-sm shadow-sm"
                  @keyup.enter="handleAddRelay"
                />

                <button
                  @click="handleAddRelay"
                  :disabled="!newRelayUrl.trim()"
                  class="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <IconPlus class="w-5 h-5" />
                </button>
              </div>

              <!-- Form Error -->
              <div v-if="relayFormError" class="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
                <div class="flex items-center gap-2">
                  <IconAlertCircle class="w-4 h-4 text-red-600" />
                  <span class="text-sm text-red-600">{{ relayFormError }}</span>
                </div>
              </div>
            </div>

            <!-- Relay List -->
            <div class="space-y-2">
              <div v-if="userRelays.length === 0" class="text-center py-12">
                <IconPlugConnected class="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h4 class="text-lg font-semibold text-gray-900 mb-2">No relays yet</h4>
                <p class="text-gray-500 text-sm">Add your first relay to connect to the Nostr network</p>
              </div>

              <div
                v-for="relay in userRelays"
                :key="relay.url"
                class="group flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-200"
              >
                <!-- Relay Info -->
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <!-- Status Dot -->
                  <div :class="['w-2.5 h-2.5 rounded-full flex-shrink-0', getRelayStatusColor(relay.status)]"></div>

                  <!-- Relay Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h5 class="text-sm font-semibold text-gray-900">{{ formatRelayUrl(relay.url) }}</h5>
                      <span v-if="relay.read" class="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">R</span>
                      <span v-if="relay.write" class="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">W</span>
                    </div>
                    <p class="text-xs text-gray-500 font-mono truncate">{{ relay.url }}</p>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    @click="handleRefreshRelay(relay.url)"
                    :disabled="refreshingIndividualRelay.has(relay.url)"
                    class="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
                    title="Refresh"
                  >
                    <IconRefresh :class="['w-4 h-4', refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : '']" />
                  </button>

                  <button
                    @click="handleRemoveRelay(relay.url)"
                    class="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-white rounded-xl transition-all duration-200"
                    title="Remove"
                  >
                    <IconTrash class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Security Notice -->
      <div class="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-6 border border-blue-100">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <IconShield class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 mb-2">Privacy & Security</h4>
            <p class="text-sm text-gray-600 leading-relaxed">
              Your Nostr keys are managed by your browser extension or client. ZapTracker only reads your public profile and relay preferences. Your private keys never leave your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Profile Editor Modal -->
  <NostrProfileEditor
    :show="showProfileEditor"
    @close-editor="showProfileEditor = false"
    @profile-updated="handleProfileUpdated"
  />
</template>

<style scoped>
/* Smooth animations */
button {
  transform-origin: center;
}

/* Enhanced hover effects */
button:active:not(:disabled) {
  transform: scale(0.98);
}

/* Smooth transitions */
* {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Custom scrollbar for relay list */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
