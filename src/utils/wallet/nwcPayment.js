import { NWC } from 'nostr-core'
import { SimplePool } from 'nostr-tools/pool'
import { makeZapRequest, getZapEndpoint } from 'nostr-tools/nip57'
import { LongFormArticle } from 'nostr-tools/kinds'

// Relays configuration
const RELAYS = ['wss://relay.damus.io', 'wss://nostr.mom', 'wss://nos.lol']

export class NWCPaymentHandler {
  constructor() {
    this.pool = new SimplePool()
    this.nwcClient = null
  }

  // Initialize NWC client with NWC URL
  async initialize(nwcUrl) {
    try {
      this.nwcClient = new NWC(nwcUrl)
      await this.nwcClient.connect()
      console.log('NWC client initialized')
      return true
    } catch (error) {
      console.error('Failed to initialize NWC client:', error)
      throw error
    }
  }

  // Get publisher's Zap endpoint
  async getZapEndpoint(publisherPubkey) {
    try {
      // Fetch publisher's profile metadata
      const metadata = await this.pool.get(RELAYS, {
        kinds: [0],
        authors: [publisherPubkey],
        limit: 1
      })

      if (!metadata) {
        throw new Error('Publisher profile not found')
      }

      // Get Zap endpoint from metadata
      const zapEndpoint = await getZapEndpoint(metadata)
      if (!zapEndpoint) {
        throw new Error('Publisher does not have a Zap endpoint configured')
      }

      return zapEndpoint
    } catch (error) {
      console.error('Failed to get Zap endpoint:', error)
      throw error
    }
  }

  // Create Zap Request event
  createZapRequest(articleEvent, amountSats, comment = '') {
    try {
      const publisherPubkey = articleEvent.pubkey

      const zapRequest = makeZapRequest({
        profile: publisherPubkey,
        event: articleEvent,
        amount: amountSats * 1000, // Convert to millisats
        relays: RELAYS,
        comment: comment
      })

      return zapRequest
    } catch (error) {
      console.error('Failed to create Zap request:', error)
      throw error
    }
  }

  // Request payment invoice from Zap endpoint
  async requestInvoice(zapEndpoint, zapRequest) {
    try {
      const response = await fetch(zapEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zap_request: JSON.stringify(zapRequest)
        })
      })

      if (!response.ok) {
        throw new Error(`Zap endpoint returned ${response.status}`)
      }

      const data = await response.json()

      if (!data.pr) {
        throw new Error('No payment request in response')
      }

      return {
        invoice: data.pr,
        amount: data.amount,
        description: data.description
      }
    } catch (error) {
      console.error('Failed to request invoice:', error)
      throw error
    }
  }

  // Pay invoice using NWC
  async payInvoice(invoice) {
    if (!this.nwcClient) {
      throw new Error('NWC client not initialized')
    }

    try {
      const result = await this.nwcClient.payInvoice(invoice)
      return {
        success: true,
        preimage: result.preimage
      }
    } catch (error) {
      console.error('Failed to pay invoice:', error)
      throw error
    }
  }

  // Complete payment flow for content unlock
  async unlockContent(articleEvent, nwcUrl, amountSats, comment = '') {
    try {
      // Initialize NWC client
      await this.initialize(nwcUrl)

      // Get publisher's Zap endpoint
      const zapEndpoint = await this.getZapEndpoint(articleEvent.pubkey)

      // Create Zap request
      const zapRequest = this.createZapRequest(articleEvent, amountSats, comment)

      // Request invoice from Zap endpoint
      const invoiceData = await this.requestInvoice(zapEndpoint, zapRequest)

      // Pay the invoice
      const paymentResult = await this.payInvoice(invoiceData.invoice)

      return {
        success: true,
        invoice: invoiceData.invoice,
        amount: invoiceData.amount,
        preimage: paymentResult.preimage
      }
    } catch (error) {
      console.error('Content unlock failed:', error)
      throw error
    } finally {
      // Clean up
      this.close()
    }
  }

  // Close connections
  close() {
    if (this.nwcClient) {
      this.nwcClient.close()
      this.nwcClient = null
    }
    this.pool.close(RELAYS)
  }
}

// Export singleton instance
export const nwcPaymentHandler = new NWCPaymentHandler()
