<template>
  <div class="h-full flex flex-col lg:flex-row bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="p-6">
      <div class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-start space-x-4">
            <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconUser class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
              <p class="text-purple-100 text-sm">
                Connect your Nostr identity to send and receive encrypted messages with Lightning zaps.
              </p>
            </div>
          </div>
          <button
            @click="handleNostrLogin"
            class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
          >
            <IconBolt class="w-4 h-4" />
            <span>Connect with Nostr</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Chat Interface -->
    <div v-else class="h-full flex flex-col lg:flex-row">
      <!-- Sidebar with connections -->
      <div class="w-full lg:w-80 border-r border-orange-100/50 bg-white/50 backdrop-blur-sm">
        <!-- Header -->
        <div class="p-4 border-b border-orange-100/50">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Chat Connections</h2>
            <button
              @click="showNewConnectionModal = true"
              class="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <IconPlus class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="p-4 border-b border-orange-100/50">
          <div class="relative">
            <IconSearch class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search connections..."
              class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Connections List -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="filteredConnections.length === 0" class="p-6 text-center text-gray-500">
            <IconMessageCircle class="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No connections found</p>
            <button
              @click="showNewConnectionModal = true"
              class="mt-2 text-orange-600 hover:text-orange-700 text-sm"
            >
              Add your first connection
            </button>
          </div>

          <div
            v-for="connection in filteredConnections"
            :key="connection.pubkey"
            @click="selectConnection(connection)"
            :class="[
              'p-4 border-b border-orange-100/50 cursor-pointer transition-colors hover:bg-orange-50/50',
              selectedConnection?.pubkey === connection.pubkey ? 'bg-orange-50 border-orange-200' : ''
            ]"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                <IconUser class="w-5 h-5 text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate">
                  {{ connection.profile?.name || formatPubkey(connection.pubkey) }}
                </div>
                <div class="text-sm text-gray-500 truncate">
                  {{ connection.pubkey }}
                </div>
                <div v-if="connection.lastMessage" class="text-xs text-gray-400 truncate">
                  {{ connection.lastMessage }}
                </div>
              </div>
              <div v-if="connection.unreadCount > 0" class="w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                {{ connection.unreadCount > 9 ? '9+' : connection.unreadCount }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="flex-1 flex flex-col">
        <!-- Chat Header -->
        <div v-if="selectedConnection" class="p-4 border-b border-orange-100/50 bg-white/50 backdrop-blur-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                <IconUser class="w-5 h-5 text-white" />
              </div>
              <div>
                <div class="font-medium text-gray-900">
                  {{ selectedConnection.profile?.name || formatPubkey(selectedConnection.pubkey) }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ selectedConnection.pubkey }}
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="showConnectionOptions = !showConnectionOptions"
                class="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <IconDots class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <!-- No Connection Selected -->
        <div v-else class="flex-1 flex items-center justify-center">
          <div class="text-center text-gray-500">
            <IconMessageCircle class="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 class="text-lg font-medium text-gray-900 mb-2">Select a connection</h3>
            <p class="text-gray-600">Choose a connection from the sidebar to start chatting</p>
          </div>
        </div>

        <!-- Messages Area -->
        <div v-if="selectedConnection" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="messages.length === 0" class="text-center text-gray-500 py-8">
            <IconMessageCircle class="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No messages yet</p>
            <p class="text-sm">Start the conversation!</p>
          </div>

          <div
            v-for="message in messages"
            :key="message.id"
            :class="[
              'flex',
              message.sender === currentUser?.pubkey ? 'justify-end' : 'justify-start'
            ]"
          >
            <div
              :class="[
                'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                message.sender === currentUser?.pubkey
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              ]"
            >
              <div class="text-sm">{{ message.content }}</div>
              <div
                :class="[
                  'text-xs mt-1',
                  message.sender === currentUser?.pubkey ? 'text-orange-100' : 'text-gray-500'
                ]"
              >
                {{ formatTime(message.timestamp) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Message Input -->
        <div v-if="selectedConnection" class="p-4 border-t border-orange-100/50 bg-white/50 backdrop-blur-sm">
          <div class="flex items-end space-x-3">
            <div class="flex-1">
              <textarea
                v-model="newMessage"
                @keydown.enter.prevent="sendMessage"
                placeholder="Type your message..."
                rows="1"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              ></textarea>
            </div>
            <button
              @click="sendMessage"
              :disabled="!newMessage.trim() || isSending"
              class="p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconLoader v-if="isSending" class="w-5 h-5 animate-spin" />
              <IconSend v-else class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Connection Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showNewConnectionModal" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900">Add New Connection</h3>
              <button
                @click="showNewConnectionModal = false"
                class="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors touch-target"
                title="Close"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Connection Name</label>
                <input
                  v-model="newConnection.name"
                  type="text"
                  placeholder="Enter a name for this connection"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base touch-target transition-all duration-200"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
                <input
                  v-model="newConnection.pubkey"
                  type="text"
                  placeholder="Enter the Nostr public key"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base touch-target transition-all duration-200"
                />
              </div>
            </div>

            <div class="flex items-center justify-end space-x-3 mt-6">
              <button
                @click="showNewConnectionModal = false"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="addConnection"
                :disabled="!newConnection.pubkey"
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Connection
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  IconMessageCircle, 
  IconPlus, 
  IconSearch, 
  IconSend, 
  IconBolt, 
  IconUser, 
  IconX, 
  IconDots, 
  IconCopy, 
  IconTrash, 
  IconUserX,
  IconLoader
} from '@iconify-prerendered/vue-tabler'
import { useNostrChat } from '../composables/useNostrChat.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrConnections } from '../composables/useNostrConnections.js'

// Authentication
const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

// Chat functionality
const { 
  conversations,
  activeMessages: messages, 
  sendMessage: sendChatMessage, 
  isLoading: isSending,
  setActiveConversation,
  startConversation
} = useNostrChat()

// Connections - using conversations from chat instead
const connections = computed(() => Array.from(conversations.value.values()))

// Local state
const searchQuery = ref('')
const selectedConnection = ref(null)
const showNewConnectionModal = ref(false)
const showConnectionOptions = ref(false)
const newMessage = ref('')
const newConnection = ref({
  name: '',
  pubkey: ''
})

// Computed
const filteredConnections = computed(() => {
  if (!searchQuery.value) return connections.value
  const query = searchQuery.value.toLowerCase()
  return connections.value.filter(conn => 
    conn.name?.toLowerCase().includes(query) || 
    conn.pubkey.toLowerCase().includes(query)
  )
})

// Methods
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

const selectConnection = (connection) => {
  selectedConnection.value = connection
  setActiveConversation(connection)
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedConnection.value) return
  
  try {
    await sendChatMessage(selectedConnection.value.pubkey, newMessage.value)
    newMessage.value = ''
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

const addConnection = async () => {
  if (!newConnection.value.pubkey) return
  
  try {
    await startConversation(newConnection.value.pubkey)
    
    // Reset form
    newConnection.value = { name: '', pubkey: '' }
    showNewConnectionModal.value = false
  } catch (error) {
    console.error('Failed to add connection:', error)
  }
}

const formatPubkey = (pubkey) => {
  if (!pubkey) return ''
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

// Lifecycle
onMounted(() => {
  // Auto-select first connection if available
  if (connections.value.length > 0 && !selectedConnection.value) {
    selectConnection(connections.value[0])
  }
})

// Auto-resize textarea
watch(newMessage, () => {
  nextTick(() => {
    const textarea = document.querySelector('textarea')
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
  })
})
</script>

<style scoped>
/* Custom scrollbar for messages */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Message input auto-resize */
textarea {
  resize: none;
  overflow-y: auto;
}
</style>
