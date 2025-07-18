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
  IconEye,
  IconCamera,
  IconShield
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
const previewImage = ref('')
const previewBanner = ref('')
const activeSection = ref('basic') // Track which section is being edited

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
  } else {
    // Initialize with empty form if no profile
    form.value = {
      name: '',
      display_name: '',
      about: '',
      picture: '',
      banner: '',
      website: '',
      lud16: '',
      nip05: ''
    }
    previewImage.value = ''
    previewBanner.value = ''
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
  error.value = '' // Clear previous errors
  
  if (!form.value.name.trim()) {
    error.value = 'Name is required'
    return false
  }
  
  if (form.value.name.trim().length > 50) {
    error.value = 'Name must be 50 characters or less'
    return false
  }
  
  if (form.value.about.length > 500) {
    error.value = 'About section must be 500 characters or less'
    return false
  }
  
  // Validate Lightning Address format (if provided)
  if (form.value.lud16 && form.value.lud16.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.value.lud16.trim())) {
      error.value = 'Lightning Address must be in the format username@domain.com'
      return false
    }
  }
  
  // Validate NIP-05 format (if provided)
  if (form.value.nip05 && form.value.nip05.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.value.nip05.trim())) {
      error.value = 'NIP-05 identifier must be in the format username@domain.com'
      return false
    }
  }
  
  // Validate website URL format (if provided)
  if (form.value.website && form.value.website.trim()) {
    if (!form.value.website.trim().startsWith('http://') && !form.value.website.trim().startsWith('https://')) {
      error.value = 'Website must start with http:// or https://'
      return false
    }
    try {
      new URL(form.value.website.trim())
    } catch (e) {
      error.value = 'Website must be a valid URL'
      return false
    }
  }
  
  // Validate image URLs (if provided)
  if (form.value.picture && form.value.picture.trim()) {
    if (!form.value.picture.trim().startsWith('http://') && !form.value.picture.trim().startsWith('https://')) {
      error.value = 'Profile picture must be a valid URL starting with http:// or https://'
      return false
    }
    try {
      new URL(form.value.picture.trim())
    } catch (e) {
      error.value = 'Profile picture must be a valid URL'
      return false
    }
  }
  
  if (form.value.banner && form.value.banner.trim()) {
    if (!form.value.banner.trim().startsWith('http://') && !form.value.banner.trim().startsWith('https://')) {
      error.value = 'Banner must be a valid URL starting with http:// or https://'
      return false
    }
    try {
      new URL(form.value.banner.trim())
    } catch (e) {
      error.value = 'Banner must be a valid URL'
      return false
    }
  }
  
  return true
}

// Real-time validation for better UX
const validateField = (field) => {
  switch (field) {
    case 'name':
      if (form.value.name.trim().length > 50) {
        return 'Name must be 50 characters or less'
      }
      break
    case 'about':
      if (form.value.about.length > 500) {
        return 'About section must be 500 characters or less'
      }
      break
    case 'lud16':
      if (form.value.lud16 && form.value.lud16.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(form.value.lud16.trim())) {
          return 'Must be in format username@domain.com'
        }
      }
      break
    case 'website':
      if (form.value.website && form.value.website.trim()) {
        if (!form.value.website.trim().startsWith('http://') && !form.value.website.trim().startsWith('https://')) {
          return 'Must start with http:// or https://'
        }
      }
      break
  }
  return null
}

// Field validation states
const fieldErrors = ref({
  name: '',
  about: '',
  lud16: '',
  website: ''
})

// Watch for field changes and validate
watch(() => form.value.name, () => {
  fieldErrors.value.name = validateField('name') || ''
})

watch(() => form.value.about, () => {
  fieldErrors.value.about = validateField('about') || ''
})

watch(() => form.value.lud16, () => {
  fieldErrors.value.lud16 = validateField('lud16') || ''
})

