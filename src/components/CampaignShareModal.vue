<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-3xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-300 scale-100">
      <!-- Header with Campaign Preview -->
      <div class="relative bg-gradient-to-br from-blue-50 to-indigo-50 px-6 pt-6 pb-4">
        <!-- Close Button -->
        <button
          @click="$emit('close')"
          class="absolute top-4 right-4 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
        >
          <IconX class="w-4 h-4 text-gray-600" />
        </button>
        
        <!-- Campaign Info -->
        <div class="pr-8">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <IconShare class="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Share Campaign</h3>
              <p class="text-sm text-gray-600">Spread the word and get support</p>
            </div>
          </div>
          
          <!-- Campaign Preview Card -->
          <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h4 class="font-semibold text-gray-900 text-base mb-1 line-clamp-1">{{ campaign.title }}</h4>
            <p class="text-sm text-gray-600 mb-3 line-clamp-2">{{ campaign.summary }}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">Goal</span>
              <span class="font-bold text-orange-600 text-sm">{{ formatAmount(campaign.goalAmount) }} sats</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Success State -->
      <div v-if="shareSuccess" class="px-6 py-8 text-center">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconCheck class="w-8 h-8 text-green-600" />
        </div>
        <h4 class="text-xl font-bold text-gray-900 mb-2">Posted Successfully! 🎉</h4>
        <p class="text-gray-600 mb-1">Your campaign is now shared on Nostr</p>
        <p class="text-sm text-gray-500">Zaps to your post will count towards your goal</p>
      </div>

      <!-- Main Content -->
      <div v-else class="px-6 py-6">
        <!-- Primary Actions -->
        <div class="space-y-3 mb-6">
          <!-- Post to Nostr - Primary Action -->
          <button
            @click="shareOnNostr"
            :disabled="!isAuthenticated || isSharing"
            class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-4 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
            <IconBolt v-else class="w-5 h-5" />
            <span class="text-lg">{{ isSharing ? 'Posting...' : 'Post to Nostr' }}</span>
          </button>
          
          <!-- Copy Link - Secondary Action -->
          <button
            @click="copyToClipboard(shareUrl, 'url')"
            class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-4 rounded-2xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-sm hover:shadow-md transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <IconCheck v-if="copySuccess === 'url'" class="w-5 h-5 text-green-600" />
            <IconCopy v-else class="w-5 h-5" />
            <span>{{ copySuccess === 'url' ? 'Copied!' : 'Copy Campaign Link' }}</span>
          </button>
        </div>

        <!-- Advanced Options Toggle -->
        <div class="mb-6">
          <button
            @click="showAdvanced = !showAdvanced"
            class="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors duration-200"
          >
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                <IconMessageCircle class="w-4 h-4 text-gray-600" />
              </div>
              <span class="font-medium text-gray-700">Customize Message</span>
            </div>
            <IconChevronDown :class="[
              'w-5 h-5 text-gray-500 transition-transform duration-200',
              showAdvanced ? 'rotate-180' : ''
            ]" />
          </button>
          
          <!-- Advanced Options Content -->
          <transition name="slide-down">
            <div v-if="showAdvanced" class="mt-4 space-y-4">
              <!-- Custom Message -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Custom Message</label>
                <textarea
                  v-model="customMessage"
                  rows="4"
                  placeholder="🎯 Support my campaign: [Campaign Title]

[Campaign URL]

