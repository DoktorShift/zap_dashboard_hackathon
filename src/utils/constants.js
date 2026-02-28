// Shared constants — single source of truth for timeouts, limits, and defaults

// ── Relay connection ──
export const RELAY_CONNECTION_TIMEOUT = 10_000   // 10s per relay connect attempt
export const RELAY_MAX_RETRIES = 3
export const RELAY_RETRY_DELAY = 2_000           // 2s between retries
export const RELAY_HEALTH_CHECK_INTERVAL = 300_000 // 5min between health checks
export const RELAY_HEALTH_CHECK_TIMEOUT = 5_000  // 5s per health check probe
export const RELAY_MAX_BACKOFF = 5 * 60 * 1000   // 5min max backoff

// ── Subscribe helper ──
export const SUBSCRIBE_TIMEOUT = 25_000          // 25s hard timeout
export const SUBSCRIBE_EOSE_GRACE = 3_000        // 3s grace after EOSE
export const DEFERRED_SUB_TIMEOUT = 5_000        // 5s timeout for deferred subs

// ── Profile fetching ──
export const PROFILE_FETCH_TIMEOUT = 15_000      // 15s batch fetch timeout
export const PROFILE_EOSE_GRACE = 1_500          // 1.5s grace for profile batch
export const PROFILE_BATCH_SIZE = 50
export const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h
export const PROFILE_CACHE_MAX = 2_000           // max entries
export const PROFILE_CACHE_EVICT = 200           // evict this many when full

// ── Event cache (relay manager) ──
export const EVENT_CACHE_TTL = 60_000            // 1min
export const EVENT_CACHE_MAX = 500               // max entries
export const EVENT_CACHE_EVICT = 100             // evict this many when full

// ── App loading ──
export const APP_HARD_TIMEOUT = 15_000           // 15s max loading screen
export const RELAY_READY_TIMEOUT = 5_000         // 5s wait for ready() in login/boot

// ── Refresh cycle ──
export const REFRESH_CYCLE_INTERVAL = 120_000    // 2min between cycles
export const REFRESH_WARMUP_DELAY = 30_000       // 30s warmup before first cycle
export const REFRESH_STAGGER_DELAY = 5_000       // 5s between callbacks

// ── Content zaps ──
export const CONTENT_ZAP_CHUNK_SIZE = 50         // max event IDs per filter
export const CONTENT_ZAP_RESUBSCRIBE_DEBOUNCE = 1_000
export const TRACKED_EVENT_IDS_MAX = 500         // max tracked event IDs

// ── Notes ──
export const NOTES_FETCH_TIMEOUT = 15_000        // 15s force-reset loading
export const NOTES_CLEANUP_INTERVAL = 30_000     // 30s duplicate cleanup

// ── Publish ──
export const PUBLISH_TIMEOUT = 10_000            // 10s publish timeout

// ── Default relay list (single source of truth) ──
export const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://nostr-01.yakihonne.com'
]

// Relay configs with read/write flags (used by relay manager)
export const DEFAULT_RELAY_CONFIGS = DEFAULT_RELAY_URLS.map(url => ({
  url,
  read: true,
  write: url !== 'wss://relay.nostr.band' && url !== 'wss://nostr-01.yakihonne.com'
}))

// Relay configs with status (used by useNostrAuth UI)
export const DEFAULT_RELAY_CONFIGS_WITH_STATUS = DEFAULT_RELAY_URLS.map(url => ({
  url,
  status: 'disconnected',
  read: true,
  write: url !== 'wss://relay.nostr.band' && url !== 'wss://nostr-01.yakihonne.com'
}))

// ── Subscription concurrency ──
export const MAX_CONCURRENT_SUBS = 20
