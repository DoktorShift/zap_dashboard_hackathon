import { ref, computed } from 'vue'
import { nostrService } from '../../../services/nostr/NostrService.js'
import { profileService } from '../../../services/nostr/ProfileService.js'
import { nip52 } from '../../../services/nostr/nostrImports.js'
import { getUserFriendlyError } from '../../../services/nostr/errors.js'
import { markStale, markFresh } from '../../core/useStaleness.js'
import { CALENDAR_EVENT_KINDS } from './calendarKinds.js'

/**
 * useCalendarFetch — subscribes to NIP-52 calendar events (kind 31922 /
 * 31923) plus deletion events (kind 5) for the authenticated user.
 * Parses each event into a UI-friendly shape via nip52 helpers with a
 * manual fallback for date-based events (nip52 only ships a time-based
 * parser). Batches participant profile fetches so the UI paints once.
 *
 * Split out of useNostrCalendar so the main composable stays focused
 * on orchestration + CRUD. Module-scoped so events survive route
 * transitions within the session.
 *
 * @param {{
 *   currentUser: import('vue').Ref<{ pubkey?: string } | null>,
 *   isAuthenticated: import('vue').Ref<boolean>,
 *   isLoading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string>,
 *   handleCalendarInvite: (invite: object) => void,
 * }} ctx
 */

const events = ref([])
const processedEventIds = new Set()
let currentSubscription = null

/**
 * Fetch profile metadata for the event organizer, used when dispatching
 * invite notifications. Returns a minimal shape with safe fallbacks.
 */
async function fetchOrganizerProfile(pubkey) {
  try {
    const profile = await profileService.get(pubkey)
    if (!profile) return null
    return {
      name: profile.name || profile.display_name,
      picture: profile.picture,
      nip05: profile.nip05,
    }
  } catch {
    return null
  }
}

/**
 * Transform a raw Nostr calendar event into the UI-consumable shape.
 * Returns null on any parse error so callers can silently skip malformed
 * events without crashing the feed.
 */
async function createEventData(calendarEvent) {
  try {
    const isTimeBased = calendarEvent.kind === CALENDAR_EVENT_KINDS.TIME_BASED

    const eventData = {
      id: calendarEvent.id,
      type: isTimeBased ? 'time-based' : 'date-based',
      pubkey: calendarEvent.pubkey,
      created_at: calendarEvent.created_at,
      participants: [],
      tags: [],
      references: [],
      rawEvent: calendarEvent,
    }

    if (isTimeBased) {
      // nip52 handles time-based parsing — timestamps, tzid, etc.
      const parsed = nip52.parseTimeBasedCalendarEvent(calendarEvent)
      eventData.title = parsed.name || 'Untitled Event'
      eventData.description = parsed.content || calendarEvent.content || ''
      eventData.location = parsed.location || ''
      eventData.geohash = parsed.geohash || ''
      eventData.start = parsed.start ?? null
      eventData.end = parsed.end ?? null
      eventData.start_tzid = parsed.startTzid || ''
      eventData.end_tzid = parsed.endTzid || ''
    } else {
      // Date-based (kind 31922) — all-day event, nip52 doesn't parse it yet,
      // so we read the tags directly. Keep the shape identical to the
      // time-based branch so the UI doesn't need to special-case.
      eventData.title = calendarEvent.tags.find(t => t[0] === 'name')?.[1] || 'Untitled Event'
      eventData.description = calendarEvent.content || ''
      eventData.location = calendarEvent.tags.find(t => t[0] === 'location')?.[1] || ''
      eventData.geohash = calendarEvent.tags.find(t => t[0] === 'g')?.[1] || ''
      eventData.start_date = calendarEvent.tags.find(t => t[0] === 'start')?.[1] ?? null
      eventData.end_date = calendarEvent.tags.find(t => t[0] === 'end')?.[1] ?? null
    }

    // Participants: enrich p-tags with profile data (batched).
    const participantTags = calendarEvent.tags
      .filter(t => t[0] === 'p')
      .map(t => ({ pubkey: t[1], relay: t[2] || '', role: t[3] || '' }))

    if (participantTags.length > 0) {
      const pubkeys = participantTags.map(p => p.pubkey)
      try { await profileService.batch(pubkeys) } catch { /* fall back to bare pubkeys */ }

      eventData.participants = participantTags.map(participant => {
        const profile = profileService.getCached(participant.pubkey)
        return {
          ...participant,
          name: profile?.name,
          picture: profile?.picture,
          nip05: profile?.nip05,
        }
      })
    }

    eventData.tags = calendarEvent.tags.filter(t => t[0] === 't').map(t => t[1])
    eventData.references = calendarEvent.tags.filter(t => t[0] === 'r').map(t => t[1])
    return eventData
  } catch (error) {
    console.error('[useCalendarFetch] Failed to parse event:', error?.message)
    return null
  }
}

