<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconUser,
  IconEdit,
  IconDeviceFloppy,
  IconX, 
  IconCheck, 
  IconAlertTriangle,
  IconLoader,
  IconKey,
  IconBolt,
  IconGlobe,
  IconPhoto,
  IconFileDescription,
  IconId,
  IconEye
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'

const props = defineProps({
  isEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close-editor', 'profile-updated'])

const { currentUser, userProfile, refreshUserProfile } = useNostrAuth()

// Form state
const form = ref({
  name: '',
  display_name: '',
  about: '',
  picture: '',
  banner: '',
  website: '',
  lud16: '',
  nip05: ''
})

// UI state
const isLoading = ref(false)
const error = ref('')
const success = ref(false)
const previewImage = ref(null)
const previewBanner = ref(null)

// Initialize form with current profile data
const initializeForm = () => {
  if (userProfile.value) {
    form.value = {
      name: userProfile.value.name || '',
      display_name: userProfile.value.display_name || '',
      about: userProfile.value.about || '',
      picture: userProfile.value.picture || '',
      banner: userProfile.value.banner || '',
      website: userProfile.value.website || '',
      lud16: userProfile.value.lud16 || '',
      nip05: userProfile.value.nip05 || ''
    }
    
    // Set preview images
    previewImage.value = form.value.picture
    previewBanner.value = form.value.banner
  }
}

// Watch for profile changes
watch(() => userProfile.value, initializeForm, { immediate: true })

// Watch for image URL changes to update previews
watch(() => form.value.picture, (newUrl) => {
  previewImage.value = newUrl
})

watch(() => form.value.banner, (newUrl) => {
  previewBanner.value = newUrl
})

// Validate form
const validateForm = () => {
  if (!form.value.name.trim()) {
    error.value = 'Name is required'
    return false
  }
  
  // Validate Lightning Address format (if provided)
  if (form.value.lud16 && !form.value.lud16.includes('@')) {
    error.value = 'Lightning Address should be in the format username@domain.com'
    return false
  }
  
  // Validate website URL format (if provided)
  if (form.value.website) {
    try {
      new URL(form.value.website)
    } catch (e) {
      error.value = 'Website must be a valid URL (include https://)'
      return false
    }
  }
  
  // Validate image URLs
  if (form.value.picture) {
    try {
      new URL(form.value.picture)
    } catch (e) {
      error.value = 'Profile picture must be a valid URL'
      return false
    }
  }
  
  if (form.value.banner) {
    try {
      new URL(form.value.banner)
    } catch (e) {
      error.value = 'Banner must be a valid URL'
      return false
    }
  }
  
  return true
}

// Save profile
const saveProfile = async () => {
  if (!validateForm()) return
  
  isLoading.value = true
  error.value = ''
  success.value = false
  
  try {
    // Create profile content object
    const profileContent = {
      name: form.value.name.trim(),
      display_name: form.value.display_name.trim() || undefined,
      about: form.value.about.trim() || undefined,
      picture: form.value.picture.trim() || undefined,
      banner: form.value.banner.trim() || undefined,
      website: form.value.website.trim() || undefined,
      lud16: form.value.lud16.trim() || undefined,
      nip05: form.value.nip05.trim() || undefined
    }
    
    // Remove undefined fields
    Object.keys(profileContent).forEach(key => {
      if (profileContent[key] === undefined) {
        delete profileContent[key]
      }
    })
    
    // Create event template
    const eventTemplate = {
      kind: 0, // Profile metadata
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profileContent)
    }
    
    // Sign the event
    let signedEvent
    if (window.nostr?.signEvent) {
      signedEvent = await window.nostr.signEvent(eventTemplate)
    } else {
      throw new Error('Nostr extension not available for signing')
    }
    
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
    
    console.log('Profile updated successfully:', result)
    
    // Refresh profile data
    await refreshUserProfile()
    
    success.value = true
    setTimeout(() => {
      emit('profile-updated')
      emit('close-editor')
    }, 2000)
    
  } catch (err) {
    console.error('Failed to update profile:', err)
    error.value = `Failed to update profile: ${err.message}`
  } finally {
    isLoading.value = false
  }
}

// Reset form
const resetForm = () => {
  initializeForm()
  error.value = ''
  success.value = false
}

// Handle cancel
const handleCancel = () => {
  resetForm()
  emit('close-editor')
}

// Get avatar with fallback
const getAvatarUrl = computed(() => {
  return previewImage.value || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
})

// Get banner with fallback
const getBannerUrl = computed(() => {
  return previewBanner.value || 'https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
})

// Initialize form on component mount
initializeForm()
</script>

<template>
  <!-- Modern Modal Overlay -->
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
      <!-- Modal Header -->
      <div class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-6 py-4 relative">
        <div class="absolute inset-0 bg-black/5"></div>
        <div class="relative flex items-center justify-between">
          <h2 class="text-xl font-bold text-white">Edit Profile</h2>
          <button
            @click="handleCancel"
            class="w-10 h-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
          >
            <IconX class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      
      <!-- Scrollable Content -->
      <div class="overflow-y-auto max-h-[calc(90vh-80px)]">
        <!-- Live Preview Section -->
        <div class="p-6 bg-gray-50 border-b border-gray-200">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Live Preview</h3>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <!-- Preview Header -->
            <div class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-4 py-6 relative">
              <div class="absolute inset-0 bg-black/5"></div>
              <div class="relative flex items-center gap-3">
                <!-- Preview Avatar -->
                <div class="w-12 h-12 rounded-full ring-2 ring-white/30 overflow-hidden bg-white shadow-lg">
                  <img 
                    :src="getAvatarUrl" 
                    :alt="form.name || 'User'" 
                    class="w-full h-full object-cover"
                    @error="previewImage = null"
                  />
                </div>
                
                <!-- Preview Info -->
                <div class="flex-1 min-w-0">
                  <h4 class="text-lg font-bold text-white truncate">{{ form.name || 'Your Name' }}</h4>
                  <p v-if="form.display_name" class="text-white/80 text-sm truncate">{{ form.display_name }}</p>
                  <p v-else-if="form.about" class="text-white/80 text-sm truncate">{{ form.about }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Form Content -->
        <div class="p-6 space-y-6">
          <!-- Basic Information Card -->
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <IconUser class="w-4 h-4 text-gray-500" />
                Basic Information
              </h3>
            </div>
            <div class="p-4 space-y-4">
              <!-- Name (Required) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Name <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="Your name"
                  class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all duration-200"
                />
              </div>
              
              <!-- Display Name -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  v-model="form.display_name"
                  type="text"
                  placeholder="Alternative display name"
                  class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all duration-200"
                />
              </div>
              
              <!-- About -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">About</label>
                <textarea
                  v-model="form.about"
                  rows="3"
                  placeholder="Tell us about yourself"
                  class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all duration-200 resize-none"
                ></textarea>
              </div>
            </div>
          </div>
          
          <!-- Profile Images Card -->
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <IconPhoto class="w-4 h-4 text-gray-500" />
                Profile Images
              </h3>
            </div>
            <div class="p-4 space-y-4">
              <!-- Profile Picture -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Profile Picture URL</label>
                <input
                  v-model="form.picture"
                  type="url"
                  placeholder="https://example.com/your-image.jpg"
                  class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all duration-200"
                />
              </div>
              
              <!-- Banner -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Banner URL</label>
                <input
                  v-model="form.banner"
                  type="url"
                  placeholder="https://example.com/your-banner.jpg"
                  class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all duration-200"
                />
              </div>
            </div>
          </div>
          
          <!-- Lightning & Verification Card -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 overflow-hidden">
            <div class="bg-gradient-to-r from-orange-100 to-amber-100 px-4 py-3 border-b border-orange-200">
              <h3 class="text-sm font-semibold text-orange-800 flex items-center gap-2">
                <IconBolt class="w-4 h-4 text-orange-600" />
                Lightning & Verification
              </h3>
            </div>
            <div class="p-4 space-y-4">
              <!-- Lightning Address - Highlighted -->
              <div class="bg-white rounded-lg border border-orange-200 p-4">
                <div class="flex items-center gap-2 mb-2">
                  <IconBolt class="w-4 h-4 text-orange-500" />
                  <label class="text-sm font-medium text-orange-700">Lightning Address</label>
                  <span class="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-medium">Required for Zaps</span>
                </div>
                <input
                  v-model="form.lud16"
                  type="text"
                  placeholder="you@getalby.com"
                  class="w-full px-4 py-3 border-2 border-orange-300 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-500 transition-all duration-200 bg-orange-50/50"
                />
                <p class="text-xs text-orange-600 mt-2 font-medium">This enables users to send you Lightning payments (zaps) in ZapTracker</p>
              </div>
              
              <!-- NIP-05 Verification -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">NIP-05 Identifier</label>
                <input
                  v-model="form.nip05"
                  type="text"
                  placeholder="you@domain.com"
                  class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all duration-200"
                />
                <p class="text-xs text-gray-500 mt-1">Verifies your identity on Nostr</p>
              </div>
              
              <!-- Website -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Website</label>
                <input
                  v-model="form.website"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all duration-200"
                />
              </div>
            </div>
          </div>
          
          <!-- Error Message -->
          <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
            <div class="flex items-center space-x-3">
              <IconAlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0" />
              <span class="text-sm text-red-600">{{ error }}</span>
            </div>
          </div>
          
          <!-- Success Message -->
          <div v-if="success" class="bg-green-50 border border-green-200 rounded-xl p-4">
            <div class="flex items-center space-x-3">
              <IconCheck class="w-5 h-5 text-green-600 flex-shrink-0" />
              <span class="text-sm text-green-600">Profile updated successfully!</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Modal Footer -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          @click="handleCancel" 
          class="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-medium transition-all duration-200 hover:scale-105"
        >
          Cancel
        </button>
        <button
          @click="saveProfile"
          :disabled="isLoading"
          class="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
        >
          <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
          <IconDeviceFloppy v-else class="w-4 h-4" />
          {{ isLoading ? 'Saving...' : 'Save Profile' }}
        </button>
      </div>
    </div>
  </div>
</template>