watch(() => form.value.website, () => {
  fieldErrors.value.website = validateField('website') || ''
})
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
  <!-- Apple-Inspired Modal Overlay -->
  <div class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
    <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden transform animate-in slide-in-from-bottom-4 duration-500">
      <!-- Elegant Header with Gradient -->
      <div class="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-6 py-6 relative overflow-hidden">
        <!-- Subtle pattern overlay -->
        <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
        <div class="relative flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <IconUser class="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-white">Edit Profile</h2>
              <p class="text-white/80 text-sm">Update your Nostr identity</p>
            </div>
          </div>
          <button
            @click="handleCancel"
            class="w-10 h-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:rotate-90"
          >
            <IconX class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      
      <!-- Scrollable Content -->
      <div class="overflow-y-auto max-h-[calc(95vh-120px)] scrollbar-thin">
        <!-- Live Preview Section with Apple-style design -->
        <div class="p-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconEye class="w-5 h-5 text-orange-500" />
              <span>Live Preview</span>
            </h3>
            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Updates in real-time</span>
          </div>
          
          <!-- Enhanced Preview Card -->
          <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
            <!-- Banner Section -->
            <div class="h-24 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 relative overflow-hidden">
              <div v-if="previewBanner" class="absolute inset-0">
                <img 
                  :src="previewBanner" 
                  alt="Banner" 
                  class="w-full h-full object-cover"
                  @error="previewBanner = ''"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            </div>
            
            <!-- Profile Section -->
            <div class="px-6 pb-6 -mt-8 relative">
              <div class="flex items-end space-x-4">
                <!-- Avatar with better positioning -->
                <div class="relative">
                  <div class="w-16 h-16 rounded-2xl ring-4 ring-white overflow-hidden bg-white shadow-xl">
                    <img 
                      :src="getAvatarUrl" 
                      :alt="form.name || 'User'" 
                      class="w-full h-full object-cover"
                      @error="previewImage = ''"
                    />
                  </div>
                  <!-- Online indicator -->
                  <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                </div>
                
                <!-- Profile Info -->
                <div class="flex-1 min-w-0 pt-4">
                  <h4 class="text-xl font-bold text-gray-900 truncate">{{ form.name || 'Your Name' }}</h4>
                  <p v-if="form.display_name" class="text-gray-600 text-sm truncate">{{ form.display_name }}</p>
                  <p v-if="form.about" class="text-gray-500 text-sm mt-1 line-clamp-2">{{ form.about }}</p>
                  
                  <!-- Quick badges -->
                  <div class="flex flex-wrap gap-2 mt-2">
                    <span v-if="form.lud16" class="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium">
                      <IconBolt class="w-3 h-3 mr-1" />
                      Zap Ready
                    </span>
                    <span v-if="form.nip05" class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                      <IconShield class="w-3 h-3 mr-1" />
                      Verified
                    </span>
                    <span v-if="form.website" class="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      <IconGlobe class="w-3 h-3 mr-1" />
                      Website
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Form Content with Apple-style sections -->
        <div class="p-6 space-y-8">
          <!-- Basic Information Section -->
          <div class="space-y-6">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                <IconUser class="w-4 h-4 text-orange-600" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900">Basic Information</h3>
            </div>
            
            <div class="bg-gray-50 rounded-2xl p-6 space-y-6">
              <!-- Name Field -->
              <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">
                  Display Name <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="Enter your display name"
                  maxlength="50"
                  class="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base"
                  :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.name }"
                />
                <div class="flex justify-between items-center">
                  <p v-if="fieldErrors.name" class="text-sm text-red-600">{{ fieldErrors.name }}</p>
                  <span class="text-xs text-gray-500 ml-auto">{{ form.name.length }}/50</span>
                </div>
              </div>
              
              <!-- Display Name Field -->
              <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Alternative Display Name</label>
                <input
                  v-model="form.display_name"
                  type="text"
                  placeholder="Optional alternative name"
                  class="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base"
                />
                <p class="text-xs text-gray-500">This will be shown as a subtitle under your main name</p>
              </div>
              
              <!-- About Field -->
              <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">About</label>
                <textarea
                  v-model="form.about"
                  rows="4"
                  placeholder="Tell people about yourself..."
                  maxlength="500"
                  class="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 resize-none text-base"
                  :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.about }"
                ></textarea>
                <div class="flex justify-between items-center">
                  <p v-if="fieldErrors.about" class="text-sm text-red-600">{{ fieldErrors.about }}</p>
                  <span class="text-xs text-gray-500 ml-auto">{{ form.about.length }}/500</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Visual Identity Section -->
          <div class="space-y-6">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                <IconCamera class="w-4 h-4 text-purple-600" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900">Visual Identity</h3>
            </div>
            
            <div class="bg-gray-50 rounded-2xl p-6 space-y-6">
              <!-- Profile Picture -->
              <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Profile Picture URL</label>
                <input
                  v-model="form.picture"
                  type="url"
                  placeholder="https://example.com/your-avatar.jpg"
                  class="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base"
                />
                <p class="text-xs text-gray-500">Recommended: Square image, at least 400x400px</p>
              </div>
              
              <!-- Banner -->
              <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Banner URL</label>
                <input
                  v-model="form.banner"
                  type="url"
                  placeholder="https://example.com/your-banner.jpg"
                  class="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base"
                />
                <p class="text-xs text-gray-500">Recommended: 1200x400px for best results</p>
              </div>
            </div>
          </div>
          
          <!-- Lightning & Verification Section -->
          <div class="space-y-6">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                <IconBolt class="w-4 h-4 text-orange-600" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900">Lightning & Verification</h3>
            </div>
            
            <!-- Lightning Address - Highlighted -->
            <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200">
              <div class="flex items-start space-x-3 mb-4">
                <div class="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <IconBolt class="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 class="font-semibold text-orange-900">Lightning Address</h4>
                  <p class="text-sm text-orange-700">Required to receive zaps in ZapTracker</p>
                </div>
              </div>
              
              <div class="space-y-2">
                <input
                  v-model="form.lud16"
                  type="text"
                  placeholder="you@getalby.com"
                  class="w-full px-4 py-4 bg-white border-2 border-orange-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base font-medium"
                  :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.lud16 }"
                />
                <div class="flex justify-between items-center">
                  <p v-if="fieldErrors.lud16" class="text-sm text-red-600">{{ fieldErrors.lud16 }}</p>
                  <p v-else class="text-xs text-orange-700">This enables Lightning payments to your profile</p>
                </div>
              </div>
            </div>
            
            <!-- Other Verification Fields -->
            <div class="bg-gray-50 rounded-2xl p-6 space-y-6">
              <!-- NIP-05 -->
              <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">NIP-05 Verification</label>
                <input
                  v-model="form.nip05"
                  type="text"
                  placeholder="you@domain.com"
                  class="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base"
                />
                <p class="text-xs text-gray-500">Verifies your identity on the Nostr network</p>
              </div>
              
              <!-- Website -->
              <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Website</label>
                <input
                  v-model="form.website"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  class="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base"
                  :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.website }"
                />
                <div class="flex justify-between items-center">
                  <p v-if="fieldErrors.website" class="text-sm text-red-600">{{ fieldErrors.website }}</p>
                  <p v-else class="text-xs text-gray-500">Your personal or professional website</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Status Messages -->
          <div class="space-y-4">
            <!-- Error Message -->
            <div v-if="error" class="bg-red-50 border border-red-200 rounded-2xl p-4 animate-in slide-in-from-left duration-300">
              <div class="flex items-start space-x-3">
                <div class="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconAlertTriangle class="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h4 class="font-semibold text-red-900">Validation Error</h4>
                  <p class="text-sm text-red-700 mt-1">{{ error }}</p>
                </div>
              </div>
            </div>
            
            <!-- Success Message -->
            <div v-if="success" class="bg-green-50 border border-green-200 rounded-2xl p-4 animate-in slide-in-from-left duration-300">
              <div class="flex items-start space-x-3">
                <div class="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconCheck class="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 class="font-semibold text-green-900">Profile Updated!</h4>
                  <p class="text-sm text-green-700 mt-1">Your changes have been published to the Nostr network</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Apple-style Footer -->
      <div class="bg-gray-50/80 backdrop-blur-sm px-6 py-4 border-t border-gray-100 flex justify-between items-center">
        <button
          @click="handleCancel" 
          class="px-6 py-3 text-gray-700 hover:text-gray-900 font-medium transition-all duration-200 hover:scale-105 rounded-xl hover:bg-gray-100"
        >
          Cancel
        </button>
        
        <div class="flex items-center space-x-3">
          <!-- Save as Draft (if needed) -->
          <button
            @click="resetForm"
            class="px-4 py-3 text-gray-600 hover:text-gray-800 font-medium transition-all duration-200 hover:scale-105 rounded-xl hover:bg-gray-100 text-sm"
          >
            Reset
          </button>
          
          <!-- Primary Save Button -->
          <button
            @click="saveProfile"
            :disabled="isLoading || !form.name.trim()"
            class="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center space-x-2 shadow-lg hover:shadow-xl"
          >
            <IconLoader v-if="isLoading" class="w-5 h-5 animate-spin" />
            <IconDeviceFloppy v-else class="w-5 h-5" />
            <span>{{ isLoading ? 'Saving...' : 'Save Profile' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Apple-inspired animations */
@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: animate-in 0.3s ease-out;
}

/* Smooth scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Focus states */
input:focus,
textarea:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.1);
}

/* Hover effects */
button:hover:not(:disabled) {
  transform: translateY(-1px);
}

/* Loading state */
button:disabled {
  cursor: not-allowed;
}

/* Gradient text effect */
.gradient-text {
  background: linear-gradient(135deg, #f97316, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
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