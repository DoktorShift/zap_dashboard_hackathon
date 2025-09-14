<script setup>
import { ref, onMounted, watch, onUnmounted, computed, inject } from 'vue'
import * as nip19 from 'nostr-tools/nip19'
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
  IconClock
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

// Use Nostr auth to get user profile
const { isAuthenticated } = useNostrAuth()
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
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showClientDropdown.value = false
  }
}

const toggleClientDropdown = () => {
  showClientDropdown.value = !showClientDropdown.value
}

// Get URL for different Nostr clients
const getNostrClientUrl = (client) => {
  if (!event.value) return '#'
  
  try {
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${event.value.id}`
      case 'yakihonne':
        return `https://yakihonne.com/${nip19.neventEncode({ id: event.value.id })}`
      default:
        return `https://primal.net/e/${event.value.id}`
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
          picture: profile.picture || generateFallbackAvatar(pubkey),
          nip05: profile.nip05 || null,
          about: profile.about || null
        }
      } catch (err) {
        console.warn('Failed to parse author profile:', err)
        eventAuthor.value = {
          pubkey,
          name: `user:${pubkey.substring(0, 8)}`,
          picture: generateFallbackAvatar(pubkey)
        }
      }
    } else {
      eventAuthor.value = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        picture: generateFallbackAvatar(pubkey)
      }
    }
  } catch (err) {
    console.warn('Failed to fetch author profile:', err)
    eventAuthor.value = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateFallbackAvatar(pubkey)
    }
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
    case 30023: return 'Long-form Content'
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
      return `<h2 class="text-xl font-bold mb-2">${title}</h2>` + 
             (summary ? `<p class="text-gray-600 mb-4">${summary}</p>` : '') +
             formatContent(event.value.content)
    }
  }
  
  return formatContent(event.value.content)
}

