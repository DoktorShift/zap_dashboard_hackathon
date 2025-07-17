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
  IconAlertCircle
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
    
    // Close modal after 2 seconds
    setTimeout(() => {
      emit('close')
    }, 2000)
    
  } catch (error) {
    console.error('Failed to share campaign:', error)
    shareError.value = error.message || 'Failed to share campaign'
  } finally {
    isSharing.value = false
  }
}

// Share via Web Share API
const shareViaWebShare = async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: props.campaign.title,
        text: `Support my campaign: ${props.campaign.title}`,
        url: shareUrl.value
      })
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Web share failed:', error)
      }
    }
  }
}

// Format amount in sats
const formatAmount = (amount) => {
  if (!amount) return '0'
  const sats = Math.floor(amount / 1000)
  return sats ? sats.toLocaleString() : '0'
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-xl flex items-center justify-center text-white shadow-sm">
              <IconShare class="w-5 h-5" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900">Share Campaign</h3>
          </div>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Success State -->
      <div v-if="shareSuccess" class="p-6 text-center">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconCheck class="w-8 h-8 text-green-600" />
        </div>
        <h4 class="text-xl font-semibold text-green-700 mb-2">Shared Successfully! 🎉</h4>
        <p class="text-gray-600 mb-4">Your campaign has been shared to Nostr with the proper goal tag for zap tracking.</p>
        <p class="text-sm text-gray-500">This window will close automatically...</p>
      </div>

      <!-- Main Content -->
      <div v-else class="p-6">
        <!-- Campaign Preview -->
        <div class="bg-gray-50 rounded-xl p-4 mb-6">
          <h4 class="font-semibold text-gray-900 mb-2">{{ campaign.title }}</h4>
          <p class="text-sm text-gray-600 mb-3">{{ campaign.summary }}</p>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500">Goal:</span>
            <span class="font-semibold text-orange-600">{{ formatAmount(campaign.goalAmount) }} sats</span>
          </div>
        </div>

        <!-- Share URL -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Campaign URL</label>
          <div class="flex items-center space-x-2">
            <input
              :value="shareUrl"
              readonly
              class="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
            />
            <button
              @click="copyToClipboard(shareUrl, 'url')"
              class="p-2 text-gray-400 hover:text-gray-600 border border-gray-300 rounded-lg transition-colors"
            >
              <IconCheck v-if="copySuccess === 'url'" class="w-4 h-4 text-green-600" />
              <IconCopy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Custom Message -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Custom Message (optional)</label>
          <textarea
            v-model="customMessage"
            rows="3"
            placeholder="Add a personal message to your campaign share..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 text-sm resize-none"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">This will be posted to Nostr with the campaign link</p>
        </div>

        <!-- Error Message -->
        <div v-if="shareError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-600" />
            <span class="text-red-600">{{ shareError }}</span>
          </div>
        </div>

        <!-- Share Actions -->
        <div class="space-y-3">
          <!-- Share on Nostr -->
          <button
            @click="shareOnNostr"
            :disabled="!isAuthenticated || isSharing"
            class="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
            <IconBolt v-else class="w-5 h-5" />
            <span>{{ isSharing ? 'Posting...' : 'Post to Nostr' }}</span>
          </button>

          <!-- Web Share API -->
          <button
            v-if="navigator.share"
            @click="shareViaWebShare"
            class="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
          >
            <IconShare class="w-5 h-5" />
            <span>Share via System</span>
          </button>

          <!-- Manual Copy -->
          <button
            @click="copyToClipboard(shareUrl, 'manual')"
            class="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
          >
            <IconCheck v-if="copySuccess === 'manual'" class="w-5 h-5 text-green-600" />
            <IconCopy v-else class="w-5 h-5" />
            <span>{{ copySuccess === 'manual' ? 'Copied!' : 'Copy Link' }}</span>
          </button>
        </div>

        <!-- Info Box -->
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <IconBolt class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="font-medium text-blue-900 mb-1">Zap Tracking</h4>
              <p class="text-sm text-blue-800">
                When you post to Nostr, zaps sent to your post will automatically count towards your campaign goal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Button hover effects */
button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}
</style>
</script>
</template>