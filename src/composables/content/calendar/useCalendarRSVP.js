import { ref } from 'vue'
import { nostrService } from '../../../services/nostr/NostrService.js'
import { publishService } from '../../../services/nostr/PublishService.js'
import { profileService } from '../../../services/nostr/ProfileService.js'
import { signerService } from '../../../services/nostr/SignerService.js'
import { nip52 } from '../../../services/nostr/nostrImports.js'
import { getUserFriendlyError } from '../../../services/nostr/errors.js'
import { CALENDAR_EVENT_KINDS } from './calendarKinds.js'

/**
 * useCalendarRSVP — publishing, subscribing, and looking up NIP-52
 * calendar event RSVPs (kind 31925). Split out of useNostrCalendar for
 * maintainability — the RSVP subsystem is ~250 lines and has distinct
 * state (`rsvps`, `rsvpSubscription`, `processedRsvpIds`) from the
 * event-fetch path.
 *
 * Usage — called from inside useNostrCalendar with a context object
 * holding shared refs. The RSVP state lives module-scoped so RSVPs
 * persist across component instances within the same session.
 *
 * @param {{
 *   currentUser: import('vue').Ref<{ pubkey?: string } | null>,
 *   events: import('vue').Ref<Array<{ id: string, rawEvent?: object }>>,
 *   isLoading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string>,
 * }} ctx
 */

const rsvps = ref([])
const processedRsvpIds = new Set()
let rsvpSubscription = null

