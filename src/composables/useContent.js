import { ref, reactive, computed } from 'vue'

// Content types
const CONTENT_TYPES = {
  ARTICLE: 'article',
  NEWSLETTER: 'newsletter', 
  PODCAST: 'podcast',
  VIDEO: 'video',
  IMAGE: 'image',
  DOCUMENT: 'document'
}

// Monetization models
const MONETIZATION_MODELS = {
  ONE_TIME: 'one-time',
  SUBSCRIPTION: 'subscription',
  FREE: 'free'
}

// Content status
const CONTENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
}

// Global content state
const contentItems = ref([
  {
    id: '1',
    title: 'Advanced Lightning Network Architecture',
    description: 'Deep dive into Lightning Network\'s technical architecture, covering channel management, routing algorithms...',
    type: CONTENT_TYPES.ARTICLE,
    monetizationModel: MONETIZATION_MODELS.ONE_TIME,
    price: 5000, // sats
    status: CONTENT_STATUS.PUBLISHED,
    unlocks: 23,
    revenue: 115000, // sats
    views: 156,
    subscribers: 0,
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString(),
    previewText: 'Understanding the Lightning Network requires deep knowledge of its underlying architecture. This comprehensive guide covers channel states, routing mechanisms, and advanced payment flows...',
    fullContent: 'The Lightning Network represents one of the most significant scaling solutions for Bitcoin...',
    tags: ['lightning', 'bitcoin', 'technical', 'architecture'],
    coverImage: 'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1'
  },
  {
    id: '2',
    title: 'Bitcoin Development Weekly',
    description: 'Weekly roundup of Bitcoin development updates, protocol improvements, and ecosystem news...',
    type: CONTENT_TYPES.NEWSLETTER,
    monetizationModel: MONETIZATION_MODELS.SUBSCRIPTION,
    price: 2000, // sats per month
    status: CONTENT_STATUS.PUBLISHED,
    unlocks: 0,
    revenue: 90000, // sats
    views: 89,
    subscribers: 45,
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-22').toISOString(),
    previewText: 'Stay updated with the latest Bitcoin development news, protocol improvements, and ecosystem updates. Weekly insights from core developers...',
    fullContent: 'This week in Bitcoin development: Core updates, Lightning improvements, and ecosystem growth...',
    tags: ['bitcoin', 'development', 'weekly', 'news'],
    coverImage: 'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1'
  },
  {
    id: '3',
    title: 'Nostr Protocol Explained',
    description: 'Comprehensive explanation of the Nostr protocol, its benefits, and implementation details...',
    type: CONTENT_TYPES.PODCAST,
    monetizationModel: MONETIZATION_MODELS.ONE_TIME,
    price: 3000, // sats
    status: CONTENT_STATUS.DRAFT,
    unlocks: 0,
    revenue: 0, // sats
    views: 0,
    subscribers: 0,
    createdAt: new Date('2024-01-25').toISOString(),
    updatedAt: new Date('2024-01-25').toISOString(),
    previewText: 'Discover the revolutionary Nostr protocol that\'s changing social media. Learn about decentralized communication, censorship resistance...',
    fullContent: 'Nostr (Notes and Other Stuff Transmitted by Relays) is a simple, open protocol...',
    tags: ['nostr', 'protocol', 'decentralized', 'social'],
    coverImage: 'https://images.pexels.com/photos/7130560/pexels-photo-7130560.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1'
  }
])

// Content form state
const contentForm = reactive({
  title: '',
  description: '',
  type: CONTENT_TYPES.ARTICLE,
  monetizationModel: MONETIZATION_MODELS.ONE_TIME,
  price: 1000,
  previewText: '',
  fullContent: '',
  tags: [],
  coverImage: ''
})

// UI state
const currentView = ref('list') // list, create, edit, preview
const editingContent = ref(null)
const selectedContent = ref(null)
const isLoading = ref(false)
const error = ref('')

// Computed properties
const totalRevenue = computed(() => {
  return contentItems.value.reduce((sum, item) => sum + item.revenue, 0)
})

const totalUnlocks = computed(() => {
  return contentItems.value.reduce((sum, item) => sum + item.unlocks, 0)
})

const publishedItems = computed(() => {
  return contentItems.value.filter(item => item.status === CONTENT_STATUS.PUBLISHED)
})

const draftItems = computed(() => {
  return contentItems.value.filter(item => item.status === CONTENT_STATUS.DRAFT)
})

const revenueInUSD = computed(() => {
  return (totalRevenue.value * 0.0003).toFixed(2) // Rough BTC to USD conversion
})

const contentStats = computed(() => {
  const published = publishedItems.value.length
  const drafts = draftItems.value.length
  const totalViews = contentItems.value.reduce((sum, item) => sum + item.views, 0)
  const totalSubscribers = contentItems.value.reduce((sum, item) => sum + item.subscribers, 0)
  
  return {
    published,
    drafts,
    totalViews,
    totalSubscribers,
    totalRevenue: totalRevenue.value,
    totalUnlocks: totalUnlocks.value
  }
})

const topPerformingContent = computed(() => {
  return [...contentItems.value]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
})

