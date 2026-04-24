import { ref, computed, watch } from 'vue'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { useNostrConnections } from './useNostrConnections.js'
import { fetchTransactions, getBalance } from '../../utils/wallet/nwcClient.js'
import { storageService, STORAGE_KEYS } from '../../services/StorageService.js'
import { NOTIFICATION_TYPES, CALENDAR_TYPES, ERROR_TYPES } from '../../utils/notifications/types.js'
import { dedupeKeyFor } from '../../utils/notifications/dedupeKey.js'
import { resolveAction } from '../../utils/notifications/action.js'
import { toSats } from '../../utils/notifications/format.js'

/**
 * useNotifications — module-scoped singleton.
 *
 * Design principles
 * ─────────────────
 * 1. Every notification has a deterministic `dedupeKey`. Same underlying event
 *    (zap receipt, calendar invite, payment hash) produces the same key regardless
 *    of replay source (relay re-delivery, page reload, polling tick), so the tray
 *    never shows a duplicate.
 * 2. Seen/unread is tri-state: {unseen → seen → read}. Badge shows `unseenCount`,
 *    cleared when the dropdown opens. `read` only flips on explicit user action.
 * 3. Persistence covers all mutations. `markAsRead` etc. save synchronously rather
 *    than waiting for a length watcher that doesn't fire on in-place mutation.
 * 4. Tab-visibility aware: live notifications surface as in-app toasts when the
 *    tab is focused, as OS notifications when hidden. Never both.
 * 5. Amounts are normalized to sats at the boundary. Callers may pass sats or
 *    msats; `toSats()` does the right thing.
 * 6. Deep links: every notification stores a navigation action (page + query),
 *    resolved at render time via the injected `changePage` handle.
 */

// ── Settings (reactive) ────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  enabled: true,
  sound: false,
  desktop: true,
  toasts: true,             // NEW: in-app toast channel
  zapReceived: true,
  zapSent: true,
  nwcTransactions: true,
  nostrZaps: true,
  balanceChange: false,
  connectionStatus: false,
  calendarInvites: true,
  calendarEventStarts: true,
}
const notificationSettings = ref({ ...DEFAULT_SETTINGS })

// ── Core state ─────────────────────────────────────────────────────────
const notifications = ref([])   // persisted list
const toasts = ref([])          // ephemeral in-app toasts (not persisted)
const seenDedupeKeys = new Set() // survives list clears so cleared notifs don't re-fire

// Pending navigation intent — set when the user clicks an OS notification
// (the composable has no router access). The UI layer watches this and
// resolves it via the injected `changePage`, then clears it.
const pendingAction = ref(null)

export function consumePendingAction() {
  const action = pendingAction.value
  pendingAction.value = null
  return action
}

const MAX_STORED = 250
const CALENDAR_FLOOR = 50 // always retain at least this many calendar notifs

// ── Persistence helpers ────────────────────────────────────────────────
const loadSettings = () => {
  const parsed = storageService.get(STORAGE_KEYS.NOTIFICATION_SETTINGS)
  if (parsed) notificationSettings.value = { ...DEFAULT_SETTINGS, ...parsed }
}
const saveSettings = () => {
  storageService.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, notificationSettings.value)
}

const loadNotifications = () => {
  const parsed = storageService.get(STORAGE_KEYS.NOTIFICATIONS_LIST, [])
  notifications.value = Array.isArray(parsed) ? parsed : []
  // Seed dedupe set from persisted notifications so we don't re-fire them
  notifications.value.forEach(n => { if (n.dedupeKey) seenDedupeKeys.add(n.dedupeKey) })
  // Also load keys that persisted after the notification itself was cleared,
  // so "clear all + reload" doesn't spam the user with the backlog again.
  const storedKeys = storageService.get(STORAGE_KEYS.NOTIFICATION_DEDUPE, [])
  if (Array.isArray(storedKeys)) storedKeys.forEach(k => seenDedupeKeys.add(k))
}

const saveNotifications = () => {
  const list = notifications.value

  // Keep all recent calendar notifications; trim other types to 200.
  const calendar = list.filter(n => CALENDAR_TYPES.includes(n.type))
  const others = list.filter(n => !CALENDAR_TYPES.includes(n.type))
  const trimmed = [
    ...calendar.slice(0, Math.max(CALENDAR_FLOOR, MAX_STORED - others.length)),
    ...others.slice(0, MAX_STORED - Math.min(calendar.length, CALENDAR_FLOOR)),
  ]

  storageService.set(STORAGE_KEYS.NOTIFICATIONS_LIST, trimmed)

  // Separately persist the dedupe set so it survives explicit list clears.
  // Cap to 2000 keys so localStorage doesn't grow unbounded.
  const keys = Array.from(seenDedupeKeys).slice(-2000)
  storageService.set(STORAGE_KEYS.NOTIFICATION_DEDUPE, keys)
}

