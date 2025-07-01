import { SimplePool, Relay } from 'nostr-tools/pool'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'

// Relay connection manager following nostr-tools best practices
class NostrRelayManager {
  constructor() {
    this.pool = new SimplePool()
    this.relays = new Map() // Map of URL -> Relay instance
    this.relayStatuses = new Map() // Map of URL -> status info
    this.connectionPromises = new Map() // Map of URL -> connection promise
    this.eventListeners = new Set()
    this.isInitialized = false
    
    // Default reliable relays
    this.defaultRelays = [
      { url: 'wss://relay.damus.io', read: true, write: true },
      { url: 'wss://nos.lol', read: true, write: true },
      { url: 'wss://relay.snort.social', read: true, write: true },
      { url: 'wss://relay.primal.net', read: true, write: true },
      { url: 'wss://nostr.wine', read: true, write: true },
      { url: 'wss://relay.nostr.band', read: true, write: false } // Read-only
    ]
    
    // Connection timeouts and retry logic
    this.connectionTimeout = 10000 // 10 seconds
    this.maxRetries = 3
    this.retryDelay = 2000 // 2 seconds
    this.healthCheckInterval = 30000 // 30 seconds
    this.healthCheckTimer = null
  }

  // Initialize the relay manager
  async initialize(userRelays = []) {
    if (this.isInitialized) {
      console.log('Relay manager already initialized')
      return
    }

    console.log('🚀 Initializing Nostr Relay Manager...')
    
    try {
      // Combine user relays with defaults, prioritizing user relays
      const allRelays = this.mergeRelayLists(userRelays, this.defaultRelays)
      
      // Connect to all relays
      await this.connectToRelays(allRelays)
      
      // Start health check monitoring
      this.startHealthCheck()
      
      this.isInitialized = true
      console.log('✅ Nostr Relay Manager initialized successfully')
      
      // Emit initialization event
      this.emitEvent('initialized', { 
        connectedRelays: this.getConnectedRelays().length,
        totalRelays: allRelays.length 
      })
      
    } catch (error) {
      console.error('❌ Failed to initialize Nostr Relay Manager:', error)
      throw error
    }
  }

  // Merge user relays with defaults, avoiding duplicates
  mergeRelayLists(userRelays, defaultRelays) {
    const relayMap = new Map()
    
    // Add default relays first
    defaultRelays.forEach(relay => {
      relayMap.set(relay.url, relay)
    })
    
    // Override with user relays
    userRelays.forEach(relay => {
      relayMap.set(relay.url, relay)
    })
    
    return Array.from(relayMap.values())
  }

  // Connect to multiple relays with proper error handling
  async connectToRelays(relayConfigs) {
    console.log(`🔌 Connecting to ${relayConfigs.length} relays...`)
    
    const connectionPromises = relayConfigs.map(config => 
      this.connectToRelay(config.url, config)
    )
    
    // Wait for all connections to complete (success or failure)
    const results = await Promise.allSettled(connectionPromises)
    
    let successCount = 0
    let failureCount = 0
    
    results.forEach((result, index) => {
      const relayUrl = relayConfigs[index].url
      if (result.status === 'fulfilled') {
        successCount++
        console.log(`✅ Connected to ${relayUrl}`)
      } else {
        failureCount++
        console.warn(`❌ Failed to connect to ${relayUrl}:`, result.reason?.message)
      }
    })
    
    console.log(`📊 Relay connection summary: ${successCount} connected, ${failureCount} failed`)
    
    if (successCount === 0) {
      throw new Error('Failed to connect to any relays')
    }
    
    return { successCount, failureCount }
  }

  // Connect to a single relay with retry logic
  async connectToRelay(url, config = { read: true, write: true }, retryCount = 0) {
    // Check if already connecting
    if (this.connectionPromises.has(url)) {
      return this.connectionPromises.get(url)
    }

    // Set initial status
    this.setRelayStatus(url, 'connecting', config)

    const connectionPromise = this._attemptConnection(url, config, retryCount)
    this.connectionPromises.set(url, connectionPromise)

    try {
      const relay = await connectionPromise
      this.connectionPromises.delete(url)
      return relay
    } catch (error) {
      this.connectionPromises.delete(url)
      throw error
    }
  }

