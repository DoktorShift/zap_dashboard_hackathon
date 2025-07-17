<script setup>
import { ref, computed } from 'vue'
import { 
  IconShare, 
  IconX, 
  IconCopy, 
  IconCheck, 
  IconBrandTwitter,
  IconBrandFacebook,
  IconExternalLink,
  IconMessageCircle,
  IconLoader,
  IconQrcode,
  IconLink,
  IconBrandWhatsapp,
  IconBrandTelegram
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'
import QRCodeVue3 from 'qrcode-vue3'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const { shareCampaignOnNostr } = useCampaigns()

// UI state
const copySuccess = ref('')
const customMessage = ref('')
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')
const activeTab = ref('link') // 'link', 'qr', 'social', 'nostr'

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

// Share on Twitter
const shareOnTwitter = () => {
  const text = encodeURIComponent(`${shareText.value}\n\n${shareUrl.value}`)
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
}

// Share on Facebook
const shareOnFacebook = () => {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl.value)}`, '_blank')
}

// Share on WhatsApp
const shareOnWhatsApp = () => {
  const text = encodeURIComponent(`${shareText.value}\n\n${shareUrl.value}`)
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

// Share on Telegram
const shareOnTelegram = () => {
  const text = encodeURIComponent(`${shareText.value}\n\n${shareUrl.value}`)
  window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl.value)}&text=${encodeURIComponent(shareText.value)}`, '_blank')
}