// Debounce persistence because mutations can arrive in bursts from subscriptions.
let _saveTimer = null
const schedulePersist = () => {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(saveNotifications, 500)
}

// Settings don't need debouncing — toggle frequency is low and we want durability.
watch(() => JSON.stringify(notificationSettings.value), saveSettings)

// Flush pending saves before unload so we don't lose a trailing mutation.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (_saveTimer) {
      clearTimeout(_saveTimer)
      saveNotifications()
    }
  })
}

// ── Core emit ──────────────────────────────────────────────────────────
// Canonical entry point. All `handle*` wrappers funnel through here.
//
// Idempotent: if `dedupeKey` collides with an existing (or previously cleared)
// notification, we reject silently rather than append.
function emit(type, { title, message, data = {} } = {}) {
  if (!notificationSettings.value.enabled) return null

  // Enforce per-type enable flags
  if (!isTypeEnabled(type)) return null

  const now = Date.now()
  const payload = { ...data, timestamp: data.timestamp || now }

  // Build dedupe key; notifications without a strong identity still get a weak
  // time-bucketed key from dedupeKeyFor, so only true duplicates collide.
  const dedupeKey = dedupeKeyFor(type, payload) || `${type}:${now}:${Math.random()}`

  if (seenDedupeKeys.has(dedupeKey)) {
    return null // silent dedupe — this is the happy path for replayed events
  }
  seenDedupeKeys.add(dedupeKey)

  const notification = {
    id: dedupeKey, // deterministic id — stable across reloads
    dedupeKey,
    type,
    title,
    message,
    timestamp: new Date(payload.timestamp).toISOString(),
    seen: false,
    read: false,
    data: payload,
  }

  // Attach resolved navigation action up-front so UI doesn't need to compute it
  notification.action = resolveAction(notification)

  notifications.value.unshift(notification)
  trimList()
  schedulePersist()

  // Route to the correct surface channel
  surface(notification)

  return notification
}

function trimList() {
  if (notifications.value.length <= MAX_STORED + 50) return
  const calendar = notifications.value.filter(n => CALENDAR_TYPES.includes(n.type))
  const others = notifications.value.filter(n => !CALENDAR_TYPES.includes(n.type))
  notifications.value = [...calendar, ...others.slice(0, MAX_STORED - Math.min(calendar.length, CALENDAR_FLOOR))]
}

function isTypeEnabled(type) {
  const s = notificationSettings.value
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC: return s.zapReceived && s.nwcTransactions
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR: return s.zapReceived && s.nostrZaps
    case NOTIFICATION_TYPES.ZAP_SENT: return s.zapSent
    case NOTIFICATION_TYPES.BALANCE_CHANGE: return s.balanceChange
    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.CONNECTION_ERROR: return s.connectionStatus
    case NOTIFICATION_TYPES.CALENDAR_INVITE: return s.calendarInvites
    case NOTIFICATION_TYPES.CALENDAR_EVENT_START: return s.calendarEventStarts
    default: return true // Payment success/error & wallet errors are transactional, always shown
  }
}

// ── Surfacing: choose toast vs. OS notification vs. silent ─────────────
function surface(notification) {
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
  const s = notificationSettings.value

  if (hidden) {
    if (s.desktop) showDesktopNotification(notification)
  } else {
    if (s.toasts) pushToast(notification)
  }

  if (s.sound) playSound()
}

function showDesktopNotification(notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const isError = ERROR_TYPES.includes(notification.type)

  try {
    const desktop = new Notification(notification.title, {
      body: notification.message,
      icon: '/new_logo3.png',
      tag: notification.dedupeKey, // collapse identical OS notifs
      renotify: false,
      // Errors stay on screen until dismissed; success/info auto-decays
      requireInteraction: isError,
    })

    // Wire click → focus the tab, mark read, publish pending action. The
    // UI layer (NotificationToastHost) picks it up and calls changePage.
    desktop.onclick = () => {
      try { window.focus() } catch {}
      markAsRead(notification.id)
      if (notification.action) pendingAction.value = notification.action
      desktop.close()
    }

    if (!isError) setTimeout(() => desktop.close(), 5000)
  } catch (err) {
    console.warn('[notifications] desktop show failed:', err.message)
  }
}

