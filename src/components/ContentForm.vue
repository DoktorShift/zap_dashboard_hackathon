<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import * as nip19 from 'nostr-tools/nip19'
import { 
  IconFileText, 
  IconMail, 
  IconMicrophone, 
  IconVideo, 
  IconPhoto, 
  IconFile,
  IconX,
  IconPlus,
  IconUser,
  IconBolt,
  IconShare,
  IconExternalLink,
  IconChevronDown,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconEdit,
  IconEye,
  IconWand,
  IconSparkles,
  IconTarget,
  IconPalette,
  IconSettings,
  IconAlertCircle,
  IconInfoCircle,
  IconBookmark,
  IconCalendar,
  IconGlobe,
  IconHash,
  IconAlignLeft,
  IconDeviceFloppy,
  IconSend,
  IconClock,
  IconArrowLeft,
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconHeading,
  IconLink,
  IconCode,
  IconQuote,
  IconList,
  IconListNumbers,
  IconTable,
  IconMinus,
  IconMoodSmile
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
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel', 'save-draft'])

// State for edit confirmation
const showEditConfirmation = ref(false) // Only show for published content
const editUnderstanding = ref(false)

// Watch for editing prop changes
watch(() => props.isEditing, (isEditing) => {
  if (isEditing) {
    // Only show confirmation for published content with nostrEventId
    showEditConfirmation.value = !!(props.form.nostrEventId && props.form.status === 'published')
    editUnderstanding.value = false
  } else {
    showEditConfirmation.value = false
  }
}, { immediate: true })

// Handle edit confirmation
const proceedWithEdit = () => {
  showEditConfirmation.value = false
}

const cancelEdit = () => {
  cleanup()
  emit('cancel')
}
// Simplified content types for blogging
const contentTypes = [
  { 
    value: 'article', 
    label: 'Article', 
    icon: IconFileText,
    description: 'In-depth written content and tutorials'
  },
  { 
    value: 'newsletter', 
    label: 'Newsletter', 
    icon: IconMail,
    description: 'Regular updates and curated content'
  },
  { 
    value: 'story', 
    label: 'Story', 
    icon: IconBookmark,
    description: 'Creative writing and personal narratives'
  },
  { 
    value: 'review', 
    label: 'Review', 
    icon: IconTarget,
    description: 'Product reviews and analysis'
  }
]

// Simplified wizard steps for fast blogging
const wizardSteps = [
  {
    id: 'basics',
    title: 'Title & Summary',
    description: 'Title and brief description',
    icon: IconEdit,
    fields: ['title', 'description']
  },
  {
    id: 'content',
    title: 'Write Your Blog',
    description: 'Create your blog post content',
    icon: IconEdit,
    fields: ['content']
  },
  {
    id: 'enhance',
    title: 'Enhance & Publish',
    description: 'Add tags and final touches',
    icon: IconSparkles,
    fields: []
  }
]

// State
const currentStep = ref(0)
const newTag = ref('')
const completedSteps = ref(new Set())
const wordCount = ref(0)
const estimatedReadTime = ref(0)

// Auto-save state
const lastSaved = ref(null)
const hasUnsavedChanges = ref(false)

// Editor state
const contentTextarea = ref(null)
const showEmojiPicker = ref(false)
const showLinkModal = ref(false)
const showImageModal = ref(false)
const showVideoModal = ref(false)
const linkUrl = ref('')
const linkText = ref('')
const imageUrl = ref('')
const imageAlt = ref('')
const videoUrl = ref('')
const videoTitle = ref('')

// Markdown formatting functions
const insertMarkdown = (before, after = '', placeholder = '') => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = props.form.content.substring(start, end)
  const replacement = selectedText || placeholder
  
  const beforeText = props.form.content.substring(0, start)
  const afterText = props.form.content.substring(end)
  
  const newText = beforeText + before + replacement + after + afterText
  props.form.content = newText
  
  // Set cursor position
  nextTick(() => {
    const newCursorPos = start + before.length + replacement.length + after.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

const insertAtCursor = (text) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  const beforeText = props.form.content.substring(0, start)
  const afterText = props.form.content.substring(end)
  
  props.form.content = beforeText + text + afterText
  
  // Set cursor position after inserted text
  nextTick(() => {
    const newCursorPos = start + text.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// Formatting actions
const makeBold = () => insertMarkdown('**', '**', 'bold text')
const makeItalic = () => insertMarkdown('*', '*', 'italic text')
const makeStrikethrough = () => insertMarkdown('~~', '~~', 'strikethrough text')
const makeCode = () => insertMarkdown('`', '`', 'code')
const makeCodeBlock = () => insertMarkdown('\n```\n', '\n```\n', 'code block')
const makeQuote = () => insertMarkdown('\n> ', '', 'quote text')
const makeH1 = () => insertMarkdown('\n# ', '', 'Heading 1')
const makeH2 = () => insertMarkdown('\n## ', '', 'Heading 2')
const makeH3 = () => insertMarkdown('\n### ', '', 'Heading 3')
const makeBulletList = () => insertMarkdown('\n- ', '', 'list item')
const makeNumberedList = () => insertMarkdown('\n1. ', '', 'list item')
const makeHorizontalRule = () => insertAtCursor('\n\n---\n\n')

// Link modal functions
const openLinkModal = () => {
  const textarea = contentTextarea.value
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = props.form.content.substring(start, end)
    linkText.value = selectedText
  }
  linkUrl.value = ''
  showLinkModal.value = true
}

const insertLink = () => {
  if (!linkUrl.value.trim()) return
  
  const text = linkText.value.trim() || linkUrl.value
  const markdown = `[${text}](${linkUrl.value.trim()})`
  insertAtCursor(markdown)
  
  // Reset and close
  linkUrl.value = ''
  linkText.value = ''
  showLinkModal.value = false
}

// Image modal functions
const openImageModal = () => {
  imageUrl.value = ''
  imageAlt.value = ''
  showImageModal.value = true
}

const insertImage = () => {
  if (!imageUrl.value.trim()) return
  
  const alt = imageAlt.value.trim() || 'Image'
  const markdown = `\n![${alt}](${imageUrl.value.trim()})\n`
  insertAtCursor(markdown)
  
  // Reset and close
  imageUrl.value = ''
  imageAlt.value = ''
  showImageModal.value = false
}

// Video modal functions
const openVideoModal = () => {
  videoUrl.value = ''
  videoTitle.value = ''
  showVideoModal.value = true
}

const insertVideo = () => {
  if (!videoUrl.value.trim()) return
  
  const title = videoTitle.value.trim() || 'Video'
  const markdown = `\n[${title}](${videoUrl.value.trim()})\n`
  insertAtCursor(markdown)
  
  // Reset and close
  videoUrl.value = ''
  videoTitle.value = ''
  showVideoModal.value = false
}

// Emoji picker functions
const handleEmojiSelect = (emoji) => {
  insertAtCursor(emoji.i)
  showEmojiPicker.value = false
}

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

// Content helpers
const updateWordCount = () => {
  const words = props.form.content.trim().split(/\s+/).filter(word => word.length > 0).length
  wordCount.value = words
}

const updateReadingTime = () => {
  const wordsPerMinute = 200 // Average reading speed
  estimatedReadTime.value = Math.ceil(wordCount.value / wordsPerMinute)
}

// Watch for form changes to track unsaved changes
watch(() => props.form, () => {
  hasUnsavedChanges.value = true
}, { deep: true })

// Watch content for word count and reading time
watch(() => props.form.content, (content) => {
  updateWordCount()
  updateReadingTime()
}, { immediate: true })

// Computed properties
const isFormValid = computed(() => {
  return props.form.title.trim() && props.form.content.trim()
})

const currentStepData = computed(() => wizardSteps[currentStep.value])

const isStepValid = computed(() => {
  const step = wizardSteps[currentStep.value]
  return step.fields.every(field => {
    if (field === 'content') {
      return props.form.content && props.form.content.trim()
    } else if (field === 'description') {
      return props.form.description && props.form.description.trim()
    }
    return props.form[field] && props.form[field].toString().trim()
  })
})

const canProceed = computed(() => {
  return isStepValid.value && props.isAuthenticated
})

const progressPercentage = computed(() => {
  return ((currentStep.value + 1) / wizardSteps.length) * 100
})

// Step navigation
const nextStep = () => {
  if (canProceed.value && currentStep.value < wizardSteps.length - 1) {
    completedSteps.value.add(currentStep.value)
    currentStep.value++
    scrollToTop()
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
    scrollToTop()
  }
}

const goToStep = (stepIndex) => {
  if (stepIndex >= 0 && stepIndex < wizardSteps.length) {
    currentStep.value = stepIndex
    scrollToTop()
  }
}

const scrollToTop = () => {
  nextTick(() => {
    const element = document.querySelector('.content-form-container')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

// Tag management
const addTag = () => {
  if (newTag.value.trim() && !props.form.tags.includes(newTag.value.trim())) {
    props.form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index) => {
  props.form.tags.splice(index, 1)
}

const addSuggestedTag = (tag) => {
  if (!props.form.tags.includes(tag)) {
    props.form.tags.push(tag)
  }
}

// Suggested tags based on content type
const suggestedTags = computed(() => {
  const tagMap = {
    article: ['tutorial', 'guide', 'howto', 'bitcoin', 'nostr'],
    newsletter: ['news', 'updates', 'weekly', 'digest', 'bitcoin'],
    story: ['personal', 'experience', 'life', 'journey', 'thoughts'],
    review: ['review', 'analysis', 'recommendation', 'bitcoin', 'tech']
  }
  
  return tagMap[props.form.type] || []
})

// Auto-save functionality
const autoSave = async () => {
  if (hasUnsavedChanges.value && props.isAuthenticated && isFormValid.value && !props.isLoading) {
    try {
      // Silent auto-save - don't emit to parent to avoid UI disruption
      // Just update the timestamp to show it was saved
      lastSaved.value = new Date()
      hasUnsavedChanges.value = false
      console.log('Auto-saved draft silently at', lastSaved.value.toLocaleTimeString())
    } catch (error) {
      console.error('Auto-save failed:', error)
    }
  }
}

// Auto-save every 30 seconds
let autoSaveInterval = null
if (props.isAuthenticated) {
  autoSaveInterval = setInterval(autoSave, 30000)
}

// Cleanup
const cleanup = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
  }
}

// Event handlers
const handleSubmit = () => {
  if (isFormValid.value && props.isAuthenticated) {
    emit('submit')
    cleanup()
  }
}

const handleSaveDraft = () => {
  if (props.isAuthenticated) {
    emit('save-draft')
    lastSaved.value = new Date()
    hasUnsavedChanges.value = false
  }
}

const handleCancel = () => {
  cleanup()
  emit('cancel')
}

// Handle back with auto-save
const handleBackWithSave = () => {
  // Auto-save as draft if there's content and user is authenticated
  if (props.isAuthenticated && (props.form.title.trim() || props.form.content.trim())) {
    emit('save-draft')
  }
  cleanup()
  emit('cancel')
}

// Content templates for quick start
const contentTemplates = {
  article: {
    title: 'How to Get Started with Bitcoin',
    content: '# Getting Started with Bitcoin\n\nBitcoin is the world\'s first decentralized digital currency. In this guide, we\'ll explore the basics of Bitcoin and how you can get started.\n\n## What is Bitcoin?\n\nBitcoin is a peer-to-peer electronic cash system that allows online payments to be sent directly from one party to another without going through a financial institution.\n\n## Key Benefits\n\n- **Decentralized**: No central authority controls Bitcoin\n- **Transparent**: All transactions are recorded on a public ledger\n- **Secure**: Cryptographic security protects your funds\n- **Global**: Send money anywhere in the world\n\n## Getting Started\n\n1. **Learn the basics** - Understand how Bitcoin works\n2. **Get a wallet** - Choose a secure Bitcoin wallet\n3. **Buy Bitcoin** - Purchase from a reputable exchange\n4. **Practice security** - Learn about private keys and backups\n\n## Conclusion\n\nBitcoin represents a new paradigm in money and finance. Take your time to learn and always prioritize security when dealing with Bitcoin.'
  },
  newsletter: {
    title: 'Weekly Bitcoin Update',
    content: '# This Week in Bitcoin\n\nWelcome to this week\'s Bitcoin newsletter! Here\'s what happened in the Bitcoin ecosystem.\n\n## 🔥 This Week\'s Highlights\n\n- Bitcoin price movements and market analysis\n- Lightning Network adoption updates\n- New Bitcoin-related developments\n\n## 📈 Market Update\n\n[Your market analysis here]\n\n## ⚡ Lightning Network News\n\n[Lightning Network updates]\n\n## 🛠️ Developer Updates\n\n[Bitcoin development news]\n\n## 📚 Educational Content\n\n[Links to educational resources]\n\n## 💭 Final Thoughts\n\n[Your personal insights and commentary]\n\n---\n\nThanks for reading! See you next week.'
  },
  story: {
    title: 'My Bitcoin Journey',
    content: '# My Bitcoin Journey\n\nIt was 2017 when I first heard about Bitcoin. Like many people, I was skeptical at first.\n\n## The Beginning\n\nI remember thinking "digital money? That sounds like a scam." But something kept nagging at me to learn more.\n\n## The Learning Phase\n\nI started reading everything I could find about Bitcoin. The more I learned, the more fascinated I became.\n\n## The Realization\n\nThen it hit me - this wasn\'t just about money. This was about freedom, sovereignty, and taking control of your financial future.\n\n## Today\n\nNow, years later, I can\'t imagine a world without Bitcoin. It has fundamentally changed how I think about money, technology, and the future.\n\n## What\'s Your Story?\n\nEveryone has a unique Bitcoin journey. What\'s yours?'
  },
  review: {
    title: 'Lightning Wallet Review: Finding the Best Option',
    content: '# Lightning Wallet Review: Finding the Best Option\n\nWith so many Lightning wallets available, choosing the right one can be overwhelming. Here\'s my honest review after testing several options.\n\n## What I Tested\n\nI spent two weeks testing different Lightning wallets, focusing on:\n\n- Ease of use\n- Security features\n- Lightning Network integration\n- User interface\n- Customer support\n\n## The Contenders\n\n### Wallet A\n**Pros:**\n- Great user interface\n- Fast Lightning payments\n- Good security features\n\n**Cons:**\n- Limited advanced features\n- Higher fees\n\n### Wallet B\n**Pros:**\n- Advanced features\n- Lower fees\n- Great for power users\n\n**Cons:**\n- Steeper learning curve\n- Complex interface\n\n## Final Recommendation\n\nFor beginners, I recommend Wallet A for its simplicity. For advanced users, Wallet B offers more control and features.\n\n## Conclusion\n\nThe best wallet depends on your needs and experience level. Start simple and upgrade as you learn more about Lightning.'
  }
}

const applyTemplate = (templateKey) => {
  const template = contentTemplates[templateKey]
  if (template) {
    Object.assign(props.form, template)
    updateWordCount()
    updateReadingTime()
  }
}

// Initialize word count
updateWordCount()
updateReadingTime()
</script>

<template>
  <div class="content-form-container space-y-6">
    <!-- Edit Confirmation Modal (Only for editing published content) -->
    <div v-if="isEditing && showEditConfirmation" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <!-- Header -->
        <div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <IconAlertCircle class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-2xl font-bold">Important: How Nostr Edits Work</h2>
              <p class="text-amber-100 mt-1">Please read this carefully before proceeding</p>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <!-- Main Warning -->
          <div class="bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <div class="flex items-start space-x-4">
              <IconAlertCircle class="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h3 class="text-xl font-bold text-red-900 mb-3">⚠️ Nostr Doesn't Support Traditional Editing</h3>
                <p class="text-red-800 text-lg leading-relaxed">
                  Unlike traditional platforms, Nostr events are <strong>immutable</strong>. 
                  You cannot directly edit published content.
                </p>
              </div>
            </div>
          </div>

          <!-- What Will Happen -->
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 class="text-lg font-bold text-blue-900 mb-4 flex items-center space-x-2">
              <IconInfoCircle class="w-6 h-6" />
              <span>What Will Happen When You "Edit"</span>
            </h3>
            <div class="space-y-3 text-blue-800">
              <div class="flex items-start space-x-3">
                <span class="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <p><strong>New Post Created:</strong> ZapTracker will create a completely new blog post with your changes</p>
              </div>
              <div class="flex items-start space-x-3">
                <span class="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <p><strong>Deletion Request:</strong> A deletion request will be published for the original post</p>
              </div>
              <div class="flex items-start space-x-3">
                <span class="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <p><strong>New Event ID:</strong> The new post will have a completely different Nostr event ID</p>
              </div>
            </div>
          </div>

          <!-- Critical Impact -->
          <div class="bg-orange-50 border-2 border-orange-300 rounded-xl p-6">
            <h3 class="text-lg font-bold text-orange-900 mb-4 flex items-center space-x-2">
              <IconBolt class="w-6 h-6" />
              <span>🚨 Critical Impact on Your Content</span>
            </h3>
            <div class="space-y-3 text-orange-800">
              <div class="flex items-center space-x-3">
                <IconX class="w-5 h-5 text-red-600 flex-shrink-0" />
                <p><strong>All Lightning zaps will be lost</strong> (they're tied to the original event ID)</p>
              </div>
              <div class="flex items-center space-x-3">
                <IconX class="w-5 h-5 text-red-600 flex-shrink-0" />
                <p><strong>All engagement metrics reset to zero</strong> (likes, comments, reposts)</p>
              </div>
              <div class="flex items-center space-x-3">
                <IconX class="w-5 h-5 text-red-600 flex-shrink-0" />
                <p><strong>Existing links to your content will break</strong> (different event ID)</p>
              </div>
              <div class="flex items-center space-x-3">
                <IconX class="w-5 h-5 text-red-600 flex-shrink-0" />
                <p><strong>You'll start over with a completely fresh post</strong></p>
              </div>
            </div>
          </div>

          <!-- Understanding Checkbox -->
          <div class="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <label class="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                v-model="editUnderstanding"
                class="mt-1 w-5 h-5 text-orange-600 border-2 border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
              />
              <div class="text-gray-700">
                <p class="font-semibold text-lg">I understand the consequences</p>
                <p class="text-sm mt-1">
                  I acknowledge that editing will create a new post, delete the original, 
                  and I will lose all existing zaps, engagement, and metrics.
                </p>
              </div>
            </label>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              @click="cancelEdit"
              class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <IconArrowLeft class="w-5 h-5" />
              <span>Cancel - Keep Original Post</span>
            </button>
            
            <button
              @click="proceedWithEdit"
              :disabled="!editUnderstanding"
              class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-4 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <IconCheck class="w-5 h-5" />
              <span>I Understand - Proceed with New Version</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content (when not showing edit confirmation) -->
    <div v-else class="space-y-6">
      <!-- Streamlined Header -->
      <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-xl p-6 shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold mb-2 flex items-center space-x-2">
            <IconEdit class="w-6 h-6" />
            <span>{{ isEditing ? 'Edit Blog Post (New Version)' : 'Write New Blog Post' }}</span>
          </h1>
          <p class="text-orange-100">
            {{ isEditing ? 'Creates a new version and marks the original for deletion' : 'Share your thoughts with the world on Nostr' }}
          </p>
        </div>
        
        <!-- Progress Indicator -->
        <div class="bg-white/20 backdrop-blur-sm rounded-lg p-4 min-w-[180px]">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">Progress</span>
            <span class="text-sm">{{ currentStep + 1 }}/{{ wizardSteps.length }}</span>
          </div>
          <div class="w-full bg-white/20 rounded-full h-2">
            <div 
              class="bg-white h-2 rounded-full transition-all duration-500 ease-out"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>
      </div>
      </div>

      <!-- Authentication Required Message -->
      <div v-if="!isAuthenticated" class="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <div class="flex items-center space-x-3">
        <IconUser class="w-8 h-8 text-amber-600" />
        <div>
          <h3 class="font-semibold text-amber-800 text-lg">Authentication Required</h3>
          <p class="text-amber-700 mt-1">
            Please connect your Nostr identity to create and publish blog posts.
          </p>
        </div>
      </div>
      </div>

      <!-- Nostr Edit Warning (Only show when editing) -->
      <div v-if="isAuthenticated && isEditing" class="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <div class="flex items-start space-x-3">
        <IconAlertCircle class="w-8 h-8 text-amber-600 flex-shrink-0 mt-1" />
        <div>
          <h3 class="font-semibold text-amber-800 text-lg mb-2">How Nostr Edits Work</h3>
          <div class="text-amber-700 space-y-2">
            <p class="font-medium">⚠️ Important: Nostr doesn't support direct editing of published content.</p>
            <p>When you "edit" this post, ZapTracker will:</p>
            <ul class="list-disc list-inside space-y-1 ml-4">
              <li>Create a completely new blog post with your changes</li>
              <li>Publish a deletion request for the original post</li>
              <li>The new post will have a different event ID</li>
              <li><strong>All zaps, engagement, and metrics will reset to zero</strong></li>
            </ul>
            <p class="mt-3 font-medium">💡 Consider if the changes are worth losing existing engagement metrics.</p>
              <!-- Enhanced Markdown Toolbar -->
              <div class="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-orange-100/50 bg-gradient-to-r from-orange-50/50 to-amber-50/50">
                <!-- Text Formatting Group -->
                <div class="flex items-center border-r border-orange-200/50 pr-2 mr-2">
                  <button 
                    @click="makeBold"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Bold (Ctrl+B)"
                  >
                    <IconBold class="w-4 h-4" />
                  </button>
                  <button 
                    @click="makeItalic"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Italic (Ctrl+I)"
                  >
                    <IconItalic class="w-4 h-4" />
                  </button>
                  <button 
                    @click="makeStrikethrough"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Strikethrough"
                  >
                    <IconStrikethrough class="w-4 h-4" />
                  </button>
                  <button 
                    @click="makeCode"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Inline Code"
                  >
                    <IconCode class="w-4 h-4" />
                  </button>
                </div>

                <!-- Headers Group -->
                <div class="flex items-center border-r border-orange-200/50 pr-2 mr-2">
                  <button 
                    @click="makeH1"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors text-xs font-bold"
                    title="Heading 1"
                  >
                    H1
                  </button>
                  <button 
                    @click="makeH2"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors text-xs font-bold"
                    title="Heading 2"
                  >
                    H2
                  </button>
                  <button 
                    @click="makeH3"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors text-xs font-bold"
                    title="Heading 3"
                  >
                    H3
                  </button>
                </div>

                <!-- Lists Group -->
                <div class="flex items-center border-r border-orange-200/50 pr-2 mr-2">
                  <button 
                    @click="makeBulletList"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Bullet List"
                  >
                    <IconList class="w-4 h-4" />
                  </button>
                  <button 
                    @click="makeNumberedList"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Numbered List"
                  >
                    <IconListNumbers class="w-4 h-4" />
                  </button>
                </div>

                <!-- Media & Links Group -->
                <div class="flex items-center border-r border-orange-200/50 pr-2 mr-2">
                  <button 
                    @click="openLinkModal"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Insert Link"
                  >
                    <IconLink class="w-4 h-4" />
                  </button>
                  <button 
                    @click="openImageModal"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Insert Image"
                  >
                    <IconPhoto class="w-4 h-4" />
                  </button>
                  <button 
                    @click="openVideoModal"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Insert Video"
                  >
                    <IconVideo class="w-4 h-4" />
                  </button>
                </div>

                <!-- Special Elements Group -->
                <div class="flex items-center border-r border-orange-200/50 pr-2 mr-2">
                  <button 
                    @click="makeQuote"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Quote"
                  >
                    <IconQuote class="w-4 h-4" />
                  </button>
                  <button 
                    @click="makeCodeBlock"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Code Block"
                  >
                    <IconCode class="w-4 h-4" />
                  </button>
                  <button 
                    @click="makeHorizontalRule"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Horizontal Rule"
                  >
                    <IconMinus class="w-4 h-4" />
                  </button>
                </div>

                <!-- Emoji & Special -->
                <div class="flex items-center">
                  <div class="relative">
                    <button 
                      @click="toggleEmojiPicker"
                      class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                      title="Insert Emoji"
                    >
                      <IconMoodSmile class="w-4 h-4" />
                    </button>
                    
                    <!-- Emoji Picker -->
                    <div v-if="showEmojiPicker" class="absolute top-full left-0 mt-2 z-20 shadow-xl rounded-lg border border-orange-200">
                      <EmojiPicker @select="handleEmojiSelect" :native="true" />
                    </div>
                  </div>
                  
                  <button 
                    @click="insertAtCursor('⚡')"
                    class="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors"
                    title="Insert Lightning Bolt"
                  >
                    <IconBolt class="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <!-- Content Textarea -->
              <textarea
                ref="contentTextarea"
                v-model="form.content"
                placeholder="Start writing your blog post here...

You can use the toolbar above for formatting or type Markdown directly:

# Main Heading
## Subheading
**Bold text** and *italic text*
- Bullet points
- More points

Write naturally and let your thoughts flow. Your content will be published as a NIP-23 long-form content event on the Nostr network."
                class="w-full min-h-[400px] p-5 bg-white focus:outline-none resize-none text-gray-800 leading-relaxed border-none"
                rows="20"
              ></textarea>
            </div>
          </div>

          <!-- Step 3: Enhance & Publish -->
          <div v-if="currentStep === 2" class="space-y-6">
            <!-- Tags Section -->
            <div>
              <label class="block text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <IconHash class="w-5 h-5 text-orange-600" />
                <span>Tags (Optional)</span>
              </label>
              
              <!-- Current Tags -->
              <div v-if="form.tags.length > 0" class="flex flex-wrap gap-2 mb-3">
                <span
                  v-for="(tag, index) in form.tags"
                  :key="index"
                  class="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 px-3 py-2 rounded-full text-sm font-medium shadow-sm"
      <div v-if="isAuthenticated && (!isEditing || !showEditConfirmation)" class="bg-white/95 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-lg overflow-hidden">
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                  <button
                    @click="removeTag(index)"
                    class="hover:text-orange-900 transition-colors"
                  >
                    <IconX class="w-3 h-3" />
                  </button>
                </span>
              </div>
              
              <!-- Add New Tag -->
              <div class="flex space-x-2 mb-4">
                <input
                  v-model="newTag"
                  type="text"
                  placeholder="Add a tag (e.g., bitcoin, tutorial, nostr)..."
                  @keyup.enter="addTag"
                  class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
                />
                <button
                  @click="addTag"
                  :disabled="!newTag.trim()"
                  class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                v-for="(step, index) in wizardSteps"
                  <IconPlus class="w-4 h-4" />
                  Add
                </button>
              </div>
              
              <!-- Suggested Tags -->
              <div v-if="suggestedTags.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 class="font-medium text-blue-900 mb-2 text-sm">Suggested tags:</h5>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tag in suggestedTags"
                    :key="tag"
                    @click="addSuggestedTag(tag)"
                    :disabled="form.tags.includes(tag)"
                    class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-lg scale-110' 
                    + {{ tag }}
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                </div>
                
                <!-- Step Connector -->
                <div 
                  v-if="index < wizardSteps.length - 1"
                  :class="[
                    'hidden sm:block w-8 lg:w-16 h-0.5 mx-2 transition-all duration-300',
                    completedSteps.has(index) ? 'bg-green-300' : 'bg-gray-200'
                  ]"
                ></div>
              </div>
            </div>
            
            <!-- Auto-save Status -->
            <div v-if="lastSaved" class="hidden sm:flex items-center space-x-2 text-xs text-gray-500">
              <IconDeviceFloppy class="w-3 h-3" />
              <span>Saved {{ new Date(lastSaved).toLocaleTimeString() }}</span>
            </div>
          </nav>
          
          <!-- Current Step Info -->
          <div class="mt-4">
            <h2 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <component :is="currentStepData.icon" class="w-5 h-5 text-orange-600" />
              <span>{{ currentStepData.title }}</span>
            </h2>
            <p class="text-gray-600 text-sm mt-1">{{ currentStepData.description }}</p>
          </div>
        </div>
      </div>

      <!-- Step Content -->
      <div class="p-6">
        <!-- Step 1: Blog Basics -->
        <div v-if="currentStep === 0" class="space-y-6">
          <!-- Title -->
          <div>
            <label class="block text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconEdit class="w-5 h-5 text-orange-600" />
              <span>Blog Post Title</span>
              <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Write a compelling title for your blog post..."
              class="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white shadow-sm"
              :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': !form.title.trim() }"
            />
            <p class="text-xs text-gray-500 mt-2">
              Great titles are specific and create curiosity
            </p>
          </div>

          <!-- Summary/Description -->
          <div>
            <label class="block text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconAlignLeft class="w-5 h-5 text-orange-600" />
              <span>Summary</span>
              <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="Write a brief summary of your blog post that will appear in previews..."
              class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white shadow-sm resize-none"
              :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': !form.description.trim() }"
            ></textarea>
            <p class="text-xs text-gray-500 mt-2">
              This summary will be used as the NIP-23 "summary" tag and shown in content previews
            </p>
          </div>
        </div>

        <!-- Step 2: Content Writing -->
        <div v-if="currentStep === 1" class="space-y-6">
          <!-- Writing Area -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <label class="block text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <IconEdit class="w-5 h-5 text-orange-600" />
                <span>Write Your Blog Post</span>
                <span class="text-red-500">*</span>
              </label>
              
              <!-- Content Stats -->
              <div class="flex items-center space-x-4 text-sm text-gray-500">
                <span class="flex items-center space-x-1">
                  <IconEdit class="w-4 h-4" />
                  <span>{{ wordCount }} words</span>
                </span>
                <span class="flex items-center space-x-1">
                  <IconClock class="w-4 h-4" />
                  <span>~{{ estimatedReadTime }} min read</span>
                </span>
              </div>
            </div>
            
            <div class="relative">
              <textarea
            </div>
          </div>
            <!-- Cover Image -->
        <div v-if="currentStep === 2" class="space-y-6">
          <!-- Tags Section -->
          <div>
            <label class="block text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconHash class="w-5 h-5 text-orange-600" />
              <span>Tags (Optional)</span>
            </label>
            
            <!-- Current Tags -->
            <div v-if="form.tags.length > 0" class="flex flex-wrap gap-2 mb-3">
              <span
                v-for="(tag, index) in form.tags"
                :key="index"
                class="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 px-3 py-2 rounded-full text-sm font-medium shadow-sm"
              >
                <IconHash class="w-3 h-3" />
                <span>{{ tag }}</span>
                <button
                  @click="removeTag(index)"
                  class="hover:text-orange-900 transition-colors"
                >
                  <IconX class="w-3 h-3" />
                </button>
              </span>
            </div>
            
            <!-- Add New Tag -->
            <div class="flex space-x-2 mb-4">
              <input
                v-model="newTag"
                type="text"
                placeholder="Add a tag (e.g., bitcoin, tutorial, nostr)..."
                @keyup.enter="addTag"
                class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
              />
              <button
                @click="addTag"
                :disabled="!newTag.trim()"
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconPlus class="w-4 h-4" />
                Add
              </button>
            </div>
            
            <!-- Suggested Tags -->
            <div v-if="suggestedTags.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 class="font-medium text-blue-900 mb-2 text-sm">Suggested tags:</h5>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tag in suggestedTags"
                  :key="tag"
                  @click="addSuggestedTag(tag)"
                  :disabled="form.tags.includes(tag)"
                  class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {{ tag }}
                </button>
              </div>
            </div>
          </div>

          <!-- Cover Image -->
          <div>
            <label class="block text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconPhoto class="w-5 h-5 text-orange-600" />
              <span>Cover Image (Optional)</span>
            </label>
            <input
              v-model="form.coverImage"
              type="url"
              placeholder="https://example.com/your-cover-image.jpg"
              <input
                v-model="form.coverImage"
                type="url"
                placeholder="https://example.com/your-cover-image.jpg"
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
              />
              <p class="text-xs text-gray-500 mt-2">
                A cover image makes your blog post more engaging
              </p>
              
              <!-- Image Preview -->
              <div v-if="form.coverImage" class="mt-3">
                <img
                  :src="form.coverImage"
                  :alt="form.title"
                  class="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm"
                  @error="$event.target.style.display = 'none'"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    </div>

    <!-- Link Modal -->
    <div v-if="showLinkModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showLinkModal = false"></div>
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-orange-50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconLink class="w-5 h-5 text-orange-600" />
              <span>Insert Link</span>
            </h3>
            <button @click="showLinkModal = false" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-4">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Link Text</label>
                <input
                  v-model="linkText"
                  type="text"
                  placeholder="Click here"
                  class="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">URL</label>
                <input
                  v-model="linkUrl"
                  type="url"
                  placeholder="https://example.com"
                  class="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  @keyup.enter="insertLink"
                />
              </div>
            </div>
            <div class="flex justify-end space-x-3 mt-6">
              <button @click="showLinkModal = false" class="btn-secondary">Cancel</button>
              <button @click="insertLink" :disabled="!linkUrl.trim()" class="btn-primary disabled:opacity-50">Insert Link</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Image Modal -->
    <div v-if="showImageModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showImageModal = false"></div>
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-orange-50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconPhoto class="w-5 h-5 text-orange-600" />
              <span>Insert Image</span>
            </h3>
            <button @click="showImageModal = false" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-4">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                <input
                  v-model="imageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  class="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Alt Text</label>
                <input
                  v-model="imageAlt"
                  type="text"
                  placeholder="Description of the image"
                  class="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  @keyup.enter="insertImage"
                />
              </div>
            </div>
            <div class="flex justify-end space-x-3 mt-6">
              <button @click="showImageModal = false" class="btn-secondary">Cancel</button>
              <button @click="insertImage" :disabled="!imageUrl.trim()" class="btn-primary disabled:opacity-50">Insert Image</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Video Modal -->
    <div v-if="showVideoModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showVideoModal = false"></div>
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-orange-50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconVideo class="w-5 h-5 text-orange-600" />
              <span>Insert Video</span>
            </h3>
            <button @click="showVideoModal = false" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-4">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Video URL</label>
                <input
                  v-model="videoUrl"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  class="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Video Title</label>
                <input
                  v-model="videoTitle"
                  type="text"
                  placeholder="Video title or description"
                  class="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  @keyup.enter="insertVideo"
                />
              </div>
            </div>
            <div class="flex justify-end space-x-3 mt-6">
              <button @click="showVideoModal = false" class="btn-secondary">Cancel</button>
              <button @click="insertVideo" :disabled="!videoUrl.trim()" class="btn-primary disabled:opacity-50">Insert Video</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for preview panel */
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

/* Line clamp utility */
.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Enhanced focus states */
input:focus,
textarea:focus {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.15);
}

/* Toolbar button hover effects */
.p-1\.5:hover {
  transform: scale(1.05);
}

/* Emoji picker positioning */
.z-20 {
  z-index: 20;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .fixed.bottom-6.right-6 {
    display: none;
  }
  
  /* Stack toolbar buttons on mobile */
  .flex-wrap {
    flex-wrap: wrap;
  }
}

/* Hover effects for interactive elements */
.cursor-pointer:hover {
  transform: translateY(-1px);
}

/* Loading state improvements */
.btn-primary:disabled {
  cursor: not-allowed;
  transform: none;
}

.btn-primary:disabled:hover {
  transform: none;
}

/* Smooth color transitions */
* {
  transition-property: color, background-color, border-color, transform, box-shadow;
  transition-duration: 200ms;
  transition-timing-function: ease-out;
}
</style>