import { ref, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { useNotifications } from '../core/useNotifications.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { nip52 } from '../../services/nostr/nostrImports.js'
import { CALENDAR_EVENT_KINDS } from './calendar/calendarKinds.js'
import { useCalendarForm } from './calendar/useCalendarForm.js'
import { useCalendarRSVP } from './calendar/useCalendarRSVP.js'
import { useCalendarFetch } from './calendar/useCalendarFetch.js'

// Calendar orchestrator — CRUD (publish/update/delete) + lifecycle
// wiring. All heavy subsystems live in ./calendar/:
// - Form + view state:    useCalendarForm
// - RSVP publish/fetch:   useCalendarRSVP
// - Event fetch + parse:  useCalendarFetch
// - Shared constants:     calendarKinds

const isLoading = ref(false)
const error = ref('')

export function useNostrCalendar() {
  const { currentUser, isAuthenticated } = useNostrAuth()
  const { handleCalendarInvite, startEventMonitoring, stopEventMonitoring } = useNotifications()

  // Form + view state — delegated composable; passes our `error` ref
  // so view transitions clear any lingering error message.
  const {
    eventForm, currentView, selectedEvent, editingEvent,
    setView, viewEvent, editEvent, createNewEvent,
  } = useCalendarForm(error)

  // Event fetch/parse subsystem owns `events` state, subscription,
  // processed-id dedupe, sorted/userEvents computeds, and the invite
  // toast gating. Exposes upsertEvent/removeEvent for optimistic UI
  // updates after CRUD.
  const {
    events,
    userEvents,
    sortedEvents,
    fetchCalendarEvents,
    upsertEvent,
    removeEvent,
    cleanupFetch,
  } = useCalendarFetch({ currentUser, isAuthenticated, isLoading, error, handleCalendarInvite })

  // RSVP subsystem — shares the `events` ref so getEventRSVPs/getUserRSVP
  // can map an event id back to its d-tag. Owns its own subscription
  // + processed-id set + rsvps ref.
  const {
    rsvps,
    createRSVP,
    fetchRSVPs,
    getEventRSVPs,
    getUserRSVP,
    cleanupRSVP,
  } = useCalendarRSVP({ currentUser, events, isLoading, error })

  // Create calendar event
  const createEvent = async (eventData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!eventData.title.trim()) {
      throw new Error('Event title is required')
    }

    isLoading.value = true
    error.value = ''

    try {
      const isTimeBased = eventData.type === 'time-based'
      const dTag = Date.now().toString() // UUID/identifier for replaceable events

      let eventTemplate

      if (isTimeBased) {
        // Build nip52 time-based event input
        const nip52Input = {
          identifier: dTag,
          name: eventData.title.trim(),
          content: eventData.description.trim(),
        }

        if (eventData.start_date && eventData.start_time) {
          const startDateTime = new Date(`${eventData.start_date}T${eventData.start_time}`)
          nip52Input.start = Math.floor(startDateTime.getTime() / 1000)
        }

        if (eventData.end_date && eventData.end_time) {
          const endDateTime = new Date(`${eventData.end_date}T${eventData.end_time}`)
          nip52Input.end = Math.floor(endDateTime.getTime() / 1000)
        }

        if (eventData.start_tzid?.trim()) {
          nip52Input.startTzid = eventData.start_tzid.trim()
        }
        if (eventData.end_tzid?.trim()) {
          nip52Input.endTzid = eventData.end_tzid.trim()
        }
        if (eventData.location?.trim()) {
          nip52Input.location = eventData.location.trim()
        }
        if (eventData.geohash?.trim()) {
          nip52Input.geohash = eventData.geohash.trim()
        }

        // Build participants array for nip52
        if (Array.isArray(eventData.participants) && eventData.participants.length > 0) {
          nip52Input.participants = eventData.participants
            .map(p => {
              if (typeof p === 'string' && p.trim()) return { pubkey: p.trim() }
              if (p?.pubkey?.trim()) return { pubkey: p.pubkey.trim(), relay: p.relay?.trim() || '', role: p.role?.trim() || '' }
              return null
            })
            .filter(Boolean)
        }

        if (Array.isArray(eventData.tags) && eventData.tags.length > 0) {
          nip52Input.hashtags = eventData.tags.filter(t => t?.trim()).map(t => t.trim())
        }

        if (Array.isArray(eventData.references) && eventData.references.length > 0) {
          nip52Input.references = eventData.references.filter(r => r?.trim()).map(r => r.trim())
        }

        eventTemplate = nip52.createTimeBasedCalendarEventTemplate(nip52Input)
      } else {
        // Date-based event (kind 31922) — nip52 only covers time-based, build manually
        const kind = CALENDAR_EVENT_KINDS.DATE_BASED
        let tags = [
          ['d', dTag],
          ['name', eventData.title.trim()]
        ]

        if (eventData.start_date) {
          tags.push(['start', eventData.start_date])
        }
        if (eventData.end_date) {
          tags.push(['end', eventData.end_date])
        }
        if (eventData.location?.trim()) {
          tags.push(['location', eventData.location.trim()])
        }
        if (eventData.geohash?.trim()) {
          tags.push(['g', eventData.geohash.trim()])
        }

        // Add participant tags with optional relay and role
        if (Array.isArray(eventData.participants)) {
          eventData.participants.forEach(participant => {
            if (typeof participant === 'string' && participant.trim()) {
              tags.push(['p', participant.trim()])
            } else if (participant?.pubkey?.trim()) {
              const pTag = ['p', participant.pubkey.trim()]
              if (participant.relay?.trim()) {
                pTag.push(participant.relay.trim())
              }
              if (participant.role?.trim()) {
                if (pTag.length === 2) pTag.push('')
                pTag.push(participant.role.trim())
              }
              tags.push(pTag)
            }
          })
        }

        if (Array.isArray(eventData.tags)) {
          eventData.tags.forEach(tag => {
            if (tag?.trim()) {
              tags.push(['t', tag.trim()])
            }
          })
        }

        if (Array.isArray(eventData.references)) {
          eventData.references.forEach(ref => {
            if (ref?.trim()) {
              tags.push(['r', ref.trim()])
            }
          })
        }

        eventTemplate = {
          kind,
          created_at: Math.floor(Date.now() / 1000),
          tags,
          content: eventData.description.trim()
        }
      }

      // Sign and publish to Nostr relays
      const { event: signedEvent, result } = await publishService.signAndPublish(eventTemplate)

      // Optimistic UI update — inject the new event into the fetch
      // subsystem's list so the user sees it immediately (before the
      // relay round-trip on their own subscription).
      upsertEvent(signedEvent)

      // Reset form to a clean slate after successful publish.
      Object.assign(eventForm, {
        title: '',
        description: '',
        type: 'time-based',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        start_tzid: '',
        end_tzid: '',
        location: '',
        geohash: '',
        participants: [],
        tags: [],
        references: []
      })

      return {
        event: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('❌ Calendar event creation error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update calendar event (creates new event and deletes old one)
  const updateEvent = async (eventId, newEventData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    try {
      // Create new event
      const result = await createEvent(newEventData)
      
      // Delete old event
      await deleteEvent(eventId)
      
      return result
    } catch (err) {
      error.value = getUserFriendlyError(err)
      throw err
    }
  }

  // Delete calendar event
  const deleteEvent = async (eventId) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    try {
      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', eventId]],
        content: 'Calendar event deleted'
      }

      // Sign and publish deletion event
      const { event: signedEvent, result } = await publishService.signAndPublish(deletionEvent)

      if (result.successful > 0) {
        // Optimistic local removal — the live subscription will eventually
        // confirm via a kind:5 event, but the user should see the item
        // disappear instantly.
        removeEvent(eventId)
      }

      return result

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('[useNostrCalendar] deletion failed:', err?.message)
      throw err
    }
  }

  // Cleanup — delegates to the subsystem composables. Called from the
  // auth-change watcher on logout so both the events + RSVP subs close
  // cleanly.
  const cleanup = () => {
    cleanupFetch()
    cleanupRSVP()
  }

  // Initialize + tear down on auth change. Fetch/RSVP state is owned
  // by the sub-composables; the orchestrator just orchestrates.
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      // fetchCalendarEvents awaits nostrService.ready() internally and
      // marks stale/fresh via the useStaleness push API — no need to
      // duplicate that instrumentation here.
      fetchCalendarEvents()
      registerRefresh('calendar', async () => {
        await fetchCalendarEvents()
      }, 'calendar')
    } else {
      cleanup()
      unregisterRefresh('calendar')
    }
  }, { immediate: true })

  // Watch authentication status to start/stop monitoring
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      startEventMonitoring(() => events.value)
    } else {
      stopEventMonitoring()
    }
  }, { immediate: true })

  return {
    // State
    events: sortedEvents,
    rsvps,
    eventForm,
    currentView,
    selectedEvent,
    editingEvent,
    isLoading,
    error,

    // Actions
    fetchCalendarEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    cleanup,
    
    // RSVP Actions
    createRSVP,
    fetchRSVPs,
    getEventRSVPs,
    getUserRSVP,
    
    // View management
    setView,
    viewEvent,
    editEvent,
    createNewEvent,
    
    // Constants
    CALENDAR_EVENT_KINDS
  }
}