// Native share if available
const nativeShare = () => {
  if (navigator.share) {
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
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
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
        
        <!-- Tabs -->
        <div class="flex items-center justify-between mt-6 border-b border-gray-200">
          <button 
            v-for="(tab, index) in [
              { id: 'link', label: 'Link', icon: IconLink },
              { id: 'qr', label: 'QR Code', icon: IconQrcode },
              { id: 'social', label: 'Social', icon: IconBrandTwitter },
              { id: 'nostr', label: 'Nostr', icon: IconMessageCircle }
            ]"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'flex-1 flex flex-col items-center py-3 px-1 border-b-2 transition-all duration-200',
              activeTab === tab.id 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <component :is="tab.icon" class="w-5 h-5 mb-1" />
            <span class="text-xs font-medium">{{ tab.label }}</span>
          </button>
        </div>
      </div>
      
      <!-- Campaign Info -->
      <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h4 class="font-medium text-gray-900 mb-2">{{ props.campaign.title }}</h4>
        <p class="text-sm text-gray-600 line-clamp-2">{{ props.campaign.summary }}</p>
      </div>

      <!-- Tab Content -->
      <div class="p-6">
        <!-- Link Tab -->
        <div v-if="activeTab === 'link'" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Campaign URL</label>
            <div class="flex items-center">
              <input
                type="text"
                :value="shareUrl"
                readonly
                class="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 text-sm bg-gray-50"
              />
              <button
                @click="copyToClipboard(shareUrl, 'url')"
                class="px-4 py-3 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 transition-colors"
              >
                <IconCheck v-if="copySuccess === 'url'" class="w-5 h-5 text-white" />
                <IconCopy v-else class="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Share Text</label>
            <div class="flex items-center">
              <input
                type="text"
                :value="shareText"
                readonly
                class="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 text-sm bg-gray-50"
              />
              <button
                @click="copyToClipboard(shareText, 'text')"
                class="px-4 py-3 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 transition-colors"
              >
                <IconCheck v-if="copySuccess === 'text'" class="w-5 h-5 text-white" />
                <IconCopy v-else class="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <!-- Native Share Button -->
          <button
            v-if="navigator.share"
            @click="nativeShare"
            class="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <IconShare class="w-5 h-5" />
            <span>Share via Device</span>
          </button>
        </div>
        
        <!-- QR Code Tab -->
        <div v-if="activeTab === 'qr'" class="space-y-6 text-center">
          <div class="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
            <QRCodeVue3
              :value="shareUrl"
              :size="200"
              :margin="2"
              :color="{
                dark: '#000000',
                light: '#FFFFFF'
              }"
              :qrOptions="{
                typeNumber: 0,
                mode: 'Byte',
                errorCorrectionLevel: 'H'
              }"
              class="rounded-lg"
            />
          </div>
          
          <p class="text-sm text-gray-600">
            Scan this QR code to view the campaign
          </p>
          
          <button
            @click="copyToClipboard(shareUrl, 'url')"
            class="inline-flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <IconCheck v-if="copySuccess === 'url'" class="w-4 h-4" />
            <IconCopy v-else class="w-4 h-4" />
            <span>Copy Campaign URL</span>
          </button>
        </div>
        
        <!-- Social Media Tab -->
        <div v-if="activeTab === 'social'" class="space-y-4">
          <p class="text-sm text-gray-600 mb-2">
            Share your campaign on social media platforms
          </p>
          
          <div class="grid grid-cols-2 gap-4">
            <button
              @click="shareOnTwitter"
              class="flex items-center justify-center space-x-2 bg-[#1DA1F2] hover:bg-[#1a94df] text-white px-4 py-3 rounded-lg transition-colors"
            >
              <IconBrandTwitter class="w-5 h-5" />
              <span>Twitter</span>
            </button>
            
            <button
              @click="shareOnFacebook"
              class="flex items-center justify-center space-x-2 bg-[#4267B2] hover:bg-[#365899] text-white px-4 py-3 rounded-lg transition-colors"
            >
              <IconBrandFacebook class="w-5 h-5" />
              <span>Facebook</span>
            </button>
            
            <button
              @click="shareOnWhatsApp"
              class="flex items-center justify-center space-x-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-3 rounded-lg transition-colors"
            >
              <IconBrandWhatsapp class="w-5 h-5" />
              <span>WhatsApp</span>
            </button>
            
            <button
              @click="shareOnTelegram"
              class="flex items-center justify-center space-x-2 bg-[#0088cc] hover:bg-[#0077b3] text-white px-4 py-3 rounded-lg transition-colors"
            >
              <IconBrandTelegram class="w-5 h-5" />
              <span>Telegram</span>
            </button>
          </div>
          
          <div class="text-center mt-4">
            <button
              @click="copyToClipboard(shareUrl, 'url')"
              class="inline-flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <IconCheck v-if="copySuccess === 'url'" class="w-4 h-4 text-green-600" />
              <IconCopy v-else class="w-4 h-4" />
              <span>Copy Link</span>
            </button>
          </div>
        </div>
        
        <!-- Nostr Tab -->
        <div v-if="activeTab === 'nostr'" class="space-y-4">
          <!-- Success State -->
          <div v-if="shareSuccess" class="text-center py-6">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconCheck class="w-8 h-8 text-green-600" />
            </div>
            <h4 class="text-xl font-semibold text-green-700 mb-2">Shared Successfully!</h4>
            <p class="text-gray-600 mb-4">Your campaign has been shared on Nostr.</p>
            <p class="text-sm text-gray-500">This window will close automatically...</p>
          </div>
          
          <!-- Share Form -->
          <div v-else>
            <label class="block text-sm font-medium text-gray-700 mb-2">Custom Message (optional)</label>
            <textarea
              v-model="customMessage"
              rows="4"
              :placeholder="shareText"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 text-base transition-all duration-200 resize-none"
            ></textarea>
            
            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
              <div class="flex items-start space-x-3">
                <IconBolt class="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-medium text-purple-900 mb-1">Share on Nostr</h4>
                  <p class="text-sm text-purple-800">
                    This will post your campaign to the Nostr network, making it visible to all your followers.
                  </p>
                </div>
              </div>
            </div>
            
            <!-- Error Message -->
            <div v-if="shareError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-center space-x-2">
                <IconAlertCircle class="w-5 h-5 text-red-600" />
                <span class="text-red-600">{{ shareError }}</span>
              </div>
            </div>
            
            <button
              @click="shareOnNostr"
              :disabled="isSharing"
              class="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
              <IconMessageCircle v-else class="w-5 h-5" />
              <span>{{ isSharing ? 'Sharing...' : 'Post to Nostr' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Button hover effects */
button {
  transition: all 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
}

button:active {
  transform: translateY(0);
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button {
    min-height: 44px;
  }
  
  input, textarea {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>