<script setup>
import { ref, computed, inject } from 'vue'
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconCheck, 
  IconX, 
  IconBolt, 
  IconStar, 
  IconStarFilled,
  IconSearch,
  IconWifi,
  IconWifiOff,
  IconAlertTriangle,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconChevronDown,
  IconChevronRight,
  IconRefresh
} from '@iconify-prerendered/vue-tabler'
import { useNostrConnections } from '../composables/useNostrConnections.js'

const {
  connections,
  activeConnection,
  isLoadingConnection,
  connectionError,
  addConnection,
  editConnection,
  deleteConnection,
  setActiveConnection,
  setDefaultConnection,
  clearActiveConnection,
  validateNwcUrl
} = useNostrConnections()

// Simplified form state
const showAddForm = ref(false)
const showEditForm = ref(false)
const showDeleteConfirm = ref(false)
const editingConnection = ref(null)
const deletingConnection = ref(null)

const newConnectionName = ref('')
const newConnectionUrl = ref('')
const editConnectionName = ref('')
const editConnectionUrl = ref('')

const formError = ref('')
const searchQuery = ref('')
const showAdvanced = ref(false)

// Filter connections based on search
const filteredConnections = computed(() => {
  if (!searchQuery.value) return connections.value
  
  const query = searchQuery.value.toLowerCase()
  return connections.value.filter(conn => 
    conn.name.toLowerCase().includes(query) ||
    conn.nwcUrl.toLowerCase().includes(query)
  )
})

// Simplified form handlers
const openAddForm = () => {
  showAddForm.value = true
  newConnectionName.value = ''
  newConnectionUrl.value = ''
  formError.value = ''
}

const closeAddForm = () => {
  showAddForm.value = false
  newConnectionName.value = ''
  newConnectionUrl.value = ''
  formError.value = ''
}

const openEditForm = (connection) => {
  editingConnection.value = connection
  editConnectionName.value = connection.name
  editConnectionUrl.value = connection.nwcUrl
  showEditForm.value = true
  formError.value = ''
}

const closeEditForm = () => {
  showEditForm.value = false
  editingConnection.value = null
  editConnectionName.value = ''
  editConnectionUrl.value = ''
  formError.value = ''
}

const openDeleteConfirm = (connection) => {
  deletingConnection.value = connection
  showDeleteConfirm.value = true
}

const closeDeleteConfirm = () => {
  showDeleteConfirm.value = false
  deletingConnection.value = null
}

// Simplified actions
const handleAddConnection = async () => {
  formError.value = ''
  
  try {
    const connection = addConnection(newConnectionName.value, newConnectionUrl.value)
    closeAddForm()
    
    if (connections.value.length === 1) {
      await setActiveConnection(connection.id)
    }
  } catch (error) {
    formError.value = error.message
  }
}

const handleEditConnection = () => {
  formError.value = ''
  
  try {
    editConnection(editingConnection.value.id, editConnectionName.value, editConnectionUrl.value)
    closeEditForm()
  } catch (error) {
    formError.value = error.message
  }
}

const handleDeleteConnection = () => {
  try {
    deleteConnection(deletingConnection.value.id)
    closeDeleteConfirm()
  } catch (error) {
    console.error('Failed to delete connection:', error)
  }
}

const handleActivateConnection = async (connection) => {
  try {
    await setActiveConnection(connection.id)
  } catch (error) {
    console.error('Failed to activate connection:', error)
  }
}

