<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  IconPlus,
  IconX,
  IconUser,
  IconBolt,
  IconArrowLeft,
  IconAlertCircle,
  IconLoader,
  IconRefresh,
  IconMessageCircle
} from '@iconify-prerendered/vue-tabler'
import { useNostrChat } from '../composables/social/useNostrChat.js'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'
import UserProfileModal from '../components/modals/UserProfileModal.vue'
import ChatConversationList from '../components/chat/ChatConversationList.vue'
import ChatMessageArea from '../components/chat/ChatMessageArea.vue'
import ChatInputBar from '../components/chat/ChatInputBar.vue'
import ChatEmptyState from '../components/chat/ChatEmptyState.vue'

// Auth
const { isAuthenticated, currentUser, login } = useNostrAuth()

// Chat
const {
  conversations,
  activeMessages: messages,
  activeConversation,
  sendMessage: sendChatMessage,
  isLoading: isSending,
  setActiveConversation,
  clearActiveConversation,
  startConversation,
  refreshConversationProfile
} = useNostrChat()

const connectionsList = computed(() => Array.from(conversations.value.values()))

// Local state
const searchQuery = ref('')
const showNewConnectionModal = ref(false)
const showProfileModal = ref(false)
const selectedProfile = ref(null)
const newConnection = ref({ name: '', pubkey: '' })
const connectionError = ref('')
const isAddingConnection = ref(false)
const messageAreaRef = ref(null)
const inputBarRef = ref(null)

// Methods
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
    if (error.message.includes('No Nostr extension')) {
      alert('No Nostr Extension Found\n\nPlease install a NIP-07 browser extension like:\n• Alby (getalby.com)\n• nos2x\n• Flamingo\n\nThen refresh this page.')
    } else {
      alert('Login failed: ' + error.message)
    }
  }
}

const selectConversation = (conversation) => {
  setActiveConversation(conversation)
  nextTick(() => {
    messageAreaRef.value?.scrollToBottom()
    inputBarRef.value?.focus()
  })
}

const goBackToList = () => {
  clearActiveConversation()
}

const handleSend = async (content) => {
  if (!activeConversation.value || !content.trim()) return
  try {
    await sendChatMessage(activeConversation.value.pubkey, content)
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

const validatePubkey = (pubkey) => {
  if (!pubkey?.trim()) return 'Public key is required'
  const trimmed = pubkey.trim()
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'npub') return null
    } catch { return 'Invalid npub format' }
  }
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return null
  return 'Invalid public key format. Enter a valid npub or hex public key.'
}

const addConnection = async () => {
  connectionError.value = ''
  const validation = validatePubkey(newConnection.value.pubkey)
  if (validation) { connectionError.value = validation; return }

  isAddingConnection.value = true
  try {
    let pubkey = newConnection.value.pubkey.trim()
    if (pubkey.startsWith('npub1')) {
      pubkey = nip19.decode(pubkey).data
    }
    await startConversation(pubkey)
    newConnection.value = { name: '', pubkey: '' }
    showNewConnectionModal.value = false
  } catch (error) {
    connectionError.value = error.message || 'Failed to add connection'
  } finally {
    isAddingConnection.value = false
  }
}

const openUserProfile = () => {
  if (activeConversation.value) {
    selectedProfile.value = activeConversation.value
    showProfileModal.value = true
  }
}
</script>

