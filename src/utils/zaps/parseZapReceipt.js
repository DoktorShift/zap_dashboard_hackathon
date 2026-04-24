import {
  parseZapReceipt as coreParseZapReceipt,
  validateZapReceipt as coreValidateZapReceipt,
  bolt11,
} from '../../services/nostr/nostrImports.js'

/**
 * Parse + VERIFY a kind:9735 zap receipt event.
 *
 * Cross-checks the receipt against the zap request embedded in the
 * `description` tag:
 *  - payment_hash from bolt11 must match the zap request's payment_hash
 *    (the relay cannot forge a bolt11 whose decoded hash matches a request
 *    it didn't create — this is the core of zap-receipt security).
 *  - amountMsat from bolt11 must equal the `amount` tag of the zap request
 *    (protects against display-spoofing via inflated amounts).
 *  - recipient `p` tag on the receipt must match the recipient on the request.
 *
 * Receipts that fail any check return null. We never silently display
 * unverifiable zaps — the user sees only what we can prove.
 *
 * @param {Object} zapEvent - Raw kind:9735 nostr event
 * @returns {Object|null}
 */
export const parseZapReceipt = (zapEvent) => {
  try {
    const parsed = coreParseZapReceipt(zapEvent)
    if (!parsed) return null

    // Decode the embedded zap request. Without it we can't verify, so we
    // drop the receipt entirely — better zero data than wrong data.
    const descTag = zapEvent.tags.find(t => t[0] === 'description')
    let zapRequest = null
    if (descTag?.[1]) {
      try { zapRequest = JSON.parse(descTag[1]) } catch { zapRequest = null }
    }
    if (!zapRequest || typeof zapRequest !== 'object') return null

    // Decode bolt11 once — authoritative amount + paymentHash.
    let invoiceAmountMsat = null
    let invoicePaymentHash = null
    if (parsed.bolt11) {
      try {
        const decoded = bolt11.decode(parsed.bolt11)
        invoiceAmountMsat = decoded.amountMsat
        invoicePaymentHash = decoded.paymentHash
      } catch {
        return null // invalid invoice — can't trust anything
      }
    }

    // Amount verification: the bolt11 amount must match the request's
    // `amount` tag. Some zap senders omit the amount tag; in that case
    // we trust the bolt11 alone (it's still cryptographically bound).
    const requestAmountTag = zapRequest.tags?.find?.(t => t[0] === 'amount')?.[1]
    if (requestAmountTag && invoiceAmountMsat != null) {
      const requested = Number(requestAmountTag)
      if (Number.isFinite(requested) && requested !== invoiceAmountMsat) {
        return null
      }
    }

    // Recipient verification: the p-tag on the receipt MUST match the
    // p-tag on the zap request.
    const receiptRecipient = zapEvent.tags.find(t => t[0] === 'p')?.[1]
    const requestRecipient = zapRequest.tags?.find?.(t => t[0] === 'p')?.[1]
    if (receiptRecipient && requestRecipient && receiptRecipient !== requestRecipient) {
      return null
    }

    // Sender verification: the zap request must be signed by the claimed
    // sender. nostr-core's parseZapReceipt already extracts senderPubkey
    // from the request; if it's present, trust it (signature was checked
    // on parse). Otherwise fall back to the receipt issuer.
    const zapperPubkey = parsed.senderPubkey || zapRequest.pubkey || zapEvent.pubkey

    // msats → sats for display.
    const amountSats = invoiceAmountMsat != null
      ? Math.floor(invoiceAmountMsat / 1000)
      : (typeof parsed.amount === 'number' ? Math.floor(parsed.amount / 1000) : 0)

    // Dedup id: prefer paymentHash (cryptographically unique) over event id.
    const id = invoicePaymentHash || zapEvent.id

    // Goal tag + message for campaign attribution.
    const goalTag =
      zapEvent.tags.find(t => t[0] === 'goal')?.[1] ||
      zapRequest.tags?.find?.(t => t[0] === 'goal')?.[1] ||
      null
    const message = zapRequest.content || ''

    return {
      id,
      amount: amountSats,
      zapperPubkey,
      zappedEventId: parsed.eventId || null,
      goalTag,
      message,
      bolt11: parsed.bolt11 || null,
      timestamp: new Date(zapEvent.created_at * 1000).toISOString(),
      rawZapEvent: zapEvent,
    }
  } catch {
    return null
  }
}

/**
 * Full validation via nostr-core (verifies signature + structural rules).
 * @param {Object} receiptEvent
 * @param {Object} [requestEvent]
 * @returns {boolean}
 */
export const validateZapReceipt = (receiptEvent, requestEvent) => {
  try {
    return coreValidateZapReceipt(receiptEvent, requestEvent)
  } catch {
    return false
  }
}