const TOAST_LIMIT = 4
function pushToast(notification) {
  toasts.value = [notification, ...toasts.value].slice(0, TOAST_LIMIT)
}
function dismissToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function playSound() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioCtor) return
    const ctx = new AudioCtor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.22, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {
    // AudioContext requires a user gesture in some browsers — swallow silently
  }
}

// ── Public actions ─────────────────────────────────────────────────────
async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

function markAsRead(id) {
  const n = notifications.value.find(x => x.id === id)
  if (n && (!n.read || !n.seen)) {
    n.read = true
    n.seen = true
    schedulePersist()
  }
}

function markAsUnread(id) {
  const n = notifications.value.find(x => x.id === id)
  if (n && n.read) {
    n.read = false
    n.seen = false // re-surface in badge so user can find it again
    schedulePersist()
  }
}

function markAllAsRead() {
  let changed = false
  for (const n of notifications.value) {
    if (!n.read || !n.seen) { n.read = true; n.seen = true; changed = true }
  }
  if (changed) schedulePersist()
}

// Called when the dropdown opens — clears the badge but leaves the unread
// visual state intact so the user can still spot fresh items.
function markAllSeen() {
  let changed = false
  for (const n of notifications.value) {
    if (!n.seen) { n.seen = true; changed = true }
  }
  if (changed) schedulePersist()
}

function removeNotification(id) {
  const idx = notifications.value.findIndex(n => n.id === id)
  if (idx !== -1) {
    notifications.value.splice(idx, 1)
    schedulePersist()
  }
}

function clearAllNotifications() {
  notifications.value = []
  schedulePersist()
}

// ── Computed ───────────────────────────────────────────────────────────
const unseenCount = computed(() => notifications.value.filter(n => !n.seen).length)
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
const recentNotifications = computed(() => notifications.value.slice(0, 10))

// ── Typed handlers (legacy public API preserved) ───────────────────────
// Content layering contract for every handler:
//   title      → the action that happened (short, verb-led)
//   message    → context (source, recipient, event name) — NEVER the amount, NEVER the zap comment
//   data.amount → rendered by the amount badge (sats)
//   data.message → the zap comment, rendered as blockquote ONLY (not in message text)
// Following this contract is what keeps the UI from showing the same fact twice.

function handleZapReceivedNWC(tx) {
  const amount = toSats(tx.amount, { assumeMsats: tx._msats })
  return emit(NOTIFICATION_TYPES.ZAP_RECEIVED_NWC, {
    title: 'Payment received',
    message: 'Incoming Lightning payment',
    data: {
      amount,
      source: 'nwc',
      paymentHash: tx.paymentHash,
      timestamp: tx.timestamp,
    },
  })
}

function handleZapReceivedNostr(zap) {
  const amount = toSats(zap.amount)
  const senderName = zap.sender?.name
  return emit(NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR, {
    title: senderName ? `⚡ ${senderName} zapped you` : '⚡ Zap received',
    // Brief context, not a re-statement of sats or comment
    message: 'Zap on your Nostr content',
    data: {
      amount,
      source: 'nostr',
      sender: zap.sender,
      eventId: zap.eventId,
      message: zap.message, // renders as blockquote — never duplicated in the message line
      paymentHash: zap.id || zap.paymentHash,
      zapId: zap.id,
      timestamp: zap.timestamp,
    },
  })
}

function handleZapSent(payment) {
  const amount = toSats(payment.amount)
  return emit(NOTIFICATION_TYPES.ZAP_SENT, {
    title: 'Payment sent',
    message: payment.recipient
      ? `To ${payment.recipient}`
      : 'Lightning payment',
    data: {
      amount,
      source: payment.source || 'nwc',
      recipient: payment.recipient,
      paymentHash: payment.paymentHash,
    },
  })
}

function handleBalanceChange(oldBalance, newBalance, connectionId = null) {
  if (oldBalance === newBalance) return null
  const diff = newBalance - oldBalance
  return emit(NOTIFICATION_TYPES.BALANCE_CHANGE, {
    title: diff > 0 ? 'Balance increased' : 'Balance decreased',
    // The delta is carried by the amount badge; message stays context-only
    message: 'Wallet balance updated',
    data: {
      oldBalance,
      newBalance,
      difference: diff,
      amount: Math.abs(diff), // surfaced as badge with signed icon
      signed: diff,
      connectionId,
    },
  })
}

