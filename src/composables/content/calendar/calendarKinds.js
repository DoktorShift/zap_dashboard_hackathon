/**
 * NIP-52 calendar event kinds — single source of truth shared between
 * the main calendar composable, the (future) RSVP sub-composable, and
 * any page-level code that needs to filter or construct calendar
 * events without pulling the full useNostrCalendar orchestrator.
 */
export const CALENDAR_EVENT_KINDS = Object.freeze({
  /** All-day event (start/end are date strings). */
  DATE_BASED: 31922,
  /** Event with specific start/end timestamps. */
  TIME_BASED: 31923,
  /** Calendar collection (groups multiple events). */
  CALENDAR: 31924,
  /** Response to an event invitation. */
  RSVP: 31925,
})
