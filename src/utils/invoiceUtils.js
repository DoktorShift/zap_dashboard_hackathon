// Utility functions for basic BOLT11 invoice parsing
// Note: This is a simplified parser for display purposes only

export function parseInvoiceBasic(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return null
  }

  try {
    // Basic BOLT11 invoice structure: ln + network + amount + checksum
    const invoiceLower = invoice.toLowerCase()
    
    // Check if it's a valid Lightning invoice
    if (!invoiceLower.startsWith('lnbc') && !invoiceLower.startsWith('lntb') && !invoiceLower.startsWith('lnbcrt')) {
      return null
    }

    // Extract network
    let network = 'mainnet'
    if (invoiceLower.startsWith('lntb')) {
      network = 'testnet'
    } else if (invoiceLower.startsWith('lnbcrt')) {
      network = 'regtest'
    }

    // Extract amount (simplified - this is not a complete implementation)
    let amount = null
    let amountUnit = 'sats'
    
    // Look for amount pattern after network prefix
    const amountMatch = invoiceLower.match(/^ln[a-z]+(\d+)([munp]?)/)
    if (amountMatch) {
      const amountValue = parseInt(amountMatch[1])
      const unit = amountMatch[2]
      
      // Convert to sats based on unit
      switch (unit) {
        case 'm': // milli-bitcoin (0.001 BTC)
          amount = amountValue * 100000 // 100,000 sats per mBTC
          break
        case 'u': // micro-bitcoin (0.000001 BTC)
          amount = amountValue * 100 // 100 sats per μBTC
          break
        case 'n': // nano-bitcoin (0.000000001 BTC)
          amount = Math.round(amountValue * 0.1) // 0.1 sats per nBTC
          break
        case 'p': // pico-bitcoin (0.000000000001 BTC)
          amount = Math.round(amountValue * 0.0001) // 0.0001 sats per pBTC
          break
        default:
          // No unit means the amount is in the smallest unit (millisatoshis for mainnet)
          amount = Math.floor(amountValue / 1000) // Convert msats to sats
      }
    }

    // Extract timestamp (simplified)
    const timestampMatch = invoice.match(/(\d{10})/)
    let timestamp = null
    if (timestampMatch) {
      timestamp = new Date(parseInt(timestampMatch[1]) * 1000)
    }

    return {
      network,
      amount,
      amountUnit,
      timestamp,
      raw: invoice,
      isValid: true
    }
  } catch (error) {
    console.warn('Failed to parse invoice:', error)
    return null
  }
}

export function formatInvoiceAmount(amount) {
  if (!amount || amount === 0) return '0 sats'
  
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)} BTC`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k sats`
  } else {
    return `${amount.toLocaleString()} sats`
  }
}

export function validateInvoice(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return { isValid: false, error: 'Invalid invoice format' }
  }

  const invoiceLower = invoice.toLowerCase()
  
  if (!invoiceLower.startsWith('ln')) {
    return { isValid: false, error: 'Invoice must start with "ln"' }
  }

  if (invoice.length < 50) {
    return { isValid: false, error: 'Invoice too short' }
  }

  if (invoice.length > 2000) {
    return { isValid: false, error: 'Invoice too long' }
  }

  return { isValid: true }
}

export function truncateInvoice(invoice, maxLength = 50) {
  if (!invoice) return ''
  if (invoice.length <= maxLength) return invoice
  
  const start = Math.floor(maxLength / 2) - 2
  const end = Math.floor(maxLength / 2) - 2
  
  return `${invoice.substring(0, start)}...${invoice.substring(invoice.length - end)}`
}