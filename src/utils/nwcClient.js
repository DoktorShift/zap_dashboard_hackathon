import { nwc } from '@getalby/sdk'

// NWC Client singleton
let nwcClient = null

// List of reliable Nostr relays as fallbacks
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.wine'
]

export function initializeNWC(nwcUrl) {
  // Clear existing client if no URL provided
  if (!nwcUrl) {
    nwcClient = null
    return null
  }
  
  try {
    nwcClient = new nwc.NWCClient({
      nostrWalletConnectUrl: nwcUrl,
      relayUrls: DEFAULT_RELAYS
    })
    console.info('NWC Client initialized successfully with fallback relays')
    return nwcClient
  } catch (error) {
    console.error('Failed to initialize NWC Client:', error)
    nwcClient = null
    throw error
  }
}

export function getNWCClient() {
  return nwcClient
}

export async function fetchTransactions() {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const response = await nwcClient.listTransactions({
      limit: 100,
      timeout: 30000 // 30 seconds timeout
    })
    
    return response.transactions || []
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
    throw error
  }
}

export async function getWalletInfo() {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const info = await nwcClient.getInfo()
    return info
  } catch (error) {
    console.error('Failed to get wallet info:', error)
    throw error
  }
}

export async function getBalance() {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const balance = await nwcClient.getBalance()
    return balance
  } catch (error) {
    console.error('Failed to get balance:', error)
    throw error
  }
}

export async function makeInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const invoice = await nwcClient.makeInvoice({
      amount: params.amount, // Amount in millisats
      description: params.description || '',
      expiry: params.expiry || 3600 // Default 1 hour expiry
    })
    return invoice
  } catch (error) {
    console.error('Failed to create invoice:', error)
    throw error
  }
}

export async function payInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const payment = await nwcClient.payInvoice({
      invoice: params.invoice
    })
    return payment
  } catch (error) {
    console.error('Failed to pay invoice:', error)
    throw error
  }
}

export async function lookupInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const invoice = await nwcClient.lookupInvoice({
      payment_hash: params.payment_hash
    })
    return invoice
  } catch (error) {
    console.error('Failed to lookup invoice:', error)
    throw error
  }
}
