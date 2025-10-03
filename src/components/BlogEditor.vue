<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import {
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
  IconX,
  IconLoader,
  IconAlertCircle,
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconLink,
  IconPhoto,
  IconVideo,
  IconQuote,
  IconMinus,
  IconBolt,
  IconHash,
  IconCheck,
  IconPlus,
  IconColumns,
  IconMaximize,
  IconEdit,
  IconArrowLeft,
  IconSettings,
  IconAt,
  IconUser
} from '@iconify-prerendered/vue-tabler'
import { useMentions } from '../composables/useMentions.js'
import MentionInput from './MentionInput.vue'
import MentionRenderer from './MentionRenderer.vue'

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

const emit = defineEmits(['submit', 'save-draft', 'cancel'])

// Use mentions composable
const { parseMentions, extractPTags } = useMentions()

// Editor state
const viewMode = ref('both') // 'edit', 'preview', 'both'
const focusMode = ref(false)
const showToolbar = ref(true)
const showMetadata = ref(true)
const useMentionInput = ref(true) // Toggle for mention support

// Refs for editor functionality
const contentTextarea = ref(null)
const previewContainer = ref(null)
const editorContainer = ref(null)
const emojiButton = ref(null)
const showEmojiPicker = ref(false)
const showLinkModal = ref(false)
const showImageModal = ref(false)
const showVideoModal = ref(false)

// Modal form data
const linkForm = ref({ url: '', text: '' })
const imageForm = ref({ url: '', alt: '' })
const videoForm = ref({ url: '', title: '' })

// Form validation
const isFormValid = computed(() => {
  return props.form.title?.trim() && props.form.content?.trim()
})

// Mention count
const mentionCount = computed(() => {
  return parseMentions(props.form.content || '').length
})

// Handle mention added
const handleMentionAdded = (user) => {
  console.log('Mention added to long-form content:', user)
}

// Handle mention click in preview
const handleMentionClick = ({ pubkey, profile }) => {
  console.log('Mention clicked:', pubkey, profile)
}

