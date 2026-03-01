import { ref, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useContentZaps } from './useContentZaps.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'

// Global state for long-form content
// Helper function to extract d tag identifier from event
const getDTagIdentifier = (event) => {
  // Look for d tag in the event tags
  const dTag = event.tags.find(tag => tag[0] === 'd')
  // Return the d tag value if found, otherwise fall back to event id
  return dTag && dTag[1] ? dTag[1] : event.id
}

const longFormContent = ref([])
const isLoading = ref(false)
const error = ref('')
let currentSubscription = null // Track current subscription
let isFetching = false // Concurrency guard
let isInitialized = false // Prevent duplicate watcher initialization
const processedEventIds = new Set() // Track processed event IDs to prevent duplicates

// UI state
const currentView = ref('list') // list, create, edit, view, preview
const selectedContent = ref(null)
const editingContent = ref(null)

export function useNostrLongForm() {
  const { currentUser, isAuthenticated, writeRelays, readRelays } = useNostrAuth()
  const { startZapTracking } = useContentZaps()

  // Computed properties
  const userContent = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }
    return longFormContent.value.filter(content => content.pubkey === currentUser.value.pubkey)
  })

  const sortedContent = computed(() => {
    return [...userContent.value].sort((a, b) => b.created_at - a.created_at)
  })

  // Extract tags from content
  const extractTags = (content) => {
    const tagRegex = /#(\w+)/g
    const tags = []
    let match
    
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1])
    }
    
    return tags
  }

  // Create content title from tags or content
  const createContentTitle = (event) => {
    // First check for title tag
    const titleTag = event.tags.find(tag => tag[0] === 'title')
    if (titleTag && titleTag[1]) {
      return titleTag[1]
    }
    
    // If no title tag, get first line or first 50 characters
    const plainText = event.content.trim()
    const firstLine = plainText.split('\\n')[0]
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine || 'Untitled Content'
  }

  // Create content preview from content or summary tag
  const createContentPreview = (event) => {
    // First check for summary tag
    const summaryTag = event.tags.find(tag => tag[0] === 'summary')
    if (summaryTag && summaryTag[1]) {
      return summaryTag[1]
    }
    
    // If no summary tag, get plain text preview
    const plainText = event.content.replace(/\\n+/g, ' ').trim()
    return plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText
  }

  // Get content type from tags
  const getContentType = (event) => {
    const contentTypeTag = event.tags.find(tag => tag[0] === 'content-type')
    return contentTypeTag ? contentTypeTag[1] : 'article'
  }

  // Get monetization model from tags
  const getMonetizationModel = (event) => {
    const monetizationTag = event.tags.find(tag => tag[0] === 'monetization')
    return monetizationTag ? monetizationTag[1] : 'free'
  }

  // Get price from tags
  const getPrice = (event) => {
    const priceTag = event.tags.find(tag => tag[0] === 'price_sats')
    return priceTag ? parseInt(priceTag[1]) : 0
  }

  // Get image URL from tags
  const getImageUrl = (event) => {
    const imageTag = event.tags.find(tag => tag[0] === 'image')
    return imageTag ? imageTag[1] : null
  }

  // Get hashtags from tags
  const getHashtags = (event) => {
    return event.tags
      .filter(tag => tag[0] === 't')
      .map(tag => tag[1])
  }

  // Fetch user's long-form content from Nostr relays
  const fetchUserLongFormContent = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) return
    if (isFetching) return // Prevent concurrent fetches
    isFetching = true

    try {
      await nostrRelayManager.ready()
    } catch (err) {
      console.warn('[useNostrLongForm] Relay manager not ready:', err.message)
      isFetching = false
      return
    }

    // Close any existing subscription before starting a new one
    if (currentSubscription) {
      currentSubscription.close()
      currentSubscription = null
    }

    isLoading.value = true
    error.value = ''

    try {
      // Capture subscription in local variable to avoid closure bug
      const sub = nostrRelayManager.subscribeToEvents([
        {
          kinds: [30023], // Long-form content
          authors: [currentUser.value.pubkey],
          limit: 200
        },
        {
          kinds: [5], // Deletion events
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ], {
        onevent: (event) => {
          // Check if we've already processed this event ID
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          if (event.kind === 30023) {
            const existingIndex = longFormContent.value.findIndex(content => content.id === event.id)

            if (existingIndex === -1) {
              // Check for duplicate content
              const duplicateContentIndex = longFormContent.value.findIndex(content =>
                content.content === event.content &&
                Math.abs(content.created_at - event.created_at) < 5
              )
              if (duplicateContentIndex !== -1) return

              const contentItem = processLongFormEvent(event)
              startZapTracking(event.id)
              longFormContent.value.push(contentItem)
              debouncedUpdateLocalStorage(contentItem)
            } else {
              const contentItem = processLongFormEvent(event)
              longFormContent.value[existingIndex] = contentItem
              debouncedUpdateLocalStorage(contentItem)
            }
          } else if (event.kind === 5) {
            const deletedEventIds = event.tags
              .filter(tag => tag[0] === 'e')
              .map(tag => tag[1])

            deletedEventIds.forEach(deletedId => {
              const index = longFormContent.value.findIndex(content => content.id === deletedId)
              if (index !== -1) {
                longFormContent.value.splice(index, 1)
                removeFromLocalStorage(deletedId)
              }
            })
          }
        },
        oneose: () => {
          isLoading.value = false
          isFetching = false
          // Close THIS specific subscription — not the module-scoped currentSubscription
          // which may have been overwritten by a concurrent call
          sub.close()
          if (currentSubscription === sub) currentSubscription = null
        },
        onclose: () => {
          isLoading.value = false
          isFetching = false
        }
      })

      currentSubscription = sub
      return sub

    } catch (err) {
      console.warn('[useNostrLongForm] Fetch failed:', err.message)
      error.value = 'Failed to fetch articles. Will retry automatically.'
      isLoading.value = false
      isFetching = false
    }
  }

  // Process a long-form event into our content format
  const processLongFormEvent = (event) => {
    // Extract data from event
    const title = createContentTitle(event)
    const description = createContentPreview(event)
    const contentType = getContentType(event)
    const monetizationModel = getMonetizationModel(event)
    const price = getPrice(event)
    const coverImage = getImageUrl(event)
    const tags = getHashtags(event)
    
    // Create content object
    return {
      id: getDTagIdentifier(event), // Use d tag as primary identifier
      nostrEventId: event.id,
      title,
      description,
      type: contentType,
      monetizationModel,
      price,
      previewText: description,
      fullContent: event.content,
      tags,
      coverImage,
      status: 'published',
      creatorPubkey: event.pubkey,
      creatorName: currentUser.value?.profile?.name || 'Anonymous Creator',
      unlocks: 0,
      revenue: 0,
      views: 0,
      subscribers: 0,
      publishedToRelays: 1,
      publishedAt: new Date(event.created_at * 1000).toISOString(),
      createdAt: new Date(event.created_at * 1000).toISOString(),
      updatedAt: new Date(event.created_at * 1000).toISOString(),
      pubkey: event.pubkey,
      created_at: event.created_at,
      rawEvent: event
    }
  }

  // Debounced wrapper to avoid localStorage thrashing during subscription events
  let _lsUpdateTimer = null
  const _lsPendingUpdates = new Map()
  const debouncedUpdateLocalStorage = (contentItem) => {
    _lsPendingUpdates.set(contentItem.id, contentItem)
    if (_lsUpdateTimer) clearTimeout(_lsUpdateTimer)
    _lsUpdateTimer = setTimeout(() => {
      _lsPendingUpdates.forEach(item => updateLocalStorage(item))
      _lsPendingUpdates.clear()
    }, 2000)
  }

  // Update local storage for backward compatibility
  const updateLocalStorage = (contentItem) => {
    try {
      // Get existing content from localStorage
      const contentStorageKey = 'user_content_items'
      const storedContent = localStorage.getItem(contentStorageKey)
      let contentItems = []
      
      if (storedContent) {
        contentItems = JSON.parse(storedContent)
      }
      
      // Check if this content already exists in localStorage
      const existingIndex = contentItems.findIndex(item => 
        item.nostrEventId === contentItem.id || item.id === contentItem.id
      )
      
      if (existingIndex !== -1) {
        // Update existing content
        contentItems[existingIndex] = {
          ...contentItems[existingIndex],
          nostrEventId: contentItem.id,
          title: contentItem.title,
          description: contentItem.description,
          type: contentItem.type,
          monetizationModel: contentItem.monetizationModel,
          price: contentItem.price,
          previewText: contentItem.previewText,
          fullContent: contentItem.fullContent,
          tags: contentItem.tags,
          coverImage: contentItem.coverImage,
          status: 'published',
          publishedToRelays: contentItem.publishedToRelays || contentItems[existingIndex].publishedToRelays || 1,
          publishedAt: contentItem.publishedAt,
          updatedAt: new Date().toISOString()
        }
      } else {
        // Add new content
        contentItems.push({
          ...contentItem,
          id: contentItem.id // Ensure ID is set correctly
        })
      }
      
      // Save back to localStorage
      localStorage.setItem(contentStorageKey, JSON.stringify(contentItems))
      console.log('Updated local storage with content:', contentItem.id)
    } catch (error) {
      console.error('Failed to update local storage:', error)
    }
  }

  // Remove content from local storage
  const removeFromLocalStorage = (contentId) => {
    try {
      // Get existing content from localStorage
      const contentStorageKey = 'user_content_items'
      const storedContent = localStorage.getItem(contentStorageKey)
      
      if (storedContent) {
        let contentItems = JSON.parse(storedContent)
        
        // Filter out the deleted content
        contentItems = contentItems.filter(item => 
          item.nostrEventId !== contentId && item.id !== contentId
        )
        
        // Save back to localStorage
        localStorage.setItem(contentStorageKey, JSON.stringify(contentItems))
        console.log('Removed content from local storage:', contentId)
      }
    } catch (error) {
      console.error('Failed to remove from local storage:', error)
    }
  }

  // Fetch a specific long-form content by ID
  const fetchContentById = async (contentId) => {
    if (!contentId) {
      throw new Error('Content ID is required')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Fetching long-form content by ID:', contentId)
      
      // First check if we already have this content in our state
      const existingContent = longFormContent.value.find(content => content.id === contentId)
      if (existingContent) {
        console.log('Content found in local state:', contentId)
        return existingContent
      }
      
      // If not in state, fetch from relays
      const event = await nostrRelayManager.getEvent({
        ids: [contentId],
        kinds: [30023]
      })
      
      if (!event) {
        throw new Error('Content not found on relays')
      }
      
      console.log('Content fetched from relays:', contentId)
      
      // Process the event
      const contentItem = processLongFormEvent(event)
      
      // Start tracking zaps for this content
      startZapTracking(event.id)
      
      // Add to state if it's not already there
      if (!longFormContent.value.find(content => content.id === contentId)) {
        longFormContent.value.push(contentItem)
      }
      
      // Update local storage for backward compatibility
      updateLocalStorage(contentItem)
      
      return contentItem
    } catch (err) {
      console.error('Failed to fetch content by ID:', err)
      error.value = 'Failed to fetch content: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // View management
  const setView = (view) => {
    currentView.value = view
    error.value = ''
  }

  const viewContent = (content) => {
    selectedContent.value = content
    currentView.value = 'view'
  }

  const previewContent = (content) => {
    selectedContent.value = content
    currentView.value = 'preview'
  }

  // Format date for display
  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    
    return date.toLocaleDateString()
  }

  // Cleanup function to close subscriptions
  const cleanup = () => {
    if (currentSubscription) {
      currentSubscription.close()
      currentSubscription = null
    }
    processedEventIds.clear()
    isFetching = false
  }

  // Initialize content when authenticated — only register once across all useNostrLongForm() calls
  if (!isInitialized) {
    isInitialized = true
    watch(isAuthenticated, (authenticated) => {
      if (authenticated) {
        if (longFormContent.value.length === 0 && !isFetching) {
          processedEventIds.clear()
          fetchUserLongFormContent().catch(err => console.warn('[useNostrLongForm] Initial fetch failed:', err.message))
        }

        registerRefresh('longform', async () => {
          processedEventIds.clear()
          isFetching = false // Allow refresh to override stale guard
          await fetchUserLongFormContent()
        }, 'global')
      } else {
        if (currentSubscription) {
          currentSubscription.close()
          currentSubscription = null
        }
        processedEventIds.clear()
        isFetching = false
        longFormContent.value = []
        unregisterRefresh('longform')
      }
    }, { immediate: true })
  }

  return {
    // State
    longFormContent: sortedContent,
    isLoading,
    error,
    currentView,
    selectedContent,
    editingContent,

    // Actions
    fetchUserLongFormContent,
    fetchContentById,
    cleanup,
    
    // View management
    setView,
    viewContent,
    previewContent,
    
    // Utilities
    formatDate,
    createContentTitle,
    createContentPreview,
    extractTags,
    processLongFormEvent
  }
}