<script setup>
import { computed, inject } from 'vue'
import { IconBolt, IconFileText, IconMessageCircle, IconRepeat, IconDeviceMobile, IconUser } from '@iconify-prerendered/vue-tabler'
import Filters from '../components/Filters.vue'

const zapData = inject('zapData')
const searchQuery = inject('searchQuery')
const selectedFilters = inject('selectedFilters')
const selectedTimeRange = inject('selectedTimeRange')

const filteredZaps = computed(() => {
  let zaps = [...zapData.value]
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    zaps = zaps.filter(zap => {
      const noteContent = parseNoteContent(zap.note).toLowerCase()
      const senderName = (zap.sender?.name || '').toLowerCase()
      const senderNip05 = (zap.sender?.nip05 || '').toLowerCase()
      
      return noteContent.includes(query) || senderName.includes(query) || senderNip05.includes(query)
    })
  }
  
  // Apply amount filters
  if (selectedFilters.value.minAmount > 0) {
    zaps = zaps.filter(zap => zap.amount >= selectedFilters.value.minAmount)
  }
  if (selectedFilters.value.maxAmount) {
    zaps = zaps.filter(zap => zap.amount <= selectedFilters.value.maxAmount)
  }
  
  // Apply note type filter
  if (selectedFilters.value.noteType !== 'all') {
    zaps = zaps.filter(zap => zap.noteType === selectedFilters.value.noteType)
  }
  
  return zaps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
})

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

// Enhanced note content parsing to handle both string and JSON array formats
const parseNoteContent = (note) => {
  if (typeof note === 'string') {
    if (note.startsWith('[') && note.endsWith(']')) {
      try {
        const parsed = JSON.parse(note)
        if (Array.isArray(parsed)) {
          return extractTextFromArray(parsed)
        }
      } catch (error) {
        return note
      }
    }
    return note
  }
  
  if (Array.isArray(note)) {
    return extractTextFromArray(note)
  }
  
  if (typeof note === 'object' && note !== null) {
    try {
      return JSON.stringify(note)
    } catch (error) {
      return 'Unable to display note content'
    }
  }
  
  return String(note || 'No note content')
}

const extractTextFromArray = (noteArray) => {
  try {
    const textPlain = noteArray.find(item => Array.isArray(item) && item[0] === 'text/plain')
    if (textPlain && textPlain[1]) {
      return textPlain[1]
    }
    
    const textIdentifier = noteArray.find(item => Array.isArray(item) && item[0] === 'text/identifier')
    if (textIdentifier && textIdentifier[1]) {
      return textIdentifier[1]
    }
    
    const firstText = noteArray.find(item => Array.isArray(item) && typeof item[1] === 'string')
    if (firstText && firstText[1]) {
      return firstText[1]
    }
    
    return 'Complex note content'
  } catch (error) {
    return 'Unable to parse note content'
  }
}

