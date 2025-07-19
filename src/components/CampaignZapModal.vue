<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconBolt, 
  IconX, 
  IconSend, 
  IconCheck, 
  IconAlertCircle,
  IconLoader,
  IconCurrencyBitcoin,
  IconMessageCircle,
  IconArrowRight
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { useNostrConnections } from '../composables/useNostrConnections.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNotifications } from '../composables/useNotifications.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { makeZapRequest } from 'nostr-tools/nip57'
import { payInvoice } from '../utils/nwcClient.js'
import { bech32 } from 'bech32'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  },
  author: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

// Use composables
const { isWalletConnected, activeConnection } = useNostrConnections()
const { isAuthenticated, currentUser } = useNostrAuth()
const { handleZapSent, handlePaymentSuccess, handlePaymentError } = useNotifications()

// State
const zapAmount = ref(1000) // Default 1000 sats
const customAmount = ref(null)
const zapComment = ref('')
const isCustomAmount = ref(false)
const isLoading = ref(false)
const error = ref('')
const invoice = ref('')
const paymentStatus = ref('') // pending, success, error
const showQRCode = ref(false)

// Predefined amounts
const predefinedAmounts = [
  { value: 1000, label: '1,000' },
  { value: 5000, label: '5,000' },
  { value: 10000, label: '10,000' },
  { value: 21000, label: '21,000' },
  { value: 50000, label: '50,000' },
  { value: 100000, label: '100,000' }
]

// Computed properties
const effectiveAmount = computed(() => {
  return isCustomAmount.value ? (customAmount.value || 0) : zapAmount.value
})

const isValidAmount = computed(() => {
  return effectiveAmount.value > 0
})

const canZap = computed(() => {
  return isAuthenticated.value && isWalletConnected.value && isValidAmount.value
})

// Watch for custom amount changes
watch(customAmount, (newValue) => {
  if (newValue) {
    isCustomAmount.value = true
  }
})

// Reset form
const resetForm = () => {
  zapAmount.value = 1000
  customAmount.value = null
  zapComment.value = ''
  isCustomAmount.value = false
  error.value = ''
  invoice.value = ''
  paymentStatus.value = ''
  showQRCode.value = false
}

// Select predefined amount
const selectAmount = (amount) => {
  zapAmount.value = amount
  isCustomAmount.value = false
  customAmount.value = null
}

// Toggle custom amount
const toggleCustomAmount = () => {
  isCustomAmount.value = !isCustomAmount.value
  if (isCustomAmount.value && !customAmount.value) {
    customAmount.value = zapAmount.value
  }
}

