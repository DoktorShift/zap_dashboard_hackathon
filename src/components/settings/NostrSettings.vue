<script setup>
import { ref, onMounted } from 'vue'
import {
  IconPlugConnected,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconAlertCircle,
  IconShield,
  IconUser,
  IconLoader
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'

const {
  currentUser,
  isAuthenticated,
  userRelays,
  relayError,
  connectedRelays,
  readRelays,
  writeRelays,
  addRelay,
  removeRelay,
  checkRelayStatus,
  checkAllRelayStatuses,
  validateRelayUrl,
  initAuthAndRelays
} = useNostrAuth()

// Local state
const newRelayUrl = ref('')
const relayFormError = ref('')
const refreshingIndividualRelay = ref(new Set())

// Initialize on mount
onMounted(async () => {
  await initAuthAndRelays()
})

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

// Get relay status color
const getRelayStatusColor = (status) => {
  switch (status) {
    case 'connected': return 'bg-green-500'
    case 'disconnected': return 'bg-gray-300'
    case 'checking': return 'bg-yellow-500'
    default: return 'bg-gray-300'
  }
}

// Format relay URL for display
const formatRelayUrl = (url) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Not Authenticated -->
    <div v-if="!isAuthenticated" class="max-w-md mx-auto">
      <div class="bg-gray-50 rounded-2xl p-8 text-center">
        <IconUser class="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Connect First</h3>
        <p class="text-sm text-gray-500">Connect your Nostr identity on the Profile tab to manage relays.</p>
      </div>
    </div>

    <!-- Relay Management -->
    <template v-else>
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Header -->
        <div class="p-5 flex items-center justify-between border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <IconPlugConnected class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-gray-900">Relay Network</h3>
              <p class="text-xs text-gray-500">
                {{ connectedRelays.length }}/{{ userRelays.length }} connected
              </p>
            </div>
          </div>
          <button
            @click="handleRefreshRelays"
            class="w-9 h-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            title="Refresh all relays"
          >
            <IconRefresh class="w-4 h-4" />
          </button>
        </div>

        <div class="px-5 pb-5">
          <!-- Stats -->
          <div class="grid grid-cols-4 gap-2 my-4">
            <div class="bg-green-50 rounded-xl p-2.5 text-center">
              <div class="text-lg font-bold text-green-600">{{ connectedRelays.length }}</div>
              <div class="text-xs text-green-700">Online</div>
            </div>
            <div class="bg-blue-50 rounded-xl p-2.5 text-center">
              <div class="text-lg font-bold text-blue-600">{{ readRelays.length }}</div>
              <div class="text-xs text-blue-700">Read</div>
            </div>
            <div class="bg-purple-50 rounded-xl p-2.5 text-center">
              <div class="text-lg font-bold text-purple-600">{{ writeRelays.length }}</div>
              <div class="text-xs text-purple-700">Write</div>
            </div>
            <div class="bg-gray-50 rounded-xl p-2.5 text-center">
              <div class="text-lg font-bold text-gray-600">{{ userRelays.length }}</div>
              <div class="text-xs text-gray-700">Total</div>
            </div>
          </div>

          <!-- Add Relay -->
          <div class="bg-orange-50 rounded-xl p-3 mb-3">
            <div class="flex gap-2">
              <input
                v-model="newRelayUrl"
                type="text"
                placeholder="wss://relay.example.com"
                class="flex-1 px-3 py-2 text-sm border-0 bg-white rounded-lg focus:ring-2 focus:ring-orange-500"
                @keyup.enter="handleAddRelay"
              />
              <button
                @click="handleAddRelay"
                :disabled="!newRelayUrl.trim()"
                class="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <IconPlus class="w-4 h-4" />
              </button>
            </div>
            <div v-if="relayFormError" class="mt-2 text-xs text-red-600 flex items-center gap-1">
              <IconAlertCircle class="w-3 h-3" />
              {{ relayFormError }}
            </div>
          </div>

          <!-- Relay List -->
          <div class="space-y-1.5">
            <div v-if="userRelays.length === 0" class="text-center py-8">
              <IconPlugConnected class="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p class="text-sm text-gray-500">No relays configured</p>
            </div>

            <div
              v-for="relay in userRelays"
              :key="relay.url"
              class="group flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div class="flex items-center gap-2.5 flex-1 min-w-0">
                <div :class="['w-2 h-2 rounded-full flex-shrink-0', getRelayStatusColor(relay.status)]"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <h5 class="text-xs font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h5>
                    <span v-if="relay.read" class="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold leading-none">R</span>
                    <span v-if="relay.write" class="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold leading-none">W</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click="handleRefreshRelay(relay.url)"
                  class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white rounded-lg transition-colors"
                >
                  <IconRefresh :class="['w-3.5 h-3.5', refreshingIndividualRelay.has(relay.url) && 'animate-spin']" />
                </button>
                <button
                  @click="handleRemoveRelay(relay.url)"
                  class="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                >
                  <IconTrash class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="bg-blue-50 rounded-3xl p-4 border border-blue-100">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <IconShield class="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 class="font-medium text-gray-900 text-sm mb-1">Privacy & Security</h4>
            <p class="text-xs text-gray-600 leading-relaxed">
              Your keys are managed by your browser extension. ZapTracker only reads your public profile. Private keys never leave your device.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
button:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
