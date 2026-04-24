// Single source of truth for notification type identifiers.
// Imported by the composable and all UI surfaces so renaming happens in one place.

export const NOTIFICATION_TYPES = Object.freeze({
  ZAP_RECEIVED_NWC: 'zap_received_nwc',
  ZAP_RECEIVED_NOSTR: 'zap_received_nostr',
  ZAP_SENT: 'zap_sent',
  BALANCE_CHANGE: 'balance_change',
  CONNECTION_SUCCESS: 'connection_success',
  CONNECTION_ERROR: 'connection_error',
  WALLET_ERROR: 'wallet_error',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_ERROR: 'payment_error',
  CALENDAR_INVITE: 'calendar_invite',
  CALENDAR_EVENT_START: 'calendar_event_start',
})

export const ZAP_TYPES = Object.freeze([
  NOTIFICATION_TYPES.ZAP_RECEIVED_NWC,
  NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR,
  NOTIFICATION_TYPES.ZAP_SENT,
])

export const CALENDAR_TYPES = Object.freeze([
  NOTIFICATION_TYPES.CALENDAR_INVITE,
  NOTIFICATION_TYPES.CALENDAR_EVENT_START,
])

export const ERROR_TYPES = Object.freeze([
  NOTIFICATION_TYPES.CONNECTION_ERROR,
  NOTIFICATION_TYPES.WALLET_ERROR,
  NOTIFICATION_TYPES.PAYMENT_ERROR,
])
