<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] transition-opacity duration-300"
    :class="{'opacity-0': !isVisible, 'opacity-100': isVisible}"
    @click="handleBackdropClick"
  >
    <!-- Desktop Modal / Mobile Bottom Sheet -->
    <div
      class="modal-container"
      :class="{
        'modal-enter': isVisible,
        'modal-exit': !isVisible
      }"
      @click.stop
    >
      <!-- Handle for mobile bottom sheet -->
      <div class="md:hidden flex justify-center pt-3 pb-2">
        <div class="w-10 h-1 bg-gray-300 rounded-full"></div>
      </div>

      <!-- Header -->
      <div class="modal-header">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="icon-container">
              <IconShare class="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Share Campaign</h3>
              <p class="text-sm text-gray-500">Spread the word</p>
            </div>
          </div>
          <button
            @click="closeModal"
            class="close-button"
            aria-label="Close"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Success State -->
      <div v-if="shareSuccess" class="success-state">
        <div class="success-icon">
          <IconCheck class="w-8 h-8 text-white" />
        </div>
        <h4 class="text-xl font-semibold text-gray-900 mb-2">Posted Successfully!</h4>
        <p class="text-gray-600 mb-6">Your campaign is now shared on Nostr</p>
        <div class="info-card">
          <IconBolt class="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-gray-700">
            Zaps to your post will count towards your goal
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else class="modal-content">
        <!-- Campaign Preview Card -->
        <div class="preview-card">
          <div class="flex items-start space-x-3">
            <div v-if="campaign.image" class="preview-image">
              <img
                :src="campaign.image"
                :alt="campaign.title"
                class="w-full h-full object-cover"
                @error="$event.target.style.display = 'none'"
              />
            </div>
            <div v-else class="preview-icon">
              <IconTarget class="w-6 h-6 text-orange-600" />
            </div>

            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-gray-900 mb-1 line-clamp-1">{{ campaign.title }}</h4>
              <p class="text-sm text-gray-600 mb-3 line-clamp-2">{{ campaign.summary }}</p>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">Goal</span>
                <span class="font-semibold text-orange-600">{{ formatAmount(campaign.goalAmount) }} sats</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Primary Action - Share on Nostr -->
        <div class="action-section">
          <button
            @click="shareOnNostr"
            :disabled="!isAuthenticated || isSharing"
            class="btn-primary-large"
          >
            <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
            <IconBolt v-else class="w-5 h-5" />
            <span>{{ isSharing ? 'Posting...' : 'Share on Nostr' }}</span>
          </button>

          <!-- Authentication Notice -->
          <div v-if="!isAuthenticated" class="notice-card warning">
            <IconAlertCircle class="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p class="text-sm text-amber-800">Connect your Nostr identity to share</p>
          </div>
        </div>

        <!-- Divider -->
        <div class="divider">
          <span class="divider-text">or share link</span>
        </div>

        <!-- Copy Link Section -->
        <div class="link-section">
          <button
            @click="copyAndShare"
            class="btn-secondary-large"
          >
            <IconCheck v-if="copySuccess" class="w-5 h-5 text-green-600" />
            <IconCopy v-else class="w-5 h-5" />
            <span>{{ copySuccess ? 'Link Copied!' : 'Copy Link' }}</span>
          </button>

          <!-- URL Display -->
          <div class="url-display">
            <input
              :value="shareUrl"
              readonly
              class="url-input"
            />
            <button
              @click="copyToClipboard(shareUrl)"
              class="copy-icon-button"
              aria-label="Copy URL"
            >
              <IconCopy class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Custom Message (Expandable) -->
        <div class="custom-message-section">
          <button
            @click="showCustomMessage = !showCustomMessage"
            class="expand-button"
          >
            <div class="flex items-center space-x-2">
              <IconEdit class="w-4 h-4 text-gray-500" />
              <span class="text-sm font-medium text-gray-700">Customize Message</span>
              <span v-if="mentionCount > 0" class="mention-badge">
                {{ mentionCount }}
              </span>
            </div>
            <IconChevronDown
              :class="[
                'w-4 h-4 text-gray-400 transition-transform duration-300',
                showCustomMessage ? 'rotate-180' : ''
              ]"
            />
          </button>

          <transition name="expand">
            <div v-if="showCustomMessage" class="message-input-container">
              <MentionInput
                v-model="customMessage"
                :placeholder="'Add your personal touch... Type @ to mention someone'"
                min-height="100px"
                max-height="200px"
                @mention-added="handleMentionAdded"
              />
              <p class="text-xs text-gray-500 mt-2">
                Leave empty to use the default campaign message
              </p>
            </div>
          </transition>
        </div>

        <!-- Info Card -->
        <div class="info-card">
          <div class="info-icon">
            <IconBolt class="w-3.5 h-3.5 text-white" />
          </div>
          <div class="flex-1">
            <h4 class="font-medium text-gray-900 text-sm mb-0.5">Automatic Zap Tracking</h4>
            <p class="text-gray-600 text-xs leading-relaxed">
              All zaps sent to your shared post are automatically tracked and counted towards your campaign goal.
            </p>
          </div>
        </div>

        <!-- Error Message -->
        <transition name="fade">
          <div v-if="shareError" class="notice-card error">
            <IconAlertCircle class="w-4 h-4 text-red-600 flex-shrink-0" />
            <span class="text-sm text-red-700">{{ shareError }}</span>
          </div>
        </transition>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <div class="footer-branding">
          <img
            src="/new_logo3.png"
            alt="ZapTracker"
            class="w-4 h-4 object-contain opacity-60"
          />
          <span class="text-xs text-gray-500">Powered by ZapTracker</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  IconShare,
  IconX,
  IconCopy,
  IconCheck,
  IconBolt,
  IconLoader,
  IconAlertCircle,
  IconChevronDown,
  IconEdit,
  IconTarget,
  IconAt
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useMentions } from '../composables/useMentions.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import MentionInput from './MentionInput.vue'

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
const { extractPTags, parseMentions } = useMentions()

