/**
 * WalletService — NWC wallet abstraction.
 *
 * Wraps the existing nwcClient.js with a clean service API.
 * Phase 1: delegates to existing nwcClient functions.
 * Phase 3+: uses nostr-core NWC directly with improved error handling.
 */

import {
  initializeNWC, closeNWC, getNWCClient,
  fetchTransactions, getWalletInfo, getBalance,
  makeInvoice, payInvoice, lookupInvoice,
  payLightningAddress, isLightningAddress, stripLightningPrefix,
  getUserFriendlyError
} from '../../utils/wallet/nwcClient.js'

class WalletService {

  // ── Connection ──────────────────────────────────────────────────

  /**
   * Connect to a wallet via NWC URL.
   * @param {string} nwcUrl — nostr+walletconnect:// URL
   * @returns {Promise<object>} NWC client instance
   */
  async connect(nwcUrl) {
    if (!nwcUrl) {
      this.disconnect()
      return null
    }
    return initializeNWC(nwcUrl)
  }

  /**
   * Disconnect the active wallet.
   */
  disconnect() {
    closeNWC()
  }

  /**
   * Check if a wallet is currently connected.
   */
  get isConnected() {
    return getNWCClient() !== null
  }

  // ── Wallet Info ─────────────────────────────────────────────────

  async getInfo(retries = 3) {
    return getWalletInfo(retries)
  }

  async getBalance(retries = 3) {
    return getBalance(retries)
  }

  // ── Transactions ────────────────────────────────────────────────

  async listTransactions(retries = 3) {
    return fetchTransactions(retries)
  }

  // ── Payments ────────────────────────────────────────────────────

  async payInvoice(invoice) {
    return payInvoice({ invoice })
  }

  async payLightningAddress(address, amountSats) {
    return payLightningAddress(address, amountSats)
  }

  async makeInvoice(params) {
    return makeInvoice(params)
  }

  async lookupInvoice(params) {
    return lookupInvoice(params)
  }
}

// ── Static utilities (no instance needed) ─────────────────────────
export { isLightningAddress, stripLightningPrefix, getUserFriendlyError }

// Singleton
export const walletService = new WalletService()