#ZapTracker #Bitcoin #Lightning"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none transition-all duration-200"
                ></textarea>
                <p class="text-xs text-gray-500 mt-2">Leave empty to use the default message</p>
              </div>
              
              <!-- Campaign URL Preview -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Campaign URL</label>
                <div class="flex items-center space-x-2">
                  <input
                    :value="shareUrl"
                    readonly
                    class="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600"
                  />
                  <button
                    @click="copyToClipboard(shareUrl, 'advanced')"
                    class="p-3 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl transition-colors hover:bg-gray-50"
                  >
                    <IconCheck v-if="copySuccess === 'advanced'" class="w-4 h-4 text-green-600" />
                    <IconCopy v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- Error Message -->
        <div v-if="shareError" class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div class="flex items-center space-x-3">
            <IconAlertCircle class="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p class="font-medium text-red-800 text-sm">Sharing Failed</p>
              <p class="text-red-700 text-sm">{{ shareError }}</p>
            </div>
          </div>
        </div>

        <!-- Info Box -->
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div class="flex items-start space-x-3">
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <IconBolt class="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 class="font-semibold text-blue-900 text-sm mb-1">Zap Tracking</h4>
              <p class="text-blue-800 text-sm leading-relaxed">
                When you post to Nostr, zaps sent to your post will automatically count towards your campaign goal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  IconShare, 
  IconX, 
  IconCopy, 
  IconCheck, 
  IconExternalLink,
  IconBolt,
  IconMessageCircle,
  IconLoader,
  IconAlertCircle,
  IconChevronDown
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { shareCampaignOnNostr } = useCampaigns()
const { currentUser } = useNostrAuth()

// State
const shareUrl = ref('')
const customMessage = ref('')
const copySuccess = ref('')
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')
const showAdvanced = ref(false)

// Generate share URL
const generateShareUrl = () => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
}

// Initialize share URL
shareUrl.value = generateShareUrl()

// Copy to clipboard
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Share on Nostr
const shareOnNostr = async () => {
  if (!props.isAuthenticated) {
    shareError.value = 'Please connect your Nostr identity to share'
    return
  }

  isSharing.value = true
  shareError.value = ''

  try {
    console.log('🔗 Sharing campaign on Nostr with goal tag...')
    
    // Create content with custom message or default
    const content = customMessage.value.trim() || 
      `🎯 Support my campaign: ${props.campaign.title}\n\n${shareUrl.value}\n\n#ZapTracker #Bitcoin #Lightning`
    
    console.log('Share content:', content)
    
    // Create event template with proper goal tag
    const eventTemplate = {
      kind: 1, // Text note
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        // CRITICAL: Reference the campaign as a zapgoal with the "goal" tag (NIP-75)
        ['goal', props.campaign.id],
        
        // Also reference the campaign with an "e" tag for better client compatibility
        ['e', props.campaign.id],
        
        // Reference the campaign creator
        ['p', props.campaign.pubkey]
      ],
      content
    }
    
    console.log('Event template with goal tag:', eventTemplate)
    console.log('Tags being added:', eventTemplate.tags)
    
    // Sign the event
    let signedEvent
    if (window.nostr?.signEvent) {
      signedEvent = await window.nostr.signEvent(eventTemplate)
    } else {
      throw new Error('Nostr extension not available for signing')
    }
    
    console.log('Signed event with goal tag:', signedEvent)
    
    // Verify the signed event
    const isValid = verifyEvent(signedEvent)
    if (!isValid) {
      throw new Error('Event signature verification failed')
    }
    
    // Publish to relays
    const result = await nostrRelayManager.publishEvent(signedEvent)
    
    if (result.successful === 0) {
      throw new Error('Failed to publish to any relays')
    }
    
    console.log('✅ Campaign shared successfully with goal tag:', {
      eventId: signedEvent.id,
      successfulRelays: result.successful,
      failedRelays: result.failed,
      goalTag: signedEvent.tags.find(tag => tag[0] === 'goal')
    })
    
    shareSuccess.value = true
    
    // Close modal after 3 seconds
    setTimeout(() => {
      emit('close')
    }, 3000)
    
  } catch (error) {
    console.error('Failed to share campaign:', error)
    shareError.value = error.message || 'Failed to share campaign'
  } finally {
    isSharing.value = false
  }
}

// Format amount in sats
const formatAmount = (amount) => {
  if (!amount) return '0'
  const sats = Math.floor(amount / 1000)
  return sats ? sats.toLocaleString() : '0'
}
</script>

<style scoped>
/* Line clamp utilities */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Slide down animation for advanced options */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Smooth micro-interactions */
button:not(:disabled) {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Custom scrollbar for textarea */
textarea::-webkit-scrollbar {
  width: 4px;
}

textarea::-webkit-scrollbar-track {
  background: transparent;
}

textarea::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}
</style>