const handleSetDefault = (connection) => {
  try {
    setDefaultConnection(connection.id)
  } catch (error) {
    console.error('Failed to set default connection:', error)
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const truncateUrl = (url, maxLength = 30) => {
  if (url.length <= maxLength) return url
  return url.substring(0, maxLength) + '...'
}

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Simplified Header with Action -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg sm:text-xl font-semibold text-gray-900 flex items-center space-x-2">
          <IconBolt class="w-5 h-5 text-orange-600" />
          <span>Wallet Connections</span>
        </h2>
        <p class="text-gray-600 text-sm mt-1">{{ connections.length }} connection{{ connections.length !== 1 ? 's' : '' }}</p>
      </div>

      <!-- Add Button (Mobile & Desktop) -->
      <button
        v-if="filteredConnections.length > 0"
        @click="openAddForm"
        class="btn-primary text-sm flex-shrink-0"
      >
        <IconPlus class="w-4 h-4" />
        <span class="hidden sm:inline">Add Connection</span>
      </button>
    </div>

    <!-- Simplified Search (only show if more than 3 connections) -->
    <div v-if="connections.length > 3" class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search connections..."
        class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm"
      />
      <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
    </div>

    <!-- Wallet Connection Cards -->
    <div class="space-y-3">
      <div
        v-for="connection in filteredConnections"
        :key="connection.id"
        class="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300 group"
      >
        <!-- Main Connection Row -->
        <div class="flex items-center justify-between gap-4 mb-4">
          <!-- Left: Icon + Name + Status -->
          <div class="flex items-center gap-4 flex-1 min-w-0">
            <!-- Wallet Icon -->
            <div :class="[
              'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm',
              connection.isActive ? 'bg-gradient-to-br from-orange-100 to-orange-50' : 'bg-gray-100'
            ]">
              <IconBolt :class="['w-7 h-7', connection.isActive ? 'text-orange-600' : 'text-gray-400']" />
            </div>

            <!-- Connection Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-semibold text-gray-900 truncate text-base">{{ connection.name }}</h3>
                <!-- Default Star -->
                <button
                  v-if="connection.isDefault"
                  @click="handleSetDefault(connection)"
                  class="flex-shrink-0"
                  title="Default connection"
                >
                  <IconStarFilled class="w-4 h-4 text-amber-400" />
                </button>
              </div>

              <!-- Status Badge -->
              <div class="flex items-center gap-2">
                <span :class="[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                  connection.isActive
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                ]">
                  <div :class="[
                    'w-1.5 h-1.5 rounded-full',
                    connection.isActive ? 'bg-green-500' : 'bg-gray-400'
                  ]"></div>
                  {{ connection.isActive ? 'Connected' : 'Disconnected' }}
                </span>
                <span class="text-xs text-gray-400 hidden sm:inline">
                  {{ formatDate(connection.lastUsed) }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Right: Quick Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              v-if="!connection.isActive"
              @click="handleActivateConnection(connection)"
              :disabled="isLoadingConnection"
              class="px-5 py-2.5 bg-orange-500 text-white hover:bg-orange-600 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105"
            >
              Connect
            </button>

            <button
              v-else
              @click="clearActiveConnection"
              class="px-5 py-2.5 bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
            >
              Disconnect
            </button>
          </div>
        </div>

        <!-- Connection URL & Actions -->
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
          <code class="text-xs text-gray-600 font-mono truncate flex-1 mr-4">
            {{ truncateUrl(connection.nwcUrl, 50) }}
          </code>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              @click="copyToClipboard(connection.nwcUrl)"
              class="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              title="Copy"
            >
              <IconCopy class="w-4 h-4" />
            </button>

            <button
              @click="openEditForm(connection)"
              class="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              title="Edit"
            >
              <IconEdit class="w-4 h-4" />
            </button>

            <button
              @click="openDeleteConfirm(connection)"
              class="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-white rounded-xl transition-all duration-200"
              title="Delete"
            >
              <IconTrash class="w-4 h-4" />
            </button>
          </div>
        </div>
        
      </div>
      
      <!-- Elegant Empty State -->
      <div v-if="filteredConnections.length === 0" class="max-w-lg mx-auto">
        <div class="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
          <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-orange-100 to-orange-50">
            <IconBolt class="w-10 h-10 text-orange-600" />
          </div>

          <h3 class="text-2xl font-semibold text-gray-900 mb-3">
            {{ searchQuery ? 'No connections found' : 'No wallet connections' }}
          </h3>
          <p class="text-gray-500 text-base mb-8">
            {{ searchQuery ? 'Try adjusting your search terms.' : 'Connect your Lightning wallet to enable zap payments.' }}
          </p>

          <button
            v-if="!searchQuery"
            @click="openAddForm"
            class="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-medium text-base hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-300 hover:scale-105"
          >
            <IconPlus class="w-5 h-5" />
            Add Connection
          </button>
        </div>
      </div>
    </div>

    <!-- Simplified Connection Error -->
    <div v-if="connectionError" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-start space-x-2">
        <IconAlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <span class="text-red-800 font-medium">Connection Error</span>
          <p class="text-red-700 text-sm mt-1">{{ connectionError }}</p>
        </div>
      </div>
    </div>

    <!-- Add Connection Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showAddForm" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-lg font-semibold text-gray-900">Add Connection</h3>
              <button @click="closeAddForm" class="text-gray-500 hover:text-gray-700">
                <IconX class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <!-- Simplified Form Fields -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  v-model="newConnectionName"
                  type="text"
                  placeholder="My Lightning Wallet"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Connection String</label>
                <input
                  v-model="newConnectionUrl"
                  type="password"
                  placeholder="nostr+walletconnect://..."
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
                <p class="text-xs text-gray-500 mt-1">
                  Get this from your wallet's NWC settings
                </p>
              </div>
              
              <!-- Error Message -->
              <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-sm text-red-600">{{ formError }}</p>
              </div>
              
              <!-- Simplified Actions -->
              <div class="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                <button @click="closeAddForm" class="btn-secondary flex-1">Cancel</button>
                <button @click="handleAddConnection" class="btn-primary flex-1">Add</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Edit Connection Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showEditForm" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-lg font-semibold text-gray-900">Edit Connection</h3>
              <button @click="closeEditForm" class="text-gray-500 hover:text-gray-700">
                <IconX class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  v-model="editConnectionName"
                  type="text"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Connection String</label>
                <input
                  v-model="editConnectionUrl"
                  type="password"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>
              
              <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-sm text-red-600">{{ formError }}</p>
              </div>
              
              <div class="flex space-x-3 pt-2">
                <button @click="closeEditForm" class="btn-secondary flex-1">Cancel</button>
                <button @click="handleEditConnection" class="btn-primary flex-1">Save</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Delete Confirmation Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex items-center space-x-3 mb-4">
              <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <IconTrash class="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900">Delete Connection</h3>
                <p class="text-gray-600 text-sm">This cannot be undone.</p>
              </div>
            </div>
            
            <div class="bg-gray-50 rounded-lg p-3 mb-6">
              <p class="text-sm text-gray-700">
                Delete "<strong>{{ deletingConnection?.name }}</strong>"?
              </p>
            </div>
            
            <div class="flex space-x-3">
              <button @click="closeDeleteConfirm" class="btn-secondary flex-1">Cancel</button>
              <button @click="handleDeleteConnection" class="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex-1">
                Delete
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Empty State Styles */
.wallet-connections-empty-state {
  @apply py-8;
}

.wallet-connections-empty-hero {
  @apply bg-white rounded-2xl p-8 text-center;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.wallet-connections-empty-icon-wrapper {
  @apply relative inline-flex items-center justify-center mb-6;
}

.wallet-connections-empty-icon {
  @apply w-16 h-16 text-orange-600;
  position: relative;
  z-index: 2;
}

.wallet-connections-empty-icon-pulse {
  @apply absolute inset-0 rounded-full bg-orange-100;
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-ring {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0;
  }
}

.wallet-connections-empty-title {
  @apply text-xl font-semibold text-gray-900 mb-3;
  letter-spacing: -0.01em;
}

.wallet-connections-empty-description {
  @apply text-gray-600 mb-6 max-w-md mx-auto;
  line-height: 1.6;
}

.wallet-connections-empty-button {
  @apply inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium transition-all duration-200;
  box-shadow: 0 2px 8px rgba(251, 146, 60, 0.3);
}

.wallet-connections-empty-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.4);
}

.wallet-connections-empty-button:active {
  transform: translateY(0);
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .wallet-connections-empty-hero {
    @apply p-6;
  }

  .wallet-connections-empty-title {
    @apply text-lg;
  }

  .wallet-connections-empty-description {
    @apply text-sm;
  }

  .wallet-connections-empty-icon {
    @apply w-12 h-12;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .wallet-connections-empty-icon-pulse,
  .wallet-connections-empty-button {
    animation: none !important;
    transition: none !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .wallet-connections-empty-hero {
    border-width: 2px;
  }
}
</style>