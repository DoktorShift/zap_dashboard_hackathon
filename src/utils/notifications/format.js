import {
  IconBell,
  IconBolt,
  IconWallet,
  IconSparkles,
  IconCircleCheck,
  IconAlertCircle,
  IconCalendar,
  IconClock,
  IconPlugConnected,
  IconCoin,
} from '@iconify-prerendered/vue-tabler'
import { NOTIFICATION_TYPES } from './types.js'

// Visual + copy mapping for each notification type.
// Single source of truth consumed by NotificationItem, Toast, and any future surface.
const TYPE_VISUAL = {
  [NOTIFICATION_TYPES.ZAP_RECEIVED_NWC]: {
    icon: IconWallet,
    accent: 'blue',
    label: 'Wallet payment',
  },
  [NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR]: {
    icon: IconSparkles,
    accent: 'orange',
    label: 'Nostr zap',
  },
  [NOTIFICATION_TYPES.ZAP_SENT]: {
    icon: IconBolt,
    accent: 'amber',
    label: 'Payment sent',
  },
  [NOTIFICATION_TYPES.BALANCE_CHANGE]: {
    icon: IconCoin,
    accent: 'green',
    label: 'Balance',
  },
  [NOTIFICATION_TYPES.CONNECTION_SUCCESS]: {
    icon: IconPlugConnected,
    accent: 'green',
    label: 'Connection',
  },
  [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: {
    icon: IconCircleCheck,
    accent: 'green',
    label: 'Payment',
  },
  [NOTIFICATION_TYPES.CONNECTION_ERROR]: {
    icon: IconAlertCircle,
    accent: 'red',
    label: 'Connection error',
  },
  [NOTIFICATION_TYPES.PAYMENT_ERROR]: {
    icon: IconAlertCircle,
    accent: 'red',
    label: 'Payment error',
  },
  [NOTIFICATION_TYPES.WALLET_ERROR]: {
    icon: IconAlertCircle,
    accent: 'red',
    label: 'Wallet error',
  },
  [NOTIFICATION_TYPES.CALENDAR_INVITE]: {
    icon: IconCalendar,
    accent: 'amber',
    label: 'Event invitation',
  },
  [NOTIFICATION_TYPES.CALENDAR_EVENT_START]: {
    icon: IconClock,
    accent: 'red',
    label: 'Event starting',
  },
}

const DEFAULT_VISUAL = { icon: IconBell, accent: 'gray', label: 'Notification' }

// Tailwind class pairs per accent. Keeping them statically defined keeps JIT purge happy.
const ACCENT_CLASSES = {
  blue:   { tile: 'bg-blue-50 text-blue-600',     dot: 'bg-blue-500',     ring: 'ring-blue-100' },
  orange: { tile: 'bg-orange-50 text-orange-600', dot: 'bg-orange-500',   ring: 'ring-orange-100' },
  amber:  { tile: 'bg-amber-50 text-amber-600',   dot: 'bg-amber-500',    ring: 'ring-amber-100' },
  green:  { tile: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500', ring: 'ring-emerald-100' },
  red:    { tile: 'bg-red-50 text-red-600',       dot: 'bg-red-500',      ring: 'ring-red-100' },
  gray:   { tile: 'bg-gray-50 text-gray-600',     dot: 'bg-gray-500',     ring: 'ring-gray-100' },
}

export function getVisual(type) {
  return TYPE_VISUAL[type] || DEFAULT_VISUAL
}

export function getAccentClasses(accent) {
  return ACCENT_CLASSES[accent] || ACCENT_CLASSES.gray
}

// Relative time formatter — stable across timezones because it only touches
// the local clock, and idempotent (same input → same output at the same moment).
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const diff = Date.now() - date.getTime()
  if (diff < 0) return 'In the future'
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Full absolute timestamp for hover tooltips / accessibility
export function formatAbsoluteTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Normalize an amount that may arrive in either sats or msats.
// Heuristic: values >= 1_000_000 with no fractional unit signal are almost
// certainly msats (equivalent of ≥1000 sats expressed in msats). We prefer
// explicit-sats callers but tolerate msats for back-compat.
export function toSats(amount, { assumeMsats = false } = {}) {
  if (amount == null || Number.isNaN(Number(amount))) return 0
  const n = Number(amount)
  if (assumeMsats) return Math.floor(n / 1000)
  if (n >= 1_000_000) return Math.floor(n / 1000)
  return Math.floor(n)
}
