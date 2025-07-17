<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconShare, 
  IconX, 
  IconCopy, 
  IconCheck, 
  IconBrandTwitter, 
  IconMessageCircle, 
  IconLoader, 
  IconAlertCircle,
  IconLink,
  IconHash,
  IconTarget,
  IconCode,
  IconEye
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const { shareCampaignOnNostr, isLoading: campaignsLoading } = useCampaigns()
const { isAuthenticated, currentUser } = useNostrAuth()

// UI state
const copySuccess = ref('')
const customMessage = ref('')
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')
const includeHashtags = ref(true)
const defaultHashtags = ref(['zapgoal', 'nostr', 'fundraising', 'ZapTracker'])
const customHashtags = ref([])
const newHashtag = ref('')
const showAdvancedOptions = ref(false)
const publishedNoteId = ref(null)

// Extract hashtags from message content
const extractHashtagsFromContent = (content) => {
  if (!content) return []
  
  const hashtagRegex = /#(\w+)/g
  const hashtags = []
  let match
  
  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push(match[1])
  }
  
  return hashtags
}

// Generate share URL
const shareUrl = computed(() => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
})

// Generate share text
const shareText = computed(() => {
  return `⚡ I'm raising sats! Support my campaign: ${props.campaign.title}`
})

// Complete message with URL always included
const completeMessage = computed(() => {
  const baseMessage = customMessage.value || shareText.value
  
  // Check if URL is already included in the message
  if (baseMessage.includes(shareUrl.value)) {
    return baseMessage
  }
  
  // Add URL on a new line if not already included
  return `${baseMessage}\n\n${shareUrl.value}`
})

// Generate hashtags for the note
const combinedHashtags = computed(() => {
  const tags = []
  
  // Add hashtags extracted from the message content
  const contentHashtags = extractHashtagsFromContent(completeMessage.value)
  tags.push(...contentHashtags)
  
  if (includeHashtags.value) {
    tags.push(...defaultHashtags.value)
  }
  
  if (customHashtags.value.length > 0) {
    tags.push(...customHashtags.value)
  }
  
  return [...new Set(tags)] // Remove duplicates
})

