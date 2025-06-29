import { ref, reactive, computed, watch } from 'vue'
import { initializeNWC, fetchTransactions, getWalletInfo, getBalance } from '../utils/nwcClient.js'
import { processTransactions } from '../utils/dataMapper.js'

// Global state for Nostr connections
const connections = ref([])
const activeConnection = ref(null)
const isLoadingConnection = ref(false)
const connectionError = ref('')

// Storage keys
const CONNECTIONS_STORAGE_KEY = 'nostr_connections'
const ACTIVE_CONNECTION_STORAGE_KEY = 'active_connection_id'

// Generate unique ID for connections
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

// Load connections from localStorage
const loadConnections = () => {
  try {
    const stored = localStorage.getItem(CONNECTIONS_STORAGE_KEY)
    if (stored) {
      connections.value = JSON.parse(stored)
    }
    
    const activeId = localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY)
    if (activeId) {
      const active = connections.value.find(conn => conn.id === activeId)
      if (active) {
        activeConnection.value = active
      }
    }
  } catch (error) {
    console.error('Failed to load connections from storage:', error)
  }
}

// Save connections to localStorage
const saveConnections = () => {
  try {
    localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections.value))
    if (activeConnection.value) {
      localStorage.setItem(ACTIVE_CONNECTION_STORAGE_KEY, activeConnection.value.id)
    } else {
      localStorage.removeItem(ACTIVE_CONNECTION_STORAGE_KEY)
    }
  } catch (error) {
    console.error('Failed to save connections to storage:', error)
  }
}

// Watch for changes and save to localStorage
watch(connections, saveConnections, { deep: true })
watch(activeConnection, saveConnections)

// Validate NWC URL format
const validateNwcUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return 'NWC URL is required'
  }
  
  if (!url.startsWith('nostr+walletconnect://')) {
    return 'NWC URL must start with "nostr+walletconnect://"'
  }
  
  try {
    new URL(url)
    return null // Valid
  } catch {
    return 'Invalid NWC URL format'
  }
}

// Add new connection
const addConnection = (name, nwcUrl) => {
  const validation = validateNwcUrl(nwcUrl)
  if (validation) {
    throw new Error(validation)
  }
  
  if (!name || name.trim().length === 0) {
    throw new Error('Display name is required')
  }
  
  // Check for duplicate URLs
  const existingConnection = connections.value.find(conn => conn.nwcUrl === nwcUrl)
  if (existingConnection) {
    throw new Error('A connection with this URL already exists')
  }
  
  const newConnection = {
    id: generateId(),
    name: name.trim(),
    nwcUrl: nwcUrl.trim(),
    isActive: false,
    isDefault: connections.value.length === 0, // First connection is default
    createdAt: new Date().toISOString(),
    lastUsed: null
  }
  
  connections.value.push(newConnection)
  return newConnection
}

// Edit existing connection
const editConnection = (id, newName, newNwcUrl) => {
  const connection = connections.value.find(conn => conn.id === id)
  if (!connection) {
    throw new Error('Connection not found')
  }
  
  const validation = validateNwcUrl(newNwcUrl)
  if (validation) {
    throw new Error(validation)
  }
  
  if (!newName || newName.trim().length === 0) {
    throw new Error('Display name is required')
  }
  
  // Check for duplicate URLs (excluding current connection)
  const existingConnection = connections.value.find(conn => 
    conn.id !== id && conn.nwcUrl === newNwcUrl
  )
  if (existingConnection) {
    throw new Error('A connection with this URL already exists')
  }
  
  connection.name = newName.trim()
  connection.nwcUrl = newNwcUrl.trim()
  
  return connection
}

// Delete connection
const deleteConnection = (id) => {
  const index = connections.value.findIndex(conn => conn.id === id)
  if (index === -1) {
    throw new Error('Connection not found')
  }
  
  const connection = connections.value[index]
  
  // If deleting active connection, clear it
  if (activeConnection.value?.id === id) {
    clearActiveConnection()
  }
  
  // If deleting default connection, set another as default
  if (connection.isDefault && connections.value.length > 1) {
    const remainingConnections = connections.value.filter(conn => conn.id !== id)
    if (remainingConnections.length > 0) {
      remainingConnections[0].isDefault = true
    }
  }
  
  connections.value.splice(index, 1)
  return true
}