// Content management functions
const createContent = async (contentData) => {
  isLoading.value = true
  error.value = ''
  
  try {
    const newContent = {
      id: Date.now().toString(),
      ...contentData,
      unlocks: 0,
      revenue: 0,
      views: 0,
      subscribers: 0,
      status: CONTENT_STATUS.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    contentItems.value.unshift(newContent)
    
    // Reset form
    Object.assign(contentForm, {
      title: '',
      description: '',
      type: CONTENT_TYPES.ARTICLE,
      monetizationModel: MONETIZATION_MODELS.ONE_TIME,
      price: 1000,
      previewText: '',
      fullContent: '',
      tags: [],
      coverImage: ''
    })
    
    currentView.value = 'list'
    return newContent
  } catch (err) {
    error.value = 'Failed to create content: ' + err.message
    throw err
  } finally {
    isLoading.value = false
  }
}

const updateContent = async (id, updates) => {
  isLoading.value = true
  error.value = ''
  
  try {
    const index = contentItems.value.findIndex(item => item.id === id)
    if (index === -1) {
      throw new Error('Content not found')
    }
    
    contentItems.value[index] = {
      ...contentItems.value[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    return contentItems.value[index]
  } catch (err) {
    error.value = 'Failed to update content: ' + err.message
    throw err
  } finally {
    isLoading.value = false
  }
}

const deleteContent = async (id) => {
  isLoading.value = true
  error.value = ''
  
  try {
    const index = contentItems.value.findIndex(item => item.id === id)
    if (index === -1) {
      throw new Error('Content not found')
    }
    
    contentItems.value.splice(index, 1)
    return true
  } catch (err) {
    error.value = 'Failed to delete content: ' + err.message
    throw err
  } finally {
    isLoading.value = false
  }
}

const publishContent = async (id) => {
  return updateContent(id, { status: CONTENT_STATUS.PUBLISHED })
}

const unpublishContent = async (id) => {
  return updateContent(id, { status: CONTENT_STATUS.DRAFT })
}

const duplicateContent = async (id) => {
  const original = contentItems.value.find(item => item.id === id)
  if (!original) {
    throw new Error('Content not found')
  }
  
  const duplicate = {
    ...original,
    id: Date.now().toString(),
    title: original.title + ' (Copy)',
    status: CONTENT_STATUS.DRAFT,
    unlocks: 0,
    revenue: 0,
    views: 0,
    subscribers: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  contentItems.value.unshift(duplicate)
  return duplicate
}

// Content interaction functions
const purchaseContent = async (contentId, paymentHash) => {
  // Simulate content purchase
  const content = contentItems.value.find(item => item.id === contentId)
  if (content) {
    content.unlocks += 1
    content.revenue += content.price
    content.views += 1
  }
}

const subscribeToContent = async (contentId, subscriptionData) => {
  // Simulate subscription
  const content = contentItems.value.find(item => item.id === contentId)
  if (content) {
    content.subscribers += 1
    content.revenue += content.price
  }
}

// View management
const setView = (view) => {
  currentView.value = view
  error.value = ''
}

const editContent = (content) => {
  editingContent.value = content
  Object.assign(contentForm, content)
  currentView.value = 'edit'
}

const previewContent = (content) => {
  selectedContent.value = content
  currentView.value = 'preview'
}

// Utility functions
const formatPrice = (price) => {
  return price.toLocaleString() + ' sats'
}

const formatRevenue = (revenue) => {
  return revenue.toLocaleString() + ' sats'
}

const getContentTypeIcon = (type) => {
  const icons = {
    [CONTENT_TYPES.ARTICLE]: 'IconFileText',
    [CONTENT_TYPES.NEWSLETTER]: 'IconMail',
    [CONTENT_TYPES.PODCAST]: 'IconMicrophone',
    [CONTENT_TYPES.VIDEO]: 'IconVideo',
    [CONTENT_TYPES.IMAGE]: 'IconPhoto',
    [CONTENT_TYPES.DOCUMENT]: 'IconFile'
  }
  return icons[type] || 'IconFileText'
}

const getStatusColor = (status) => {
  const colors = {
    [CONTENT_STATUS.PUBLISHED]: 'text-green-600 bg-green-100',
    [CONTENT_STATUS.DRAFT]: 'text-yellow-600 bg-yellow-100',
    [CONTENT_STATUS.ARCHIVED]: 'text-gray-600 bg-gray-100'
  }
  return colors[status] || 'text-gray-600 bg-gray-100'
}

export function useContent() {
  return {
    // State
    contentItems,
    contentForm,
    currentView,
    editingContent,
    selectedContent,
    isLoading,
    error,
    
    // Computed
    totalRevenue,
    totalUnlocks,
    publishedItems,
    draftItems,
    revenueInUSD,
    contentStats,
    topPerformingContent,
    
    // Actions
    createContent,
    updateContent,
    deleteContent,
    publishContent,
    unpublishContent,
    duplicateContent,
    purchaseContent,
    subscribeToContent,
    
    // View management
    setView,
    editContent,
    previewContent,
    
    // Utilities
    formatPrice,
    formatRevenue,
    getContentTypeIcon,
    getStatusColor,
    
    // Constants
    CONTENT_TYPES,
    MONETIZATION_MODELS,
    CONTENT_STATUS
  }
}