import { NOTIFICATION_TYPES } from './types.js'

// Derive a deterministic, stable dedupe key from a notification's type + payload.
// Same underlying event → same key, regardless of how many times it's replayed
// by a Nostr relay, a poll loop, or a page reload.
//
// Falls back to a second-resolution timestamp bucket so that even bare success/error
// notifications can't spam the tray on rapid repeats, while still permitting the
// user to intentionally retry minutes later.
export function dedupeKeyFor(type, data = {}) {
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC:
      // Lightning payment hash is globally unique per invoice
      return data.paymentHash ? `nwc:${data.paymentHash}` : null

    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR:
      // Nostr zap receipt id (kind 9735 event id) is globally unique
      return data.paymentHash || data.zapId
        ? `nostr-zap:${data.paymentHash || data.zapId}`
        : null

    case NOTIFICATION_TYPES.ZAP_SENT:
      return data.paymentHash
        ? `zap-sent:${data.paymentHash}`
        : `zap-sent:${data.amount}:${bucketSeconds(data.timestamp, 2)}`

    case NOTIFICATION_TYPES.BALANCE_CHANGE:
      return `balance:${data.connectionId || 'default'}:${data.oldBalance}:${data.newBalance}`

    case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
      return data.paymentHash
        ? `pay-ok:${data.paymentHash}`
        : `pay-ok:${bucketSeconds(data.timestamp, 2)}`

    case NOTIFICATION_TYPES.PAYMENT_ERROR:
    case NOTIFICATION_TYPES.WALLET_ERROR:
      // Coalesce identical back-to-back errors within a 10s window
      return `err:${type}:${data.errorMessage || 'unknown'}:${bucketSeconds(data.timestamp, 10)}`

    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
      return `conn-ok:${data.connectionId || data.connectionName}:${bucketSeconds(data.timestamp, 5)}`

    case NOTIFICATION_TYPES.CONNECTION_ERROR:
      return `conn-err:${data.errorMessage || 'unknown'}:${bucketSeconds(data.timestamp, 10)}`

    case NOTIFICATION_TYPES.CALENDAR_INVITE:
      return data.eventId ? `cal-invite:${data.eventId}` : null

    case NOTIFICATION_TYPES.CALENDAR_EVENT_START:
      return data.eventId ? `cal-start:${data.eventId}` : null

    default:
      return null
  }
}

// Bucket a timestamp to a coarser resolution so "essentially the same moment"
// hashes identically. Returns a number keyed to the bucket boundary.
function bucketSeconds(timestamp, bucketSeconds) {
  const ms = typeof timestamp === 'number'
    ? timestamp
    : timestamp
      ? new Date(timestamp).getTime()
      : Date.now()
  return Math.floor(ms / (bucketSeconds * 1000))
}