<template>
  <div class="h-[calc(100vh-160px)] sm:h-[calc(100vh-180px)] lg:h-[calc(100vh-200px)] flex bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">

    <!-- Auth Banner -->
    <div v-if="!isAuthenticated" class="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
        <div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <IconUser class="w-7 h-7" />
        </div>
        <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
        <p class="text-purple-100 text-sm mb-5 leading-relaxed">
          Connect your Nostr identity to send and receive encrypted messages.
        </p>
        <button @click="handleNostrLogin" class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2">
          <IconBolt class="w-4 h-4" />
          Connect with Nostr
        </button>
      </div>
    </div>

    <!-- Main Chat Interface -->
    <template v-else>
      <!-- Sidebar: conversation list -->
      <div
        :class="[
          'flex flex-col border-r border-gray-100 bg-white transition-all duration-200',
          'lg:w-[320px] md:w-[280px]',
          activeConversation ? 'hidden md:flex' : 'w-full md:w-[280px]'
        ]"
      >
        <!-- Sidebar header -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 class="text-lg font-semibold text-gray-900">Messages</h2>
          <button
            @click="showNewConnectionModal = true"
            class="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            title="New conversation"
          >
            <IconPlus class="w-5 h-5" />
          </button>
        </div>

        <ChatConversationList
          :conversations="connectionsList"
          :active-conversation-id="activeConversation?.pubkey"
          v-model:search-query="searchQuery"
          @select="selectConversation"
          @new-connection="showNewConnectionModal = true"
        />
      </div>

      <!-- Chat panel -->
      <div
        :class="[
          'flex-1 flex flex-col min-w-0 bg-gray-50/30',
          !activeConversation ? 'hidden md:flex' : 'w-full'
        ]"
      >
        <!-- Chat header -->
        <div v-if="activeConversation" class="px-3 py-2.5 sm:px-4 border-b border-gray-100 bg-white flex items-center gap-3 flex-shrink-0">
          <!-- Back button (mobile) -->
          <button
            @click="goBackToList"
            class="md:hidden p-1.5 -ml-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <IconArrowLeft class="w-5 h-5" />
          </button>

          <!-- Avatar -->
          <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 cursor-pointer" @click="openUserProfile">
            <img
              v-if="activeConversation.profile?.picture"
              :src="activeConversation.profile.picture"
              class="w-full h-full object-cover"
              @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
            />
            <div
              class="w-full h-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center"
              :style="{ display: activeConversation.profile?.picture ? 'none' : 'flex' }"
            >
              <IconUser class="w-4 h-4 text-white" />
            </div>
          </div>

          <!-- Name -->
          <div class="flex-1 min-w-0 cursor-pointer" @click="openUserProfile">
            <div class="font-medium text-sm text-gray-900 truncate">
              {{ activeConversation.profile?.name || activeConversation.pubkey?.substring(0, 12) + '...' }}
            </div>
            <div v-if="activeConversation.profile?.lud16" class="text-xs text-gray-400 truncate flex items-center gap-1">
              <IconBolt class="w-3 h-3 text-yellow-500" />
              {{ activeConversation.profile.lud16 }}
            </div>
          </div>

          <!-- Actions -->
          <button
            @click="refreshConversationProfile(activeConversation.pubkey)"
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh profile"
          >
            <IconRefresh class="w-4 h-4" />
          </button>
        </div>

        <!-- Messages or empty state -->
        <ChatMessageArea
          v-if="activeConversation"
          ref="messageAreaRef"
          :messages="messages"
          :current-user-pubkey="currentUser?.pubkey"
          :conversation-profile="activeConversation?.profile"
        />
        <ChatEmptyState v-else type="no-selection" />

        <!-- Input -->
        <ChatInputBar
          v-if="activeConversation"
          ref="inputBarRef"
          :sending="isSending"
          @send="handleSend"
        />
      </div>
    </template>

    <!-- New Connection Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showNewConnectionModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" @click.self="showNewConnectionModal = false">
          <div class="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-lg font-semibold text-gray-900">New Conversation</h3>
              <button @click="showNewConnectionModal = false" class="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                <IconX class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Name (optional)</label>
                <input
                  v-model="newConnection.name"
                  type="text"
                  placeholder="Contact name"
                  class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Public Key</label>
                <textarea
                  v-model="newConnection.pubkey"
                  placeholder="npub... or hex public key"
                  rows="2"
                  class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-colors resize-none"
                ></textarea>
              </div>
              <div v-if="connectionError" class="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <IconAlertCircle class="w-4 h-4 text-red-500 flex-shrink-0" />
                <span class="text-sm text-red-600">{{ connectionError }}</span>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 mt-6">
              <button @click="showNewConnectionModal = false" class="btn-secondary text-sm px-4 py-2">
                Cancel
              </button>
              <button
                @click="addConnection"
                :disabled="!newConnection.pubkey || isAddingConnection"
                class="btn-primary text-sm px-4 py-2 disabled:opacity-50"
              >
                <IconLoader v-if="isAddingConnection" class="w-4 h-4 animate-spin" />
                <IconPlus v-else class="w-4 h-4" />
                {{ isAddingConnection ? 'Adding...' : 'Start Chat' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- User Profile Modal -->
    <UserProfileModal
      :show="showProfileModal"
      :user-profile-data="selectedProfile"
      @close="showProfileModal = false; selectedProfile = null"
    />
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}
</style>
