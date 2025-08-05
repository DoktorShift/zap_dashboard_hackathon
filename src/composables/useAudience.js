import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import { interests } from '../data/interests.js'

// Global state for audience management
const followLists = ref([])
const currentFollows = ref([])
const suggestedUsers = ref([])
const interestBasedLists = ref(new Map()) // Map<interest, followList[]>
const isLoading = ref(false)
const error = ref('')

// UI state
const selectedInterests = ref(new Set())
const searchQuery = ref('')
const activeTab = ref('discover') // discover, suggestions, follows, create

// Storage keys
const FOLLOW_LISTS_STORAGE_KEY = 'user_follow_lists'
const SELECTED_INTERESTS_STORAGE_KEY = 'selected_interests'

// Subscription management
let followListSubscription = null
let contactListSubscription = null
let profileSubscriptions = new Map()

// Profile cache
const profileCache = new Map()
const profileFetchPromises = new Map()

export function useAudience() {
  const { currentUser, isAuthenticated, userProfile } = useNostrAuth()

  // Load data from localStorage
  const loadFromStorage = () => {
    try {
      // Load follow lists
      const storedLists = localStorage.getItem(FOLLOW_LISTS_STORAGE_KEY)
      if (storedLists) {
        followLists.value = JSON.parse(storedLists)
      }

      // Load selected interests
      const storedInterests = localStorage.getItem(SELECTED_INTERESTS_STORAGE_KEY)
      if (storedInterests) {
        selectedInterests.value = new Set(JSON.parse(storedInterests))
      }
    } catch (error) {
      console.error('Failed to load audience data from storage:', error)
    }
  }

  // Save data to localStorage
  const saveToStorage = () => {
    try {
      localStorage.setItem(FOLLOW_LISTS_STORAGE_KEY, JSON.stringify(followLists.value))
      localStorage.setItem(SELECTED_INTERESTS_STORAGE_KEY, JSON.stringify(Array.from(selectedInterests.value)))
    } catch (error) {
      console.error('Failed to save audience data to storage:', error)
    }
  }

  // Watch for changes and save
  watch([followLists, selectedInterests], saveToStorage, { deep: true })

  // Enhanced profile fetching with caching
  const fetchUserProfile = async (pubkey) => {
    if (profileCache.has(pubkey)) {
      const cached = profileCache.get(pubkey)
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.profile
      }
    }

    if (profileFetchPromises.has(pubkey)) {
      return profileFetchPromises.get(pubkey)
    }

    const fetchPromise = _fetchProfileFromNostr(pubkey)
    profileFetchPromises.set(pubkey, fetchPromise)

    try {
      const profile = await fetchPromise
      profileCache.set(pubkey, { profile, timestamp: Date.now() })
      return profile
    } catch (error) {
      console.warn(`Failed to fetch profile for ${pubkey.substring(0, 8)}:`, error)
      return createFallbackProfile(pubkey)
    } finally {
      profileFetchPromises.delete(pubkey)
    }
  }

  // Internal profile fetching from Nostr
  const _fetchProfileFromNostr = async (pubkey) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Profile fetch timeout'))
      }, 15000)

      try {
        const profileSub = nostrRelayManager.subscribeToEvents([
          {
            kinds: [0],
            authors: [pubkey],
            limit: 1
          }
        ], {
          onevent: (event) => {
            try {
              clearTimeout(timeout)
              const profileData = JSON.parse(event.content)
              
              const profile = {
                pubkey,
                name: profileData.name || profileData.display_name || `user:${pubkey.substring(0, 8)}`,
                picture: profileData.picture || generateFallbackAvatar(pubkey),
                nip05: profileData.nip05 || null,
                about: profileData.about || null,
                lud16: profileData.lud16 || null,
                website: profileData.website || null
              }
              
              profileSub.close()
              resolve(profile)
            } catch (error) {
              clearTimeout(timeout)
              profileSub.close()
              reject(error)
            }
          },
          oneose: () => {
            setTimeout(() => {
              clearTimeout(timeout)
              profileSub.close()
              resolve(createFallbackProfile(pubkey))
            }, 2000)
          }
        })
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    })
  }

  // Create fallback profile
  const createFallbackProfile = (pubkey) => {
    return {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateFallbackAvatar(pubkey),
      nip05: null,
      about: null,
      lud16: null,
      website: null
    }
  }

  // Generate fallback avatar
  const generateFallbackAvatar = (pubkey) => {
    const avatars = [
      'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
      'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
      'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
      'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
      'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
      'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    ]
    
    const hash = pubkey.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return avatars[Math.abs(hash) % avatars.length]
  }

  // Fetch current user's follow list (kind:3)
  const fetchCurrentFollows = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) return

    try {
      console.log('Fetching current follow list...')
      
      const contactEvent = await nostrRelayManager.getEvent({
        kinds: [3],
        authors: [currentUser.value.pubkey],
        limit: 1
      })

      if (contactEvent) {
        const follows = contactEvent.tags
          .filter(tag => tag[0] === 'p' && tag[1])
          .map(tag => ({
            pubkey: tag[1],
            relay: tag[2] || null,
            petname: tag[3] || null
          }))

        // Fetch profiles for all follows
        const profilePromises = follows.map(async (follow) => {
          const profile = await fetchUserProfile(follow.pubkey)
          return { ...follow, profile }
        })

        const followsWithProfiles = await Promise.allSettled(profilePromises)
        currentFollows.value = followsWithProfiles
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value)

        console.log('Loaded current follows:', currentFollows.value.length)
      }
    } catch (error) {
      console.error('Failed to fetch current follows:', error)
    }
  }

  // Fetch follow lists by interests (NIP-51 kind:30000)
  const fetchInterestBasedLists = async (interestTags) => {
    if (!Array.isArray(interestTags) || interestTags.length === 0) return

    try {
      console.log('Fetching interest-based follow lists for:', interestTags)
      
      const subscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [30000], // Follow sets
          '#t': interestTags, // Interest tags
          limit: 50
        }
      ], {
        onevent: (event) => {
          try {
            const dTag = event.tags.find(tag => tag[0] === 'd')?.[1]
            const title = event.tags.find(tag => tag[0] === 'title')?.[1] || dTag || 'Untitled List'
            const description = event.tags.find(tag => tag[0] === 'description')?.[1] || ''
            const image = event.tags.find(tag => tag[0] === 'image')?.[1] || null
            
            // Extract follows from p tags
            const follows = event.tags
              .filter(tag => tag[0] === 'p' && tag[1])
              .map(tag => ({
                pubkey: tag[1],
                relay: tag[2] || null,
                petname: tag[3] || null
              }))

            // Extract interest tags
            const listInterests = event.tags
              .filter(tag => tag[0] === 't' && tag[1])
              .map(tag => tag[1])

            const followList = {
              id: event.id,
              dTag,
              title,
              description,
              image,
              author: event.pubkey,
              follows,
              interests: listInterests,
              createdAt: event.created_at * 1000,
              rawEvent: event
            }

            // Add to interest-based lists
            listInterests.forEach(interest => {
              if (!interestBasedLists.value.has(interest)) {
                interestBasedLists.value.set(interest, [])
              }
              
              const existingLists = interestBasedLists.value.get(interest)
              const exists = existingLists.find(list => list.id === followList.id)
              
              if (!exists) {
                existingLists.push(followList)
                interestBasedLists.value.set(interest, existingLists)
              }
            })
          } catch (error) {
            console.warn('Failed to process follow list event:', error)
          }
        },
        oneose: () => {
          console.log('End of interest-based follow lists')
        }
      })

      return subscription
    } catch (error) {
      console.error('Failed to fetch interest-based lists:', error)
    }
  }

  // Generate smart suggestions based on mutual follows
  const generateSmartSuggestions = async () => {
    if (currentFollows.value.length === 0) return

    try {
      console.log('Generating smart suggestions...')
      
      const mutualConnections = new Map() // pubkey -> count
      const followedPubkeys = new Set(currentFollows.value.map(f => f.pubkey))

      // Fetch contact lists of people we follow
      const contactPromises = currentFollows.value.slice(0, 20).map(async (follow) => {
        try {
          const contactEvent = await nostrRelayManager.getEvent({
            kinds: [3],
            authors: [follow.pubkey],
            limit: 1
          })

          if (contactEvent) {
            const theirFollows = contactEvent.tags
              .filter(tag => tag[0] === 'p' && tag[1])
              .map(tag => tag[1])

            // Count mutual connections
            theirFollows.forEach(pubkey => {
              if (!followedPubkeys.has(pubkey) && pubkey !== currentUser.value.pubkey) {
                mutualConnections.set(pubkey, (mutualConnections.get(pubkey) || 0) + 1)
              }
            })
          }
        } catch (error) {
          console.warn('Failed to fetch contact list for:', follow.pubkey.substring(0, 8))
        }
      })

      await Promise.allSettled(contactPromises)

      // Sort by mutual connection count and take top suggestions
      const suggestions = Array.from(mutualConnections.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([pubkey, mutualCount]) => ({
          pubkey,
          mutualCount,
          profile: null
        }))

      // Fetch profiles for suggestions
      const profilePromises = suggestions.map(async (suggestion) => {
        suggestion.profile = await fetchUserProfile(suggestion.pubkey)
        return suggestion
      })

      const suggestionsWithProfiles = await Promise.allSettled(profilePromises)
      suggestedUsers.value = suggestionsWithProfiles
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)

      console.log('Generated smart suggestions:', suggestedUsers.value.length)
    } catch (error) {
      console.error('Failed to generate smart suggestions:', error)
    }
  }

  // Follow a user (update kind:3 contact list)
  const followUser = async (pubkey, relay = null, petname = null) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      console.log('Following user:', pubkey.substring(0, 8))
      
      // Get current contact list
      const currentContactEvent = await nostrRelayManager.getEvent({
        kinds: [3],
        authors: [currentUser.value.pubkey],
        limit: 1
      })

      // Build new tags array
      let tags = []
      if (currentContactEvent) {
        tags = [...currentContactEvent.tags]
      }

      // Check if already following
      const existingIndex = tags.findIndex(tag => tag[0] === 'p' && tag[1] === pubkey)
      if (existingIndex !== -1) {
        console.log('Already following this user')
        return
      }

      // Add new follow
      const newTag = ['p', pubkey]
      if (relay) newTag.push(relay)
      if (petname) newTag.push(petname)
      
      tags.push(newTag)

      // Create new contact list event
      const eventTemplate = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: currentContactEvent?.content || ''
      }

      // Sign and publish
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      // Update local state
      const profile = await fetchUserProfile(pubkey)
      currentFollows.value.push({
        pubkey,
        relay,
        petname,
        profile
      })

      console.log('Successfully followed user')
      return result
    } catch (error) {
      console.error('Failed to follow user:', error)
      throw error
    }
  }

  // Unfollow a user
  const unfollowUser = async (pubkey) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      console.log('Unfollowing user:', pubkey.substring(0, 8))
      
      // Get current contact list
      const currentContactEvent = await nostrRelayManager.getEvent({
        kinds: [3],
        authors: [currentUser.value.pubkey],
        limit: 1
      })

      if (!currentContactEvent) {
        throw new Error('No contact list found')
      }

      // Remove the follow
      const tags = currentContactEvent.tags.filter(tag => 
        !(tag[0] === 'p' && tag[1] === pubkey)
      )

      // Create new contact list event
      const eventTemplate = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: currentContactEvent.content || ''
      }

      // Sign and publish
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      // Update local state
      currentFollows.value = currentFollows.value.filter(follow => follow.pubkey !== pubkey)

      console.log('Successfully unfollowed user')
      return result
    } catch (error) {
      console.error('Failed to unfollow user:', error)
      throw error
    }
  }

  // Create custom follow list (NIP-51 kind:30000)
  const createFollowList = async (title, description, follows, interests = []) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      console.log('Creating follow list:', title)
      
      const dTag = Date.now().toString()
      
      // Build tags
      const tags = [
        ['d', dTag],
        ['title', title],
        ['description', description],
        ...interests.map(interest => ['t', interest]),
        ...follows.map(follow => {
          const tag = ['p', follow.pubkey]
          if (follow.relay) tag.push(follow.relay)
          if (follow.petname) tag.push(follow.petname)
          return tag
        })
      ]

      // Create event
      const eventTemplate = {
        kind: 30000, // Follow sets
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: ''
      }

      // Sign and publish
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      // Add to local state
      const newList = {
        id: signedEvent.id,
        dTag,
        title,
        description,
        author: currentUser.value.pubkey,
        follows,
        interests,
        createdAt: Date.now(),
        isLocal: false,
        rawEvent: signedEvent
      }

      followLists.value.unshift(newList)

      console.log('Successfully created follow list')
      return newList
    } catch (error) {
      console.error('Failed to create follow list:', error)
      throw error
    }
  }

  // Follow all users from a list
  const followAllFromList = async (followList) => {
    if (!followList.follows || followList.follows.length === 0) return

    try {
      console.log('Following all users from list:', followList.title)
      
      const followPromises = followList.follows.map(follow => 
        followUser(follow.pubkey, follow.relay, follow.petname)
          .catch(error => {
            console.warn('Failed to follow user:', follow.pubkey.substring(0, 8), error)
            return null
          })
      )

      const results = await Promise.allSettled(followPromises)
      const successful = results.filter(result => result.status === 'fulfilled').length
      
      console.log(`Successfully followed ${successful}/${followList.follows.length} users`)
      return { successful, total: followList.follows.length }
    } catch (error) {
      console.error('Failed to follow all from list:', error)
      throw error
    }
  }

  // Toggle interest selection
  const toggleInterest = (interest) => {
    if (selectedInterests.value.has(interest)) {
      selectedInterests.value.delete(interest)
    } else {
      selectedInterests.value.add(interest)
    }
  }

  // Search interests
  const searchInterests = (query) => {
    if (!query.trim()) return interests
    
    const lowerQuery = query.toLowerCase()
    return interests.filter(interest => 
      interest.toLowerCase().includes(lowerQuery)
    )
  }

  // Computed properties
  const filteredFollows = computed(() => {
    if (!searchQuery.value) return currentFollows.value
    
    const query = searchQuery.value.toLowerCase()
    return currentFollows.value.filter(follow =>
      follow.profile?.name?.toLowerCase().includes(query) ||
      follow.profile?.nip05?.toLowerCase().includes(query) ||
      follow.pubkey.toLowerCase().includes(query)
    )
  })

  const followStats = computed(() => {
    return {
      total: currentFollows.value.length,
      withLightning: currentFollows.value.filter(f => f.profile?.lud16).length,
      verified: currentFollows.value.filter(f => f.profile?.nip05).length
    }
  })

  const interestStats = computed(() => {
    return {
      selected: selectedInterests.value.size,
      available: interests.length,
      listsFound: Array.from(interestBasedLists.value.values()).flat().length
    }
  })

  // Initialize audience data
  const initializeAudience = async () => {
    if (!isAuthenticated.value) return

    isLoading.value = true
    error.value = ''

    try {
      console.log('Initializing audience data...')
      
      // Load from storage first
      loadFromStorage()
      
      // Fetch current follows
      await fetchCurrentFollows()
      
      // Generate smart suggestions
      await generateSmartSuggestions()
      
      // Fetch interest-based lists for selected interests
      if (selectedInterests.value.size > 0) {
        await fetchInterestBasedLists(Array.from(selectedInterests.value))
      }
      
      console.log('Audience initialization complete')
    } catch (err) {
      console.error('Failed to initialize audience:', err)
      error.value = 'Failed to load audience data: ' + err.message
    } finally {
      isLoading.value = false
    }
  }

  // Cleanup subscriptions
  const cleanup = () => {
    if (followListSubscription) {
      followListSubscription.close()
      followListSubscription = null
    }
    
    if (contactListSubscription) {
      contactListSubscription.close()
      contactListSubscription = null
    }
    
    profileSubscriptions.forEach(sub => sub.close())
    profileSubscriptions.clear()
  }

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      setTimeout(() => {
        initializeAudience()
      }, 1000)
    } else {
      cleanup()
      followLists.value = []
      currentFollows.value = []
      suggestedUsers.value = []
      interestBasedLists.value.clear()
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    followLists,
    currentFollows,
    suggestedUsers,
    interestBasedLists,
    selectedInterests,
    searchQuery,
    activeTab,
    isLoading,
    error,
    
    // Computed
    filteredFollows,
    followStats,
    interestStats,
    
    // Actions
    fetchCurrentFollows,
    fetchInterestBasedLists,
    generateSmartSuggestions,
    followUser,
    unfollowUser,
    createFollowList,
    followAllFromList,
    toggleInterest,
    searchInterests,
    fetchUserProfile,
    
    // Utilities
    initializeAudience,
    cleanup,
    
    // Constants
    interests
  }
}