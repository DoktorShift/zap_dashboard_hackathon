/**
 * Shared formatting utilities — single source of truth
 */

/**
 * Format sats with abbreviated suffix (e.g., 1234567 → "1.2M", 12345 → "12.3k", 123 → "123")
 */
export function formatSatsShort(amount) {
  if (!amount) return '0'
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`
  return amount.toLocaleString()
}

/**
 * Format millisats to sats with locale string (e.g., 1234000 → "1,234")
 */
export function formatMsatsToSats(amount) {
  if (!amount) return '0'
  const sats = Math.floor(amount / 1000)
  return sats ? sats.toLocaleString() : '0'
}
