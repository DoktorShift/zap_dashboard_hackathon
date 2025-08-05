// Professional metrics caching system for ZapTracker
// Handles computation, storage, and retrieval of dashboard metrics

// Storage keys
const METRICS_CACHE_KEY = 'zap_metrics_cache'
const CACHE_VERSION = '1.0'
const MAX_CACHE_ENTRIES = 90 // Keep 90 days of data
const CACHE_EXPIRY_HOURS = 1 // Recalculate if data is older than 1 hour

/**
 * Metrics cache structure:
 * {
 *   version: string,
 *   lastUpdated: string,
 *   entries: {
 *     'YYYY-MM-DD': {
 *       date: string,
 *       totalZaps: number,
 *       totalSats: number,
 *       uniqueSupporters: number,
 *       avgZap: number,
 *       zapCount: number,
 *       calculatedAt: string
 *     }
 *   }
 * }
 */

export class MetricsCache {
  constructor() {
    this.cache = this.loadCache()
  }

  // Load cache from localStorage with version checking
  loadCache() {
    try {
      const stored = localStorage.getItem(METRICS_CACHE_KEY)
      if (!stored) {
        return this.createEmptyCache()
      }

      const parsed = JSON.parse(stored)
      
      // Version check - clear cache if version mismatch
      if (parsed.version !== CACHE_VERSION) {
        console.log('📦 Cache version mismatch, clearing cache')
        return this.createEmptyCache()
      }

      console.log('📦 Loaded metrics cache with', Object.keys(parsed.entries || {}).length, 'entries')
      return parsed
    } catch (error) {
      console.error('❌ Failed to load metrics cache:', error)
      return this.createEmptyCache()
    }
  }

  // Create empty cache structure
  createEmptyCache() {
    return {
      version: CACHE_VERSION,
      lastUpdated: new Date().toISOString(),
      entries: {}
    }
  }

  // Save cache to localStorage
  saveCache() {
    try {
      this.cache.lastUpdated = new Date().toISOString()
      localStorage.setItem(METRICS_CACHE_KEY, JSON.stringify(this.cache))
      console.log('💾 Saved metrics cache with', Object.keys(this.cache.entries).length, 'entries')
    } catch (error) {
      console.error('❌ Failed to save metrics cache:', error)
    }
  }

  // Get date key in YYYY-MM-DD format
  getDateKey(date) {
    return date.toISOString().split('T')[0]
  }

  // Check if cached data is still fresh
  isCacheEntryFresh(entry) {
    if (!entry || !entry.calculatedAt) return false
    
    const calculatedAt = new Date(entry.calculatedAt)
    const now = new Date()
    const hoursDiff = (now - calculatedAt) / (1000 * 60 * 60)
    
    return hoursDiff < CACHE_EXPIRY_HOURS
  }

  // Calculate metrics for a specific date range
  calculateMetricsForPeriod(zaps, startDate, endDate) {
    const startTime = startDate.getTime()
    const endTime = endDate.getTime()
    
    // Filter zaps for the period
    const periodZaps = zaps.filter(zap => {
      if (!zap.timestamp) return false
      const zapTime = new Date(zap.timestamp).getTime()
      return zapTime >= startTime && zapTime <= endTime
    })

    // Calculate metrics
    const totalZaps = periodZaps.length
    const totalSats = periodZaps.reduce((sum, zap) => sum + (zap.amount || 0), 0)
    
    // Calculate unique supporters
    const uniquePubkeys = new Set()
    periodZaps.forEach(zap => {
      const pubkey = zap.sender?.pubkey || zap.zapperPubkey || 'anonymous'
      uniquePubkeys.add(pubkey)
    })
    const uniqueSupporters = uniquePubkeys.size
    
    const avgZap = totalZaps > 0 ? Math.round(totalSats / totalZaps) : 0

    return {
      totalZaps,
      totalSats,
      uniqueSupporters,
      avgZap,
      zapCount: totalZaps
    }
  }

  // Get or calculate metrics for a specific date
  getMetricsForDate(zaps, date) {
    const dateKey = this.getDateKey(date)
    const cachedEntry = this.cache.entries[dateKey]

    // Return cached data if fresh
    if (cachedEntry && this.isCacheEntryFresh(cachedEntry)) {
      console.log(`📦 Using cached metrics for ${dateKey}`)
      return cachedEntry
    }

    // Calculate new metrics
    console.log(`🔄 Calculating fresh metrics for ${dateKey}`)
    
    // Calculate metrics for the entire day
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const metrics = this.calculateMetricsForPeriod(zaps, dayStart, dayEnd)
    
    // Create cache entry
    const cacheEntry = {
      date: dateKey,
      ...metrics,
      calculatedAt: new Date().toISOString()
    }

    // Store in cache
    this.cache.entries[dateKey] = cacheEntry
    this.cleanupOldEntries()
    this.saveCache()

    return cacheEntry
  }