export function useCalendarRSVP(ctx) {
  const { currentUser, events, isLoading, error } = ctx

  /**
   * Publish a kind:31925 RSVP for a calendar event.
   * @param {string} eventId — the target event's d-tag
   * @param {number} eventKind — kind of the target event (31922/31923)
   * @param {string} eventAuthor — pubkey of the event author
   * @param {'accepted'|'declined'|'tentative'} status
   * @param {'free'|'busy'|null} freebusy — optional availability
   * @param {string} [note]
   */
  const createRSVP = async (eventId, eventKind, eventAuthor, status, freebusy, note = '') => {
    if (!currentUser.value?.pubkey || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }
    if (!['accepted', 'declined', 'tentative'].includes(status)) {
      throw new Error('Invalid RSVP status. Must be accepted, declined, or tentative')
    }
    if (freebusy && !['free', 'busy'].includes(freebusy)) {
      throw new Error('Invalid freebusy status. Must be free or busy')
    }

    isLoading.value = true
    error.value = ''

    try {
      const rsvpInput = {
        identifier: Date.now().toString(),
        eventAddress: `${eventKind}:${eventAuthor}:${eventId}`,
        status,
        content: note.trim(),
      }
      // Freebusy only meaningful when the user isn't declining.
      if (freebusy && status !== 'declined') {
        rsvpInput.freebusy = freebusy
      }

      const rsvpEvent = nip52.createCalendarEventRSVPTemplate(rsvpInput)
      const { event: signedEvent, result } = await publishService.signAndPublish(rsvpEvent)

      const rsvpData = {
        id: signedEvent.id,
        eventId,
        eventKind,
        eventAuthor,
        pubkey: currentUser.value.pubkey,
        status,
        freebusy: freebusy || null,
        note: note.trim(),
        created_at: signedEvent.created_at,
      }

      const existingIndex = rsvps.value.findIndex(r => r.id === signedEvent.id)
      if (existingIndex === -1) {
        processedRsvpIds.add(signedEvent.id)
        rsvps.value.push(rsvpData)
      }

      return {
        rsvp: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed,
      }
    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('[useCalendarRSVP] create failed:', err?.message)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Subscribe to RSVPs for the user + their authored events. Opens ONE
   * outbox subscription; EOSE closes it after a 3s grace for late
   * arrivals. Profile metadata for each RSVP author is batched after
   * EOSE so the UI paints once with full data.
   */
  const fetchRSVPs = async () => {
    if (!currentUser.value?.pubkey) return

    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useCalendarRSVP] Relay manager not ready:', err?.message)
      return
    }

    try {
      const filters = [
        // RSVPs I published (outbox-routed).
        {
          kinds: [CALENDAR_EVENT_KINDS.RSVP],
          authors: [currentUser.value.pubkey],
          limit: 100,
        },
      ]

      // RSVPs on MY events (identified by their NIP-33 address coord).
      if (events.value.length > 0) {
        const eventIdentifiers = events.value
          .filter(e => e.rawEvent)
          .map(e => {
            const dTag = e.rawEvent.tags.find(tag => tag[0] === 'd')?.[1]
            return dTag ? `${e.rawEvent.kind}:${e.rawEvent.pubkey}:${dTag}` : null
          })
          .filter(Boolean)

        if (eventIdentifiers.length > 0) {
          filters.push({
            kinds: [CALENDAR_EVENT_KINDS.RSVP],
            '#a': eventIdentifiers,
            limit: 200,
          })
        }
      }

      // Close any prior sub before opening a new one.
      if (rsvpSubscription) {
        rsvpSubscription.close()
        rsvpSubscription = null
      }

      const pubkeysToEnrich = new Set()

      rsvpSubscription = nostrService.subscribeOutbox(filters, {
        onevent: (event) => {
          if (processedRsvpIds.has(event.id)) return
          processedRsvpIds.add(event.id)

          // nip52 parses the canonical NIP-52 shape. Plektos-style
          // clients emit a simplified ['status', 'accepted'] form that
          // nip52 doesn't recognize — fall back to reading the tag
          // directly so those RSVPs still count.
          const parsed = nip52.parseCalendarEventRSVP(event)
          let statusValue = parsed?.status ?? null
          let freebusyValue = parsed?.freebusy ?? null

          if (!statusValue) {
            const alt = event.tags.find(t => t[0] === 'status')
            if (alt) statusValue = alt[1]
          }
          if (!freebusyValue) {
            const alt = event.tags.find(t => t[0] === 'freebusy')
            if (alt) freebusyValue = alt[1]
          }

          const eventAddress =
            parsed?.eventAddress ||
            event.tags.find(t => t[0] === 'a')?.[1]
          if (!eventAddress || !statusValue) return

          const [eventKind, eventAuthor, eventId] = eventAddress.split(':')
          pubkeysToEnrich.add(event.pubkey)

          const rsvpData = {
            id: event.id,
            eventId,
            eventKind: parseInt(eventKind, 10),
            eventAuthor,
            pubkey: event.pubkey,
            name: null,
            picture: null,
            nip05: null,
            status: statusValue,
            freebusy: freebusyValue,
            note: parsed?.content ?? event.content,
            created_at: event.created_at,
          }

          const existingIndex = rsvps.value.findIndex(r => r.id === event.id)
          if (existingIndex === -1) rsvps.value.push(rsvpData)
          else rsvps.value[existingIndex] = rsvpData
        },
        oneose: () => {
          // Profile enrichment happens ONCE after backfill settles —
          // avoids N in-flight ProfileService calls during replay.
          if (pubkeysToEnrich.size > 0) {
            const pubkeys = Array.from(pubkeysToEnrich)
            profileService.batch(pubkeys)
              .then(() => {
                rsvps.value.forEach((rsvp, i) => {
                  const cached = profileService.getCached(rsvp.pubkey)
                  if (cached) {
                    rsvps.value[i] = {
                      ...rsvp,
                      name: cached.name,
                      picture: cached.picture,
                      nip05: cached.nip05,
                    }
                  }
                })
              })
              .catch(err => console.warn('[useCalendarRSVP] profile batch failed:', err?.message))
          }
          // Close after grace period for late arrivals.
          setTimeout(() => {
            if (rsvpSubscription) {
              rsvpSubscription.close()
              rsvpSubscription = null
            }
          }, 3000)
        },
      })

      return rsvpSubscription
    } catch (err) {
      console.error('[useCalendarRSVP] fetch failed:', err?.message)
      error.value = getUserFriendlyError(err)
    }
  }

  /**
   * RSVPs for a given calendar event. Matches by the event's d-tag
   * because RSVPs reference the addressable-event coordinate, not the
   * specific event id (the event may have been replaced by a newer version).
   */
  const getEventRSVPs = (eventId) => {
    const event = events.value.find(e => e.id === eventId)
    if (!event?.rawEvent) return []
    const dTag = event.rawEvent.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) return []
    return rsvps.value.filter(r => r.eventId === dTag)
  }

  /** The current user's RSVP for a given event (if any). */
  const getUserRSVP = (eventId) => {
    if (!currentUser.value?.pubkey) return null
    const event = events.value.find(e => e.id === eventId)
    if (!event?.rawEvent) return null
    const dTag = event.rawEvent.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) return null
    return rsvps.value.find(
      r => r.eventId === dTag && r.pubkey === currentUser.value.pubkey
    )
  }

  /** Close the subscription + reset local state. Called on logout. */
  const cleanupRSVP = () => {
    if (rsvpSubscription) {
      rsvpSubscription.close()
      rsvpSubscription = null
    }
    processedRsvpIds.clear()
    rsvps.value = []
  }

  return {
    rsvps,
    createRSVP,
    fetchRSVPs,
    getEventRSVPs,
    getUserRSVP,
    cleanupRSVP,
  }
}
