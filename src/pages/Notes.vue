<script setup>
import { ref, onMounted, computed } from 'vue'
import { 
  IconFileText, 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconArrowLeft, 
  IconSend,
  IconLoader,
  IconAlertCircle,
  IconUser,
  IconBolt,
  IconHash,
  IconCalendar,
  IconEye
} from '@iconify-prerendered/vue-tabler'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Markdown } from 'tiptap-markdown'
import { useNostrNotes } from '../composables/useNostrNotes.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'

const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

const {
  notes,
  noteForm,
  currentView,
  selectedNote,
  editingNote,
  isLoading,
  error,
  publishNote,
  updateNote,
  deleteNote,
  setView,
  viewNote,
  editNote,
  createNewNote,
  formatDate
} = useNostrNotes()

// Editor setup
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      }
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-orange-600 hover:text-orange-700 underline'
      }
    }),
    Underline,
    Placeholder.configure({
      placeholder: 'Start writing your note... Use # for headings, **bold**, *italic*, and [links](url)'
    }),
    Markdown.configure({
      html: false,
      transformCopiedText: true,
      transformPastedText: true
    })
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4'
    }
  },
  onUpdate: ({ editor }) => {
    noteForm.content = editor.getHTML()
  }
})

// Watch for content changes when editing
const updateEditorContent = (content) => {
  if (editor.value && content !== editor.value.getHTML()) {
    editor.value.commands.setContent(content)
  }
}

// Handle form submission
const handleSubmit = async () => {
  if (!noteForm.content.trim()) return

  try {
    if (editingNote.value) {
      await updateNote(editingNote.value.id, noteForm.content, noteForm.tags)
    } else {
      await publishNote(noteForm.content, noteForm.tags)
    }
    
    // Reset editor and go back to list
    editor.value?.commands.clearContent()
    setView('list')
  } catch (err) {
    console.error('Failed to save note:', err)
  }
}

