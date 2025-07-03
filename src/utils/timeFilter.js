// Centralized time filtering utility for zap data
// This ensures consistent filtering logic across all components

/**
 * Filter zaps by time range
 * @param {Array} zaps - Array of zap objects with timestamp property
 * @param {string} timeRange - Time range filter ('24h', '7d', '30d', 'all')
 * @returns {Array} Filtered array of zaps
 */
export function filterZapsByTimeRange(zaps, timeRange) {
  if (!Array.isArray(zaps) || zaps.length === 0) {
    return []
  }
  
  const now = new Date()
  let cutoffTime
  
  switch (timeRange) {
    case '24h':
      cutoffTime = new Date(now - 24 * 60 * 60 * 1000)
      break
    case '7d':
      cutoffTime = new Date(now - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      cutoffTime = new Date(now - 30 * 24 * 60 * 60 * 1000)
      break
    case 'all':
    default:
      return zaps // Return all zaps for 'all' time range
  }
  
  return zaps.filter(zap => {
    if (!zap.timestamp) return false
    return new Date(zap.timestamp) > cutoffTime
  })
}

/**
 * Get time range display text
 * @param {string} timeRange - Time range filter ('24h', '7d', '30d', 'all')
 * @returns {string} Human-readable time range text
 */
export function getTimeRangeDisplayText(timeRange) {
  switch (timeRange) {
    case '24h':
      return 'last 24 hours'
    case '7d':
      return 'last 7 days'
    case '30d':
      return 'last 30 days'
    case 'all':
    default:
      return 'all time'
  }
}

/**
 * Get short time range display text
 * @param {string} timeRange - Time range filter ('24h', '7d', '30d', 'all')
 * @returns {string} Short time range text
 */
export function getShortTimeRangeText(timeRange) {
  switch (timeRange) {
    case '24h':
      return '24h'
    case '7d':
      return '7d'
    case '30d':
      return '30d'
    case 'all':
    default:
      return 'All'
  }
}