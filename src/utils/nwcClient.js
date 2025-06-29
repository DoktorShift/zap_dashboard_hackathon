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
      type: 'incoming' // Only fetch incoming zaps
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