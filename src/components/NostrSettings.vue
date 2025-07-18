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
  IconUserX
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
const showRelaySection = ref(true)
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
const handleLogout = () => {
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

  addingRelay.value = true
  relayFormError.value = ''

  try {
    await addRelay(newRelayUrl.value.trim())
    newRelayUrl.value = ''
  } catch (error) {
    relayFormError.value = error.message
  } finally {
    addingRelay.value = false
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

// Handle refresh all relays with visual feedback
const handleRefreshRelays = async () => {
  refreshingRelays.value = true
  try {
    await checkAllRelayStatuses()
  } finally {
    refreshingRelays.value = false
  }
}

// Handle refresh single relay with visual feedback
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
  
  refreshingProfile.value = true
  try {
    await refreshUserProfile()
  } catch (error) {
    console.error('Failed to refresh profile:', error)
  } finally {
    refreshingProfile.value = false
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
      return 'text-green-600 bg-green-100'
    case 'disconnected':
      return 'text-red-600 bg-red-100'
    case 'checking':
      return 'text-yellow-600 bg-yellow-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

// Get relay status icon
const getRelayStatusIcon = (status) => {
  switch (status) {
    case 'connected':
      return IconWifi
    case 'disconnected':
      return IconWifiOff
    case 'checking':
      return IconLoader
    default:
      return IconWifiOff
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
  return currentUser.value.npub.substring(0, 20) + '...'
}

// Handle profile edit
const handleEditProfile = () => {
  showProfileEditor.value = true
}

// Handle profile update
const handleProfileUpdated = () => {
  showProfileEditor.value = false
}

// Toggle relay section
const toggleRelaySection = () => {
  showRelaySection.value = !showRelaySection.value
}
</script>

<template>
  <div class="space-y-6">
    <!-- Profile Section -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <!-- Section Header -->
      <div class="p-4 sm:p-6 border-b border-orange-100/50 bg-gradient-to-r from-orange-50 to-amber-50">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <IconUser class="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Nostr Identity</h3>
            <p class="text-sm text-gray-600">Connect and manage your decentralized identity</p>
          </div>
        </div>
      </div>
      
      <!-- Not Authenticated State -->
      <div v-if="!isAuthenticated" class="p-4 sm:p-6">
        <div class="text-center py-6">
          <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-r from-purple-100 to-pink-100">
            <img 
              src="/nostr-logo/nostr10.png" 
              alt="Nostr Logo" 
              class="w-12 h-12 object-contain"
            />
          </div>
          
          <h4 class="text-xl font-semibold text-gray-900 mb-3">Connect with Nostr</h4>
          <p class="text-gray-600 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            Sign in with your Nostr identity to access decentralized social features and manage your profile.
          </p>
          
          <button
            @click="handleLogin"
            :disabled="isLoading"
            class="btn-primary w-full sm:w-auto"
          >
            <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
            <IconUser v-else class="w-4 h-4" />
            {{ isLoading ? 'Connecting...' : 'Connect with Nostr' }}
          </button>
          
          <!-- Auth Error -->
          <div v-if="authError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <IconAlertCircle class="w-4 h-4 text-red-600" />
              <span class="text-sm text-red-600">{{ authError }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Authenticated State -->
      <div v-else class="p-4 sm:p-6">
        <!-- Profile Editor -->
        <div v-if="showProfileEditor">
          <NostrProfileEditor 
            @close-editor="showProfileEditor = false"
            @profile-updated="handleProfileUpdated"
          />
        </div>
        
        <!-- Profile Display -->
        <div v-else>
          <!-- Profile Card -->
          <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 mb-6">
            <div class="flex flex-col sm:flex-row sm:items-start gap-4">
              <!-- Avatar and Basic Info -->
              <div class="flex items-center space-x-4 flex-1">
                <div class="relative">
                  <img 
                    :src="getUserAvatar()" 
                    :alt="userProfile?.name || 'User'"
                    class="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-lg object-cover"
                    @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                  />
                  <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                    <IconUserCheck class="w-3 h-3 text-white" />
                  </div>
                </div>
                
                <div class="flex-1 min-w-0">
                  <h4 class="text-xl font-bold text-gray-900 mb-1">{{ userProfile?.name || 'Anonymous' }}</h4>
                  
                  <!-- Display name or about -->
                  <p v-if="userProfile?.display_name && userProfile?.display_name !== userProfile?.name" 
                     class="text-sm text-gray-600 mb-2">
                    {{ userProfile.display_name }}
                  </p>
                  <p v-else-if="userProfile?.about" 
                     class="text-sm text-gray-600 mb-2 line-clamp-2">
                    {{ userProfile.about }}
                  </p>
                  
                  <!-- Status Badges -->
                  <div class="flex flex-wrap gap-2">
                    <span class="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <IconUserCheck class="w-3 h-3 mr-1" />
                      Connected
                    </span>
                    <span v-if="userProfile?.nip05" class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      <IconShield class="w-3 h-3 mr-1" />
                      Verified
                    </span>
                    <span v-if="userProfile?.lud16" class="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      <IconBolt class="w-3 h-3 mr-1" />
                      Zap Ready
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Action Buttons -->
              <div class="flex flex-row sm:flex-col gap-2 sm:gap-3">
                <button
                  @click="handleEditProfile"
                  class="flex-1 sm:flex-none btn-secondary text-sm"
                >
                  <IconEdit class="w-4 h-4" />
                  <span class="hidden sm:inline">Edit</span>
                </button>
                
                <button
                  @click="handleRefreshProfile"
                  :disabled="refreshingProfile"
                  class="flex-1 sm:flex-none btn-secondary text-sm"
                >
                  <IconRefresh :class="['w-4 h-4', refreshingProfile ? 'animate-spin' : '']" />
                  <span class="hidden sm:inline">Refresh</span>
                </button>
                
                <button
                  @click="handleLogout"
                  class="flex-1 sm:flex-none btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <IconX class="w-4 h-4" />
                  <span class="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Profile Details Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <!-- Public Key Card -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-2">
                  <IconKey class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Public Key</span>
                </div>
                <button
                  @click="copyToClipboard(currentUser.npub)"
                  class="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                  title="Copy npub"
                >
                  <IconCheck v-if="copySuccess" class="w-4 h-4 text-green-600" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
              <code class="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded block break-all">
                {{ getShortNpub() }}
              </code>
            </div>

            <!-- Lightning Address Card -->
            <div v-if="userProfile?.lud16" class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-2">
                  <IconBolt class="w-4 h-4 text-orange-500" />
                  <span class="text-sm font-medium text-gray-700">Lightning Address</span>
                </div>
                <button
                  @click="copyToClipboard(userProfile.lud16)"
                  class="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                  title="Copy Lightning address"
                >
                  <IconCopy class="w-4 h-4" />
                </button>
              </div>
              <div class="text-sm text-orange-600 font-mono break-all">{{ userProfile.lud16 }}</div>
            </div>

            <!-- NIP-05 Card -->
            <div v-if="userProfile?.nip05" class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="flex items-center space-x-2 mb-3">
                <IconShield class="w-4 h-4 text-green-500" />
                <span class="text-sm font-medium text-gray-700">NIP-05 Verified</span>
              </div>
              <div class="text-sm text-green-600 font-mono break-all">{{ userProfile.nip05 }}</div>
            </div>

            <!-- Website Card -->
            <div v-if="userProfile?.website" class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="flex items-center space-x-2 mb-3">
                <IconGlobe class="w-4 h-4 text-blue-500" />
                <span class="text-sm font-medium text-gray-700">Website</span>
              </div>
              <a 
                :href="userProfile.website" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center space-x-1"
              >
                <span class="break-all">{{ userProfile.website }}</span>
                <IconExternalLink class="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Relay Management Section -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <!-- Collapsible Header -->
      <button
        @click="toggleRelaySection"
        class="w-full p-4 sm:p-6 border-b border-orange-100/50 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <IconPlugConnected class="w-5 h-5 text-blue-600" />
            </div>
            <div class="text-left">
              <h3 class="text-lg font-semibold text-gray-900">Relay Network</h3>
              <p class="text-sm text-gray-600">{{ connectedRelays.length }}/{{ userRelays.length }} relays connected</p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <button
              @click.stop="handleRefreshRelays"
              :disabled="refreshingRelays"
              class="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
              title="Refresh all relays"
            >
              <IconRefresh :class="['w-5 h-5', refreshingRelays ? 'animate-spin' : '']" />
            </button>
            <component 
              :is="showRelaySection ? IconChevronUp : IconChevronDown" 
              class="w-5 h-5 text-gray-400 transition-transform duration-200" 
            />
          </div>
        </div>
      </button>
      
      <!-- Relay Content (Collapsible) -->
      <transition name="slide-down">
        <div v-if="showRelaySection" class="p-4 sm:p-6">
          <!-- Relay Stats Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 text-center border border-green-200">
              <div class="text-2xl font-bold text-green-600">{{ connectedRelays.length }}</div>
              <div class="text-xs text-green-700 font-medium">Connected</div>
            </div>
            <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 text-center border border-blue-200">
              <div class="text-2xl font-bold text-blue-600">{{ readRelays.length }}</div>
              <div class="text-xs text-blue-700 font-medium">Read</div>
            </div>
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 text-center border border-purple-200">
              <div class="text-2xl font-bold text-purple-600">{{ writeRelays.length }}</div>
              <div class="text-xs text-purple-700 font-medium">Write</div>
            </div>
            <div class="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg p-3 text-center border border-gray-200">
              <div class="text-2xl font-bold text-gray-600">{{ userRelays.length }}</div>
              <div class="text-xs text-gray-700 font-medium">Total</div>
            </div>
          </div>
          
          <!-- Add Relay Form -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200 p-4 mb-6">
            <h4 class="font-medium text-gray-900 mb-3 flex items-center space-x-2">
              <IconPlus class="w-4 h-4 text-orange-600" />
              <span>Add New Relay</span>
            </h4>
            
            <div class="space-y-3">
              <input
                v-model="newRelayUrl"
                type="text"
                placeholder="wss://relay.example.com"
                class="w-full px-3 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm bg-white"
                @keyup.enter="handleAddRelay"
              />
              
              <div class="flex flex-col sm:flex-row gap-2">
                <button
                  @click="handleAddRelay"
                  :disabled="addingRelay || !newRelayUrl.trim()"
                  class="btn-primary flex-1 sm:flex-none"
                >
                  <IconLoader v-if="addingRelay" class="w-4 h-4 animate-spin" />
                  <IconPlus v-else class="w-4 h-4" />
                  {{ addingRelay ? 'Adding...' : 'Add Relay' }}
                </button>
              </div>
              
              <!-- Form Error -->
              <div v-if="relayFormError" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <div class="flex items-center space-x-2">
                  <IconAlertCircle class="w-4 h-4 text-red-600" />
                  <span class="text-sm text-red-600">{{ relayFormError }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Relay List -->
          <div class="space-y-3">
            <h4 class="font-medium text-gray-900 flex items-center space-x-2">
              <IconSettings class="w-4 h-4 text-gray-600" />
              <span>Your Relays</span>
            </h4>
            
            <div v-if="userRelays.length === 0" class="text-center py-8">
              <IconPlugConnected class="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <h4 class="text-lg font-medium text-gray-900 mb-2">No relays configured</h4>
              <p class="text-gray-600 text-sm">Add your first relay to start connecting to the Nostr network</p>
            </div>
            
            <div v-else class="space-y-2">
              <div
                v-for="relay in userRelays"
                :key="relay.url"
                class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
              >
                <!-- Mobile Layout -->
                <div class="block sm:hidden">
                  <!-- Top Row: Status + Name + Actions -->
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3 flex-1 min-w-0">
                      <div :class="[
                        'w-3 h-3 rounded-full flex-shrink-0',
                        relay.status === 'connected' ? 'bg-green-400 animate-pulse' : 
                        relay.status === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                      ]"></div>
                      <div class="flex-1 min-w-0">
                        <h5 class="font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h5>
                        <div class="flex items-center space-x-2 mt-1">
                          <span v-if="relay.read" class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">Read</span>
                          <span v-if="relay.write" class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-medium">Write</span>
                        </div>
                      </div>
                    </div>
                    
                    <div class="flex items-center space-x-1">
                      <button
                        @click="handleRefreshRelay(relay.url)"
                        :disabled="refreshingIndividualRelay.has(relay.url)"
                        class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Refresh relay"
                      >
                        <IconRefresh :class="['w-4 h-4', refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : '']" />
                      </button>
                      
                      <button
                        @click="copyToClipboard(relay.url)"
                        class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Copy URL"
                      >
                        <IconCopy class="w-4 h-4" />
                      </button>
                      
                      <button
                        @click="handleRemoveRelay(relay.url)"
                        class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove relay"
                      >
                        <IconTrash class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <!-- Bottom Row: URL -->
                  <div class="bg-gray-50 rounded-lg p-2">
                    <code class="text-xs text-gray-600 break-all">{{ relay.url }}</code>
                  </div>
                </div>

                <!-- Desktop Layout -->
                <div class="hidden sm:flex items-center justify-between">
                  <div class="flex items-center space-x-4 flex-1 min-w-0">
                    <!-- Status Indicator -->
                    <div :class="[
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      getRelayStatusColor(relay.status)
                    ]">
                      <component 
                        :is="getRelayStatusIcon(relay.status)" 
                        :class="[
                          'w-5 h-5',
                          relay.status === 'checking' || refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : ''
                        ]"
                      />
                    </div>
                    
                    <!-- Relay Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center space-x-3 mb-1">
                        <h5 class="font-medium text-gray-900">{{ formatRelayUrl(relay.url) }}</h5>
                        <span :class="[
                          'px-2 py-1 rounded-full text-xs font-medium',
                          getRelayStatusColor(relay.status)
                        ]">
                          {{ relay.status }}
                        </span>
                      </div>
                      <div class="flex items-center space-x-4">
                        <code class="text-xs text-gray-500 truncate max-w-xs">{{ relay.url }}</code>
                        <div class="flex items-center space-x-2">
                          <span v-if="relay.read" class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">Read</span>
                          <span v-if="relay.write" class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">Write</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Actions -->
                  <div class="flex items-center space-x-2">
                    <button
                      @click="handleRefreshRelay(relay.url)"
                      :disabled="refreshingIndividualRelay.has(relay.url)"
                      class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Refresh relay status"
                    >
                      <IconRefresh :class="['w-4 h-4', refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : '']" />
                    </button>
                    
                    <button
                      @click="copyToClipboard(relay.url)"
                      class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="Copy relay URL"
                    >
                      <IconCopy class="w-4 h-4" />
                    </button>
                    
                    <button
                      @click="handleRemoveRelay(relay.url)"
                      title="Remove relay"
                      class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <IconTrash class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Relay Error -->
          <div v-if="relayError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center space-x-2">
              <IconAlertCircle class="w-5 h-5 text-red-600" />
              <span class="text-sm text-red-600">{{ relayError }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Security Notice -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-6">
      <div class="flex items-start space-x-3">
        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconShield class="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h4 class="font-semibold text-blue-900 mb-2">Privacy & Security</h4>
          <p class="text-sm text-blue-800 leading-relaxed">
            Your Nostr keys are managed by your browser extension or client. ZapTracker only reads your public profile and relay preferences. Your private keys never leave your device.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Slide down animation for collapsible content */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
  overflow: hidden;
}

.slide-down-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 1000px;
  transform: translateY(0);
}

/* Enhanced touch targets for mobile */
@media (max-width: 640px) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Improved button hover states */
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.3);
}

.btn-secondary:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Smooth transitions for interactive elements */
button {
  transition: all 0.2s ease-out;
}

/* Status indicator animations */
@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pulse-yellow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.bg-green-400.animate-pulse {
  animation: pulse-green 2s infinite;
}

.bg-yellow-400.animate-pulse {
  animation: pulse-yellow 1.5s infinite;
}

/* Responsive grid improvements */
@media (max-width: 640px) {
  .grid-cols-2 {
    gap: 0.75rem;
  }
}

/* Enhanced focus states for accessibility */
button:focus-visible {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}

input:focus-visible {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}
</style>