  // Get metrics for a period (e.g., last 30 days)
  getMetricsForPeriod(zaps, days = 30, endDate = new Date()) {
    console.log(`🔄 getMetricsForPeriod called: ${days} days ending ${endDate.toISOString()}`)
    console.log('📊 Input zaps:', zaps.length)
    
    const cacheKey = `period_${days}_${this.getDateKey(endDate)}`
    console.log('🔑 Cache key:', cacheKey)
    
    // Check if we have cached period data
    const cachedPeriod = this.cache.entries[cacheKey]
    if (cachedPeriod && this.isCacheEntryFresh(cachedPeriod)) {
      console.log(`📦 Using cached period metrics for ${days} days ending ${this.getDateKey(endDate)}`)
      return cachedPeriod
    }

    // Calculate period metrics
    console.log(`🔄 Calculating fresh period metrics for ${days} days ending ${this.getDateKey(endDate)}`)
    
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
    console.log('📅 Period range:', {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    })
    
    const metrics = this.calculateMetricsForPeriod(zaps, startDate, endDate)
    console.log('📊 Calculated metrics:', metrics)
    
    // Create cache entry for period
    const cacheEntry = {
      date: cacheKey,
      period: days,
      endDate: this.getDateKey(endDate),
      ...metrics,
      calculatedAt: new Date().toISOString()
    }

    // Store in cache
    this.cache.entries[cacheKey] = cacheEntry
    this.cleanupOldEntries()
    this.saveCache()

    return cacheEntry
  }

  // Get comparison between current and previous periods
  getPeriodComparison(zaps, days = 30) {
    console.log('📊 getPeriodComparison called with:', {
      totalZaps: zaps.length,
      days,
      sampleZap: zaps[0]
    })
    
    const now = new Date()
    
    // Get current period metrics (last X days)
    const currentMetrics = this.getMetricsForPeriod(zaps, days, now)
    console.log('📈 Current period metrics:', currentMetrics)
    
    // Get previous period metrics (X days before that)
    const previousEndDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))
    const previousMetrics = this.getMetricsForPeriod(zaps, days, previousEndDate)
    console.log('📉 Previous period metrics:', previousMetrics)
    
    // Calculate percentage changes
    const changes = {
      totalZaps: this.calculatePercentageChange(currentMetrics.totalZaps, previousMetrics.totalZaps),
      totalSats: this.calculatePercentageChange(currentMetrics.totalSats, previousMetrics.totalSats),
      uniqueSupporters: this.calculatePercentageChange(currentMetrics.uniqueSupporters, previousMetrics.uniqueSupporters),
      avgZap: this.calculatePercentageChange(currentMetrics.avgZap, previousMetrics.avgZap)
    }
    
    console.log('📊 Calculated changes:', changes)

    console.log('📊 Period comparison (cached):', {
      current: currentMetrics,
      previous: previousMetrics,
      changes,
      period: `${days} days`
    })

    return {
      current: currentMetrics,
      previous: previousMetrics,
      changes,
      period: days
    }
  }

  // Calculate percentage change with proper edge case handling
  calculatePercentageChange(current, previous) {
    // Handle edge cases
    if (previous === 0 && current === 0) {
      return { percentage: 0, trend: 'neutral', isNew: false }
    }
    
    if (previous === 0 && current > 0) {
      return { percentage: 100, trend: 'positive', isNew: true }
    }
    
    if (previous > 0 && current === 0) {
      return { percentage: -100, trend: 'negative', isNew: false }
    }
    
    // Calculate normal percentage change
    const percentage = Math.round(((current - previous) / previous) * 100)
    
    // Determine trend
    let trend = 'neutral'
    if (percentage > 0) {
      trend = 'positive'
    } else if (percentage < 0) {
      trend = 'negative'
    }
    
    return { percentage, trend, isNew: false }
  }

  // Clean up old cache entries to prevent storage bloat
  cleanupOldEntries() {
    const entries = Object.keys(this.cache.entries)
    
    if (entries.length <= MAX_CACHE_ENTRIES) {
      return // No cleanup needed
    }

    // Sort entries by date and keep only the most recent
    const sortedEntries = entries
      .filter(key => !key.startsWith('period_')) // Don't clean up period entries
      .sort((a, b) => new Date(b) - new Date(a))
      .slice(MAX_CACHE_ENTRIES)

    // Remove old entries
    const entriesToRemove = entries.filter(key => 
      !sortedEntries.includes(key) && !key.startsWith('period_')
    )

    entriesToRemove.forEach(key => {
      delete this.cache.entries[key]
    })

    if (entriesToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${entriesToRemove.length} old cache entries`)
    }
  }

  // Get cache statistics for debugging
  getCacheStats() {
    const entries = Object.keys(this.cache.entries)
    const dailyEntries = entries.filter(key => !key.startsWith('period_'))
    const periodEntries = entries.filter(key => key.startsWith('period_'))
    
    return {
      totalEntries: entries.length,
      dailyEntries: dailyEntries.length,
      periodEntries: periodEntries.length,
      lastUpdated: this.cache.lastUpdated,
      version: this.cache.version
    }
  }

  // Clear all cached data
  clearCache() {
    this.cache = this.createEmptyCache()
    this.saveCache()
    console.log('🗑️ Cleared all cached metrics')
  }

  // Force recalculation of all metrics
  invalidateCache() {
    // Mark all entries as expired by setting old calculatedAt timestamps
    Object.keys(this.cache.entries).forEach(key => {
      if (this.cache.entries[key]) {
        this.cache.entries[key].calculatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    })
    this.saveCache()
    console.log('♻️ Invalidated all cached metrics')
  }
}

// Export singleton instance
export const metricsCache = new MetricsCache()

// Export utility functions
export const getCachedMetrics = (zaps, days = 30) => metricsCache.getPeriodComparison(zaps, days)
export const clearMetricsCache = () => metricsCache.clearCache()
export const invalidateMetricsCache = () => metricsCache.invalidateCache()
export const getMetricsCacheStats = () => metricsCache.getCacheStats()