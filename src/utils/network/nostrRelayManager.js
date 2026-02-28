import { SimplePool } from 'nostr-tools/pool'
import { verifyEvent } from 'nostr-tools/pure'
import {
  RELAY_CONNECTION_TIMEOUT, RELAY_MAX_RETRIES, RELAY_RETRY_DELAY,
  RELAY_HEALTH_CHECK_INTERVAL, RELAY_HEALTH_CHECK_TIMEOUT, RELAY_MAX_BACKOFF,
  EVENT_CACHE_TTL, EVENT_CACHE_MAX, EVENT_CACHE_EVICT,
  DEFERRED_SUB_TIMEOUT, PUBLISH_TIMEOUT,
  DEFAULT_RELAY_CONFIGS, MAX_CONCURRENT_SUBS
} from '../constants.js'

// Relay connection manager following nostr-tools best practices
class NostrRelayManager {
  constructor() {
    this.pool = new SimplePool()
    this.relayConnections = new Map() // Map of URL -> connection info
    this.relayStatuses = new Map() // Map of URL -> status info
    this.connectionPromises = new Map() // Map of URL -> connection promise
    this.eventListeners = new Set()
    this.isInitialized = false
    this._createReadyGate()

    // Default reliable relays (from constants)
    this.defaultRelays = DEFAULT_RELAY_CONFIGS

    // Connection timeouts and retry logic
    this.connectionTimeout = RELAY_CONNECTION_TIMEOUT
    this.maxRetries = RELAY_MAX_RETRIES
    this.retryDelay = RELAY_RETRY_DELAY
    this.healthCheckInterval = RELAY_HEALTH_CHECK_INTERVAL
    this.healthCheckTimer = null

    // Memoization
    this._eventCache = new Map() // key: JSON.stringify(filters), value: {event, timestamp}
    this._eventCacheTTL = EVENT_CACHE_TTL
    this._relayBackoff = new Map() // url -> {backoffMs, lastFail}
    this._maxBackoff = RELAY_MAX_BACKOFF

    // Subscription concurrency control
    this._activeSubscriptions = new Set()
    this._subscriptionQueue = []
    this._maxConcurrentSubs = MAX_CONCURRENT_SUBS
  }

  // Create the ready gate (Promise that resolves when initialized)
  _createReadyGate() {
    this._readyPromise = new Promise((resolve, reject) => {
      this._readyResolve = resolve
      this._readyReject = reject
    })
  }

  // Returns a Promise that resolves when the relay manager is initialized.
  // Safe to call multiple times; returns immediately if already initialized.
  ready() {
    if (this.isInitialized) return Promise.resolve()
    return this._readyPromise
  }

  // Initialize the relay manager
  async initialize(userRelays = []) {
    if (this.isInitialized) {
      console.log('Relay manager already initialized, use updateRelays() to add new relays')
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
      this._readyResolve()
      console.log('✅ Nostr Relay Manager initialized successfully')

      // Emit initialization event
      this.emitEvent('initialized', {
        connectedRelays: this.getConnectedRelays().length,
        totalRelays: allRelays.length
      })
      
    } catch (error) {
      console.error('❌ Failed to initialize Nostr Relay Manager:', error)
      this._readyReject(error)
      throw error
    }
  }

  // Update relays after initialization (add new relays from user's NIP-65 list)
  async updateRelays(newRelays = []) {
    if (!this.isInitialized) {
      console.log('Relay manager not initialized, calling initialize instead')
      return this.initialize(newRelays)
    }

    if (!newRelays || newRelays.length === 0) {
      console.log('No new relays to add')
      return
    }

    console.log(`Updating relay manager with ${newRelays.length} relays...`)
    
    try {
      // Filter out relays we're already connected to
      const existingUrls = new Set(Array.from(this.relayConnections.keys()))
      const relaysToAdd = newRelays.filter(relay => !existingUrls.has(relay.url))
      
      if (relaysToAdd.length === 0) {
        console.log('All relays already connected')
        return
      }
      
      console.log(`Adding ${relaysToAdd.length} new relays:`, relaysToAdd.map(r => r.url))
      
      // Connect to new relays
      await this.connectToRelays(relaysToAdd)
      
      console.log('Relay manager updated successfully')
      
      // Emit update event
      this.emitEvent('relaysUpdated', { 
        addedRelays: relaysToAdd.length,
        connectedRelays: this.getConnectedRelays().length
      })
      
    } catch (error) {
      console.error('Failed to update relays:', error)
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
      const result = await connectionPromise
      this.connectionPromises.delete(url)
      return result
    } catch (error) {
      this.connectionPromises.delete(url)
      throw error
    }
  }