// Generate preview of the final post
const postPreview = computed(() => {
  let preview = completeMessage.value
  
  // Add hashtags if any
  if (combinedHashtags.value.length > 0) {
    preview += '\n\n' + combinedHashtags.value.map(tag => `#${tag}`).join(' ')
  }
  
  return preview
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
  if (!isAuthenticated.value || !window.nostr) {
    shareError.value = 'Nostr authentication required'
    return
  }
  
  isSharing.value = true
  shareError.value = ''
  publishedNoteId.value = null
  
  try {
    console.log('Publishing note with zapgoal reference...')
    
    // Use the complete message that always includes the URL
    const messageContent = completeMessage.value
    
    // Prepare tags
    const tags = [
      // Reference the campaign as a zapgoal with the "goal" tag
      ['goal', props.campaign.id],
      
      // Also reference the campaign with an "e" tag for better client compatibility
      ['e', props.campaign.id, '', 'mention'],
      
      // Public key of the campaign creator (used in zap receipts)
      ['p', props.campaign.pubkey],
      
      // (Custom tag) Explicitly state that this post is zap-related
      ['zap', props.campaign.pubkey],
      
      // (Optional) Human-readable fallback for accessibility and indexing
      ['alt', `Support this campaign: ${props.campaign.title}`],
      
      // Add hashtags as "t" tags
      ...combinedHashtags.value.map(tag => ['t', tag])
    ]
    
    // Create event
    const eventTemplate = {
      kind: 1, // Text note
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: messageContent
    }
    
    // Sign the event
    let signedEvent
    if (window.nostr?.signEvent) {
      try {
        signedEvent = await window.nostr.signEvent(eventTemplate)
        // Verify the signed event
        if (!verifyEvent(signedEvent)) {
          console.warn('Zap request signature verification failed, using unsigned request')
          signedEvent = eventTemplate
        }
      } catch (err) {
        console.warn('Failed to sign zap request:', err)
        signedEvent = eventTemplate
      }
    } else {
      signedEvent = eventTemplate
    }
    
    // Publish to Nostr relays
    const result = await nostrRelayManager.publishEvent(signedEvent)
    
    if (result.successful === 0) {
      throw new Error('Failed to publish to any relays')
    }
    
    console.log('✅ Note published successfully:', {
      eventId: signedEvent.id,
      successfulRelays: result.successful,
      failedRelays: result.failed
    })
    
    // Store the published note ID
    publishedNoteId.value = signedEvent.id
    shareSuccess.value = true
    
    // Reset form
    customMessage.value = ''
    newHashtag.value = ''
    
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

// Add a custom hashtag
const addHashtag = () => {
  if (!newHashtag.value.trim()) return
  
  // Remove # if present
  let tag = newHashtag.value.trim()
  if (tag.startsWith('#')) {
    tag = tag.substring(1)
  }
  
  // Only add if not already in the list
  if (!customHashtags.value.includes(tag) && !defaultHashtags.value.includes(tag)) {
    customHashtags.value.push(tag)
  }
  
  newHashtag.value = ''
}

// Remove a custom hashtag
const removeHashtag = (tag) => {
  const index = customHashtags.value.indexOf(tag)
  if (index !== -1) {
    customHashtags.value.splice(index, 1)
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
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                :placeholder="`⚡ I'm raising sats! Support my campaign: ${props.campaign.title}`"
              ></textarea>
            </div>
          </details>
          
          <!-- Advanced Options Toggle -->
          <div class="mt-3">
            <button 
              @click="showAdvancedOptions = !showAdvancedOptions"
              class="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
            >
              <span>{{ showAdvancedOptions ? 'Hide' : 'Show' }} advanced options</span>
              <IconHash class="w-3 h-3" />
            </button>
          </div>
          
          <!-- Advanced Options -->
          <div v-if="showAdvancedOptions" class="mt-3 space-y-3">
            <!-- Hashtags -->
            <div>
              <div class="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  id="include-hashtags"
                  v-model="includeHashtags"
                  class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label for="include-hashtags" class="text-sm text-gray-700">Include default hashtags</label>
              </div>
              
              <!-- Default Hashtags -->
              <div v-if="includeHashtags" class="flex flex-wrap gap-2 mb-3">
                <span
                  v-for="tag in defaultHashtags"
                  :key="tag"
                  class="inline-flex items-center space-x-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs"
                >
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                </span>
              </div>
              
              <!-- Custom Hashtags -->
              <div class="flex flex-wrap gap-2 mb-3">
                <span
                  v-for="tag in customHashtags"
                  :key="tag"
                  class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs"
                >
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                  <button @click="removeHashtag(tag)" class="text-orange-500 hover:text-orange-700">
                    <IconX class="w-3 h-3" />
                  </button>
                </span>
              </div>
              
              <!-- Add Custom Hashtag -->
              <div class="flex space-x-2">
                <input
                  v-model="newHashtag"
                  type="text"
                  placeholder="Add custom hashtag..."
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  @keyup.enter="addHashtag"
                />
                <button
                  @click="addHashtag"
                  class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                >
                  Add
                </button>
              </div>
            </div>
            
            <!-- ZapGoal Info -->
          <!-- Simple ZapGoal Info -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p class="text-blue-800">
              <IconTarget class="w-3 h-3 inline-block mr-1" />
              Your note will include a reference to this campaign, allowing zaps to be tracked across both the campaign and related notes.
            </p>
            
          </div>
        </div> 
        
        <!-- Success Indicator -->
        <p v-if="copySuccess === 'url'" class="text-green-600 text-sm flex items-center justify-center">
          <IconCheck class="w-4 h-4 mr-1" />
          Link copied to clipboard!
        </p>
        
        <!-- Published Note Success -->
        <div v-if="publishedNoteId" class="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <div class="flex items-start space-x-2">
            <IconCheck class="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="text-sm font-medium text-green-800 mb-1">Note Published Successfully</h4>
              <p class="text-xs text-green-700 mb-2">
                Your note has been published to the Nostr network with a reference to this campaign.
              </p>
              <div class="flex space-x-2">
                <a 
                  :href="`https://primal.net/e/${publishedNoteId}`" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors flex items-center space-x-1"
                >
                  <IconExternalLink class="w-3 h-3" />
                  <span>View on Primal</span>
                </a>
              </div>
            </div>
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
  button, a {
    min-height: 44px;
  }
}
</style>