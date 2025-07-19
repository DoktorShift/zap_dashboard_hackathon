<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
    <!-- Mobile-first modal design -->
    <div class="bg-white w-full sm:max-w-lg sm:rounded-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-300">
      <!-- Sticky Header with ZapTracker Branding -->
      <div class="sticky top-0 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 z-10">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 sm:p-6">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-lg">
              <IconShare class="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-white">Share Campaign</h3>
              <p class="text-orange-100 text-sm">Spread the word and get support</p>
            </div>
          </div>
          <button
            @click="$emit('close')"
            class="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 text-white"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Campaign Preview Card -->
        <div class="px-4 sm:px-6 pb-4">
          <div class="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20">
            <div class="flex items-start space-x-3">
              <div v-if="campaign.image" class="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                <img 
                  :src="campaign.image" 
                  :alt="campaign.title"
                  class="w-full h-full object-cover"
                  @error="$event.target.style.display = 'none'"
                />
              </div>
              <div v-else class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                <IconTarget class="w-6 h-6 text-white" />
              </div>
              
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-900 text-base mb-1 line-clamp-1">{{ campaign.title }}</h4>
                <p class="text-sm text-gray-600 mb-2 line-clamp-2">{{ campaign.summary }}</p>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-500 font-medium">Goal</span>
                  <span class="font-bold text-orange-600 text-sm">{{ formatAmount(campaign.goalAmount) }} sats</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Success State -->
      <div v-if="shareSuccess" class="px-4 sm:px-6 py-8 text-center">
        <div class="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <IconCheck class="w-10 h-10 text-white" />
        </div>
        <h4 class="text-2xl font-bold text-gray-900 mb-3">Posted Successfully! 🎉</h4>
        <p class="text-gray-600 mb-2 text-lg">Your campaign is now shared on Nostr</p>
        <p class="text-sm text-gray-500">Zaps to your post will count towards your goal</p>
        
        <!-- ZapTracker Branding -->
        <div class="mt-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
          <div class="flex items-center justify-center space-x-2">
            <img 
              src="/new_logo3.png"
              alt="ZapTracker" 
              class="w-5 h-5 object-contain"
            />
            <span class="text-sm font-medium text-orange-700">Powered by ZapTracker</span>
          </div>
        </div>
      </div>

      <!-- Main Content - Scrollable -->
      <div v-else class="overflow-y-auto max-h-[calc(95vh-200px)] sm:max-h-[calc(90vh-220px)]">
        <div class="px-4 sm:px-6 py-6 space-y-6">
          <!-- Primary Action - Post to Nostr -->
          <div class="space-y-4">
            <h4 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconBolt class="w-5 h-5 text-orange-600" />
              <span>Share on Nostr</span>
            </h4>
            
            <button
              @click="shareOnNostr"
              :disabled="!isAuthenticated || isSharing"
              class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-4 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] touch-target"
            >
              <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
              <IconBolt v-else class="w-5 h-5" />
              <span class="text-lg">{{ isSharing ? 'Posting...' : 'Post to Nostr Network' }}</span>
            </button>
            
            <!-- Authentication Notice -->
            <div v-if="!isAuthenticated" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div class="flex items-start space-x-3">
                <IconAlertCircle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-amber-800">Nostr Login Required</p>
                  <p class="text-sm text-amber-700 mt-1">Connect your Nostr identity to share campaigns on the network</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-200"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-4 bg-white text-gray-500 font-medium">or</span>
            </div>
          </div>

          <!-- Secondary Action - Copy Link -->
          <div class="space-y-4">
            <h4 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconCopy class="w-5 h-5 text-blue-600" />
              <span>Share Link</span>
            </h4>
            
            <button
              @click="copyToClipboard(shareUrl, 'url')"
              class="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-4 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] touch-target"
            >
              <IconCheck v-if="copySuccess === 'url'" class="w-5 h-5 text-white" />
              <IconCopy v-else class="w-5 h-5" />
              <span class="text-lg">{{ copySuccess === 'url' ? 'Copied!' : 'Copy Campaign Link' }}</span>
            </button>
            
            <!-- URL Preview -->
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <label class="block text-sm font-medium text-gray-700 mb-2">Campaign URL</label>
              <div class="flex items-center space-x-2">
                <input
                  :value="shareUrl"
                  readonly
                  class="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 font-mono"
                />
                <button
                  @click="copyToClipboard(shareUrl, 'url-preview')"
                  class="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg transition-colors hover:bg-gray-50 touch-target"
                >
                  <IconCheck v-if="copySuccess === 'url-preview'" class="w-4 h-4 text-green-600" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Customization Section -->
          <div class="space-y-4">
            <button
              @click="showCustomization = !showCustomization"
              class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-xl transition-all duration-200 border border-gray-200 hover:border-gray-300 touch-target"
            >
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center shadow-sm">
                  <IconEdit class="w-4 h-4 text-white" />
                </div>
                <div class="text-left">
                  <span class="font-semibold text-gray-900">Customize Message</span>
                  <p class="text-sm text-gray-600">Add personal touch to your share</p>
                </div>
              </div>
              <IconChevronDown :class="[
                'w-5 h-5 text-gray-500 transition-transform duration-200',
                showCustomization ? 'rotate-180' : ''
              ]" />
            </button>
            
            <!-- Customization Content -->
            <transition name="slide-down">
              <div v-if="showCustomization" class="space-y-4">
                <!-- Custom Message -->
                <div>
                  <label class="block text-sm font-semibold text-gray-900 mb-3">Custom Message</label>
                  <div class="relative">
                    <textarea
                      v-model="customMessage"
                      rows="4"
                      :placeholder="defaultMessagePlaceholder"
                      class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-base resize-none transition-all duration-200 touch-target"
                    ></textarea>
                    <div class="absolute bottom-3 right-3">
                      <IconMessageCircle class="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 mt-2 flex items-center space-x-1">
                    <IconInfoCircle class="w-3 h-3" />
                    <span>Leave empty to use the default message</span>
                  </p>
                </div>
                
                <!-- Custom Tags -->
                <div>
                  <label class="block text-sm font-semibold text-gray-900 mb-3">Custom Tags</label>
                  <div class="space-y-3">
                    <!-- Tag Input -->
                    <div class="flex items-center space-x-2">
                      <div class="relative flex-1">
                        <input
                          v-model="newTag"
                          type="text"
                          placeholder="Add a hashtag (without #)"
                          class="w-full px-4 py-3 pl-8 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-base transition-all duration-200 touch-target"
                          @keyup.enter="addTag"
                        />
                        <IconHash class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                      </div>
                      <button
                        @click="addTag"
                        :disabled="!newTag.trim()"
                        class="px-4 py-3 bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 touch-target"
                      >
                        <IconPlus class="w-4 h-4" />
                      </button>
                    </div>
                    
                    <!-- Current Tags -->
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="(tag, index) in customTags"
                        :key="index"
                        class="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 px-3 py-2 rounded-full text-sm font-medium border border-orange-200 shadow-sm"
                      >
                        <IconHash class="w-3 h-3" />
                        <span>{{ tag }}</span>
                        <button
                          @click="removeTag(index)"
                          class="hover:text-orange-900 transition-colors ml-1"
                        >
                          <IconX class="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                    
                    <!-- Default Tags -->
                    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p class="text-sm font-medium text-blue-900 mb-2">Default tags included:</p>
                      <div class="flex flex-wrap gap-2">
                        <span
                          v-for="tag in defaultTags"
                          :key="tag"
                          class="inline-flex items-center space-x-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium"
                        >
                          <IconHash class="w-3 h-3" />
                          <span>{{ tag }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <!-- Error Message -->
          <div v-if="shareError" class="bg-red-50 border border-red-200 rounded-xl p-4">
            <div class="flex items-start space-x-3">
              <IconAlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p class="font-semibold text-red-800 text-sm mb-1">Sharing Failed</p>
                <p class="text-red-700 text-sm">{{ shareError }}</p>
              </div>
            </div>
          </div>

          <!-- Info Box -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
            <div class="flex items-start space-x-3">
              <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <IconBolt class="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 class="font-semibold text-orange-900 text-sm mb-2">⚡ Zap Tracking</h4>
                <p class="text-orange-800 text-sm leading-relaxed">
                  When you post to Nostr, zaps sent to your post will automatically count towards your campaign goal. Share widely to maximize support!
                </p>
              </div>
            </div>
          </div>

          <!-- ZapTracker Branding Footer -->
          <div class="text-center pt-4 border-t border-gray-200">
            <div class="flex items-center justify-center space-x-2 text-gray-500">
              <img 
                src="/new_logo3.png"
                alt="ZapTracker" 
                class="w-4 h-4 object-contain"
              />
              <span class="text-sm font-medium">Powered by ZapTracker</span>
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
  IconChevronDown,
  IconEdit,
  IconHash,
  IconPlus,
  IconTarget,
  IconInfoCircle
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
const customTags = ref([])
const newTag = ref('')
const copySuccess = ref('')
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')
const showCustomization = ref(false)

// Default tags
const defaultTags = ['ZapTracker', 'Bitcoin', 'Lightning', 'Nostr']

// Generate share URL
const generateShareUrl = () => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
}