  // Attempt connection to a relay using pool.ensureRelay
  async _attemptConnection(url, config, retryCount) {
    try {
      console.log(`🔌 Attempting to connect to ${url} (attempt ${retryCount + 1})`)
      
      // Use pool.ensureRelay which returns a promise that resolves when connected
      const relayPromise = this.pool.ensureRelay(url)
      
      // Add timeout to the connection attempt
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
      )
      
      // Wait for either connection or timeout
      await Promise.race([relayPromise, timeoutPromise])

      // Store connection info
      this.relayConnections.set(url, {
        url,
        config,
        connectedAt: new Date().toISOString()
      })
      
      this.setRelayStatus(url, 'connected', config)
      
      console.log(`✅ Successfully connected to ${url}`)
      this.emitEvent('relayConnected', { url, config })
      
      return { url, config }
      
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

  // Reconnect to a specific relay
  async reconnectRelay(url) {
    const status = this.relayStatuses.get(url)
    if (!status) return

    console.log(`🔄 Attempting to reconnect to ${url}`)
    
    try {
      // Remove old connection info
      this.relayConnections.delete(url)
      
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

  // Publish event to write relays using the correct pool.publish API
  async publishEvent(event, targetRelays = null) {
    await this.ready()

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
    console.log(`📤 Publishing event ${event.id} to ${relayUrls.length} relays:`, relayUrls)

    try {
      // Use pool.publish which returns an array of promises
      const publishPromises = this.pool.publish(relayUrls, event)

      // Wait for at least one successful publish with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('publish timed out')), PUBLISH_TIMEOUT)
      )

      // Use Promise.any to resolve as soon as one relay succeeds
      // Also track all results for reporting
      let successCount = 0
      let failCount = 0
      const allResults = []

      try {
        // Wait for first success
        await Promise.race([
          Promise.any(publishPromises),
          timeoutPromise
        ])

        // Give a little more time for other relays to respond
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Check all results
        const results = await Promise.allSettled(publishPromises)
        results.forEach((result, index) => {
          allResults.push(result)
          if (result.status === 'fulfilled') {
            successCount++
          } else {
            failCount++
            console.warn(`❌ Failed to publish to ${relayUrls[index]}:`, result.reason?.message || 'publish timed out')
          }
        })
      } catch (error) {
        // If Promise.any fails, all promises rejected
        const results = await Promise.allSettled(publishPromises)
        results.forEach((result, index) => {
          allResults.push(result)
          if (result.status === 'fulfilled') {
            successCount++
          } else {
            failCount++
            console.warn(`❌ Failed to publish to ${relayUrls[index]}:`, result.reason?.message || 'publish timed out')
          }
        })

        if (successCount === 0) {
          throw new Error('Failed to publish to any relays')
        }
      }

      console.log(`📊 Publishing results: ${successCount} successful, ${failCount} failed`)

      this.emitEvent('eventPublished', {
        eventId: event.id,
        successfulRelays: successCount,
        failedRelays: failCount,
        totalRelays: relayUrls.length
      })

      return {
        successful: successCount,
        failed: failCount,
        total: relayUrls.length
      }

    } catch (error) {
      console.error('❌ Failed to publish event:', error)
      this.emitEvent('publishFailed', { eventId: event.id, error: error.message })
      throw error
    }
  }

  // Utility: check if relay is in backoff
  _isRelayBackedOff(url) {
    const entry = this._relayBackoff.get(url)
    if (!entry) return false
    return Date.now() - entry.lastFail < entry.backoffMs
  }

  // Utility: mark relay as failed and increase backoff
  _markRelayBackoff(url) {
    const entry = this._relayBackoff.get(url) || {backoffMs: 2000, lastFail: 0}
    entry.backoffMs = Math.min(this._maxBackoff, entry.backoffMs * 2)
    entry.lastFail = Date.now()
    this._relayBackoff.set(url, entry)
  }

  // Utility: reset relay backoff on success
  _resetRelayBackoff(url) {
    if (this._relayBackoff.has(url)) {
      this._relayBackoff.delete(url)
    }
  }

  _validateFilters(filters) {
    if (!Array.isArray(filters)) {
      console.warn('Filters must be an array, got:', typeof filters)
      return []
    }
    
    const validFilters = filters.filter(filter => {
      if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
        console.warn('Invalid filter (not an object):', filter)
        return false
      }
      
      const hasValidProperty = Object.keys(filter).length > 0
      if (!hasValidProperty) {
        console.warn('Invalid filter (empty object):', filter)
        return false
      }
      
      return true
    })
    
    return validFilters
  }

  // Subscribe to events from read relays with deduplication.
  // If called before initialization, defers until ready.
  subscribeToEvents(filters, options = {}) {
    if (!this.isInitialized) {
      // Deferred subscription: queue until relay manager is ready (with timeout)
      let realSub = null
      let closed = false

      const deferTimeout = setTimeout(() => {
        if (!closed) {
          closed = true
          console.warn('Deferred subscription timed out after', DEFERRED_SUB_TIMEOUT, 'ms')
        }
      }, DEFERRED_SUB_TIMEOUT)

      this._readyPromise.then(() => {
        clearTimeout(deferTimeout)
        if (!closed) {
          try {
            realSub = this.subscribeToEvents(filters, options)
          } catch (e) {
            console.warn('Deferred subscription failed:', e.message)
          }
        }
      }).catch(() => {
        clearTimeout(deferTimeout)
        closed = true
      })

      return { close: () => { closed = true; clearTimeout(deferTimeout); realSub?.close() } }
    }
    
    const validFilters = this._validateFilters(filters)
    if (validFilters.length === 0) {
      console.warn('No valid filters provided to subscribeToEvents, skipping subscription')
      return {
        close: () => {},
        on: () => {},
        off: () => {}
      }
    }

    // Concurrency control: if at limit, queue the request
    if (this._activeSubscriptions.size >= this._maxConcurrentSubs) {
      let realSub = null
      const proxy = {
        close: () => { proxy._closed = true; realSub?.close() },
        _closed: false
      }
      this._subscriptionQueue.push({ filters: validFilters, options, proxy, setReal: (s) => { realSub = s } })
      return proxy
    }

    return this._openSubscription(validFilters, options)
  }

  // Internal: actually open a subscription (after concurrency check)
  // filters here are already validated
  _openSubscription(filters, options) {
    const validFilters = filters
    const readRelays = this.getReadRelays().filter(r => !this._isRelayBackedOff(r.url))
    if (readRelays.length === 0) {
      throw new Error('No read-enabled relays available (all may be rate-limited or unhealthy)')
    }
    const relayUrls = readRelays.map(relay => relay.url)

    // Track this subscription
    const subId = Symbol('sub')
    this._activeSubscriptions.add(subId)

    // Cleanup helper — idempotent, safe to call multiple times
    let cleaned = false
    const cleanupSub = () => {
      if (cleaned) return
      cleaned = true
      this._activeSubscriptions.delete(subId)
      this._drainQueue()
    }

    // Wrap callbacks to handle relay failures + cleanup
    const wrappedOptions = {...options}
    wrappedOptions.onclose = (reason) => {
      cleanupSub()
      if (Array.isArray(reason)) {
        reason.forEach((r, i) => {
          if (r && r.toLowerCase().includes('rate')) {
            this._markRelayBackoff(relayUrls[i])
          }
        })
      }
      if (options.onclose) options.onclose(reason)
    }

    // Build per-relay per-filter request list for subscribeMap
    const requests = []
    for (const url of relayUrls) {
      for (const filter of validFilters) {
        requests.push({ url, filter })
      }
    }

    const sub = this.pool.subscribeMap(requests, {
      ...wrappedOptions,
      maxWait: options.maxWait || 10000
    })

    // Wrap close to ensure cleanup even if onclose doesn't fire
    const originalClose = sub.close.bind(sub)
    sub.close = () => {
      cleanupSub()
      originalClose()
    }

    return sub
  }

  // Drain the subscription queue (FIFO)
  _drainQueue() {
    while (this._subscriptionQueue.length > 0 && this._activeSubscriptions.size < this._maxConcurrentSubs) {
      const { filters, options, proxy, setReal } = this._subscriptionQueue.shift()
      if (proxy._closed) continue // proxy was closed while queued
      try {
        const realSub = this._openSubscription(filters, options)
        setReal(realSub)
        // Rewire proxy close to delegate to real sub
        proxy.close = () => { proxy._closed = true; realSub.close() }
      } catch (e) {
        console.warn('Queued subscription failed:', e.message)
      }
    }
  }

  // Memoized getEvent (in-memory, TTL)
  async getEvent(filters, options = {}) {
    await this.ready()
    
    // Validate filters - must be a single filter object
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      console.warn('Invalid filter for getEvent (must be an object):', filters)
      return null
    }
    
    if (Object.keys(filters).length === 0) {
      console.warn('Invalid filter for getEvent (empty object):', filters)
      return null
    }
    
    const cacheKey = JSON.stringify(filters)
    const cached = this._eventCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this._eventCacheTTL) {
      return cached.event
    }
    const readRelays = this.getReadRelays().filter(r => !this._isRelayBackedOff(r.url))
    if (readRelays.length === 0) {
      throw new Error('No read-enabled relays available (all may be rate-limited or unhealthy)')
    }
    const relayUrls = readRelays.map(relay => relay.url)
    try {
      const event = await this.pool.get(relayUrls, filters)
      if (event) {
        this._eventCache.set(cacheKey, {event, timestamp: Date.now()})
        this._evictEventCache()
        // Reset backoff for all relays on success
        relayUrls.forEach(url => this._resetRelayBackoff(url))
      }
      return event
    } catch (error) {
      // Mark relays as failed if error is rate limit or network
      relayUrls.forEach(url => {
        if (error.message && error.message.toLowerCase().includes('rate')) {
          this._markRelayBackoff(url)
        }
      })
      throw error
    }
  }

  // Clear cached getEvent result for given filters
  clearEventCache(filters) {
    const cacheKey = JSON.stringify(filters)
    this._eventCache.delete(cacheKey)
  }

  // Evict oldest entries when event cache exceeds max size
  _evictEventCache() {
    if (this._eventCache.size <= EVENT_CACHE_MAX) return
    const entries = Array.from(this._eventCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, EVENT_CACHE_EVICT)
    toRemove.forEach(([key]) => this._eventCache.delete(key))
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
        const connection = this.relayConnections.get(relayStatus.url)
        if (!connection) {
          // Connection not in our map, try to reconnect
          await this.reconnectRelay(relayStatus.url)
          return
        }

        // Check if relay is still responsive via WebSocket connection
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), RELAY_HEALTH_CHECK_TIMEOUT)
        )

        await Promise.race([
          this.pool.ensureRelay(relayStatus.url),
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
    // Type check to ensure only functions are added
    if (typeof callback !== 'function') {
      console.warn('addEventListener: callback must be a function')
      return () => {} // Return empty cleanup function
    }
    this.eventListeners.add(callback)
    return () => this.eventListeners.delete(callback)
  }

  // Emit event to all listeners
  emitEvent(type, data) {
    this.eventListeners.forEach(listener => {
      try {
        if (typeof listener !== 'function') {
          console.warn('Invalid event listener found, removing:', typeof listener)
          this.eventListeners.delete(listener)
          return
        }
        // Defensive type check before calling
        if (typeof listener === 'function') {
        listener({ type, data, timestamp: new Date().toISOString() })
        } else {
          console.warn('emitEvent: listener is not a function, removing from set')
          this.eventListeners.delete(listener)
        }
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
    
    // Remove from our tracking
    this.relayConnections.delete(url)
    this.relayStatuses.delete(url)
    this.connectionPromises.delete(url)
    
    // The pool will handle closing the actual connection
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
    
    // Close the pool with all relay URLs
    const allUrls = Array.from(this.relayStatuses.keys())
    if (allUrls.length > 0) {
      this.pool.close(allUrls)
    }
    
    // Clear all data
    this.relayConnections.clear()
    this.relayStatuses.clear()
    this.connectionPromises.clear()
    this.eventListeners.clear()
    this._activeSubscriptions.clear()
    this._subscriptionQueue.length = 0
    this._eventCache.clear()
    this._relayBackoff.clear()

    this.isInitialized = false
    this._createReadyGate() // Reset for next initialization cycle
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