  // Attempt connection to a relay
  async _attemptConnection(url, config, retryCount) {
    try {
      console.log(`🔌 Attempting to connect to ${url} (attempt ${retryCount + 1})`)
      
      // Use pool.ensureRelay for proper connection management
      const relay = await Promise.race([
        this.pool.ensureRelay(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        )
      ])

      // Store the relay instance
      this.relays.set(url, relay)
      this.setRelayStatus(url, 'connected', config)
      
      // Set up event listeners for this relay
      this.setupRelayEventListeners(url, relay)
      
      console.log(`✅ Successfully connected to ${url}`)
      this.emitEvent('relayConnected', { url, config })
      
      return relay
      
    } catch (error) {
      console.warn(`❌ Connection attempt ${retryCount + 1} failed for ${url}:`, error.message)
      
      // Retry logic
      if (retryCount < this.maxRetries) {
        console.log(`🔄 Retrying connection to ${url} in ${this.retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
        return this._attemptConnection(url, config, retryCount + 1)
      } else {
        this.setRelayStatus(url, 'failed', config, error.message)
        this.emitEvent('relayFailed', { url, config, error: error.message })
        throw new Error(`Failed to connect to ${url} after ${this.maxRetries + 1} attempts: ${error.message}`)
      }
    }
  }

  // Set up event listeners for relay connection status
  setupRelayEventListeners(url, relay) {
    // Listen for disconnect events
    relay.on('disconnect', () => {
      console.warn(`🔌 Relay ${url} disconnected`)
      this.setRelayStatus(url, 'disconnected')
      this.emitEvent('relayDisconnected', { url })
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        this.reconnectRelay(url)
      }, this.retryDelay)
    })

    // Listen for error events
    relay.on('error', (error) => {
      console.error(`❌ Relay ${url} error:`, error)
      this.setRelayStatus(url, 'error', undefined, error.message)
      this.emitEvent('relayError', { url, error: error.message })
    })
  }

  // Reconnect to a specific relay
  async reconnectRelay(url) {
    const status = this.relayStatuses.get(url)
    if (!status) return

    console.log(`🔄 Attempting to reconnect to ${url}`)
    
    try {
      // Remove old relay instance
      this.relays.delete(url)
      
      // Attempt new connection
      await this.connectToRelay(url, status.config)
    } catch (error) {
      console.warn(`❌ Failed to reconnect to ${url}:`, error.message)
    }
  }

  // Set relay status with metadata
  setRelayStatus(url, status, config = null, error = null) {
    const currentStatus = this.relayStatuses.get(url) || {}
    
    this.relayStatuses.set(url, {
      ...currentStatus,
      url,
      status,
      config: config || currentStatus.config,
      error,
      lastUpdated: new Date().toISOString(),
      lastConnected: status === 'connected' ? new Date().toISOString() : currentStatus.lastConnected
    })
  }

  // Get all relay statuses
  getRelayStatuses() {
    return Array.from(this.relayStatuses.values())
  }

  // Get connected relays
  getConnectedRelays() {
    return this.getRelayStatuses().filter(relay => relay.status === 'connected')
  }

  // Get write-enabled connected relays
  getWriteRelays() {
    return this.getConnectedRelays().filter(relay => relay.config?.write === true)
  }

  // Get read-enabled connected relays
  getReadRelays() {
    return this.getConnectedRelays().filter(relay => relay.config?.read === true)
  }

  // Publish event to write relays
  async publishEvent(event, targetRelays = null) {
    if (!this.isInitialized) {
      throw new Error('Relay manager not initialized')
    }

    // Verify event before publishing
    const isValid = verifyEvent(event)
    if (!isValid) {
      throw new Error('Invalid event signature')
    }

    // Determine which relays to use
    const relaysToUse = targetRelays || this.getWriteRelays()
    
    if (relaysToUse.length === 0) {
      throw new Error('No write-enabled relays available')
    }

    const relayUrls = relaysToUse.map(relay => relay.url)
    console.log(`📤 Publishing event to ${relayUrls.length} relays:`, relayUrls)

    try {
      // Use pool.publish for reliable publishing
      const publishPromises = this.pool.publish(relayUrls, event)
      
      // Wait for all publish attempts with timeout
      const results = await Promise.race([
        Promise.allSettled(publishPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Publishing timeout after 30 seconds')), 30000)
        )
      ])

      // Count successful publications
      const successful = results.filter(result => result.status === 'fulfilled')
      const failed = results.filter(result => result.status === 'rejected')

      console.log(`📊 Publishing results: ${successful.length} successful, ${failed.length} failed`)

      if (successful.length === 0) {
        throw new Error('Failed to publish to any relays')
      }

      this.emitEvent('eventPublished', {
        eventId: event.id,
        successfulRelays: successful.length,
        failedRelays: failed.length,
        totalRelays: relayUrls.length
      })

      return {
        successful: successful.length,
        failed: failed.length,
        total: relayUrls.length
      }

    } catch (error) {
      console.error('❌ Failed to publish event:', error)
      this.emitEvent('publishFailed', { eventId: event.id, error: error.message })
      throw error
    }
  }

  // Subscribe to events from read relays
  subscribeToEvents(filters, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Relay manager not initialized')
    }

    const readRelays = this.getReadRelays()
    if (readRelays.length === 0) {
      throw new Error('No read-enabled relays available')
    }

    const relayUrls = readRelays.map(relay => relay.url)
    console.log(`📥 Subscribing to events from ${relayUrls.length} relays`)

    // Use pool.subscribeMany for reliable subscription
    return this.pool.subscribeMany(relayUrls, filters, {
      ...options,
      maxWait: options.maxWait || 10000 // 10 second timeout
    })
  }

  // Get a single event
  async getEvent(filters, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Relay manager not initialized')
    }

    const readRelays = this.getReadRelays()
    if (readRelays.length === 0) {
      throw new Error('No read-enabled relays available')
    }

    const relayUrls = readRelays.map(relay => relay.url)
    
    try {
      const event = await this.pool.get(relayUrls, filters)
      return event
    } catch (error) {
      console.error('❌ Failed to get event:', error)
      throw error
    }
  }

  // Start health check monitoring
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckInterval)

    console.log(`💓 Started relay health check (every ${this.healthCheckInterval / 1000}s)`)
  }

  // Perform health check on all relays
  async performHealthCheck() {
    console.log('💓 Performing relay health check...')
    
    const relayStatuses = this.getRelayStatuses()
    const healthPromises = relayStatuses.map(async (relayStatus) => {
      try {
        const relay = this.relays.get(relayStatus.url)
        if (!relay) {
          // Relay not in our map, try to reconnect
          await this.reconnectRelay(relayStatus.url)
          return
        }

        // Check if relay is still responsive
        // We can do this by trying to get relay info or sending a simple query
        const testFilters = { kinds: [0], limit: 1 }
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )

        await Promise.race([
          this.pool.get([relayStatus.url], testFilters),
          timeout
        ])

        // If we get here, relay is healthy
        if (relayStatus.status !== 'connected') {
          this.setRelayStatus(relayStatus.url, 'connected', relayStatus.config)
          this.emitEvent('relayHealthy', { url: relayStatus.url })
        }

      } catch (error) {
        console.warn(`💔 Health check failed for ${relayStatus.url}:`, error.message)
        this.setRelayStatus(relayStatus.url, 'unhealthy', relayStatus.config, error.message)
        this.emitEvent('relayUnhealthy', { url: relayStatus.url, error: error.message })
        
        // Try to reconnect unhealthy relays
        setTimeout(() => {
          this.reconnectRelay(relayStatus.url)
        }, this.retryDelay)
      }
    })

    await Promise.allSettled(healthPromises)
  }

  // Stop health check monitoring
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
      console.log('💓 Stopped relay health check')
    }
  }

  // Add event listener
  addEventListener(callback) {
    this.eventListeners.add(callback)
    return () => this.eventListeners.delete(callback)
  }

  // Emit event to all listeners
  emitEvent(type, data) {
    this.eventListeners.forEach(listener => {
      try {
        listener({ type, data, timestamp: new Date().toISOString() })
      } catch (error) {
        console.error('Event listener error:', error)
      }
    })
  }

  // Add a new relay
  async addRelay(url, config = { read: true, write: true }) {
    console.log(`➕ Adding new relay: ${url}`)
    
    try {
      await this.connectToRelay(url, config)
      this.emitEvent('relayAdded', { url, config })
      return true
    } catch (error) {
      console.error(`❌ Failed to add relay ${url}:`, error)
      throw error
    }
  }

  // Remove a relay
  removeRelay(url) {
    console.log(`➖ Removing relay: ${url}`)
    
    const relay = this.relays.get(url)
    if (relay) {
      relay.close()
      this.relays.delete(url)
    }
    
    this.relayStatuses.delete(url)
    this.connectionPromises.delete(url)
    
    this.emitEvent('relayRemoved', { url })
  }

  // Get connection statistics
  getConnectionStats() {
    const statuses = this.getRelayStatuses()
    const connected = statuses.filter(r => r.status === 'connected').length
    const total = statuses.length
    const writeEnabled = this.getWriteRelays().length
    const readEnabled = this.getReadRelays().length
    
    return {
      total,
      connected,
      disconnected: total - connected,
      writeEnabled,
      readEnabled,
      healthyPercentage: total > 0 ? Math.round((connected / total) * 100) : 0
    }
  }

  // Cleanup and close all connections
  async cleanup() {
    console.log('🧹 Cleaning up Nostr Relay Manager...')
    
    this.stopHealthCheck()
    
    // Close all relay connections
    for (const [url, relay] of this.relays) {
      try {
        relay.close()
      } catch (error) {
        console.warn(`Failed to close relay ${url}:`, error)
      }
    }
    
    // Close the pool
    const allUrls = Array.from(this.relayStatuses.keys())
    this.pool.close(allUrls)
    
    // Clear all data
    this.relays.clear()
    this.relayStatuses.clear()
    this.connectionPromises.clear()
    this.eventListeners.clear()
    
    this.isInitialized = false
    console.log('✅ Nostr Relay Manager cleanup complete')
  }
}

// Create singleton instance
export const nostrRelayManager = new NostrRelayManager()

// Export the class for testing or multiple instances
export { NostrRelayManager }

// Convenience functions
export const initializeRelays = (userRelays) => nostrRelayManager.initialize(userRelays)
export const publishToNostr = (event, targetRelays) => nostrRelayManager.publishEvent(event, targetRelays)
export const subscribeToNostr = (filters, options) => nostrRelayManager.subscribeToEvents(filters, options)
export const getNostrEvent = (filters, options) => nostrRelayManager.getEvent(filters, options)
export const getRelayStats = () => nostrRelayManager.getConnectionStats()
export const addNostrRelay = (url, config) => nostrRelayManager.addRelay(url, config)
export const removeNostrRelay = (url) => nostrRelayManager.removeRelay(url)