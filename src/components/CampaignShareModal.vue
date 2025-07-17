<script setup>
import { ref, computed } from 'vue'
import { 
  IconShare, 
  IconX, 
  IconCopy, 
  IconCheck, 
  IconBrandTwitter, 
  IconMessageCircle, 
  IconLoader, 
  IconAlertCircle,
  IconLink
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const { shareCampaignOnNostr, isLoading: campaignsLoading } = useCampaigns()

// UI state
const copySuccess = ref('')
const customMessage = ref('')
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')

// Generate share URL
const shareUrl = computed(() => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
})

// Generate share text
const shareText = computed(() => {
  return `⚡ I'm raising sats! Support my campaign: ${props.campaign.title}`
})

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
  isSharing.value = true
  shareError.value = ''
  
  try {
    await shareCampaignOnNostr(props.campaign.id, customMessage.value)
    shareSuccess.value = true
    
    // Reset form
    customMessage.value = ''
    
    // Close modal after 2 seconds
    setTimeout(() => {
      emit('close')
    }, 2000)
  } catch (error) {
    shareError.value = error.message
    console.error('Failed to share on Nostr:', error)
  } finally {
    isSharing.value = false
  }
}

// Share on Twitter/X
const shareOnTwitter = () => {
  const text = encodeURIComponent(`${shareText.value}\n\n${shareUrl.value}`)
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
}

// Native share if available
const nativeShare = () => {
  if (navigator && navigator.share) {
    navigator.share({
      title: props.campaign.title,
      text: shareText.value,
      url: shareUrl.value
    }).catch(err => console.error('Error sharing:', err))
  } else {
    copyToClipboard(shareUrl.value, 'url')
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-xl w-full max-w-sm mx-4 shadow-lg">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900">Share Campaign</h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors"
        >
          <IconX class="w-5 h-5" />
        </button>
      </div>

      <!-- Success State -->
      <div v-if="shareSuccess" class="p-6 text-center">
        <div class="flex items-center justify-between">
          <IconCheck class="w-6 h-6 text-green-600 mx-auto" />
        </div>
        <p class="text-green-700 font-medium mt-2">Shared successfully!</p>
      </div>
      <!-- Main Content -->
      <div v-else class="p-4 space-y-4">
        <!-- Error Message -->
        <div v-if="shareError" class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-4 h-4 text-red-600" />
            <span class="text-sm text-red-600">{{ shareError }}</span>
          </div>
        </div>
        
        <!-- Share Options -->
        <div class="grid grid-cols-1 gap-3">
          <!-- Copy Link -->
          <div class="flex items-center">
            <input
              type="text"
              :value="shareUrl"
              readonly
              class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm bg-gray-50"
            />
            <button
              @click="copyToClipboard(shareUrl, 'url')"
              class="px-3 py-2 bg-orange-500 text-white rounded-r-lg"
            >
              <IconCheck v-if="copySuccess === 'url'" class="w-5 h-5" />
              <IconCopy v-else class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Native Share -->
          <button
            v-if="typeof navigator !== 'undefined' && navigator.share"
            @click="nativeShare"
            class="w-full bg-orange-500 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
          >
            <IconShare class="w-5 h-5" />
            <span>Share</span>
          </button>
          
          <!-- Twitter/X -->
          <button
            @click="shareOnTwitter"
            class="w-full bg-[#1DA1F2] text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
          >
            <IconBrandTwitter class="w-5 h-5" />
            <span>Share on X/Twitter</span>
          </button>
          
          <!-- Nostr -->
          <button
            @click="shareOnNostr"
            :disabled="isSharing"
            class="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
            <IconMessageCircle v-else class="w-5 h-5" />
            <span>{{ isSharing ? 'Posting...' : 'Post to Nostr' }}</span>
          </button>
          
          <!-- Custom Message (Collapsed) -->
          <details class="bg-gray-50 rounded-lg p-3">
            <summary class="font-medium text-sm text-gray-700 cursor-pointer">Add custom message</summary>
            <div class="mt-3">
              <textarea
                v-model="customMessage"
                rows="2"
                :placeholder="shareText"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              ></textarea>
            </div>
          </details>
        </div>
        
        <!-- Success Indicator -->
        <p v-if="copySuccess === 'url'" class="text-green-600 text-sm flex items-center justify-center">
          <IconCheck class="w-4 h-4 mr-1" />
          Link copied to clipboard!
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, a {
    min-height: 44px;
  }
}
</style>