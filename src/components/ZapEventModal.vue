<script setup>
import { ref, onMounted, watch, onUnmounted, computed, inject } from 'vue'
import { neventEncode, naddrEncode } from 'nostr-tools/nip19'
import { generateAvatar } from '../utils/avatarGenerator.js'
import {
  IconX,
  IconBolt,
  IconUser,
  IconCalendar,
  IconMessageCircle,
  IconRepeat,
  IconHeart,
  IconExternalLink,
  IconLoader,
  IconAlertCircle,
  IconFileText,
  IconPhoto,
  IconVideo,
  IconMicrophone,
  IconLink,
  IconHash,
  IconChevronDown,
  IconCheck,
  IconCopy,
  IconShare,
  IconBookmark,
  IconEye,
  IconClock,
  IconCode,
  IconBraces,
  IconDownload,
  IconArrowUpRight
} from '@iconify-prerendered/vue-tabler'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useContentZaps } from '../composables/useContentZaps.js'

const props = defineProps({
  eventId: {
    type: String,
    required: true
  },
  specificZapId: {
    type: String,
    required: false,
    default: null
  },
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

// State
const isLoading = ref(false)
const error = ref('')
const event = ref(null)
const eventAuthor = ref(null)
const specificZap = ref(null)
const showClientDropdown = ref(false)
const dropdownRef = ref(null)
const copiedItem = ref(null)
const activeTab = ref('content') // 'content', 'zaps', 'details'
const jsonViewMode = ref('formatted') // 'formatted', 'raw'

// Use Nostr auth to get user profile
const { isAuthenticated, currentUser } = useNostrAuth()
const { getTotalZapAmount, getZapsForContent } = useContentZaps()
const combinedZapData = inject('combinedZapData')

// Fetch event when modal is shown
watch(() => props.show, async (show) => {
  if (show && props.eventId) {
    await fetchEvent()
  }
})

// Fetch event when eventId changes
watch(() => props.eventId, async (newId, oldId) => {
  if (newId && newId !== oldId && props.show) {
    await fetchEvent()
  }
})

// Fetch event on mount if show is true
onMounted(async () => {
  if (props.show && props.eventId) {
    await fetchEvent()
  }
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

// Handle escape key
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.show) {
    closeModal()
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showClientDropdown.value = false
  }
}

const toggleClientDropdown = () => {
  showClientDropdown.value = !showClientDropdown.value
}

// Get URL for different Nostr clients with correct encoding
const getNostrClientUrl = (client) => {
  if (!event.value) return '#'

  try {
    const eventKind = event.value.kind
    const eventId = event.value.id

    switch (client) {
      case 'primal':
        return `https://primal.net/e/${eventId}`
      case 'yakihonne':
        // For long-form articles (kind 30023), use naddr
        if (eventKind === 30023) {
          const dTag = event.value.tags.find(tag => tag[0] === 'd')?.[1] || eventId
          const naddrData = {
            identifier: dTag,
            pubkey: event.value.pubkey,
            kind: 30023,
            relays: []
          }
          return `https://yakihonne.com/article/${naddrEncode(naddrData)}`
        }
        // For notes (kind 1) and other events, use nevent
        else {
          return `https://yakihonne.com/note/${neventEncode({ id: eventId })}`
        }
      default:
        return `https://primal.net/e/${eventId}`
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
}

// Fetch event from Nostr relays
const fetchEvent = async () => {
  if (!props.eventId) return

  isLoading.value = true
  error.value = ''
  event.value = null
  eventAuthor.value = null
  specificZap.value = null

  try {
    console.log(`Fetching event: ${props.eventId}`)

    const fetchedEvent = await nostrRelayManager.getEvent({
      ids: [props.eventId]
    })

    if (!fetchedEvent) {
      throw new Error('Event not found')
    }

    event.value = fetchedEvent
    console.log('Event fetched:', fetchedEvent)

    await fetchAuthorProfile(fetchedEvent.pubkey)

    if (props.specificZapId) {
      console.log('Looking for specific zap:', props.specificZapId)
      const zap = combinedZapData.value.find(z => z.id === props.specificZapId)
      if (zap) {
        console.log('Found specific zap:', zap)
        specificZap.value = zap
      } else {
        console.warn('Specific zap not found:', props.specificZapId)
      }
    }

  } catch (err) {
    console.error('Failed to fetch event:', err)
    error.value = `Failed to load event: ${err.message}`
  } finally {
    isLoading.value = false
  }
}

// Fetch author profile
const fetchAuthorProfile = async (pubkey) => {
  try {
    const authorEvent = await nostrRelayManager.getEvent({
      kinds: [0],
      authors: [pubkey],
      limit: 1
    })

    if (authorEvent) {
      try {
        const profile = JSON.parse(authorEvent.content)
        eventAuthor.value = {
          pubkey,
          name: profile.name || profile.display_name || `user:${pubkey.substring(0, 8)}`,
          picture: profile.picture || generateAvatar(pubkey),
          nip05: profile.nip05 || null,
          about: profile.about || null
        }
      } catch (err) {
        console.warn('Failed to parse author profile:', err)
        eventAuthor.value = {
          pubkey,
          name: `user:${pubkey.substring(0, 8)}`,
          picture: generateAvatar(pubkey)
        }
      }
    } else {
      eventAuthor.value = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        picture: generateAvatar(pubkey)
      }
    }
  } catch (err) {
    console.warn('Failed to fetch author profile:', err)
    eventAuthor.value = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateAvatar(pubkey)
    }
  }
}


// Copy to clipboard with feedback
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedItem.value = type
    setTimeout(() => {
      copiedItem.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Get zaps for this event
const zapsForEvent = computed(() => {
  return getZapsForContent(props.eventId) || []
})

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return ''

  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`

  return date.toLocaleDateString()
}

// Get event kind name
const getEventKindName = (kind) => {
  switch (kind) {
    case 0: return 'Profile'
    case 1: return 'Note'
    case 3: return 'Contact List'
    case 4: return 'Direct Message'
    case 5: return 'Deletion'
    case 6: return 'Repost'
    case 7: return 'Reaction'
    case 9041: return 'Campaign'
    case 9735: return 'Zap Receipt'
    case 30023: return 'Article'
    default: return `Kind ${kind}`
  }
}

// Get event kind icon
const getEventKindIcon = (kind) => {
  switch (kind) {
    case 0: return IconUser
    case 1: return IconFileText
    case 3: return IconUser
    case 4: return IconMessageCircle
    case 5: return IconX
    case 6: return IconRepeat
    case 7: return IconHeart
    case 9735: return IconBolt
    case 30023: return IconFileText
    default: return IconFileText
  }
}

// Get event content
const getEventContent = () => {
  if (!event.value) return ''

  if (event.value.kind === 30023) {
    const title = event.value.tags.find(tag => tag[0] === 'title')?.[1]
    const summary = event.value.tags.find(tag => tag[0] === 'summary')?.[1]

    if (title) {
      return `<h2 class="text-2xl font-black mb-3 text-gray-900">${title}</h2>` +
             (summary ? `<p class="text-gray-600 mb-6 text-base leading-relaxed">${summary}</p>` : '') +
             formatContent(event.value.content)
    }
  }

  return formatContent(event.value.content)
}

// Format content with basic markdown-like processing
const formatContent = (content) => {
  if (!content) return ''

  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  formatted = formatted.replace(/\n/g, '<br>')

  const urlRegex = /(https?:\/\/[^\s]+)/g
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" class="text-orange-600 hover:text-orange-700 hover:underline font-medium transition-colors">$1</a>')

  const hashtagRegex = /#(\w+)/g
  formatted = formatted.replace(hashtagRegex, '<span class="text-orange-600 font-semibold">#$1</span>')

  const mentionRegex = /@(\w+)/g
  formatted = formatted.replace(mentionRegex, '<span class="text-orange-600 font-semibold">@$1</span>')

  return formatted
}

// Get event tags
const getEventTags = () => {
  if (!event.value) return []

  return event.value.tags.filter(tag => {
    const excludedTags = ['d', 'published_at']
    return !excludedTags.includes(tag[0])
  })
}

// Close modal
const closeModal = () => {
  activeTab.value = 'content'
  showClientDropdown.value = false
  emit('close')
}

// Handle backdrop click
const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    closeModal()
  }
}

// Get media attachments
const getMediaAttachments = () => {
  if (!event.value) return []

  const attachments = []

  const imageTag = event.value.tags.find(tag => tag[0] === 'image')
  if (imageTag && imageTag[1]) {
    attachments.push({
      type: 'image',
      url: imageTag[1],
      icon: IconPhoto
    })
  }

  event.value.tags.forEach(tag => {
    if (tag[0] === 'media' && tag[1]) {
      let type = 'file'
      let icon = IconLink

      if (tag[1].match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        type = 'image'
        icon = IconPhoto
      } else if (tag[1].match(/\.(mp4|webm|mov)$/i)) {
        type = 'video'
        icon = IconVideo
      } else if (tag[1].match(/\.(mp3|wav|ogg)$/i)) {
        type = 'audio'
        icon = IconMicrophone
      }

      attachments.push({
        type,
        url: tag[1],
        icon
      })
    }
  })

  return attachments
}

// Get event hashtags
const getEventHashtags = () => {
  if (!event.value) return []

  const hashtags = []

  event.value.tags.forEach(tag => {
    if (tag[0] === 't' && tag[1]) {
      hashtags.push(tag[1])
    }
  })

  const content = event.value?.content || ''
  const hashtagRegex = /#(\w+)/g
  let match

  while ((match = hashtagRegex.exec(content)) !== null) {
    if (!hashtags.includes(match[1])) {
      hashtags.push(match[1])
    }
  }

  return hashtags
}

// Format zap amount for display
const formatZapAmount = (amount) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return amount.toLocaleString()
}

// Get sender name with fallback
const getSenderName = (sender) => {
  if (sender?.display_name) {
    return sender.display_name
  }

  if (sender?.name) {
    return sender.name
  }

  const pubkey = sender?.pubkey || sender?.zapperPubkey
  if (pubkey) {
    return `user:${pubkey.substring(0, 8)}`
  }

  return 'Anonymous'
}

// Get zap amount for this event
const zapAmount = computed(() => {
  return getTotalZapAmount(props.eventId) || 0
})

// Format time for zaps
const formatZapTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// Tab configuration
const tabs = [
  { id: 'content', label: 'Content', icon: IconFileText },
  { id: 'zaps', label: 'Zaps', icon: IconBolt, count: computed(() => zapsForEvent.value.length) },
  { id: 'details', label: 'Details', icon: IconCode }
]

// Enhanced JSON formatting for developer view
const formatEventJson = computed(() => {
  if (!event.value) return ''

  if (jsonViewMode.value === 'raw') {
    return JSON.stringify(event.value, null, 2)
  }

  // Formatted view with better organization
  const formattedEvent = {
    // Core event data
    id: event.value.id,
    pubkey: event.value.pubkey,
    created_at: event.value.created_at,
    kind: event.value.kind,

    // Human-readable timestamp
    created_at_human: new Date(event.value.created_at * 1000).toISOString(),

    // Content
    content: event.value.content,

    // Tags organized by type
    tags: {
      raw: event.value.tags,
      organized: organizeTagsByType(event.value.tags)
    },

    // Signature
    sig: event.value.sig
  }

  return JSON.stringify(formattedEvent, null, 2)
})

// Organize tags by type for better readability
const organizeTagsByType = (tags) => {
  const organized = {}

  tags.forEach(tag => {
    const tagType = tag[0]
    if (!organized[tagType]) {
      organized[tagType] = []
    }
    organized[tagType].push(tag.slice(1))
  })

  return organized
}

// Copy entire JSON
const copyEventJson = async () => {
  await copyToClipboard(formatEventJson.value, 'json')
}

// Download JSON as file
const downloadEventJson = () => {
  try {
    const blob = new Blob([formatEventJson.value], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nostr-event-${event.value.id.substring(0, 8)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download JSON:', error)
  }
}

// Format zapper pubkey for display
const formatZapperPubkey = (pubkey) => {
  if (!pubkey) return 'Anonymous'
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-slide">
      <div v-if="show" class="fixed inset-0 z-[9999]" @click="handleBackdropClick">
        <!-- Enhanced Backdrop with gradient -->
        <div class="modal-backdrop absolute inset-0 bg-gradient-to-br from-black/60 via-black/50 to-orange-900/20 backdrop-blur-lg transition-all duration-300"></div>

        <!-- Modal Container - Bottom Sheet on Mobile, Center on Desktop -->
        <div class="modal-panel absolute sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[90vw] sm:max-w-5xl bottom-0 sm:bottom-auto left-0 right-0 sm:right-auto bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl sm:shadow-[0_30px_90px_-20px_rgba(249,115,22,0.4)] sm:border sm:border-orange-100/50 max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden">
          <!-- Drag Handle (Mobile Only) -->
          <div class="flex sm:hidden justify-center pt-3 pb-2 bg-gradient-to-b from-orange-50 to-transparent">
            <div class="w-12 h-1.5 bg-gradient-to-r from-orange-300 to-amber-300 rounded-full shadow-sm"></div>
          </div>

          <!-- ZapTracker Brand Accent Line (Desktop) -->
          <div class="hidden sm:block h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400"></div>

          <!-- Enhanced Header with Apple aesthetic -->
          <div class="bg-gradient-to-b from-white via-white to-orange-50/20 backdrop-blur-xl px-5 sm:px-8 py-5 sm:py-6 border-b border-orange-100/50">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                <div class="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-amber-400 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-orange-200/50 flex-shrink-0">
                  <component :is="getEventKindIcon(event?.kind)" class="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-xl sm:text-2xl font-black text-gray-900 truncate">{{ getEventKindName(event?.kind) }}</h3>
                  <p class="text-xs sm:text-sm text-gray-500 font-semibold">{{ formatDate(event?.created_at) }}</p>
                </div>
              </div>

              <div class="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                <!-- Share Button with Dropdown -->
                <div v-if="event" class="relative" ref="dropdownRef">
                  <button
                    @click="toggleClientDropdown"
                    class="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-gray-100 to-gray-50 hover:from-orange-100 hover:to-amber-100 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg border border-gray-200/50 hover:border-orange-200"
                  >
                    <IconShare class="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  </button>

                  <!-- Enhanced Dropdown with Apple aesthetic -->
                  <transition name="dropdown-slide">
                    <div
                      v-if="showClientDropdown"
                      class="absolute right-0 mt-2 w-52 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 border border-orange-100/50 py-2 z-[99999] overflow-hidden"
                    >
                      <a
                        :href="getNostrClientUrl('primal')"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 hover:text-orange-700 transition-all duration-200 mx-2 rounded-xl"
                      >
                        <div class="flex items-center space-x-3">
                          <span class="text-xl">🌐</span>
                          <span>View on Primal</span>
                        </div>
                        <IconArrowUpRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </a>
                      <a
                        :href="getNostrClientUrl('yakihonne')"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 hover:text-orange-700 transition-all duration-200 mx-2 rounded-xl"
                      >
                        <div class="flex items-center space-x-3">
                          <span class="text-xl">🍜</span>
                          <span>View on Yakihonne</span>
                        </div>
                        <IconArrowUpRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </a>
                    </div>
                  </transition>
                </div>

                <!-- Close Button -->
                <button
                  @click="closeModal"
                  class="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg border border-gray-200/50"
                >
                  <IconX class="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="isLoading" class="flex-1 flex items-center justify-center p-12">
            <div class="text-center">
              <div class="relative w-20 h-20 mx-auto mb-6">
                <div class="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin"></div>
              </div>
              <p class="text-gray-600 font-semibold text-base">Loading event...</p>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="flex-1 flex items-center justify-center p-12">
            <div class="text-center max-w-md">
              <div class="w-20 h-20 bg-gradient-to-br from-red-100 to-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <IconAlertCircle class="w-10 h-10 text-red-600" />
              </div>
              <h4 class="text-xl font-black text-gray-900 mb-3">Failed to Load Event</h4>
              <p class="text-sm text-red-600 font-medium">{{ error }}</p>
            </div>
          </div>

          <!-- Event Content -->
          <div v-else-if="event" class="flex flex-col flex-1 min-h-0">
            <!-- Specific Zap Highlight (if viewing specific zap) -->
            <div v-if="specificZap" class="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 backdrop-blur-sm border-b border-orange-200/50 px-5 sm:px-8 py-5 sm:py-6">
              <div class="flex items-center space-x-4">
                <div class="relative">
                  <div class="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl blur-md opacity-40 animate-pulse"></div>
                  <img
                    :src="specificZap.sender?.picture || specificZap.sender?.avatar"
                    :alt="getSenderName(specificZap.sender)"
                    class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-3 border-white object-cover shadow-xl"
                    @error="$event.target.src = generateAvatar(specificZap.zapperPubkey)"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-black text-gray-900 text-lg sm:text-xl truncate">{{ getSenderName(specificZap.sender) }}</div>
                  <div class="text-sm text-gray-600 font-semibold">{{ formatZapTime(specificZap.timestamp) }}</div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="font-black text-orange-600 text-2xl sm:text-3xl">{{ formatZapAmount(specificZap.amount) }}</div>
                  <div class="text-xs sm:text-sm text-orange-700 font-bold">sats</div>
                </div>
              </div>
            </div>

            <!-- Clean Tab Navigation with Apple aesthetic -->
            <div class="bg-white/80 backdrop-blur-sm border-b border-orange-100/50">
              <nav class="flex px-5 sm:px-8 overflow-x-auto hide-scrollbar">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  @click="activeTab = tab.id"
                  :class="[
                    'flex items-center space-x-2 py-4 px-4 sm:px-6 font-bold text-sm border-b-2 transition-all duration-200 whitespace-nowrap flex-shrink-0',
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600 bg-gradient-to-t from-orange-50/50 to-transparent'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                  ]"
                >
                  <component :is="tab.icon" class="w-4 h-4" />
                  <span>{{ tab.label }}</span>
                  <span v-if="tab.count?.value > 0" class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-black">
                    {{ tab.count.value }}
                  </span>
                </button>
              </nav>
            </div>

            <!-- Tab Content with smooth scrolling -->
            <div class="flex-1 overflow-y-auto bg-gradient-to-b from-white to-orange-50/20 backdrop-blur-sm">
              <!-- Content Tab -->
              <div v-if="activeTab === 'content'" class="p-5 sm:p-8">
                <!-- Author Info with enhanced design -->
                <div v-if="eventAuthor" class="flex items-start space-x-4 mb-8 pb-6 border-b border-orange-100/50">
                  <div class="relative flex-shrink-0">
                    <div class="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl blur-sm opacity-30"></div>
                    <img
                      :src="eventAuthor.picture"
                      :alt="eventAuthor.name"
                      class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 border-white shadow-xl object-cover"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-black text-gray-900 text-lg sm:text-xl mb-1">{{ eventAuthor.name }}</div>
                    <div v-if="eventAuthor.nip05" class="text-sm text-orange-600 font-semibold mb-2">{{ eventAuthor.nip05 }}</div>
                    <div v-if="eventAuthor.about" class="text-sm text-gray-600 leading-relaxed line-clamp-2">{{ eventAuthor.about }}</div>
                  </div>
                </div>

                <!-- Main Content with enhanced typography -->
                <div class="prose prose-lg max-w-none text-gray-800">
                  <div v-html="getEventContent()"></div>
                </div>

                <!-- Media Attachments with enhanced cards -->
                <div v-if="getMediaAttachments().length > 0" class="mt-8 space-y-4">
                  <h4 class="font-black text-gray-900 text-lg flex items-center gap-2">
                    <IconPhoto class="w-5 h-5 text-orange-600" />
                    Attachments
                  </h4>
                  <div class="grid grid-cols-1 gap-4">
                    <div v-for="(attachment, index) in getMediaAttachments()" :key="index" class="rounded-2xl overflow-hidden border-2 border-orange-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
                      <img
                        v-if="attachment.type === 'image'"
                        :src="attachment.url"
                        alt="Attachment"
                        class="w-full h-auto max-h-96 object-cover bg-gray-50"
                        @error="$event.target.style.display = 'none'"
                      />
                      <video
                        v-else-if="attachment.type === 'video'"
                        :src="attachment.url"
                        controls
                        class="w-full max-h-96 bg-gray-900"
                        @error="$event.target.style.display = 'none'"
                      ></video>
                      <audio
                        v-else-if="attachment.type === 'audio'"
                        :src="attachment.url"
                        controls
                        class="w-full"
                        @error="$event.target.style.display = 'none'"
                      ></audio>
                      <div v-else class="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl">
                        <a
                          :href="attachment.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center justify-between text-orange-600 hover:text-orange-700 font-bold group"
                        >
                          <div class="flex items-center space-x-3">
                            <component :is="attachment.icon" class="w-5 h-5" />
                            <span>View attachment</span>
                          </div>
                          <IconExternalLink class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Hashtags with enhanced design -->
                <div v-if="getEventHashtags().length > 0" class="mt-8">
                  <div class="flex flex-wrap gap-2 sm:gap-3">
                    <span
                      v-for="tag in getEventHashtags()"
                      :key="tag"
                      class="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-all duration-200 border border-orange-200/50"
                    >
                      <IconHash class="w-3.5 h-3.5" />
                      <span>{{ tag }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Zaps Tab with enhanced design -->
              <div v-else-if="activeTab === 'zaps'" class="p-5 sm:p-8">
                <div v-if="zapsForEvent.length === 0" class="text-center py-16">
                  <div class="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <IconBolt class="w-12 h-12 text-gray-400" />
                  </div>
                  <h4 class="text-xl font-black text-gray-900 mb-3">No Zaps Yet</h4>
                  <p class="text-gray-500 font-medium">Be the first to zap this content!</p>
                </div>

                <div v-else class="space-y-6">
                  <!-- Zaps Summary with gradient card -->
                  <div class="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 rounded-3xl p-6 sm:p-8 border-2 border-orange-200/50 shadow-xl shadow-orange-100/50">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-4xl sm:text-5xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                          {{ zapAmount.toLocaleString() }}
                        </div>
                        <div class="text-sm text-orange-700 font-bold mt-1">Total sats received</div>
                      </div>
                      <div class="text-right">
                        <div class="text-3xl sm:text-4xl font-black text-gray-900">{{ zapsForEvent.length }}</div>
                        <div class="text-sm text-gray-600 font-bold mt-1">Zaps</div>
                      </div>
                    </div>
                  </div>

                  <!-- Zaps List with enhanced cards -->
                  <div class="space-y-4">
                    <div
                      v-for="zap in zapsForEvent"
                      :key="zap.id"
                      class="bg-white/90 backdrop-blur-sm border-2 border-orange-100/50 rounded-2xl p-5 sm:p-6 hover:bg-gradient-to-br hover:from-orange-50/50 hover:to-amber-50/50 transition-all duration-300 shadow-md hover:shadow-xl hover:border-orange-200"
                    >
                      <div class="flex items-center space-x-4">
                        <img
                          :src="zap.sender?.avatar || zap.sender?.picture"
                          :alt="zap.sender?.name || 'User'"
                          class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white shadow-lg flex-shrink-0"
                          @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between mb-2">
                            <div class="font-black text-gray-900 truncate text-base sm:text-lg">
                              {{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}
                            </div>
                            <div class="text-xs sm:text-sm text-gray-500 font-semibold flex-shrink-0 ml-2">{{ formatZapTime(zap.timestamp) }}</div>
                          </div>
                          <div v-if="zap.message" class="text-sm text-gray-700 bg-gray-50/80 rounded-xl p-3 mt-2 leading-relaxed">{{ zap.message }}</div>
                        </div>
                        <div class="text-right flex-shrink-0">
                          <div class="font-black text-orange-600 text-xl sm:text-2xl">{{ formatZapAmount(zap.amount) }}</div>
                          <div class="text-xs sm:text-sm text-orange-700 font-bold">sats</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Enhanced Details Tab -->
              <div v-else-if="activeTab === 'details'" class="p-5 sm:p-8">
                <!-- Developer Tools Header -->
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <IconCode class="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 class="text-xl font-black text-gray-900">Developer Tools</h4>
                      <p class="text-sm text-gray-600 font-medium">Inspect and export event data</p>
                    </div>
                  </div>

                  <!-- View Mode Toggle -->
                  <div class="flex items-center bg-gray-100/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-md">
                    <button
                      @click="jsonViewMode = 'formatted'"
                      :class="[
                        'px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2',
                        jsonViewMode === 'formatted'
                          ? 'bg-white text-blue-600 shadow-lg scale-105'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                      ]"
                    >
                      <IconBraces class="w-4 h-4" />
                      <span class="hidden sm:inline">Formatted</span>
                    </button>
                    <button
                      @click="jsonViewMode = 'raw'"
                      :class="[
                        'px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2',
                        jsonViewMode === 'raw'
                          ? 'bg-white text-blue-600 shadow-lg scale-105'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                      ]"
                    >
                      <IconCode class="w-4 h-4" />
                      <span class="hidden sm:inline">Raw</span>
                    </button>
                  </div>
                </div>

                <!-- Quick Actions -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                  <button
                    @click="copyEventJson"
                    class="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3.5 rounded-2xl font-black transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg hover:shadow-xl active:scale-95"
                  >
                    <IconCheck v-if="copiedItem === 'json'" class="w-5 h-5" />
                    <IconCopy v-else class="w-5 h-5" />
                    <span>{{ copiedItem === 'json' ? 'Copied!' : 'Copy JSON' }}</span>
                  </button>

                  <button
                    @click="downloadEventJson"
                    class="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg hover:shadow-xl active:scale-95"
                  >
                    <IconDownload class="w-5 h-5" />
                    <span>Download JSON</span>
                  </button>
                </div>

                <!-- Event Metadata Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                  <!-- Basic Info Card -->
                  <div class="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border-2 border-orange-100/50 shadow-lg">
                    <h5 class="font-black text-gray-900 mb-4 flex items-center gap-2">
                      <IconFileText class="w-5 h-5 text-orange-600" />
                      <span>Event Info</span>
                    </h5>
                    <div class="space-y-3">
                      <div class="flex flex-col gap-1">
                        <span class="text-xs text-gray-600 font-bold uppercase">Event ID:</span>
                        <div class="flex items-center gap-2">
                          <code class="text-xs text-gray-800 bg-gray-100/80 px-3 py-1.5 rounded-lg font-mono flex-1 truncate">
                            {{ event.id.substring(0, 20) }}...
                          </code>
                          <button
                            @click="copyToClipboard(event.id, 'eventId')"
                            class="w-9 h-9 bg-gray-100/80 hover:bg-gray-200/80 rounded-lg flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                          >
                            <IconCheck v-if="copiedItem === 'eventId'" class="w-4 h-4 text-green-600" />
                            <IconCopy v-else class="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                      <div class="flex justify-between pt-2">
                        <span class="text-sm text-gray-600 font-bold">Kind:</span>
                        <span class="text-sm text-gray-900 font-black">{{ event.kind }}</span>
                      </div>
                      <div class="flex flex-col gap-1 pt-2">
                        <span class="text-sm text-gray-600 font-bold">Created:</span>
                        <span class="text-sm text-gray-900 font-semibold">{{ new Date(event.created_at * 1000).toLocaleString() }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Tags Summary Card -->
                  <div class="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border-2 border-orange-100/50 shadow-lg">
                    <h5 class="font-black text-gray-900 mb-4 flex items-center gap-2">
                      <IconHash class="w-5 h-5 text-blue-600" />
                      <span>Tags Summary</span>
                    </h5>
                    <div class="space-y-3">
                      <div class="flex justify-between">
                        <span class="text-sm text-gray-600 font-bold">Total Tags:</span>
                        <span class="text-sm text-gray-900 font-black">{{ event.tags.length }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-sm text-gray-600 font-bold">Content Length:</span>
                        <span class="text-sm text-gray-900 font-black">{{ event.content.length }} chars</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-sm text-gray-600 font-bold">Signature:</span>
                        <span class="text-xs text-green-600 font-black flex items-center gap-1">
                          <IconCheck class="w-4 h-4" />
                          Valid
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Enhanced JSON Inspector -->
                <div class="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-orange-100/50 shadow-xl overflow-hidden">
                  <div class="bg-gradient-to-r from-gray-50 to-gray-100 backdrop-blur-sm px-6 py-4 border-b border-gray-200/50">
                    <div class="flex items-center justify-between">
                      <h5 class="font-black text-gray-900 flex items-center gap-2">
                        <IconBraces class="w-5 h-5 text-indigo-600" />
                        <span>Event JSON</span>
                      </h5>
                      <span class="text-xs text-gray-600 bg-white/80 px-3 py-1.5 rounded-full font-bold border border-gray-200">
                        {{ jsonViewMode === 'formatted' ? 'Developer Friendly' : 'Raw Event' }}
                      </span>
                    </div>
                  </div>

                  <div class="p-4 sm:p-6">
                    <div class="bg-gray-900 rounded-2xl p-4 sm:p-6 overflow-hidden shadow-inner">
                      <pre class="text-xs sm:text-sm text-green-400 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words"><code>{{ formatEventJson }}</code></pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Enhanced mobile-first slide transitions */
.modal-slide-enter-active,
.modal-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-slide-enter-from .modal-backdrop,
.modal-slide-leave-to .modal-backdrop {
  opacity: 0;
}

/* Mobile: Slide up from bottom */
.modal-slide-enter-from .modal-panel,
.modal-slide-leave-to .modal-panel {
  transform: translateY(100%);
}

/* Desktop: Fade and scale from center */
@media (min-width: 640px) {
  .modal-slide-enter-from .modal-panel,
  .modal-slide-leave-to .modal-panel {
    transform: translate(-50%, -50%) scale(0.9) rotate(-1deg);
    opacity: 0;
  }
}

/* Dropdown Transitions */
.dropdown-slide-enter-active,
.dropdown-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dropdown-slide-enter-from,
.dropdown-slide-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

/* Custom Scrollbar - Apple aesthetic */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: linear-gradient(to bottom, #fed7aa, #fef3c7);
  border-radius: 10px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #f97316, #f59e0b);
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #ea580c, #d97706);
}

/* Hide scrollbar for tab navigation */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Enhanced Prose Styling */
:deep(.prose) {
  max-width: none;
  color: #374151;
  line-height: 1.8;
}

:deep(.prose a) {
  color: #ea580c;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;
}

:deep(.prose a:hover) {
  color: #c2410c;
  text-decoration: underline;
}

:deep(.prose h1) {
  font-size: 1.875rem;
  font-weight: 900;
  color: #111827;
  margin-bottom: 1.5rem;
  line-height: 1.2;
}

:deep(.prose h2) {
  font-size: 1.5rem;
  font-weight: 800;
  color: #111827;
  margin-bottom: 1rem;
  line-height: 1.3;
}

:deep(.prose p) {
  margin-bottom: 1.5rem;
  line-height: 1.8;
}

/* Line clamp for author bio */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Apple-like Button Interactions */
button:not(:disabled) {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

button:not(:disabled):active {
  transform: scale(0.95);
}

/* Focus States */
button:focus-visible,
a:focus-visible {
  outline: 3px solid #fb923c;
  outline-offset: 3px;
  border-radius: 16px;
}

/* Code Block Styling */
pre code {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.8125rem;
  line-height: 1.7;
}

/* Ensure proper text wrapping */
.break-words {
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

.whitespace-pre-wrap {
  white-space: pre-wrap;
}

/* Prevent body scroll when modal is open */
body:has(.modal-panel) {
  overflow: hidden;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .modal-panel {
    border-radius: 1.5rem 1.5rem 0 0;
  }
}
</style>