// Add tag functionality
const newTag = ref('')
const addTag = () => {
  if (newTag.value.trim() && !props.form.tags.includes(newTag.value.trim())) {
    props.form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index) => {
  props.form.tags.splice(index, 1)
}

// View mode controls
const setViewMode = (mode) => {
  viewMode.value = mode
  
  // Auto-focus editor when switching to edit mode
  if (mode === 'edit' || mode === 'both') {
    nextTick(() => {
      if (contentTextarea.value) {
        contentTextarea.value.focus()
      }
    })
  }
}

const toggleFocusMode = () => {
  focusMode.value = !focusMode.value
  showToolbar.value = !focusMode.value
  
  if (focusMode.value) {
    viewMode.value = 'edit'
  }
}

// Toolbar functionality
const insertAtCursor = (before, after = '', placeholder = '') => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = props.form.content.substring(start, end)
  
  let insertText
  if (selectedText) {
    insertText = before + selectedText + after
  } else {
    insertText = before + placeholder + after
  }
  
  const newContent = props.form.content.substring(0, start) + insertText + props.form.content.substring(end)
  props.form.content = newContent
  
  // Set cursor position
  nextTick(() => {
    const newCursorPos = selectedText ? start + insertText.length : start + before.length + placeholder.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

const insertAtNewLine = (text) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const beforeCursor = props.form.content.substring(0, start)
  const afterCursor = props.form.content.substring(start)
  
  // Add newlines if needed
  const needsNewlineBefore = beforeCursor && !beforeCursor.endsWith('\n')
  const needsNewlineAfter = afterCursor && !afterCursor.startsWith('\n')
  
  const insertText = (needsNewlineBefore ? '\n' : '') + text + (needsNewlineAfter ? '\n' : '')
  
  props.form.content = beforeCursor + insertText + afterCursor
  
  nextTick(() => {
    const newCursorPos = start + insertText.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// Formatting functions
const makeBold = () => insertAtCursor('**', '**', 'bold text')
const makeItalic = () => insertAtCursor('*', '*', 'italic text')
const makeStrikethrough = () => insertAtCursor('~~', '~~', 'strikethrough text')
const makeInlineCode = () => insertAtCursor('`', '`', 'code')

// Enhanced formatting functions with proper toggle behavior
const toggleInlineFormat = (marker, placeholder) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = props.form.content.substring(start, end)
  
  if (!selectedText) {
    // No selection - insert placeholder with markers
    insertAtCursor(marker, marker, placeholder)
    return
  }
  
  // Check if selected text is already formatted
  const beforeSelection = props.form.content.substring(Math.max(0, start - marker.length), start)
  const afterSelection = props.form.content.substring(end, end + marker.length)
  
  const isAlreadyFormatted = beforeSelection === marker && afterSelection === marker
  
  if (isAlreadyFormatted) {
    // Remove formatting (toggle off)
    const newStart = start - marker.length
    const newEnd = end + marker.length
    const newContent = props.form.content.substring(0, newStart) + 
                      selectedText + 
                      props.form.content.substring(newEnd)
    
    props.form.content = newContent
    
    nextTick(() => {
      textarea.focus()
      textarea.setSelectionRange(newStart, newStart + selectedText.length)
    })
  } else {
    // Add formatting (toggle on)
    const newContent = props.form.content.substring(0, start) + 
                      marker + selectedText + marker + 
                      props.form.content.substring(end)
    
    props.form.content = newContent
    
    nextTick(() => {
      textarea.focus()
      textarea.setSelectionRange(start + marker.length, start + marker.length + selectedText.length)
    })
  }
}

const toggleBlockFormat = (prefix, placeholder) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  if (start === end) {
    // No selection - insert at new line
    insertAtNewLine(`${prefix} ${placeholder}`)
    return
  }
  
  // Get selected text and split into lines
  const selectedText = props.form.content.substring(start, end)
  const lines = selectedText.split('\n')
  
  // Check if all lines are already formatted
  const allFormatted = lines.every(line => line.trim().startsWith(prefix + ' '))
  
  let newLines
  if (allFormatted) {
    // Remove formatting from all lines (toggle off)
    newLines = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed.startsWith(prefix + ' ')) {
        const withoutPrefix = trimmed.substring(prefix.length + 1)
        // Preserve original indentation
        const leadingSpaces = line.match(/^(\s*)/)[1]
        return leadingSpaces + withoutPrefix
      }
      return line
    })
  } else {
    // Add formatting to all lines (toggle on)
    newLines = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith(prefix + ' ')) {
        // Preserve original indentation
        const leadingSpaces = line.match(/^(\s*)/)[1]
        return leadingSpaces + prefix + ' ' + trimmed
      }
      return line
    })
  }
  
  const newSelectedText = newLines.join('\n')
  const newContent = props.form.content.substring(0, start) + 
                    newSelectedText + 
                    props.form.content.substring(end)
  
  props.form.content = newContent
  
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start, start + newSelectedText.length)
  })
}

// Updated formatting functions with toggle behavior
const makeBoldToggle = () => toggleInlineFormat('**', 'bold text')
const makeItalicToggle = () => toggleInlineFormat('*', 'italic text')
const makeStrikethroughToggle = () => toggleInlineFormat('~~', 'strikethrough text')
const makeInlineCodeToggle = () => toggleInlineFormat('`', 'code')

const insertHeaderToggle = (level) => {
  const prefix = '#'.repeat(level)
  toggleBlockFormat(prefix, `Heading ${level}`)
}

