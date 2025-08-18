<script setup>
import { computed, ref } from 'vue'
import {
  IconX,
  IconUser,
  IconShield,
  IconBolt,
  IconGlobe,
  IconUserPlus,
  IconUserCheck,
  IconUserX,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconList,
  IconHeart
} from '@iconify-prerendered/vue-tabler'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  pubkey: {
    type: String,
    required: true
  },
  profile: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'follow', 'unfollow'])

// UI state
const activeTab = ref('overview')
const copySuccess = ref('')

// Computed properties
const displayName = computed(() => {
  return props.profile?.name || 
         props.profile?.display_name || 
         `user:${props.pubkey.substring(0, 8)}`
})

const avatar = computed(() => {
  return props.profile?.picture || generateFallbackAvatar(props.pubkey)
})

const banner = computed(() => {
  return props.profile?.banner || null
})

const npub = computed(() => {
  try {
    return nip19.npubEncode(props.pubkey)
  } catch {
    return props.pubkey
  }
})

// Generate fallback avatar
const generateFallbackAvatar = (pubkey) => {
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Copy to clipboard
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Get profile URL for different clients
const getProfileUrl = (client) => {
  try {
    const npubValue = nip19.npubEncode(props.pubkey)
    switch (client) {
      case 'primal':
        return `https://primal.net/p/${npubValue}`
      case 'yakihonne':
        return `https://yakihonne.com/${npubValue}`
      default:
        return `https://primal.net/p/${npubValue}`
    }
  } catch (error) {
    return '#'
  }
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="show" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
          <!-- Header with Banner -->
          <div class="relative">
            <!-- Banner -->
            <div class="h-32 bg-gradient-to-r from-orange-400 to-amber-400 relative overflow-hidden">
              <img 
                v-if="banner"
                :src="banner" 
                :alt="displayName + ' banner'"
                class="w-full h-full object-cover"
                @error="$event.target.style.display = 'none'"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            
            <!-- Close Button -->
            <button
              @click="emit('close')"
              class="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full flex items-center justify-center transition-colors text-white"
            >
              <IconX class="w-4 h-4" />
            </button>
            
            <!-- Profile Info Overlay -->
            <div class="absolute bottom-0 left-0 right-0 p-6">
              <div class="flex items-end space-x-4">
                <!-- Large Avatar -->
                <div class="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white">
                  <img
                    :src="avatar"
                    :alt="displayName"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = generateFallbackAvatar(pubkey)"
                  />
                </div>
                
                <!-- Name and Handle -->
                <div class="flex-1 min-w-0 text-white">
                  <h2 class="text-2xl font-bold mb-1 drop-shadow-sm">{{ displayName }}</h2>
                  <p v-if="profile?.display_name && profile?.display_name !== profile?.name" 
                     class="text-white/90 text-lg drop-shadow-sm">
                    {{ profile.display_name }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6">
            <!-- Status Badges -->
            <div class="flex flex-wrap gap-2 mb-4">
              <span v-if="profile?.nip05" class="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                <IconShield class="w-3 h-3 mr-1" />
                Verified
              </span>
              <span v-if="profile?.lud16" class="inline-flex items-center px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                <IconBolt class="w-3 h-3 mr-1" />
                Zap Ready
              </span>
              <span v-if="profile?.website" class="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <IconGlobe class="w-3 h-3 mr-1" />
                Website
              </span>
            </div>

            <!-- About -->
            <div v-if="profile?.about" class="mb-6">
              <p class="text-gray-700 leading-relaxed">{{ profile.about }}</p>
            </div>

            <!-- Details -->
            <div class="space-y-3 mb-6">
              <!-- Public Key -->
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconUser class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Public Key</span>
                </div>
                <div class="flex items-center space-x-2">
                  <code class="text-xs text-gray-600 font-mono">{{ npub.substring(0, 20) }}...</code>
                  <button
                    @click="copyToClipboard(npub, 'npub')"
                    class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <IconCheck v-if="copySuccess === 'npub'" class="w-3 h-3 text-green-600" />
                    <IconCopy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <!-- Lightning Address -->
              <div v-if="profile?.lud16" class="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconBolt class="w-4 h-4 text-orange-600" />
                  <span class="text-sm font-medium text-gray-700">Lightning Address</span>
                </div>
                <div class="flex items-center space-x-2">
                  <code class="text-xs text-orange-700 font-mono">{{ profile.lud16 }}</code>
                  <button
                    @click="copyToClipboard(profile.lud16, 'lud16')"
                    class="p-1 text-orange-400 hover:text-orange-600 transition-colors"
                  >
                    <IconCheck v-if="copySuccess === 'lud16'" class="w-3 h-3 text-green-600" />
                    <IconCopy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <!-- Website -->
              <div v-if="profile?.website" class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconGlobe class="w-4 h-4 text-green-600" />
                  <span class="text-sm font-medium text-gray-700">Website</span>
                </div>
                <a
                  :href="profile.website"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-green-600 hover:text-green-700 flex items-center space-x-1"
                >
                  <span>Visit</span>
                  <IconExternalLink class="w-3 h-3" />
                </a>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex space-x-3">
              <button
                @click="emit(isFollowing ? 'unfollow' : 'follow', pubkey)"
                :class="[
                  'flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2',
                  isFollowing 
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                ]"
              >
                <IconUserX v-if="isFollowing" class="w-4 h-4" />
                <IconUserPlus v-else class="w-4 h-4" />
                <span>{{ isFollowing ? 'Unfollow' : 'Follow' }}</span>
              </button>
              
              <a
                :href="getProfileUrl('primal')"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-secondary"
              >
                <IconExternalLink class="w-4 h-4" />
                <span class="hidden sm:inline">View on Primal</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>