function handleConnectionSuccess(connectionName, connectionId = null) {
  return emit(NOTIFICATION_TYPES.CONNECTION_SUCCESS, {
    title: 'Wallet connected',
    message: connectionName || 'Wallet is online',
    data: { connectionName, connectionId },
  })
}

function handleConnectionError(error) {
  return emit(NOTIFICATION_TYPES.CONNECTION_ERROR, {
    title: 'Connection failed',
    message: getUserFriendlyError(error),
    data: { errorMessage: error?.message || String(error) },
  })
}

function handlePaymentSuccess(paymentData = {}) {
  const amount = paymentData.amount ? toSats(paymentData.amount) : null
  return emit(NOTIFICATION_TYPES.PAYMENT_SUCCESS, {
    title: 'Payment successful',
    message: 'Lightning payment completed',
    data: { ...paymentData, amount: amount ?? paymentData.amount },
  })
}

function handlePaymentError(error) {
  return emit(NOTIFICATION_TYPES.PAYMENT_ERROR, {
    title: 'Payment failed',
    message: getUserFriendlyError(error),
    data: { errorMessage: error?.message || String(error) },
  })
}

function handleCalendarInvite(event) {
  return emit(NOTIFICATION_TYPES.CALENDAR_INVITE, {
    title: event.title ? `Invited to ${event.title}` : 'Event invitation',
    message: 'You were added as a participant',
    data: {
      eventId: event.id,
      eventTitle: event.title,
      eventStart: event.start || event.start_date,
      eventType: event.type,
      organizer: event.organizer,
      organizerProfile: event.organizerProfile || null,
    },
  })
}

function handleCalendarEventStart(event) {
  return emit(NOTIFICATION_TYPES.CALENDAR_EVENT_START, {
    title: event.title ? `${event.title} is starting` : 'Event starting',
    message: 'Your event is starting soon',
    data: {
      eventId: event.id,
      eventTitle: event.title,
      eventStart: event.start || event.start_date,
      eventType: event.type,
    },
  })
}

// ── NWC transaction + balance monitor (polling) ────────────────────────
let _txPoll = null
let _lastTxTimestamp = null
let _lastBalance = null
let _processedTx = new Set()

async function startTransactionMonitoring(activeConnectionRef = null) {
  if (_txPoll) return

  // Load persisted state
  const storedTs = storageService.getRaw(STORAGE_KEYS.LAST_TX_TIMESTAMP)
  const storedProcessed = storageService.get(STORAGE_KEYS.PROCESSED_TX)
  if (storedTs) _lastTxTimestamp = parseInt(storedTs, 10)
  if (Array.isArray(storedProcessed)) _processedTx = new Set(storedProcessed)

  let isFirstBalanceTick = true

  const tick = async () => {
    try {
      // Fetch settled transactions
      const txs = await fetchTransactions()
      if (Array.isArray(txs) && txs.length) {
        let changed = false
        for (const tx of txs) {
          if (!tx.payment_hash || tx.state !== 'settled') continue
          if (_processedTx.has(tx.payment_hash)) continue
          _processedTx.add(tx.payment_hash)
          changed = true

          const ts = tx.settled_at || tx.created_at
          if (!_lastTxTimestamp || ts > _lastTxTimestamp) _lastTxTimestamp = ts

          if (tx.type === 'incoming') {
            handleZapReceivedNWC({
              amount: tx.amount, // msats from LNbits-style NWC response
              _msats: true,
              timestamp: new Date(ts * 1000).toISOString(),
              paymentHash: tx.payment_hash,
            })
          }
        }
        if (changed) {
          storageService.setRaw(STORAGE_KEYS.LAST_TX_TIMESTAMP, String(_lastTxTimestamp))
          const recent = Array.from(_processedTx).slice(-1000)
          _processedTx = new Set(recent)
          storageService.set(STORAGE_KEYS.PROCESSED_TX, recent)
        }
      }

      // Balance check — keyed per connection so switching wallets doesn't fire a spurious delta
      const connectionId = activeConnectionRef?.value?.id || 'default'
      const balanceKey = `${STORAGE_KEYS.LAST_BALANCE}:${connectionId}`
      if (_lastBalance === null) {
        const persisted = storageService.getRaw(balanceKey)
        _lastBalance = persisted != null ? parseInt(persisted, 10) : null
      }

      const data = await getBalance()
      if (data && typeof data.balance === 'number') {
        const currentSats = Math.floor(data.balance / 1000)
        if (_lastBalance !== null && currentSats !== _lastBalance && !isFirstBalanceTick) {
          handleBalanceChange(_lastBalance, currentSats, connectionId)
        }
        _lastBalance = currentSats
        storageService.setRaw(balanceKey, String(currentSats))
        isFirstBalanceTick = false
      }
    } catch (err) {
      // Polling errors are noisy and expected on flaky connections — suppress
    }
  }

  await tick()
  _txPoll = setInterval(tick, 10_000)
}