const insertBulletListToggle = () => toggleBlockFormat('-', 'List item')
const insertNumberedListToggle = () => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  if (start === end) {
    // No selection - insert at new line
    insertAtNewLine('1. List item')
    return
  }
  
  // Get selected text and split into lines
  const selectedText = props.form.content.substring(start, end)
  const lines = selectedText.split('\n')
  
  // Check if all lines are already formatted as numbered list
  const allFormatted = lines.every(line => /^\s*\d+\.\s/.test(line.trim()))
  
  let newLines
  if (allFormatted) {
    // Remove numbering from all lines (toggle off)
    newLines = lines.map(line => {
      const leadingSpaces = line.match(/^(\s*)/)[1]
      const withoutNumber = line.replace(/^\s*\d+\.\s/, '')
      return leadingSpaces + withoutNumber
    })
  } else {
    // Add numbering to all lines (toggle on)
    let counter = 1
    newLines = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed && !/^\d+\.\s/.test(trimmed)) {
        const leadingSpaces = line.match(/^(\s*)/)[1]
        return leadingSpaces + `${counter++}. ` + trimmed
      }
      return line
    })
  }
  
  const newSelectedText = newLines.join('\n')
  const newContent = props.form.content.substring(0, start) + 
                    newSelectedText + 
                    props.form.content.substring(end)
  
  props.form.content = newContent
  
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start, start + newSelectedText.length)
  })
}

const insertQuoteToggle = () => toggleBlockFormat('>', 'Quote text')

const insertHeader = (level) => {
  const hashes = '#'.repeat(level)
  insertAtNewLine(`${hashes} Heading ${level}`)
}

const insertBulletList = () => insertAtNewLine('- List item')
const insertNumberedList = () => insertAtNewLine('1. List item')
const insertQuote = () => insertAtNewLine('> Quote text')
const insertCodeBlock = () => insertAtNewLine('```\ncode block\n```')
const insertHorizontalRule = () => insertAtNewLine('---')
const insertLightningBolt = () => insertAtCursor('⚡', '', '')

// Modal handlers
const openLinkModal = () => {
  linkForm.value = { url: '', text: '' }
  showLinkModal.value = true
}

const insertLink = () => {
  if (linkForm.value.url.trim()) {
    const linkText = linkForm.value.text.trim() || linkForm.value.url
    insertAtCursor(`[${linkText}](${linkForm.value.url})`)
    showLinkModal.value = false
  }
}

const openImageModal = () => {
  imageForm.value = { url: '', alt: '' }
  showImageModal.value = true
}

const insertImage = () => {
  if (imageForm.value.url.trim()) {
    const altText = imageForm.value.alt.trim() || 'Image'
    insertAtNewLine(`![${altText}](${imageForm.value.url})`)
    showImageModal.value = false
  }
}

const openVideoModal = () => {
  videoForm.value = { url: '', title: '' }
  showVideoModal.value = true
}

const insertVideo = () => {
  if (videoForm.value.url.trim()) {
    const title = videoForm.value.title.trim() || 'Video'
    insertAtNewLine(`[${title}](${videoForm.value.url})`)
    showVideoModal.value = false
  }
}

// Emoji picker
const handleEmojiSelect = (emoji) => {
  const textarea = contentTextarea.value
  
  if (textarea) {
    const cursorPos = textarea.selectionStart
    const textBefore = props.form.content.substring(0, cursorPos)
    const textAfter = props.form.content.substring(textarea.selectionEnd)
    
    // Update content with emoji
    props.form.content = textBefore + emoji.i + textAfter
    
    // Reset emoji picker state
    showEmojiPicker.value = false
    
    // Focus back on textarea and set cursor position after the emoji
    nextTick(() => {
      textarea.focus()
      const newCursorPos = cursorPos + emoji.i.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
  }
}

// Keyboard shortcuts
const handleKeydown = (event) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'b':
        event.preventDefault()
        makeBoldToggle()
        break
      case 'i':
        event.preventDefault()
        makeItalicToggle()
        break
      case 'Enter':
        if (event.shiftKey) {
          event.preventDefault()
          emit('save-draft')
        }
        break
    }
  }
  
  // Toggle focus mode with F11
  if (event.key === 'F11') {
    event.preventDefault()
    toggleFocusMode()
  }
  
  // Toggle preview with Ctrl/Cmd + P
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault()
    setViewMode(viewMode.value === 'both' ? 'edit' : 'both')
  }
}

