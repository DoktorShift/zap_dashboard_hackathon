<script setup>
import { computed } from 'vue'
import { 
  IconFileText, 
  IconPlus, 
  IconEye, 
  IconChartBar,
  IconArrowLeft
} from '@iconify-prerendered/vue-tabler'
import { useContent } from '../composables/useContent.js'
import ContentStats from '../components/ContentStats.vue'
import ContentList from '../components/ContentList.vue'
import ContentForm from '../components/ContentForm.vue'
import ContentPerformance from '../components/ContentPerformance.vue'

const {
  // State
  contentItems,
  contentForm,
  currentView,
  editingContent,
  selectedContent,
  isLoading,
  error,
  
  // Computed
  contentStats,
  publishedItems,
  draftItems,
  
  // Actions
  createContent,
  updateContent,
  deleteContent,
  publishContent,
  unpublishContent,
  duplicateContent,
  
  // View management
  setView,
  editContent,
  previewContent
} = useContent()

const handleCreateContent = async () => {
  try {
    await createContent({ ...contentForm })
  } catch (error) {
    console.error('Failed to create content:', error)
  }
}

const handleUpdateContent = async () => {
  if (!editingContent.value) return
  
  try {
    await updateContent(editingContent.value.id, { ...contentForm })
    setView('list')
  } catch (error) {
    console.error('Failed to update content:', error)
  }
}

const handleSaveDraft = async () => {
  const contentData = { 
    ...contentForm, 
    status: 'draft' 
  }
  
  if (editingContent.value) {
    await updateContent(editingContent.value.id, contentData)
    setView('list')
  } else {
    await createContent(contentData)
  }
}

const handleDeleteContent = async (content) => {
  if (confirm(`Are you sure you want to delete "${content.title}"?`)) {
    try {
      await deleteContent(content.id)
    } catch (error) {
      console.error('Failed to delete content:', error)
    }
  }
}

const handleDuplicateContent = async (content) => {
  try {
    await duplicateContent(content.id)
  } catch (error) {
    console.error('Failed to duplicate content:', error)
  }
}

const handleShareContent = (content) => {
  // Mock share functionality
  const shareUrl = `${window.location.origin}/content/${content.id}`
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert('Share link copied to clipboard!')
  })
}

const activeTab = computed(() => {
  if (currentView.value === 'list') return 'my-content'
  if (currentView.value === 'create' || currentView.value === 'edit') return 'create-new'
  return 'my-content'
})

const setActiveTab = (tab) => {
  if (tab === 'my-content') {
    setView('list')
  } else if (tab === 'create-new') {
    setView('create')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
          <IconFileText class="w-6 h-6 text-orange-600" />
          <span>Content Monetization</span>
        </h1>
        <p class="text-gray-600">Publish premium content gated by Lightning payments</p>
      </div>
      
      <div class="flex items-center space-x-3">
        <button
          v-if="currentView !== 'list'"
          @click="setView('list')"
          class="btn-secondary"
        >
          <IconArrowLeft class="w-4 h-4" />
          Back
        </button>
        <button
          v-if="currentView === 'list'"
          @click="setView('performance')"
          class="btn-secondary"
        >
          <IconChartBar class="w-4 h-4" />
          Performance
        </button>
        <button
          v-if="currentView === 'list'"
          @click="setView('create')"
          class="btn-primary"
        >
          <IconPlus class="w-4 h-4" />
          New Content
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-600">{{ error }}</p>
    </div>

    <!-- Main Content -->
    <div v-if="currentView === 'list'">
      <!-- Stats Overview -->
      <ContentStats :stats="contentStats" />
      
      <!-- Content Tabs -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden mt-6">
        <!-- Tab Navigation -->
        <div class="border-b border-orange-100/50">
          <nav class="flex space-x-8 px-6" aria-label="Content tabs">
            <button
              @click="setActiveTab('my-content')"
              :class="[
                'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200',
                activeTab === 'my-content'
                  ? 'border-orange-400 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <IconFileText class="w-4 h-4" />
              <span>My Content</span>
            </button>
          </nav>
        </div>
        
        <!-- Content List -->
        <div class="p-6">
          <ContentList
            :items="contentItems"
            @edit="editContent"
            @delete="handleDeleteContent"
            @preview="previewContent"
            @duplicate="handleDuplicateContent"
            @share="handleShareContent"
          />
        </div>
      </div>
    </div>

    <!-- Create/Edit Content Form -->
    <div v-else-if="currentView === 'create' || currentView === 'edit'">
      <ContentForm
        :form="contentForm"
        :is-editing="currentView === 'edit'"
        :is-loading="isLoading"
        @submit="currentView === 'edit' ? handleUpdateContent() : handleCreateContent()"
        @save-draft="handleSaveDraft"
        @cancel="setView('list')"
      />
    </div>

    <!-- Content Preview -->
    <div v-else-if="currentView === 'preview' && selectedContent">
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
        <div class="p-6 border-b border-orange-100/50">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900">Content Preview</h2>
            <button @click="setView('list')" class="btn-secondary">
              <IconArrowLeft class="w-4 h-4" />
              Back to List
            </button>
          </div>
        </div>
        
        <div class="p-6">
          <!-- Content Header -->
          <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-4">{{ selectedContent.title }}</h1>
            <p class="text-lg text-gray-600 mb-4">{{ selectedContent.description }}</p>
            
            <!-- Content Meta -->
            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span>{{ selectedContent.type.charAt(0).toUpperCase() + selectedContent.type.slice(1) }}</span>
              <span>•</span>
              <span>{{ selectedContent.price.toLocaleString() }} sats</span>
              <span>•</span>
              <span>{{ selectedContent.unlocks }} unlocks</span>
              <span>•</span>
              <span>{{ selectedContent.views }} views</span>
            </div>
          </div>
          
          <!-- Cover Image -->
          <div v-if="selectedContent.coverImage" class="mb-6">
            <img 
              :src="selectedContent.coverImage" 
              :alt="selectedContent.title"
              class="w-full h-64 object-cover rounded-lg"
            />
          </div>
          
          <!-- Preview Content -->
          <div class="prose max-w-none mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Preview</h3>
            <p class="text-gray-700 leading-relaxed">{{ selectedContent.previewText }}</p>
          </div>
          
          <!-- Gated Content -->
          <div class="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div class="text-center">
              <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconEye class="w-8 h-8 text-orange-600" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Premium Content</h3>
              <p class="text-gray-600 mb-4">
                Unlock the full content with a Lightning payment of {{ selectedContent.price.toLocaleString() }} sats
              </p>
              <button class="btn-primary">
                <IconPlus class="w-4 h-4" />
                Unlock for {{ selectedContent.price.toLocaleString() }} sats
              </button>
            </div>
          </div>
          
          <!-- Tags -->
          <div v-if="selectedContent.tags && selectedContent.tags.length > 0" class="mt-6">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Tags</h4>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in selectedContent.tags"
                :key="tag"
                class="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance View -->
    <div v-else-if="currentView === 'performance'">
      <ContentPerformance :content-items="contentItems" />
    </div>
  </div>
</template>