// Format content with basic markdown-like processing
const formatContent = (content) => {
  if (!content) return ''
  
  let formatted = content
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
  
  formatted = formatted.replace(/\n/g, '<br>')
  
  const urlRegex = /(https?:\/\/[^\s]+)/g
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-600 hover:underline">$1</a>')
  
  const hashtagRegex = /#(\w+)/g
  formatted = formatted.replace(hashtagRegex, '<span class="text-orange-600">#$1</span>')
  
  const mentionRegex = /@(\w+)/g
  formatted = formatted.replace(mentionRegex, '<span class="text-blue-600">@$1</span>')
  
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
  emit('close')
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
  return amount.toString()
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
  { id: 'details', label: 'Details', icon: IconEye }
]
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-fade">
      <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
        
        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div class="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="bg-white border-b border-gray-100 px-6 py-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <component :is="getEventKindIcon(event?.kind)" class="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900">{{ getEventKindName(event?.kind) }}</h3>
                    <p class="text-sm text-gray-500">{{ formatDate(event?.created_at) }}</p>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2">
                  <!-- Share Button -->
                  <div v-if="event" class="relative" ref="dropdownRef">
                    <button
                      @click="toggleClientDropdown"
                      class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <IconShare class="w-4 h-4" />
                    </button>
                    
                    <!-- Client Dropdown -->
                    <transition name="dropdown-fade">
                      <div 
                        v-if="showClientDropdown"
                        class="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                      >
                        <a 
                          :href="getNostrClientUrl('primal')" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <span class="text-orange-600">🌐</span>
                          <span>Primal</span>
                        </a>
                        <a 
                          :href="getNostrClientUrl('yakihonne')" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <span class="text-purple-600">🍜</span>
                          <span>Yakihonne</span>
                        </a>
                      </div>
                    </transition>
                  </div>

                  <!-- Close Button -->
                  <button
                    @click="closeModal"
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <IconX class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="isLoading" class="p-8 text-center">
              <div class="w-12 h-12 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-gray-600">Loading event...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-8">
              <div class="text-center">
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <IconAlertCircle class="w-6 h-6 text-red-600" />
                </div>
                <h4 class="text-lg font-medium text-gray-900 mb-2">Error Loading Event</h4>
                <p class="text-sm text-red-600">{{ error }}</p>
              </div>
            </div>

            <!-- Event Content -->
            <div v-else-if="event" class="flex flex-col max-h-[calc(90vh-80px)]">
              <!-- Specific Zap Info (if viewing specific zap) -->
              <div v-if="specificZap" class="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 p-4">
                <div class="flex items-center space-x-3">
                  <img 
                    :src="specificZap.sender?.picture || specificZap.sender?.avatar" 
                    :alt="getSenderName(specificZap.sender)"
                    class="w-10 h-10 rounded-full border-2 border-orange-200 object-cover"
                    @error="$event.target.src = generateFallbackAvatar(specificZap.zapperPubkey)"
                  />
                  <div class="flex-1">
                    <div class="font-medium text-gray-900">{{ getSenderName(specificZap.sender) }}</div>
                    <div class="text-sm text-gray-600">{{ formatZapTime(specificZap.timestamp) }}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-orange-600 text-lg">{{ formatZapAmount(specificZap.amount) }}</div>
                    <div class="text-xs text-orange-700">sats</div>
                  </div>
                </div>
              </div>

              <!-- Tab Navigation -->
              <div class="border-b border-gray-100 bg-white">
                <nav class="flex">
                  <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    @click="activeTab = tab.id"
                    :class="[
                      'flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-all duration-200',
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600 bg-orange-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    ]"
                  >
                    <component :is="tab.icon" class="w-4 h-4" />
                    <span>{{ tab.label }}</span>
                    <span v-if="tab.count?.value > 0" class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                      {{ tab.count.value }}
                    </span>
                  </button>
                </nav>
              </div>

              <!-- Tab Content -->
              <div class="flex-1 overflow-y-auto">
                <!-- Content Tab -->
                <div v-if="activeTab === 'content'" class="p-6">
                  <!-- Author Info -->
                  <div v-if="eventAuthor" class="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
                    <img 
                      :src="eventAuthor.picture" 
                      :alt="eventAuthor.name"
                      class="w-12 h-12 rounded-full border-2 border-gray-200"
                    />
                    <div>
                      <div class="font-medium text-gray-900">{{ eventAuthor.name }}</div>
                      <div v-if="eventAuthor.nip05" class="text-sm text-gray-500">{{ eventAuthor.nip05 }}</div>
                      <div v-if="eventAuthor.about" class="text-sm text-gray-600 mt-1">{{ eventAuthor.about }}</div>
                    </div>
                  </div>

                  <!-- Main Content -->
                  <div class="prose prose-sm max-w-none">
                    <div v-html="getEventContent()"></div>
                  </div>
                  
                  <!-- Media Attachments -->
                  <div v-if="getMediaAttachments().length > 0" class="mt-6 space-y-3">
                    <h4 class="font-medium text-gray-900">Attachments</h4>
                    <div class="grid grid-cols-1 gap-3">
                      <div v-for="(attachment, index) in getMediaAttachments()" :key="index" class="rounded-lg overflow-hidden border border-gray-200">
                        <img 
                          v-if="attachment.type === 'image'" 
                          :src="attachment.url" 
                          alt="Attachment" 
                          class="w-full h-auto max-h-64 object-contain bg-gray-50"
                          @error="$event.target.style.display = 'none'"
                        />
                        <video 
                          v-else-if="attachment.type === 'video'"
                          :src="attachment.url"
                          controls
                          class="w-full max-h-64"
                          @error="$event.target.style.display = 'none'"
                        ></video>
                        <audio
                          v-else-if="attachment.type === 'audio'"
                          :src="attachment.url"
                          controls
                          class="w-full"
                          @error="$event.target.style.display = 'none'"
                        ></audio>
                        <div v-else class="bg-gray-50 p-4 rounded-lg">
                          <a 
                            :href="attachment.url" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="flex items-center space-x-2 text-blue-600 hover:underline"
                          >
                            <component :is="attachment.icon" class="w-4 h-4" />
                            <span>View attachment</span>
                            <IconExternalLink class="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Hashtags -->
                  <div v-if="getEventHashtags().length > 0" class="mt-6">
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="tag in getEventHashtags()"
                        :key="tag"
                        class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
                      >
                        <IconHash class="w-3 h-3" />
                        <span>{{ tag }}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Zaps Tab -->
                <div v-else-if="activeTab === 'zaps'" class="p-6">
                  <div v-if="zapsForEvent.length === 0" class="text-center py-12">
                    <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconBolt class="w-6 h-6 text-gray-400" />
                    </div>
                    <h4 class="text-lg font-medium text-gray-900 mb-2">No zaps yet</h4>
                    <p class="text-gray-500">Be the first to zap this content!</p>
                  </div>

                  <div v-else class="space-y-4">
                    <!-- Zaps Summary -->
                    <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-2xl font-bold text-orange-600">{{ zapAmount.toLocaleString() }}</div>
                          <div class="text-sm text-orange-700">Total sats received</div>
                        </div>
                        <div class="text-right">
                          <div class="text-lg font-semibold text-gray-900">{{ zapsForEvent.length }}</div>
                          <div class="text-sm text-gray-600">Zaps</div>
                        </div>
                      </div>
                    </div>

                    <!-- Zaps List -->
                    <div class="space-y-3">
                      <div
                        v-for="zap in zapsForEvent"
                        :key="zap.id"
                        class="bg-white border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div class="flex items-center space-x-3">
                          <img
                            :src="zap.sender?.avatar || zap.sender?.picture"
                            :alt="zap.sender?.name || 'User'"
                            class="w-10 h-10 rounded-full object-cover border border-gray-200"
                            @error="$event.target.src = generateFallbackAvatar(zap.zapperPubkey)"
                          />
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between">
                              <div class="font-medium text-gray-900 truncate">
                                {{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}
                              </div>
                              <div class="text-sm text-gray-500">{{ formatZapTime(zap.timestamp) }}</div>
                            </div>
                            <div v-if="zap.message" class="text-sm text-gray-600 mt-1">{{ zap.message }}</div>
                          </div>
                          <div class="text-right flex-shrink-0">
                            <div class="font-bold text-orange-600">{{ formatZapAmount(zap.amount) }}</div>
                            <div class="text-xs text-orange-700">sats</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Details Tab -->
                <div v-else-if="activeTab === 'details'" class="p-6">
                  <!-- Event Metadata -->
                  <div class="space-y-4">
                    <div class="bg-gray-50 rounded-lg p-4">
                      <h4 class="font-medium text-gray-900 mb-3">Event Information</h4>
                      <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                          <span class="text-gray-600">Event ID:</span>
                          <div class="flex items-center space-x-2">
                            <code class="text-gray-800 bg-gray-200 px-2 py-1 rounded text-xs font-mono">
                              {{ event.id.substring(0, 16) }}...
                            </code>
                            <button
                              @click="copyToClipboard(event.id, 'eventId')"
                              class="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <IconCheck v-if="copiedItem === 'eventId'" class="w-3 h-3 text-green-600" />
                              <IconCopy v-else class="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-gray-600">Kind:</span>
                          <span class="text-gray-800">{{ event.kind }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-gray-600">Created:</span>
                          <span class="text-gray-800">{{ new Date(event.created_at * 1000).toLocaleString() }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-gray-600">Author:</span>
                          <code class="text-gray-800 bg-gray-200 px-2 py-1 rounded text-xs font-mono">
                            {{ event.pubkey.substring(0, 16) }}...
                          </code>
                        </div>
                      </div>
                    </div>

                    <!-- Event Tags -->
                    <div v-if="getEventTags().length > 0" class="bg-gray-50 rounded-lg p-4">
                      <h4 class="font-medium text-gray-900 mb-3">Tags</h4>
                      <div class="space-y-2">
                        <div
                          v-for="(tag, index) in getEventTags().slice(0, 10)"
                          :key="index"
                          class="bg-white rounded p-2 border border-gray-200"
                        >
                          <div class="flex items-center space-x-2">
                            <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {{ tag[0] }}
                            </span>
                            <code class="text-xs text-gray-700 font-mono break-all">
                              {{ tag[1] }}
                            </code>
                          </div>
                        </div>
                        <div v-if="getEventTags().length > 10" class="text-xs text-gray-500 text-center">
                          +{{ getEventTags().length - 10 }} more tags
                        </div>
                      </div>
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
/* Modal transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}

/* Dropdown transitions */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease-out;
}

.dropdown-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Prose styling for content */
:deep(.prose) {
  max-width: none;
  color: #374151;
}

:deep(.prose a) {
  color: #2563eb;
  text-decoration: none;
}

:deep(.prose a:hover) {
  text-decoration: underline;
}

:deep(.prose h1) {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 1rem;
}

:deep(.prose h2) {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.75rem;
}

:deep(.prose p) {
  margin-bottom: 1rem;
  line-height: 1.6;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .max-w-2xl {
    max-width: 100%;
    margin: 0.5rem;
  }
  
  .p-6 {
    padding: 1rem;
  }
  
  .space-x-3 > * + * {
    margin-left: 0.75rem;
  }
}

/* Focus states for accessibility */
button:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Smooth hover effects */
.hover\:shadow-sm:hover {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.hover\:border-gray-200:hover {
  border-color: #e5e7eb;
}

/* Loading spinner */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Text utilities */
.break-all {
  word-break: break-all;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Ensure proper spacing on mobile */
@media (max-width: 768px) {
  .ml-13 {
    margin-left: 0;
    margin-top: 0.75rem;
  }
}
</style>