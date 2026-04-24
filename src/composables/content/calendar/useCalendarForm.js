import { ref, reactive } from 'vue'

/**
 * useCalendarForm — form + view state for the calendar composable.
 *
 * Self-contained: no relay subscriptions, no auth dependency, no
 * refresh-cycle hooks. Pure local reactive state + the transitions
 * between list/create/edit/view modes.
 *
 * Module-scoped so the form survives page navigation within a session
 * — matches the behavior of the old useNostrCalendar where these
 * refs lived at module scope.
 */

const EMPTY_FORM = () => ({
  title: '',
  description: '',
  type: 'time-based', // time-based | date-based
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  start_tzid: '',
  end_tzid: '',
  location: '',
  geohash: '',
  participants: [], // [{ pubkey, relay, role }]
  tags: [],
  references: [], // URLs
})

const eventForm = reactive(EMPTY_FORM())
const currentView = ref('list') // list | create | edit | view
const selectedEvent = ref(null)
const editingEvent = ref(null)

/**
 * Copy an existing event's values into the form fields so the edit
 * view prepopulates. Date/time fields split out of the unix timestamp
 * for the time-based case.
 */
function populateFormFromEvent(event) {
  Object.assign(eventForm, {
    title: event.title,
    description: event.description,
    type: event.type,
    location: event.location || '',
    geohash: event.geohash || '',
    participants: [...(event.participants || [])],
    tags: [...(event.tags || [])],
    references: [...(event.references || [])],
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    start_tzid: event.start_tzid || '',
    end_tzid: event.end_tzid || '',
  })

  if (event.type === 'time-based') {
    if (event.start) {
      const startDate = new Date(event.start * 1000)
      eventForm.start_date = startDate.toISOString().split('T')[0]
      eventForm.start_time = startDate.toTimeString().split(' ')[0].substring(0, 5)
    }
    if (event.end) {
      const endDate = new Date(event.end * 1000)
      eventForm.end_date = endDate.toISOString().split('T')[0]
      eventForm.end_time = endDate.toTimeString().split(' ')[0].substring(0, 5)
    }
  } else {
    eventForm.start_date = event.start_date || ''
    eventForm.end_date = event.end_date || ''
  }
}

function resetForm() {
  Object.assign(eventForm, EMPTY_FORM())
}

/**
 * @param {import('vue').Ref<string>} [errorRef] — optional error ref
 *   from the parent composable; transitioning views clears any lingering
 *   error so the new view starts clean.
 */
export function useCalendarForm(errorRef = null) {
  const setView = (view) => {
    currentView.value = view
    if (errorRef) errorRef.value = ''
  }

  const viewEvent = (event) => {
    selectedEvent.value = event
    currentView.value = 'view'
  }

  const editEvent = (event) => {
    editingEvent.value = event
    populateFormFromEvent(event)
    currentView.value = 'edit'
  }

  const createNewEvent = () => {
    editingEvent.value = null
    resetForm()
    currentView.value = 'create'
  }

  return {
    // Reactive state (module singletons — shared across composable callers)
    eventForm,
    currentView,
    selectedEvent,
    editingEvent,

    // Transitions
    setView,
    viewEvent,
    editEvent,
    createNewEvent,

    // Internal (exposed for the main composable to reset after delete)
    resetForm,
  }
}