// Handle note deletion
const handleDelete = async (note) => {
  if (confirm(`Are you sure you want to delete "${note.title}"?`)) {
    try {
      await deleteNote(note.id)
      if (currentView.value === 'view' && selectedNote.value?.id === note.id) {
        setView('list')
      }
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }
}

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Set up editor content when editing
const startEditing = (note) => {
  editNote(note)
  updateEditorContent(note.content)
}

const startCreating = () => {
  createNewNote()
  editor.value?.commands.clearContent()
}

// Computed properties
const isFormValid = computed(() => {
  return noteForm.content.trim().length > 0
})

const noteStats = computed(() => {
  return {
    total: notes.value.length,
    thisWeek: notes.value.filter(note => {
      const noteDate = new Date(note.created_at * 1000)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return noteDate > weekAgo
    }).length
  }
})

onMounted(() => {
  // Editor is automatically set up by useEditor
})
</script>

<template>
  <div class="space-y-6">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-start space-x-4">
          <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <IconUser class="w-6 h-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
            <p class="text-purple-100 text-sm">
              Connect your Nostr identity to create and manage your notes on the decentralized network.
              Your notes will be stored on Nostr relays, not on our servers.
            </p>
          </div>
        </div>
        <button
          @click="handleNostrLogin"
          class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
        >
          <IconBolt class="w-4 h-4" />
          <span>Connect with Nostr</span>
        </button>
      </div>
    </div>

    <!-- Authenticated Content -->
    <div v-else>
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
            <IconFileText class="w-6 h-6 text-orange-600" />
            <span>My Notes</span>
          </h1>
          <p class="text-gray-600">
            Welcome back, {{ userProfile?.name || 'Creator' }}! Write and publish notes to the Nostr network.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            v-if="currentView !== 'list'"
            @click="setView('list')"
            class="btn-secondary"
          >
            <IconArrowLeft class="w-4 h-4" />
            Back to Notes
          </button>
          <button
            v-if="currentView === 'list'"
            @click="startCreating"
            class="btn-primary"
          >
            <IconPlus class="w-4 h-4" />
            New Note
          </button>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>

      <!-- Notes List View -->
      <div v-if="currentView === 'list'">
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-4 rounded-xl shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-orange-100 text-sm">Total Notes</p>
                <p class="text-2xl font-bold">{{ noteStats.total }}</p>
              </div>
              <IconFileText class="w-8 h-8 text-orange-200" />
            </div>
          </div>
          
          <div class="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-600 text-sm">This Week</p>
                <p class="text-2xl font-bold text-gray-900">{{ noteStats.thisWeek }}</p>
              </div>
              <IconCalendar class="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <div class="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-600 text-sm">On Nostr</p>
                <p class="text-2xl font-bold text-purple-600">{{ noteStats.total }}</p>
              </div>
              <IconBolt class="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <!-- Notes List -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
          <div class="p-6 border-b border-orange-100/50">
            <h3 class="text-lg font-semibold text-gray-900">Your Notes</h3>
          </div>

          <div v-if="isLoading && notes.length === 0" class="p-6">
            <div class="flex items-center justify-center space-x-2">
              <IconLoader class="w-5 h-5 animate-spin text-orange-600" />
              <span class="text-gray-600">Loading your notes...</span>
            </div>
          </div>

          <div v-else-if="notes.length === 0" class="p-6 text-center">
            <IconFileText class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No notes yet</h4>
            <p class="text-gray-600 mb-4">Start writing your first note to share your thoughts on Nostr.</p>
            <button @click="startCreating" class="btn-primary">
              <IconPlus class="w-4 h-4" />
              Create First Note
            </button>
          </div>

          <div v-else class="divide-y divide-orange-100/50">
            <div
              v-for="note in notes"
              :key="note.id"
              class="p-4 hover:bg-orange-25/50 transition-colors cursor-pointer"
              @click="viewNote(note)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <h4 class="font-semibold text-gray-900 mb-2 truncate">{{ note.title }}</h4>
                  <p class="text-sm text-gray-600 mb-3 line-clamp-2">{{ note.preview }}</p>
                  
                  <div class="flex items-center space-x-4 text-xs text-gray-500">
                    <span class="flex items-center space-x-1">
                      <IconCalendar class="w-3 h-3" />
                      <span>{{ formatDate(note.created_at) }}</span>
                    </span>
                    <span v-if="note.hashtags && note.hashtags.length > 0" class="flex items-center space-x-1">
                      <IconHash class="w-3 h-3" />
                      <span>{{ note.hashtags.slice(0, 2).join(', ') }}</span>
                      <span v-if="note.hashtags.length > 2">+{{ note.hashtags.length - 2 }}</span>
                    </span>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2 ml-4">
                  <button
                    @click.stop="startEditing(note)"
                    class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Edit note"
                  >
                    <IconEdit class="w-4 h-4" />
                  </button>
                  <button
                    @click.stop="handleDelete(note)"
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete note"
                  >
                    <IconTrash class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit Note View -->
      <div v-else-if="currentView === 'create' || currentView === 'edit'">
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
          <div class="p-6 border-b border-orange-100/50">
            <h2 class="text-xl font-semibold text-gray-900">
              {{ currentView === 'edit' ? 'Edit Note' : 'Create New Note' }}
            </h2>
            <p class="text-gray-600 text-sm mt-1">
              Write your note using Markdown formatting. It will be published to the Nostr network.
            </p>
          </div>

          <div class="p-6">
            <!-- Editor Toolbar -->
            <div v-if="editor" class="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg mb-4 border">
              <button
                @click="editor.chain().focus().toggleBold().run()"
                :class="{ 'bg-orange-200': editor.isActive('bold') }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                Bold
              </button>
              <button
                @click="editor.chain().focus().toggleItalic().run()"
                :class="{ 'bg-orange-200': editor.isActive('italic') }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                Italic
              </button>
              <button
                @click="editor.chain().focus().toggleUnderline().run()"
                :class="{ 'bg-orange-200': editor.isActive('underline') }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                Underline
              </button>
              <div class="w-px h-6 bg-gray-300"></div>
              <button
                @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
                :class="{ 'bg-orange-200': editor.isActive('heading', { level: 1 }) }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                H1
              </button>
              <button
                @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
                :class="{ 'bg-orange-200': editor.isActive('heading', { level: 2 }) }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                H2
              </button>
              <button
                @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
                :class="{ 'bg-orange-200': editor.isActive('heading', { level: 3 }) }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                H3
              </button>
              <div class="w-px h-6 bg-gray-300"></div>
              <button
                @click="editor.chain().focus().toggleBulletList().run()"
                :class="{ 'bg-orange-200': editor.isActive('bulletList') }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                List
              </button>
              <button
                @click="editor.chain().focus().toggleCodeBlock().run()"
                :class="{ 'bg-orange-200': editor.isActive('codeBlock') }"
                class="px-3 py-1 rounded text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                Code
              </button>
            </div>

            <!-- Editor -->
            <div class="border border-orange-200/50 rounded-lg overflow-hidden">
              <EditorContent :editor="editor" class="min-h-[300px] bg-white" />
            </div>

            <!-- Markdown Help -->
            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-medium text-blue-900 mb-2">Markdown Quick Reference</h4>
              <div class="text-sm text-blue-800 space-y-1">
                <p><code># Heading 1</code> • <code>## Heading 2</code> • <code>### Heading 3</code></p>
                <p><code>**bold**</code> • <code>*italic*</code> • <code>`code`</code> • <code>[link](url)</code></p>
                <p><code>- List item</code> • <code>#hashtag</code> for tags</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end space-x-3 mt-6">
              <button
                @click="setView('list')"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="!isFormValid || isLoading"
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                <IconSend v-else class="w-4 h-4" />
                {{ isLoading ? 'Publishing...' : (currentView === 'edit' ? 'Update Note' : 'Publish Note') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- View Note -->
      <div v-else-if="currentView === 'view' && selectedNote">
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
          <div class="p-6 border-b border-orange-100/50">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">{{ selectedNote.title }}</h2>
                <div class="flex items-center space-x-4 text-sm text-gray-600">
                  <span class="flex items-center space-x-1">
                    <IconCalendar class="w-4 h-4" />
                    <span>{{ formatDate(selectedNote.created_at) }}</span>
                  </span>
                  <span class="flex items-center space-x-1">
                    <IconUser class="w-4 h-4" />
                    <span>{{ userProfile?.name || 'You' }}</span>
                  </span>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button
                  @click="startEditing(selectedNote)"
                  class="btn-secondary"
                >
                  <IconEdit class="w-4 h-4" />
                  Edit
                </button>
                <button
                  @click="handleDelete(selectedNote)"
                  class="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <IconTrash class="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div class="p-6">
            <!-- Hashtags -->
            <div v-if="selectedNote.hashtags && selectedNote.hashtags.length > 0" class="mb-6">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in selectedNote.hashtags"
                  :key="tag"
                  class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
                >
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                </span>
              </div>
            </div>

            <!-- Note Content -->
            <div class="prose prose-sm max-w-none" v-html="selectedNote.content"></div>

            <!-- Nostr Event Details -->
            <div class="mt-8 pt-6 border-t border-gray-200">
              <h4 class="text-sm font-medium text-gray-700 mb-3">Nostr Event Details</h4>
              <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Event ID:</span>
                  <code class="text-gray-800 bg-gray-200 px-2 py-1 rounded text-xs">
                    {{ selectedNote.id.substring(0, 16) }}...
                  </code>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Kind:</span>
                  <span class="text-gray-800">1 (Text Note)</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Published:</span>
                  <span class="text-gray-800">{{ new Date(selectedNote.created_at * 1000).toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Tiptap Editor Styles */
:deep(.ProseMirror) {
  outline: none;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

:deep(.ProseMirror h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 1rem 0 0.5rem 0;
}

:deep(.ProseMirror h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
}

:deep(.ProseMirror h3) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
}

:deep(.ProseMirror ul) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

:deep(.ProseMirror li) {
  margin: 0.25rem 0;
}

:deep(.ProseMirror code) {
  background-color: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

:deep(.ProseMirror pre) {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 0.5rem;
  margin: 1rem 0;
  overflow-x: auto;
}

:deep(.ProseMirror pre code) {
  background: none;
  padding: 0;
  color: inherit;
}
</style>