// Create and pay zap invoice
const createAndPayZapInvoice = async () => {
  if (!canZap.value) return
  
  isLoading.value = true
  error.value = ''
  paymentStatus.value = 'pending'
  
  try {
    console.log('Creating zap for campaign:', props.campaign.id)
    
    // Get author's profile metadata to extract zap endpoint
    const profileEvent = await nostrRelayManager.getEvent({
      kinds: [0],
      authors: [props.author.pubkey],
      limit: 1
    })
    
    if (!profileEvent) {
      throw new Error('Could not find author profile')
    }
    
    // Get zap endpoint using proper nostr-tools implementation
    const zapEndpoint = await getZapEndpoint(profileEvent)
    
    if (!zapEndpoint) {
      throw new Error('Author does not have a zap endpoint configured')
    }
    
    console.log('Using zap endpoint:', zapEndpoint)
    
    // Create zap request
    const zapRequest = makeZapRequest({
      profile: props.author.pubkey,
      event: props.campaign.rawEvent,
      amount: effectiveAmount.value * 1000, // Convert to millisats
      comment: zapComment.value || `Zap for campaign: ${props.campaign.title}`,
      relays: props.campaign.relays || [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.snort.social'
      ]
    })
    
    console.log('Created zap request:', zapRequest)
    
    // Get invoice from zap endpoint
    const response = await fetch(zapEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: effectiveAmount.value * 1000, // millisats
        nostr: JSON.stringify(zapRequest),
        lnurl: zapEndpoint // Some endpoints require this
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Zap endpoint error response:', errorText)
      throw new Error(`Zap endpoint returned ${response.status}: ${errorText}`)
    }
    
    const zapEndpointResponse = await response.json()
    
    if (!zapEndpointResponse.pr) {
      console.error('Zap endpoint response:', zapEndpointResponse)
      throw new Error('No payment request in zap endpoint response. Response: ' + JSON.stringify(zapEndpointResponse))
    }
    
    invoice.value = zapEndpointResponse.pr
    console.log('Got invoice:', invoice.value)
    
    // Pay the invoice
    const paymentResult = await payInvoice({
      invoice: invoice.value
    })
    
    console.log('Payment result:', paymentResult)
    
    // Update status
    paymentStatus.value = 'success'
    
    // Notify about successful payment
    handlePaymentSuccess(paymentResult)
    handleZapSent({ 
      amount: effectiveAmount.value,
      recipient: props.author.name || 'Campaign Author'
    })
    
    // Close modal after 2 seconds
    setTimeout(() => {
      emit('close')
    }, 2000)
    
  } catch (err) {
    console.error('Failed to zap campaign:', err)
    error.value = err.message || 'Failed to zap campaign'
    paymentStatus.value = 'error'
    handlePaymentError(err)
  } finally {
    isLoading.value = false
  }
}

// Proper getZapEndpoint implementation based on nostr-tools
async function getZapEndpoint(metadata) {
  try {
    let lnurl = ''
    const profile = JSON.parse(metadata.content)
    const { lud06, lud16 } = profile
    
    if (lud06) {
      // Decode bech32 lud06 to get LNURL
      try {
        const { words } = bech32.decode(lud06, 1000)
        const data = bech32.fromWords(words)
        lnurl = new TextDecoder().decode(new Uint8Array(data))
      } catch (decodeError) {
        console.error('Failed to decode lud06:', decodeError)
        throw new Error('Invalid lud06 format')
      }
    } else if (lud16) {
      // Convert lightning address to LNURL
      const [name, domain] = lud16.split('@')
      if (!name || !domain) {
        throw new Error('Invalid lightning address format')
      }
      lnurl = `https://${domain}/.well-known/lnurlp/${name}`
    } else {
      return null
    }
    
    console.log('Resolved LNURL:', lnurl)
    
    // Fetch LNURL metadata
    const response = await fetch(lnurl)
    if (!response.ok) {
      throw new Error(`LNURL endpoint returned ${response.status}`)
    }
    
    const body = await response.json()
    console.log('LNURL response:', body)
    
    // Check for NIP-57 zap compatibility
    if (body.allowsNostr && body.nostrPubkey) {
      console.log('Zap endpoint found:', body.callback)
      return body.callback
    } else {
      console.log('LNURL endpoint does not support zaps:', { allowsNostr: body.allowsNostr, nostrPubkey: body.nostrPubkey })
      return null
    }
  } catch (err) {
    console.error('Failed to get zap endpoint:', err)
    throw err
  }
}

// Show QR code
const showQRCodeView = () => {
  if (!invoice.value) return
  showQRCode.value = true
}