// Parse markdown content to HTML for preview
const parseMarkdown = (content) => {
  if (!content) return ''
  
  let html = content
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Parse markdown syntax
  html = html
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4 leading-tight">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-6 leading-tight">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-12 mb-8 leading-tight">$1</h1>')
    
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold"><em class="italic">$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors">$1</a>')
    
    // Code blocks (triple backticks)
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 border border-gray-200 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm font-mono text-gray-800">$1</code></pre>')
    
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono">$1</code>')
    
    // Unordered lists
    .replace(/^[\s]*[-*+] (.+)$/gm, '<li class="ml-4 mb-2 text-gray-700">$1</li>')
    
    // Ordered lists
    .replace(/^[\s]*\d+\. (.+)$/gm, '<li class="ml-4 mb-2 text-gray-700">$1</li>')
    
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-orange-400 pl-4 py-2 my-4 bg-orange-50/50 italic text-gray-700">$1</blockquote>')
    
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="border-t border-gray-300 my-8">')
    
    // Line breaks (convert double newlines to paragraphs)
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 leading-relaxed">')
    
    // Single line breaks
    .replace(/\n/g, '<br>')
  
  // Wrap in paragraph tags if not already wrapped
  if (!html.includes('<p>') && !html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>')) {
    html = `<p class="mb-4 text-gray-700 leading-relaxed">${html}</p>`
  } else if (html.includes('</p><p>')) {
    html = `<p class="mb-4 text-gray-700 leading-relaxed">${html}</p>`
  }
  
  // Wrap lists in proper ul/ol tags
  html = html.replace(/(<li class="ml-4 mb-2 text-gray-700">.*?<\/li>)/gs, (match) => {
    return `<ul class="list-disc list-inside mb-4 space-y-2">${match}</ul>`
  })
  
  return html
}

// Auto-resize textarea
const autoResizeTextarea = () => {
  const textarea = contentTextarea.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = Math.max(textarea.scrollHeight, 400) + 'px'
  }
}

// Watch content changes for auto-resize
watch(() => props.form.content, () => {
  nextTick(() => {
    autoResizeTextarea()
  })
})

// Close modals when clicking outside
const handleClickOutside = (event) => {
  if (showEmojiPicker.value && !event.target.closest('.emoji-picker-container')) {
    showEmojiPicker.value = false
  }
}

// Keyboard shortcuts
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  
  // Auto-resize on mount
  nextTick(() => {
    autoResizeTextarea()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

// Computed classes for responsive layout
const editorClasses = computed(() => {
  const base = 'flex-1 min-w-0'
  
  if (viewMode.value === 'edit') return `${base} w-full`
  if (viewMode.value === 'preview') return 'hidden'
  return `${base} lg:w-1/2` // both mode
})

const previewClasses = computed(() => {
  const base = 'flex-1 min-w-0'
  
  if (viewMode.value === 'preview') return `${base} w-full`
  if (viewMode.value === 'edit') return 'hidden'
  return `${base} lg:w-1/2 hidden lg:block` // both mode
})

// Sync scroll between editor and preview
const syncScroll = (source) => {
  if (viewMode.value !== 'both') return
  
  const sourceElement = source === 'editor' ? contentTextarea.value : previewContainer.value
  const targetElement = source === 'editor' ? previewContainer.value : contentTextarea.value
  
  if (sourceElement && targetElement) {
    const scrollPercentage = sourceElement.scrollTop / (sourceElement.scrollHeight - sourceElement.clientHeight)
    targetElement.scrollTop = scrollPercentage * (targetElement.scrollHeight - targetElement.clientHeight)
  }
}
</script>

<template>
  <div class="h-screen bg-gray-50 flex flex-col overflow-hidden">
    <!-- Minimal Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <!-- Left: Back and Title -->
      <div class="flex items-center space-x-4">
        <button
          @click="emit('cancel')"
          class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
          title="Back to content list"
        >
          <IconArrowLeft class="w-5 h-5" />
        </button>
        
        <div class="hidden sm:block">
          <h1 class="text-lg font-semibold text-gray-900">
            {{ isEditing ? 'Edit Content' : 'Create New Content' }}
          </h1>
        </div>
      </div>

      <!-- Center: View Mode Controls -->
      <div class="flex items-center bg-gray-100 rounded-lg p-1">
        <button
          @click="setViewMode('edit')"
          :class="[
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-1