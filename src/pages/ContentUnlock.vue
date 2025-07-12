<template>
  <div class="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Loading Article...</h2>
        <p class="text-gray-600">{{ loadingMessage }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconAlertCircle class="w-8 h-8 text-red-600" />
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Error Loading Article</h2>
        <p class="text-red-600 mb-4">{{ error }}</p>
        <button @click="goBack" class="btn-primary">
          <IconArrowLeft class="w-4 h-4" />
          Go Back
        </button>
      </div>

      <!-- Article Preview -->
      <div v-else-if="articleEvent && !isUnlocked" class="space-y-6">
        <!-- Article Header -->
        <div class="text-center">
          <h1 class="text-3xl font-bold text-gray-900 mb-4">{{ articleTitle }}</h1>
          <p class="text-lg text-gray-600 mb-6">{{ articlePreview }}</p>
          
          <!-- Article Meta -->
          <div class="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 mb-6">
            <span>{{ articleType }}</span>
            <span>•</span>
            <span v-if="isPaidContent">{{ unlockPriceSats }} sats to unlock</span>
            <span v-else>Free Content</span>
            <span>•</span>
            <span>By {{ publisherName }}</span>
          </div>
        </div>

        <!-- Free Content - Show Full Content -->
        <div v-if="!isPaidContent" class="bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="text-center mb-4">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconBolt class="w-8 h-8 text-green-600" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Free Content</h3>
            <p class="text-gray-600">This content is freely accessible to all users</p>
          </div>
                      <div class="bg-white p-4 rounded-lg border border-green-200 max-h-60 overflow-y-auto">
              <div class="prose prose-sm max-w-none">
                <p class="text-gray-700 text-left whitespace-pre-wrap">{{ fullContent || 'Free content preview...' }}</p>
              </div>
            </div>
        </div>

        <!-- Paid Content - Payment Flow -->
        <div v-else class="space-y-6">
          <!-- NWC Connection -->
          <div class="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Connect Your Wallet</h3>
            <div class="space-y-4">
              <input
                v-model="nwcUrl"
                type="text"
                placeholder="Enter your NWC URL (nostr+walletconnect://...)"
                class="w-full px-4 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                @click="initiatePayment"
                :disabled="!nwcUrl || isProcessingPayment"
                class="w-full btn-primary disabled:opacity-50"
              >
                <IconLoader v-if="isProcessingPayment" class="w-4 h-4 animate-spin" />
                <IconBolt v-else class="w-4 h-4" />
                {{ isProcessingPayment ? 'Processing...' : `Unlock for ${unlockPriceSats} sats` }}
              </button>
            </div>
          </div>

          <!-- Payment Status -->
          <div v-if="paymentStatus" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center space-x-3">
              <IconLoader v-if="paymentStatus.includes('Processing')" class="w-5 h-5 text-blue-600 animate-spin" />
              <IconCheck v-else-if="paymentStatus.includes('Success')" class="w-5 h-5 text-green-600" />
              <IconAlertCircle v-else-if="paymentStatus.includes('Error')" class="w-5 h-5 text-red-600" />
              <IconShare v-else class="w-5 h-5 text-blue-600" />
              <p class="text-sm font-medium text-gray-900">{{ paymentStatus }}</p>
            </div>
          </div>

          <!-- QR Code for Payment -->
          <div v-if="paymentInvoice && !isUnlocked" class="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Complete Payment</h3>
            <p class="text-gray-600 mb-4">Scan the QR code or copy the invoice to pay</p>
            <div class="flex justify-center mb-4">
              <div id="qrCodeContainer"></div>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg">
              <p class="text-xs text-gray-600 break-all">{{ paymentInvoice }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Unlocked Content -->
      <div v-else-if="isUnlocked" class="space-y-6">
        <div class="text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck class="w-8 h-8 text-green-600" />
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Content Unlocked!</h2>
          <p class="text-gray-600 mb-6">Thank you for supporting independent creators!</p>
        </div>

        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">{{ articleTitle }}</h3>
          <div class="prose max-w-none">
            <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{{ fullContent || 'Content loading...' }}</p>
          </div>
        </div>

        <div class="text-center">
          <button @click="goBack" class="btn-secondary">
            <IconArrowLeft class="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, inject, watch } from 'vue'
import { 
  IconArrowLeft, 
  IconBolt, 
  IconLoader, 
  IconCheck, 
  IconAlertCircle,
  IconShare
} from '@iconify-prerendered/vue-tabler'
import { SimplePool } from 'nostr-tools/pool'
import { nwcPaymentHandler } from '../utils/nwcPayment.js'
import { contentService } from '../utils/contentService.js'
import { useNostrLongForm } from '../composables/useNostrLongForm.js'

// Inject currentPage from parent
const currentPage = inject('currentPage')

// Use the long-form content composable
const { fetchContentById, isLoading: isContentLoading } = useNostrLongForm()

// State
const isLoading = ref(true)
const error = ref('')
const articleEvent = ref(null)
const isUnlocked = ref(false)
const isProcessingPayment = ref(false)
const paymentStatus = ref('')
const paymentInvoice = ref('')
const nwcUrl = ref('')

// Computed properties
const articleTitle = computed(() => {
  return articleEvent.value?.tags.find(tag => tag[0] === 'title')?.[1] || 'Untitled Article'
})

const articlePreview = computed(() => {
  return articleEvent.value?.content || ''
})

const articleType = computed(() => {
  const contentType = articleEvent.value?.tags.find(tag => tag[0] === 'content-type')?.[1] || 'article'
  return contentType.charAt(0).toUpperCase() + contentType.slice(1)
})

const isPaidContent = computed(() => {
  return articleEvent.value?.tags.some(tag => tag[0] === 'price_sats')
})

const unlockPriceSats = computed(() => {
  return parseInt(articleEvent.value?.tags.find(tag => tag[0] === 'price_sats')?.[1] || '0')
})

const publisherName = computed(() => {
  // In a real app, you'd fetch the publisher's profile
  return 'Content Creator'
})

const fullContent = ref('')

// Fetch full content after payment verification
const fetchFullContent = async (paymentProof) => {
  try {
    const contentData = await contentService.getFullContent(articleEvent.value.id, paymentProof)
    fullContent.value = contentData.content
    
    if (contentData.encrypted) {
      console.log('✅ Content decrypted successfully')
    }
  } catch (error) {
    console.error('Failed to fetch full content:', error)
    error.value = 'Failed to load full content: ' + error.message
  }
}

const loadingMessage = ref('Fetching article details from Nostr relays...')

// Relays configuration
// No longer needed as we use the relay manager

// Fetch article from Nostr
const fetchArticle = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const eventId = urlParams.get('eventId')
  if (!eventId) {
    error.value = 'No article ID provided'
    isLoading.value = false
    return
  }

  try {
    loadingMessage.value = 'Fetching article from Nostr network...'
    
    // Use our new composable to fetch the content
    const contentItem = await fetchContentById(eventId)
    
    if (!contentItem) {
      throw new Error('Article not found')
    }
    
    // Convert to event format for backward compatibility
    const event = contentItem.rawEvent || {
      id: contentItem.id,
      pubkey: contentItem.pubkey || contentItem.creatorPubkey,
      created_at: contentItem.created_at || Math.floor(new Date(contentItem.createdAt).getTime() / 1000),
      kind: 30023,
      tags: [
        ['title', contentItem.title],
        ['summary', contentItem.description],
        ...(contentItem.tags.map(tag => ['t', tag])),
        ...(contentItem.monetizationModel !== 'free' ? [['price_sats', contentItem.price.toString()]] : []),
        ...(contentItem.coverImage ? [['image', contentItem.coverImage]] : []),
        ['content-type', contentItem.type],
        ['monetization', contentItem.monetizationModel]
      ],
      content: contentItem.fullContent || contentItem.previewText
    }

    articleEvent.value = event
    console.log('Article loaded:', event)

    // Check if content was already paid for
    if (isPaidContent.value && contentService.isPaymentVerified(eventId)) {
      const paymentVerification = contentService.getPaymentVerification(eventId)
      await fetchFullContent(paymentVerification)
      isUnlocked.value = true
    }
    
  } catch (err) {
    console.error('Error fetching article:', err)
    error.value = `Failed to load article: ${err.message}`
  } finally {
    isLoading.value = false
  }
}

// Initialize payment
const initiatePayment = async () => {
  if (!nwcUrl.value.trim()) {
    error.value = 'Please enter your Nostr Wallet Connect URL'
    return
  }

  if (!articleEvent.value || !isPaidContent.value) {
    error.value = 'Article data not loaded correctly'
    return
  }

  try {
    isProcessingPayment.value = true
    paymentStatus.value = 'Initializing payment...'

    // Use the NWC payment handler
    const result = await nwcPaymentHandler.unlockContent(
      articleEvent.value,
      nwcUrl.value,
      unlockPriceSats.value,
      `Unlock: ${articleTitle.value}`
    )

    // Store payment verification
    contentService.storePaymentVerification(articleEvent.value.id, result)

    paymentStatus.value = 'Payment successful! Loading content...'
    
    // Fetch and display full content
    await fetchFullContent(result)
    
    // Show success and unlock content
    setTimeout(() => {
      isUnlocked.value = true
      paymentStatus.value = ''
      paymentInvoice.value = ''
    }, 1000)

  } catch (err) {
    console.error('Payment error:', err)
    error.value = `Payment failed: ${err.message}`
  } finally {
    isProcessingPayment.value = false
  }
}

// Navigation
const goBack = () => {
  currentPage.value = 'content'
  // Update URL
  const url = new URL(window.location)
  url.searchParams.delete('page')
  url.searchParams.delete('eventId')
  window.history.pushState({}, '', url)
}

// Lifecycle
onMounted(() => {
  fetchArticle().catch(err => {
    console.error('Failed to fetch article:', err)
    error.value = `Failed to load article: ${err.message}`
    isLoading.value = false
  })
})

// Watch for content loading state changes
watch(isContentLoading, (loading) => {
  isLoading.value = loading
})
</script>

<style scoped>
.btn-primary {
  @apply bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2;
}

.btn-secondary {
  @apply bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2;
}
</style> 