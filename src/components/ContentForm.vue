<script setup>
import { ref, computed } from 'vue'
import { 
  IconFileText, 
  IconMail, 
  IconMicrophone, 
  IconVideo, 
  IconPhoto, 
  IconFile,
  IconX,
  IconPlus,
  IconLock
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel', 'save-draft'])

const contentTypes = [
  { value: 'article', label: 'Article', icon: IconFileText },
  { value: 'newsletter', label: 'Newsletter', icon: IconMail },
  { value: 'podcast', label: 'Podcast', icon: IconMicrophone },
  { value: 'video', label: 'Video', icon: IconVideo },
  { value: 'image', label: 'Image', icon: IconPhoto },
  { value: 'document', label: 'Document', icon: IconFile }
]

const monetizationModels = [
  { value: 'one-time', label: 'One-time Purchase' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'free', label: 'Free' }
]

const newTag = ref('')

const isFormValid = computed(() => {
  return props.form.title.trim() && 
         props.form.description.trim() && 
         props.form.previewText.trim() &&
         props.form.fullContent.trim() &&
         (props.form.monetizationModel === 'free' || props.form.price > 0)
})

const addTag = () => {
  if (newTag.value.trim() && !props.form.tags.includes(newTag.value.trim())) {
    props.form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index) => {
  props.form.tags.splice(index, 1)
}

const handleSubmit = () => {
  if (isFormValid.value) {
    emit('submit')
  }
}

const handleSaveDraft = () => {
  emit('save-draft')
}
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
    <div class="p-6 border-b border-orange-100/50">
      <h2 class="text-xl font-semibold text-gray-900">
        {{ isEditing ? 'Edit Content' : 'Create New Content' }}
      </h2>
      <p class="text-gray-600 text-sm mt-1">
        Publish premium content that users can unlock with Lightning payments
      </p>
    </div>
    
    <div class="p-6 space-y-6">
      <!-- Title -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
        <input
          v-model="form.title"
          type="text"
          placeholder="Enter content title..."
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
        />
      </div>
      
      <!-- Type and Monetization -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
          <select
            v-model="form.type"
            class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
          >
            <option v-for="type in contentTypes" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Monetization Model</label>
          <select
            v-model="form.monetizationModel"
            class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
          >
            <option v-for="model in monetizationModels" :key="model.value" :value="model.value">
              {{ model.label }}
            </option>
          </select>
        </div>
      </div>
      
      <!-- Price -->
      <div v-if="form.monetizationModel !== 'free'">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Price (sats)
          <span v-if="form.monetizationModel === 'subscription'" class="text-gray-500">per month</span>
        </label>
        <div class="relative">
          <input
            v-model.number="form.price"
            type="number"
            min="1"
            placeholder="5000"
            class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            <IconLock class="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
      
      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          v-model="form.description"
          rows="3"
          placeholder="Brief description of your content..."
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
        ></textarea>
      </div>
      
      <!-- Preview Text -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Preview Text</label>
        <textarea
          v-model="form.previewText"
          rows="4"
          placeholder="Write a compelling preview that will encourage users to unlock your content..."
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">This is what users see before purchasing</p>
      </div>
      
      <!-- Full Content -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Full Content</label>
        <textarea
          v-model="form.fullContent"
          rows="8"
          placeholder="Write your premium content here..."
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">This content is unlocked after payment</p>
      </div>
      
      <!-- Tags -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <div class="flex flex-wrap gap-2 mb-3">
          <span
            v-for="(tag, index) in form.tags"
            :key="index"
            class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
          >
            <span>{{ tag }}</span>
            <button @click="removeTag(index)" class="hover:text-orange-900">
              <IconX class="w-3 h-3" />
            </button>
          </span>
        </div>
        <div class="flex space-x-2">
          <input
            v-model="newTag"
            type="text"
            placeholder="Add tag..."
            @keyup.enter="addTag"
            class="flex-1 px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm"
          />
          <button
            @click="addTag"
            class="btn-secondary text-sm"
          >
            <IconPlus class="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <!-- Cover Image -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Cover Image URL (optional)</label>
        <input
          v-model="form.coverImage"
          type="url"
          placeholder="https://example.com/image.jpg"
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
        />
      </div>
    </div>
    
    <!-- Actions -->
    <div class="p-6 border-t border-orange-100/50 flex flex-col sm:flex-row gap-3 sm:justify-end">
      <button
        @click="$emit('cancel')"
        class="btn-secondary"
      >
        Cancel
      </button>
      <button
        @click="handleSaveDraft"
        :disabled="isLoading"
        class="btn-secondary"
      >
        Save Draft
      </button>
      <button
        @click="handleSubmit"
        :disabled="!isFormValid || isLoading"
        class="btn-primary"
      >
        <IconLock class="w-4 h-4" />
        {{ isLoading ? 'Publishing...' : 'Publish Gated Content' }}
      </button>
    </div>
  </div>
</template>