/**
 * Typed error classes for the Nostr service layer.
 *
 * Services throw these; composables catch and set user-friendly error refs.
 */

export class RelayError extends Error {
  constructor(message, relay = null, code = 'RELAY_ERROR') {
    super(message)
    this.name = 'RelayError'
    this.relay = relay
    this.code = code
  }
}

export class SignerError extends Error {
  constructor(message, code = 'SIGNER_ERROR') {
    super(message)
    this.name = 'SignerError'
    this.code = code
  }
}

export class SubscriptionError extends Error {
  constructor(message, filter = null, code = 'SUBSCRIPTION_ERROR') {
    super(message)
    this.name = 'SubscriptionError'
    this.filter = filter
    this.code = code
  }
}

/**
 * Map any error to a user-friendly message string.
 */
export function getUserFriendlyError(error) {
  if (!error) return 'An unexpected error occurred.'
  if (error instanceof RelayError) {
    if (error.code === 'NO_RELAYS') return 'No relays available. Check your connection settings.'
    if (error.code === 'PUBLISH_FAILED') return 'Failed to publish. Please try again.'
    return `Relay error: ${error.message}`
  }
  if (error instanceof SignerError) {
    if (error.code === 'NO_EXTENSION') return 'No Nostr extension found. Please install Alby or nos2x.'
    if (error.code === 'SIGN_REJECTED') return 'Signing was rejected by your extension.'
    return `Signer error: ${error.message}`
  }
  if (error instanceof SubscriptionError) {
    return 'Failed to load data from relays. Please try refreshing.'
  }
  if (error.message?.includes('timeout')) return 'Request timed out. Please try again.'
  if (error.message?.includes('rate')) return 'Rate limited. Please wait a moment.'
  return error.message || 'An unexpected error occurred.'
}
