import { NOTIFICATION_TYPES } from './types.js'

// Resolve the in-app navigation target for a notification.
// Returns { page, tab?, query? } consumed by App.vue's `changePage(page, tab, { query })`,
// or null if the notification has no meaningful destination.
//
// Keeping this as a pure function (no imports of router/state) makes it trivially
// testable and keeps UI components ignorant of routing details.
export function resolveAction(notification) {
  if (!notification) return null
  const type = notification.type
  const data = notification.data || {}

  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR:
      // Prefer campaign deeplink if we know the content is a campaign
      if (data.campaignEventId) {
        return { page: 'campaign-view', query: { eventId: data.campaignEventId } }
      }
      // Otherwise land on the zap feed where the user reviews incoming zaps
      return { page: 'zap-feed' }

    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC:
    case NOTIFICATION_TYPES.ZAP_SENT:
    case NOTIFICATION_TYPES.BALANCE_CHANGE:
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
    case NOTIFICATION_TYPES.PAYMENT_ERROR:
    case NOTIFICATION_TYPES.WALLET_ERROR:
      return { page: 'wallet' }

    case NOTIFICATION_TYPES.CALENDAR_INVITE:
    case NOTIFICATION_TYPES.CALENDAR_EVENT_START:
      return { page: 'calendar', query: { eventId: data.eventId } }

    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.CONNECTION_ERROR:
      return { page: 'settings', tab: 'wallets' }

    default:
      return null
  }
}