// Close modal
const closeModal = () => {
  resetForm()
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center text-white shadow-sm">
              <IconBolt class="w-5 h-5" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900">Zap Campaign</h3>
          </div>
          <button
            @click="closeModal"
            class="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Campaign Info -->
      <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h4 class="font-medium text-gray-900 mb-2">{{ props.campaign.title }}</h4>
        <p class="text-sm text-gray-600 line-clamp-2">{{ props.campaign.summary }}</p>
      </div>

      <!-- Success State -->
      <div v-if="paymentStatus === 'success'" class="p-6 text-center">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconCheck class="w-8 h-8 text-green-600" />
        </div>
        <h4 class="text-xl font-semibold text-green-700 mb-2">Zap Successful!</h4>
        <p class="text-gray-600 mb-4">Thank you for supporting this campaign with {{ effectiveAmount.toLocaleString() }} sats!</p>
        <p class="text-sm text-gray-500">This window will close automatically...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="paymentStatus === 'error'" class="p-6">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-start space-x-3">
            <IconAlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="font-medium text-red-800 mb-1">Payment Failed</h4>
              <p class="text-sm text-red-700">{{ error }}</p>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end">
          <button @click="closeModal" class="btn-secondary">
            Close
          </button>
        </div>
      </div>

      <!-- QR Code View -->
      <div v-else-if="showQRCode && invoice" class="p-6">
        <div class="text-center mb-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Scan to Pay</h4>
          <div class="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
            <QRCodeVue3
              :value="`lightning:${invoice}`"
              :size="200"
              color="#000000"
              background-color="#ffffff"
              error-correction-level="M"
            />
          </div>
          <p class="text-sm text-gray-600 mb-2">Amount: {{ effectiveAmount.toLocaleString() }} sats</p>
          <p class="text-xs text-gray-500">Scan this QR code with any Lightning wallet</p>
        </div>
        
        <div class="flex justify-between">
          <button @click="showQRCode = false" class="btn-secondary">
            Back
          </button>
          <button @click="closeModal" class="btn-secondary">
            Close
          </button>
        </div>
      </div>

      <!-- Zap Form -->
      <div v-else class="p-6">
        <!-- Amount Selection -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-3">Select Amount</label>
          
          <!-- Predefined Amounts -->
          <div class="grid grid-cols-3 gap-2 mb-3">
            <button
              v-for="amount in predefinedAmounts"
              :key="amount.value"
              @click="selectAmount(amount.value)"
              :class="[
                'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border',
                !isCustomAmount && zapAmount === amount.value
                  ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white border-orange-400 shadow-md'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'
              ]"
            >
              {{ amount.label }}
            </button>
          </div>
          
          <!-- Custom Amount -->
          <div class="mt-4">
            <div class="flex items-center mb-2">
              <input
                type="checkbox"
                :checked="isCustomAmount"
                @change="toggleCustomAmount"
                class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <label class="ml-2 text-sm text-gray-700">Custom amount</label>
            </div>
            
            <div v-if="isCustomAmount" class="relative">
              <input
                v-model.number="customAmount"
                type="number"
                min="1"
                placeholder="Enter amount in sats"
                class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <IconBolt class="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
        
        <!-- Comment -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Comment (optional)</label>
          <div class="relative">
            <textarea
              v-model="zapComment"
              rows="3"
              placeholder="Add a comment to your zap..."
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200 resize-none"
            ></textarea>
            <div class="absolute bottom-3 right-3">
              <IconMessageCircle class="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
        
        <!-- Summary -->
        <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">Amount:</span>
            <span class="text-lg font-bold text-orange-600">{{ effectiveAmount.toLocaleString() }} sats</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">To:</span>
            <span class="text-gray-800 font-medium">{{ props.author.name || 'Campaign Author' }}</span>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-600" />
            <span class="text-red-600">{{ error }}</span>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-between">
          <button @click="closeModal" class="btn-secondary">
            Cancel
          </button>
          
          <button
            @click="createAndPayZapInvoice"
            :disabled="!canZap || isLoading"
            class="btn-primary"
          >
            <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
            <IconBolt v-else class="w-4 h-4" />
            {{ isLoading ? 'Processing...' : 'Zap Now' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Button Styles */
.btn-primary {
  @apply bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md;
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    font-size: 16px; /* Prevent zoom on iOS */
  }
  
  .btn-primary, .btn-secondary {
    min-height: 44px;
  }
}
</style>