// Set active connection
const setActiveConnection = async (idOrNwcUrl) => {
  isLoadingConnection.value = true
  connectionError.value = ''
  
  try {
    let connection
    
    // If it's an ID, find existing connection
    if (typeof idOrNwcUrl === 'string' && !idOrNwcUrl.startsWith('nostr+walletconnect://')) {
      connection = connections.value.find(conn => conn.id === idOrNwcUrl)
      if (!connection) {
        throw new Error('Connection not found')
      }
    } else {
      // If it's a URL, try to find existing or create new
      const nwcUrl = idOrNwcUrl
      connection = connections.value.find(conn => conn.nwcUrl === nwcUrl)
      
      if (!connection) {
        // Create new connection with auto-generated name
        const timestamp = new Date().toLocaleString()
        const autoName = `Wallet ${timestamp}`
        connection = addConnection(autoName, nwcUrl)
      }
    }
    
    // Clear previous active connection
    connections.value.forEach(conn => {
      conn.isActive = false
    })
    
    // Initialize NWC client
    const client = initializeNWC(connection.nwcUrl)
    if (!client) {
      throw new Error('Failed to initialize NWC client')
    }
    
    // Test the connection
    const walletInfo = await getWalletInfo()
    
    // Set as active
    connection.isActive = true
    connection.lastUsed = new Date().toISOString()
    activeConnection.value = connection
    
    console.info(`Connected to wallet: ${walletInfo?.alias || connection.name}`)
    return connection
    
  } catch (error) {
    connectionError.value = error.message || 'Failed to connect to wallet'
    console.error('Connection failed:', error)
    throw error
  } finally {
    isLoadingConnection.value = false
  }
}

// Set default connection
const setDefaultConnection = (id) => {
  const connection = connections.value.find(conn => conn.id === id)
  if (!connection) {
    throw new Error('Connection not found')
  }
  
  // Clear all default flags
  connections.value.forEach(conn => {
    conn.isDefault = false
  })
  
  // Set new default
  connection.isDefault = true
  return connection
}

// Clear active connection
const clearActiveConnection = () => {
  if (activeConnection.value) {
    const connection = connections.value.find(conn => conn.id === activeConnection.value.id)
    if (connection) {
      connection.isActive = false
    }
  }
  
  activeConnection.value = null
  connectionError.value = ''
  
  // Clear NWC client
  initializeNWC(null)
}

// Load zap data for active connection
const loadZapData = async () => {
  if (!activeConnection.value) {
    return []
  }
  
  try {
    const transactions = await fetchTransactions()
    const processedZaps = processTransactions(transactions)
    return processedZaps
  } catch (error) {
    console.error('Failed to load zap data:', error)
    throw error
  }
}

// Computed properties
const isWalletConnected = computed(() => !!activeConnection.value)
const defaultConnection = computed(() => connections.value.find(conn => conn.isDefault))
const sortedConnections = computed(() => {
  return [...connections.value].sort((a, b) => {
    // Active first, then default, then by last used, then by name
    if (a.isActive !== b.isActive) return b.isActive - a.isActive
    if (a.isDefault !== b.isDefault) return b.isDefault - a.isDefault
    if (a.lastUsed && b.lastUsed) return new Date(b.lastUsed) - new Date(a.lastUsed)
    if (a.lastUsed && !b.lastUsed) return -1
    if (!a.lastUsed && b.lastUsed) return 1
    return a.name.localeCompare(b.name)
  })
})

// Initialize on module load
loadConnections()

// Auto-connect to default connection if available and no active connection
if (!activeConnection.value && defaultConnection.value) {
  setActiveConnection(defaultConnection.value.id).catch(error => {
    console.warn('Failed to auto-connect to default connection:', error)
  })
}

export function useNostrConnections() {
  return {
    // State
    connections: sortedConnections,
    activeConnection,
    isLoadingConnection,
    connectionError,
    isWalletConnected,
    defaultConnection,
    
    // Actions
    addConnection,
    editConnection,
    deleteConnection,
    setActiveConnection,
    setDefaultConnection,
    clearActiveConnection,
    loadZapData,
    validateNwcUrl,
    
    // Re-export utilities
    fetchTransactions,
    getWalletInfo,
    getBalance
  }
}