// State
const shareUrl = ref('')
const customMessage = ref('')
const copySuccess = ref(false)
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')
const showCustomMessage = ref(false)
const isVisible = ref(false)

// Default tags
const defaultTags = ['ZapTracker', 'Bitcoin', 'Lightning', 'Nostr']

// Animation on mount
onMounted(() => {
  nextTick(() => {
    isVisible.value = true
  })
})

// Generate share URL
const generateShareUrl = () => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
}

// Initialize share URL
shareUrl.value = generateShareUrl()

// Default message placeholder
const defaultMessagePlaceholder = computed(() => {
  return `Support my campaign: ${props.campaign.title}\n\n${shareUrl.value}\n\n#ZapTracker #Lightning #Nostr`
})

// Mention count
const mentionCount = computed(() => {
  return parseMentions(customMessage.value || '').length
})

// Handle mention added
const handleMentionAdded = (user) => {
  console.log('Mention added to campaign share:', user)
}

// Handle backdrop click (mobile)
const handleBackdropClick = () => {
  if (window.innerWidth < 768) {
    closeModal()
  }
}

// Close modal with animation
const closeModal = () => {
  isVisible.value = false
  setTimeout(() => {
    emit('close')
  }, 300)
}

// Copy to clipboard and trigger native share if available
const copyAndShare = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copySuccess.value = true

    setTimeout(() => {
      copySuccess.value = false
    }, 2000)

    // Try native share API (mobile)
    if (navigator.share && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: `Support: ${props.campaign.title}`,
          text: `Help me reach my goal! ${props.campaign.summary}`,
          url: shareUrl.value
        })
      } catch (shareError) {
        console.log('Native share cancelled or not supported')
      }
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Copy to clipboard
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
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

    const hashtagString = defaultTags.map(tag => `#${tag}`).join(' ')

    const content = customMessage.value.trim() ||
      `Support my campaign: ${props.campaign.title}\n\n${shareUrl.value}\n\n${hashtagString}`

    console.log('Share content:', content)

    const mentionPTags = extractPTags(content)

    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['goal', props.campaign.id],
        ['e', props.campaign.id],
        ['p', props.campaign.pubkey],
        ...mentionPTags,
        ...defaultTags.map(tag => ['t', tag])
      ],
      content
    }

    console.log('Event template with goal tag:', eventTemplate)

    let signedEvent
    if (window.nostr?.signEvent) {
      signedEvent = await window.nostr.signEvent(eventTemplate)
    } else {
      throw new Error('Nostr extension not available for signing')
    }

    console.log('Signed event with goal tag:', signedEvent)

    const isValid = verifyEvent(signedEvent)
    if (!isValid) {
      throw new Error('Event signature verification failed')
    }

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

    setTimeout(() => {
      closeModal()
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
/* Modal Container - Desktop centered, Mobile bottom sheet */
.modal-container {
  @apply fixed bg-white w-full max-w-lg mx-auto overflow-hidden;
  @apply md:rounded-3xl md:shadow-2xl md:max-h-[90vh] md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2;
  @apply rounded-t-3xl bottom-0 left-0 right-0 max-h-[92vh];
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Mobile Bottom Sheet Animation */
@media (max-width: 768px) {
  .modal-container {
    transform: translateY(100%);
  }

  .modal-container.modal-enter {
    transform: translateY(0);
  }

  .modal-container.modal-exit {
    transform: translateY(100%);
  }
}

/* Desktop Modal Animation */
@media (min-width: 769px) {
  .modal-container {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.95);
  }

  .modal-container.modal-enter {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  .modal-container.modal-exit {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.95);
  }
}

/* Header */
.modal-header {
  @apply px-6 py-5 border-b border-gray-100;
}

.icon-container {
  @apply w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center;
  @apply ring-1 ring-orange-100;
}

.close-button {
  @apply w-9 h-9 rounded-full flex items-center justify-center;
  @apply text-gray-400 hover:text-gray-600 hover:bg-gray-100;
  @apply transition-all duration-200;
}

/* Content */
.modal-content {
  @apply px-6 py-5 space-y-5 overflow-y-auto max-h-[calc(92vh-180px)] md:max-h-[calc(90vh-180px)];
}

/* Success State */
.success-state {
  @apply p-8 text-center;
}

.success-icon {
  @apply w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full;
  @apply flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200;
}

/* Preview Card */
.preview-card {
  @apply bg-gray-50 rounded-2xl p-4 border border-gray-200;
}

.preview-image {
  @apply w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-gray-200;
}

.preview-icon {
  @apply w-14 h-14 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl;
  @apply flex items-center justify-center flex-shrink-0 ring-1 ring-orange-200;
}

/* Action Section */
.action-section {
  @apply space-y-3;
}

/* Primary Button */
.btn-primary-large {
  @apply w-full bg-gradient-to-r from-orange-500 to-orange-600;
  @apply hover:from-orange-600 hover:to-orange-700;
  @apply text-white px-6 py-4 rounded-2xl font-semibold;
  @apply flex items-center justify-center space-x-2;
  @apply transition-all duration-200;
  @apply shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300;
  @apply disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none;
  @apply active:scale-[0.98];
}

/* Secondary Button */
.btn-secondary-large {
  @apply w-full bg-gray-100 hover:bg-gray-200 text-gray-700;
  @apply px-6 py-4 rounded-2xl font-medium;
  @apply flex items-center justify-center space-x-2;
  @apply transition-all duration-200;
  @apply active:scale-[0.98];
}

/* Divider */
.divider {
  @apply relative flex items-center justify-center py-2;
}

.divider::before,
.divider::after {
  @apply content-[''] flex-1 border-t border-gray-200;
}

.divider-text {
  @apply px-3 text-xs text-gray-400 font-medium;
}

/* Link Section */
.link-section {
  @apply space-y-3;
}

.url-display {
  @apply bg-gray-50 rounded-xl p-3 border border-gray-200;
  @apply flex items-center space-x-2;
}

.url-input {
  @apply flex-1 bg-transparent text-sm text-gray-600 font-mono;
  @apply border-none focus:outline-none;
}

.copy-icon-button {
  @apply p-2 text-gray-400 hover:text-gray-600 rounded-lg;
  @apply hover:bg-gray-100 transition-all duration-200;
}

/* Custom Message Section */
.custom-message-section {
  @apply border border-gray-200 rounded-2xl overflow-hidden;
}

.expand-button {
  @apply flex items-center justify-between w-full p-4;
  @apply text-left hover:bg-gray-50 transition-all duration-200;
}

.mention-badge {
  @apply bg-orange-100 text-orange-700 text-xs font-medium;
  @apply px-2 py-0.5 rounded-full;
}

.message-input-container {
  @apply px-4 pb-4 space-y-2;
}

/* Info Card */
.info-card {
  @apply bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200;
  @apply rounded-2xl p-4 flex items-start space-x-3;
}

.info-icon {
  @apply w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg;
  @apply flex items-center justify-center flex-shrink-0 shadow-sm;
}

/* Notice Cards */
.notice-card {
  @apply rounded-xl p-3 flex items-center space-x-2;
}

.notice-card.warning {
  @apply bg-amber-50 border border-amber-200;
}

.notice-card.error {
  @apply bg-red-50 border border-red-200;
}

/* Footer */
.modal-footer {
  @apply border-t border-gray-100 px-6 py-4 bg-gray-50;
}

.footer-branding {
  @apply flex items-center justify-center space-x-2;
}

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

/* Expand animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 300px;
}

/* Fade animation */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Scrollbar styling */
.modal-content::-webkit-scrollbar {
  width: 6px;
}

.modal-content::-webkit-scrollbar-track {
  background: transparent;
}

.modal-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Touch targets for mobile */
@media (max-width: 640px) {
  button, input, textarea {
    min-height: 44px;
    font-size: 16px;
  }
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}
</style>