export function useCalendarFetch(ctx) {
  const { currentUser, isAuthenticated, isLoading, error, handleCalendarInvite } = ctx

  const userEvents = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) return []
    return events.value.filter(e => e.pubkey === currentUser.value.pubkey)
  })

  // All events (including invites), newest-first. The UI reads this.
  const sortedEvents = computed(() => {
    return [...events.value].sort((a, b) => {
      const timeA = a.type === 'time-based' ? a.start : new Date(a.start_date).getTime() / 1000
      const timeB = b.type === 'time-based' ? b.start : new Date(b.start_date).getTime() / 1000
      return timeB - timeA
    })
  })

  /**
   * Subscribe to the authenticated user's calendar events. Splits the
   * feed into three filters — own-authored, invited-as-participant,
   * and deletions. EOSE-gated so historical invite notifications don't
   * spam the user on every reload; only live arrivals fire the toast.
   */
  const fetchCalendarEvents = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) return

    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useCalendarFetch] Relay manager not ready:', err?.message)
      markStale('calendar', getUserFriendlyError(err))
      return
    }

    isLoading.value = true
    error.value = ''

    const loadingTimeout = setTimeout(() => {
      if (isLoading.value) isLoading.value = false
    }, 5000)

    // EOSE gate: pre-EOSE events hydrate the list silently; post-EOSE
    // arrivals are "live" and fire the invite toast.
    let calendarEosed = false

    try {
      if (currentSubscription) {
        currentSubscription.close()
        currentSubscription = null
      }

      currentSubscription = nostrService.subscribeOutbox([
        {
          kinds: [CALENDAR_EVENT_KINDS.TIME_BASED, CALENDAR_EVENT_KINDS.DATE_BASED],
          authors: [currentUser.value.pubkey],
          limit: 100,
        },
        {
          kinds: [CALENDAR_EVENT_KINDS.TIME_BASED, CALENDAR_EVENT_KINDS.DATE_BASED],
          '#p': [currentUser.value.pubkey],
          limit: 100,
        },
        {
          kinds: [5],
          authors: [currentUser.value.pubkey],
          limit: 100,
        },
      ], {
        onevent: async (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          if (
            event.kind === CALENDAR_EVENT_KINDS.TIME_BASED ||
            event.kind === CALENDAR_EVENT_KINDS.DATE_BASED
          ) {
            const existingIndex = events.value.findIndex(e => e.id === event.id)

            if (existingIndex === -1) {
              const eventData = await createEventData(event)
              if (!eventData) return
              events.value.push(eventData)

              // Fire invite toast only for LIVE arrivals to an event we're
              // invited to (not one we authored). handleCalendarInvite
              // dedupes internally, but skipping pre-EOSE saves noise.
              if (
                calendarEosed &&
                currentUser.value &&
                eventData.pubkey !== currentUser.value.pubkey
              ) {
                const isInvited = eventData.participants?.some(
                  p => p.pubkey === currentUser.value.pubkey
                )
                if (isInvited) {
                  const organizerProfile = await fetchOrganizerProfile(eventData.pubkey)
                  handleCalendarInvite({
                    id: eventData.id,
                    title: eventData.title,
                    start: eventData.start,
                    start_date: eventData.start_date,
                    type: eventData.type,
                    organizer: eventData.pubkey,
                    organizerProfile: organizerProfile || null,
                  })
                }
              }
            } else {
              // Replaceable: newer version supersedes existing entry.
              const eventData = await createEventData(event)
              if (eventData) events.value[existingIndex] = eventData
            }
          } else if (event.kind === 5) {
            const deletedEventIds = event.tags
              .filter(t => t[0] === 'e')
              .map(t => t[1])
            for (const deletedId of deletedEventIds) {
              const idx = events.value.findIndex(e => e.id === deletedId)
              if (idx !== -1) events.value.splice(idx, 1)
            }
          }
        },
        oneose: () => {
          calendarEosed = true
          clearTimeout(loadingTimeout)
          isLoading.value = false
          markFresh('calendar')
          // Close after grace period; refresh cycle re-fetches periodically.
          setTimeout(() => {
            if (currentSubscription) {
              currentSubscription.close()
              currentSubscription = null
            }
          }, 3000)
        },
        onclose: (reason) => {
          clearTimeout(loadingTimeout)
          isLoading.value = false
          if (reason) {
            markStale('calendar', reason)
          }
        },
      })
    } catch (err) {
      clearTimeout(loadingTimeout)
      isLoading.value = false
      markStale('calendar', getUserFriendlyError(err))
      error.value = getUserFriendlyError(err)
      console.error('[useCalendarFetch] fetch failed:', err?.message)
    }
  }

  /** Inject an event into the live list — used after local create/update
   *  so the UI updates instantly without waiting for the relay echo. */
  const upsertEvent = (rawEvent) => {
    const existingIndex = events.value.findIndex(e => e.id === rawEvent.id)
    createEventData(rawEvent).then(data => {
      if (!data) return
      if (existingIndex === -1) {
        processedEventIds.add(rawEvent.id)
        events.value.push(data)
      } else {
        events.value[existingIndex] = data
      }
    })
  }

  /** Remove an event by id (local optimistic delete). */
  const removeEvent = (eventId) => {
    const idx = events.value.findIndex(e => e.id === eventId)
    if (idx !== -1) events.value.splice(idx, 1)
  }

  const cleanupFetch = () => {
    if (currentSubscription) {
      currentSubscription.close()
      currentSubscription = null
    }
    processedEventIds.clear()
    events.value = []
  }

  return {
    events,
    userEvents,
    sortedEvents,
    fetchCalendarEvents,
    upsertEvent,
    removeEvent,
    cleanupFetch,
  }
}