function stopTransactionMonitoring() {
  if (_txPoll) { clearInterval(_txPoll); _txPoll = null }
  _processedTx.clear()
  _lastBalance = null
}

// ── Calendar event start monitor ───────────────────────────────────────
let _eventPoll = null
let _notifiedEvents = new Set()

function loadNotifiedEvents() {
  const stored = storageService.get(STORAGE_KEYS.NOTIFIED_CALENDAR)
  if (Array.isArray(stored)) _notifiedEvents = new Set(stored)
}
function saveNotifiedEvents() {
  const recent = Array.from(_notifiedEvents).slice(-500)
  _notifiedEvents = new Set(recent)
  storageService.set(STORAGE_KEYS.NOTIFIED_CALENDAR, recent)
}

function startEventMonitoring(getEventsCallback) {
  if (_eventPoll) return
  loadNotifiedEvents()

  const tick = () => {
    try {
      const events = getEventsCallback?.()
      if (!Array.isArray(events) || events.length === 0) return
      const now = Date.now()
      const FIVE_MIN = 5 * 60_000

      for (const event of events) {
        const key = `${event.id}_start`
        if (_notifiedEvents.has(key)) continue

        let startMs
        if (event.type === 'time-based' && event.start) startMs = event.start * 1000
        else if (event.type === 'date-based' && event.start_date) startMs = new Date(event.start_date).getTime()
        else continue

        const until = startMs - now
        if (until <= FIVE_MIN && until > -60_000) {
          handleCalendarEventStart(event)
          _notifiedEvents.add(key)
          saveNotifiedEvents()
        }
      }
    } catch {
      // swallow; polling errors shouldn't take the app down
    }
  }

  tick()
  _eventPoll = setInterval(tick, 30_000)
}

function stopEventMonitoring() {
  if (_eventPoll) { clearInterval(_eventPoll); _eventPoll = null }
}

// ── Initialization (module-scoped, runs once) ──────────────────────────
let _initialized = false
async function initialize() {
  if (_initialized) return
  _initialized = true
  loadSettings()
  loadNotifications()
  if (notificationSettings.value.desktop) {
    await requestNotificationPermission()
  }
}

// ── Public composable factory ──────────────────────────────────────────
export function useNotifications() {
  const { isWalletConnected, activeConnection } = useNostrConnections()

  // Drive tx monitoring off wallet connection state
  watch(isWalletConnected, (connected) => {
    if (connected) startTransactionMonitoring(activeConnection)
    else stopTransactionMonitoring()
  }, { immediate: true })

  // Kick off one-shot init
  initialize()

  return {
    // State
    notifications,
    notificationSettings,
    toasts,
    pendingAction,
    unseenCount,
    unreadCount,
    recentNotifications,

    // Actions
    markAsRead,
    markAsUnread,
    markAllAsRead,
    markAllSeen,
    clearAllNotifications,
    removeNotification,
    requestNotificationPermission,
    dismissToast,

    // Raw emit (for new callers — prefer this over handle*)
    emit,

    // Typed handlers
    handleZapReceivedNWC,
    handleZapReceivedNostr,
    handleZapSent,
    handleBalanceChange,
    handleConnectionSuccess,
    handleConnectionError,
    handlePaymentSuccess,
    handlePaymentError,
    handleCalendarInvite,
    handleCalendarEventStart,

    // Lifecycle
    startTransactionMonitoring,
    stopTransactionMonitoring,
    startEventMonitoring,
    stopEventMonitoring,

    // Constants
    NOTIFICATION_TYPES,
  }
}

// Re-export for call sites that only need the constants without the composable
export { NOTIFICATION_TYPES }