// Dynamic avatar generation based on sender info
const generateAvatar = (sender, index) => {
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  if (sender?.avatar) {
    return sender.avatar
  }
  
  const identifier = sender?.name || sender?.pubkey || `user-${index}`
  const hash = identifier.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Get sender name with fallback
const getSenderName = (sender) => {
  return sender?.name || sender?.pubkey?.substring(0, 8) || 'Anonymous'
}

// Get note type icon component
const getNoteTypeIcon = (type) => {
  switch (type) {
    case 'original': return IconFileText
    case 'reply': return IconMessageCircle
    case 'repost': return IconRepeat
    default: return IconFileText
  }
}

// Truncate note content for compact display
const truncateNote = (note, maxLength = 120) => {
  const content = parseNoteContent(note)
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + '...'
}
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Page Header -->
    <div class="animate-fade-in">
      <h1 class="text-xl sm:text-2xl font-bold text-gray-800 mb-2 flex items-center space-x-2">
        <IconBolt class="w-6 h-6 text-orange-600" />
        <span>Zap Feed</span>
      </h1>
      <p class="text-gray-600 text-sm sm:text-base">Real-time feed of all your lightning tips</p>
    </div>
    
    <!-- Filters -->
    <div class="animate-fade-in" style="animation-delay: 0.1s;">
      <Filters />
    </div>
    
    <!-- Feed -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm animate-fade-in" style="animation-delay: 0.2s;">
      <div class="p-3 sm:p-4 border-b border-orange-100/50">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p class="text-sm text-gray-600">
            Showing {{ filteredZaps.length }} zaps
          </p>
          <button class="btn-secondary text-sm self-start sm:self-auto">
            <IconBolt class="w-4 h-4 animate-pulse" />
            Live Updates
          </button>
        </div>
      </div>
      
      <div class="divide-y divide-orange-100/50">
        <transition-group name="list-item" tag="div">
          <div
            v-for="(zap, index) in filteredZaps"
            :key="zap.id"
            class="p-3 hover:bg-orange-25/50 transition-all duration-200 hover:shadow-sm"
            :style="{ animationDelay: `${index * 0.05}s` }"
          >
            <!-- Compact Layout -->
            <div class="flex items-center space-x-3">
              <!-- Smaller Avatar -->
              <div class="relative flex-shrink-0">
                <img
                  :src="generateAvatar(zap.sender, index)"
                  :alt="getSenderName(zap.sender)"
                  class="w-8 h-8 rounded-full border-2 border-orange-200 transition-all duration-200 hover:border-orange-300"
                  @error="$event.target.src = generateAvatar(zap.sender, index)"
                />
              </div>
              
              <!-- Main Content - Single Row Layout -->
              <div class="flex-1 min-w-0">
                <!-- Header Row: Name, Amount, Time -->
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center space-x-2 min-w-0">
                    <span class="font-medium text-gray-800 text-sm truncate hover:text-orange-600 transition-colors duration-200">
                      {{ getSenderName(zap.sender) }}
                    </span>
                    <span v-if="zap.sender?.nip05" class="text-xs text-gray-500 truncate max-w-[100px]">
                      {{ zap.sender.nip05 }}
                    </span>
                  </div>
                  
                  <div class="flex items-center space-x-2 flex-shrink-0">
                    <!-- Compact Zap Amount -->
                    <div class="flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 px-2 py-1 rounded-full">
                      <IconBolt class="w-3 h-3 text-orange-600" />
                      <span class="font-bold text-orange-600 text-sm">{{ zap.amount?.toLocaleString() || 0 }}</span>
                    </div>
                    <span class="text-xs text-gray-400">{{ formatDate(zap.timestamp) }}</span>
                  </div>
                </div>
                
                <!-- Note Content Row -->
                <div class="flex items-center justify-between">
                  <p class="text-sm text-gray-700 flex-1 mr-3 truncate">
                    {{ truncateNote(zap.note) }}
                  </p>
                  
                  <!-- Compact Metadata -->
                  <div class="flex items-center space-x-1 flex-shrink-0">
                    <span v-if="zap.noteType" class="bg-orange-100 px-1.5 py-0.5 rounded text-xs text-orange-700 flex items-center space-x-1">
                      <component :is="getNoteTypeIcon(zap.noteType)" class="w-3 h-3" />
                    </span>
                    <span v-if="zap.client" class="bg-blue-100 px-1.5 py-0.5 rounded text-xs text-blue-700 flex items-center space-x-1">
                      <IconDeviceMobile class="w-3 h-3" />
                    </span>
                    <button class="text-xs text-orange-600 hover:text-orange-700 font-medium hover:underline transition-all duration-200">
                      View →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition-group>
      </div>
      
      <!-- Empty State -->
      <div v-if="filteredZaps.length === 0" class="text-center py-8 animate-fade-in">
        <div class="text-4xl mb-3 animate-bounce-subtle">
          <IconBolt class="w-12 h-12 mx-auto text-gray-300" />
        </div>
        <h3 class="text-lg font-medium text-gray-800 mb-2">No zaps found</h3>
        <p class="text-gray-600 text-sm px-4">
          {{ zapData.length === 0 ? 'Connect your wallet to see real zap data' : 'Try adjusting your filters or search terms.' }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.6s ease-out forwards;
  opacity: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>