// Initialize share URL
shareUrl.value = generateShareUrl()

// Default message placeholder
const defaultMessagePlaceholder = computed(() => {
  return `🎯 Support my campaign: ${props.campaign.title}

${shareUrl.value}

#ZapTracker #Bitcoin #Lightning #Nostr`
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

// Add custom tag
const addTag = () => {
  const tag = newTag.value.trim().replace(/^#/, '') // Remove # if user added it
  if (tag && !customTags.value.includes(tag) && !defaultTags.includes(tag)) {
    customTags.value.push(tag)
    newTag.value = ''
  }
}

// Remove custom tag
const removeTag = (index) => {
  customTags.value.splice(index, 1)
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
    
    // Combine default tags with custom tags
    const allTags = [...defaultTags, ...customTags.value]
    const hashtagString = allTags.map(tag => `#${tag}`).join(' ')
    
    // Create content with custom message or default
    const content = customMessage.value.trim() || 
      `🎯 Support my campaign: ${props.campaign.title}\n\n${shareUrl.value}\n\n${hashtagString}`
    
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
        ['p', props.campaign.pubkey],
        
        // Add hashtags as t tags
        ...allTags.map(tag => ['t', tag])
      ],
      content
    }
    
    console.log('Event template with goal tag:', eventTemplate)
    
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
    
    // Close modal after 4 seconds
    setTimeout(() => {
      emit('close')
    }, 4000)
    
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

/* Slide down animation for customization section */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
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

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 1000px;
}

/* Touch targets for mobile */
.touch-target {
  min-height: 44px;
  min-width: 44px;
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
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Custom scrollbar for modal content */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Gradient text effect for branding */
.gradient-text {
  background: linear-gradient(135deg, #f97316, #fbbf24);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Enhanced button styles */
.btn-primary {
  background: linear-gradient(135deg, #f97316, #fbbf24);
  box-shadow: 0 4px 14px 0 rgba(249, 115, 22, 0.25);
}

.btn-primary:hover {
  box-shadow: 0 6px 20px 0 rgba(249, 115, 22, 0.35);
}

.btn-secondary {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.25);
}

.btn-secondary:hover {
  box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.35);
}

/* Mobile landscape optimizations */
@media (max-height: 500px) and (orientation: landscape) {
  .max-h-\[95vh\] {
    max-height: 90vh;
  }
  
  .max-h-\[calc\(95vh-200px\)\] {
    max-height: calc(90vh - 150px);
  }
}

/* Ensure proper spacing on very small screens */
@media (max-width: 320px) {
  .space-x-3 {
    gap: 0.5rem;
  }
  
  .space-y-4 {
    gap: 0.75rem;
  }
}
</style>