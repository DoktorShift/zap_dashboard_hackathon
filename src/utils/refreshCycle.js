// Refresh cycle utility — periodic data refresh for composables
// Pure JS, no Vue dependency

import {
  REFRESH_CYCLE_INTERVAL,
  REFRESH_WARMUP_DELAY,
  REFRESH_STAGGER_DELAY
} from './constants.js'

const callbacks = new Map() // name → { fn, group }
let cycleTimer = null
let warmupTimer = null
let activeGroup = null // null = run all

/**
 * Register a refresh callback.
 * @param {string} name — unique identifier
 * @param {Function} fn — async refresh function
 * @param {string} [group='global'] — page group ('global' always runs)
 */
export function registerRefresh(name, fn, group = 'global') {
  callbacks.set(name, { fn, group })
  console.log(`[refreshCycle] Registered: ${name} (group: ${group})`)
}

/**
 * Unregister a refresh callback.
 * @param {string} name
 */
export function unregisterRefresh(name) {
  callbacks.delete(name)
  console.log(`[refreshCycle] Unregistered: ${name}`)
}

/**
 * Set the active page group.
 * Only 'global' callbacks and those matching the active group will run.
 * @param {string|null} group — null to run all
 */
export function setActiveGroup(group) {
  activeGroup = group
  console.log(`[refreshCycle] Active group: ${group || 'all'}`)
}

/**
 * Run one cycle — staggers callbacks by REFRESH_STAGGER_DELAY.
 * Only runs 'global' callbacks and those matching activeGroup.
 */
async function runCycle() {
  const entries = Array.from(callbacks.entries()).filter(([, { group }]) => {
    if (activeGroup === null) return true
    return group === 'global' || group === activeGroup
  })
  if (entries.length === 0) return

  console.log(`[refreshCycle] Running cycle (${entries.length} callbacks)`)

  for (let i = 0; i < entries.length; i++) {
    const [name, { fn }] = entries[i]

    // Stagger: wait before each callback (skip first)
    if (i > 0) {
      await new Promise(r => setTimeout(r, REFRESH_STAGGER_DELAY))
    }

    try {
      await fn()
      console.log(`[refreshCycle] ${name} refreshed`)
    } catch (err) {
      console.warn(`[refreshCycle] ${name} failed:`, err.message)
    }
  }
}

/**
 * Start the refresh cycle.
 * Waits REFRESH_WARMUP_DELAY before first cycle, then repeats every REFRESH_CYCLE_INTERVAL.
 */
export function startRefreshCycle() {
  stopRefreshCycle()

  warmupTimer = setTimeout(() => {
    warmupTimer = null
    runCycle()
    cycleTimer = setInterval(runCycle, REFRESH_CYCLE_INTERVAL)
  }, REFRESH_WARMUP_DELAY)

  console.log(`[refreshCycle] Started (warmup ${REFRESH_WARMUP_DELAY / 1000}s, interval ${REFRESH_CYCLE_INTERVAL / 1000}s)`)
}

/**
 * Stop the refresh cycle.
 */
export function stopRefreshCycle() {
  if (warmupTimer) {
    clearTimeout(warmupTimer)
    warmupTimer = null
  }
  if (cycleTimer) {
    clearInterval(cycleTimer)
    cycleTimer = null
  }
}
