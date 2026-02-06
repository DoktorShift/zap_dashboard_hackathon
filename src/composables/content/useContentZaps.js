import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useNotifications } from '../core/useNotifications.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { fetchProfile } from '../../utils/profile/profileFetcher.js'

// Global state for content zaps
const contentZaps = reactive(new Map()) // Map<eventId, zap[]>
const activeSubscriptions = reactive(new Map()) // Map<eventId, subscription>
const isTrackingZaps = ref(false)
const allZapEvents = ref([]) // Store all zap events for reference

// Create enriched zap data from a raw zap event using shared utilities
const createZapData = async (zapEvent) => {
  try {
    const parsed = parseZapReceipt(zapEvent)
    if (!parsed) return null

    const zapData = {
      id: parsed.id,
      amount: parsed.amount,
      zapperPubkey: parsed.zapperPubkey,
      sender: {
        pubkey: parsed.zapperPubkey,
        name: `User ${parsed.zapperPubkey.substring(0, 8)}`,
        avatar: generateAvatar(parsed.zapperPubkey)
      },
      timestamp: parsed.timestamp,
      message: parsed.message,
      bolt11: parsed.bolt11,
      eventId: parsed.zappedEventId,
      rawEvent: zapEvent
    }

    // Fetch profile to enrich sender data before notification
    const profile = await fetchProfile(parsed.zapperPubkey)
    if (profile) {
      zapData.sender = {
        pubkey: parsed.zapperPubkey,
        name: profile.name || `user:${parsed.zapperPubkey.substring(0, 8)}`,
        avatar: profile.picture || generateAvatar(parsed.zapperPubkey),
        picture: profile.picture || generateAvatar(parsed.zapperPubkey),
        nip05: profile.nip05
      }
    }

    return zapData
  } catch (error) {
    console.error('Failed to create zap data:', error)
    return null
  }
}

export function useContentZaps() {
  const { isAuthenticated, currentUser } = useNostrAuth()

  // Initialize notification handler
  let notificationHandler = null
  const getNotificationHandler = () => {
    if (!notificationHandler) {
      const { handleZapReceivedNostr } = useNotifications()
      notificationHandler = handleZapReceivedNostr
    }
    return notificationHandler
  }

  // Initialize zap tracking for all published content
  const initializeZapTracking = async () => {
    try {
      // Get all content items from localStorage
      const contentStorageKey = 'user_content_items'
      const storedContent = localStorage.getItem(contentStorageKey)

      if (storedContent) {
        const contentItems = JSON.parse(storedContent)

        // Filter for published content with Nostr event IDs
        const publishedContent = contentItems.filter(item =>
          item.status === 'published' && item.nostrEventId
        )

        if (publishedContent.length > 0) {
          const eventIds = publishedContent.map(item => item.nostrEventId)
          await trackMultipleContent(eventIds)
        }
      }
    } catch (error) {
      console.error('Failed to initialize zap tracking:', error)
    }
  }

  // Start tracking zaps for a specific content item
  const startZapTracking = async (eventId) => {
    if (!eventId || activeSubscriptions.has(eventId)) {
      return
    }

    try {
      // Initialize zaps array for this content if not exists
      if (!contentZaps.has(eventId)) {
        contentZaps.set(eventId, [])
      }

      // Subscribe to zap receipts (kind 9735) for this specific event
      const subscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [9735], // Zap receipts
          "#e": [eventId], // Events that reference our content
          limit: 100
        }
      ], {
        onevent: async (zapEvent) => {
          const zapData = await createZapData(zapEvent)
          if (zapData) {
            const existingZaps = contentZaps.get(eventId) || []

            // Store the zap event for reference
            allZapEvents.value.push(zapEvent)

            // Check if we already have this zap (avoid duplicates)
            const exists = existingZaps.find(zap => zap.id === zapData.id)
            if (!exists) {
              existingZaps.unshift(zapData) // Add to beginning (newest first)
              contentZaps.set(eventId, existingZaps)

              // Trigger notification for new zap receipt
              try {
                const handler = getNotificationHandler()
                if (handler) {
                  handler(zapData)
                }
              } catch (err) {
                console.warn('Failed to trigger notification:', err)
              }
            }
          }
        },
        oneose: () => {},
        onclose: (reason) => {
          activeSubscriptions.delete(eventId)
        }
      })

      activeSubscriptions.set(eventId, subscription)
      isTrackingZaps.value = true

    } catch (error) {
      console.error(`Failed to start zap tracking for ${eventId}:`, error)
    }
  }

  // Stop tracking zaps for a specific content item
  const stopZapTracking = (eventId) => {
    const subscription = activeSubscriptions.get(eventId)
    if (subscription) {
      subscription.close()
      activeSubscriptions.delete(eventId)
    }
  }

  // Stop all zap tracking
  const stopAllZapTracking = () => {
    activeSubscriptions.forEach((subscription, eventId) => {
      subscription.close()
    })
    activeSubscriptions.clear()
    isTrackingZaps.value = false
  }

  // Get zaps for a specific content item
  const getZapsForContent = (eventId) => {
    return contentZaps.get(eventId) || []
  }

  // Get total zap amount for content
  const getTotalZapAmount = (eventId) => {
    const zaps = getZapsForContent(eventId)
    return zaps.reduce((total, zap) => total + zap.amount, 0)
  }

  // Get zap count for content
  const getZapCount = (eventId) => {
    return getZapsForContent(eventId).length
  }

  // Get all content with zaps
  const getAllContentZaps = computed(() => {
    const result = {}
    contentZaps.forEach((zaps, eventId) => {
      result[eventId] = {
        zaps,
        totalAmount: zaps.reduce((sum, zap) => sum + zap.amount, 0),
        count: zaps.length
      }
    })
    return result
  })

  // Track zaps for multiple content items
  const trackMultipleContent = async (eventIds) => {
    const promises = eventIds.map(eventId => startZapTracking(eventId))
    await Promise.allSettled(promises)
  }

  // Clear zaps for a content item
  const clearZapsForContent = (eventId) => {
    contentZaps.delete(eventId)
    stopZapTracking(eventId)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopAllZapTracking()
  })

  return {
    // State
    contentZaps: computed(() => contentZaps),
    isTrackingZaps,
    activeSubscriptions: computed(() => activeSubscriptions),
    allZapEvents: computed(() => allZapEvents.value),

    // Actions
    startZapTracking,
    stopZapTracking,
    stopAllZapTracking,
    trackMultipleContent,
    clearZapsForContent,

    // Getters
    getZapsForContent,
    getTotalZapAmount,
    getZapCount,
    getAllContentZaps,
    initializeZapTracking
  }
}
