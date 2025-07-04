import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'

// Global state for notes
const notes = ref([])
const isLoading = ref(false)
const error = ref('')

// Note form state
const noteForm = reactive({
  content: '',
  tags: []
})

// UI state
const currentView = ref('list') // list, create, edit, view
const selectedNote = ref(null)
const editingNote = ref(null)

export function useNostrNotes() {
  const { currentUser, isAuthenticated, writeRelays, readRelays } = useNostrAuth()

  // Computed properties
  const userNotes = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }
    return notes.value.filter(note => note.pubkey === currentUser.value.pubkey)
  })

  const sortedNotes = computed(() => {
    return [...userNotes.value].sort((a, b) => b.created_at - a.created_at)
  })

  // Extract hashtags from content
  const extractHashtags = (content) => {
    const hashtagRegex = /#(\w+)/g
    const hashtags = []
    let match
    
    while ((match = hashtagRegex.exec(content)) !== null) {
      hashtags.push(match[1])
    }
    
    return hashtags
  }

  // Create note title from content
  const createNoteTitle = (content) => {
    // Remove markdown formatting for title
    const plainText = content
      .replace(/#{1,6}\s+/g, '') // Remove heading markers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .trim()

    // Get first line or first 50 characters
    const firstLine = plainText.split('\n')[0]
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine || 'Untitled Note'
  }

  // Create note preview from content
  const createNotePreview = (content) => {
    // Remove markdown formatting for preview
    const plainText = content
      .replace(/#{1,6}\s+/g, '') // Remove heading markers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()

    return plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText
  }

  // Fetch user's notes from Nostr relays
  const fetchUserNotes = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch notes')
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Fetching notes for user:', currentUser.value.pubkey.substring(0, 8) + '...')

      // Subscribe to user's kind:1 events (notes)
      const subscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [1], // Text notes
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ], {
        onevent: (event) => {
          console.log('Received note event:', event)
          
          // Check if we already have this note
          const existingIndex = notes.value.findIndex(note => note.id === event.id)
          
          if (existingIndex === -1) {
            // Add new note
            notes.value.push({
              ...event,
              title: createNoteTitle(event.content),
              preview: createNotePreview(event.content),
              hashtags: extractHashtags(event.content)
            })
          } else {
            // Update existing note
            notes.value[existingIndex] = {
              ...event,
              title: createNoteTitle(event.content),
              preview: createNotePreview(event.content),
              hashtags: extractHashtags(event.content)
            }
          }
        },
        oneose: () => {
          console.log('End of stored notes events')
          isLoading.value = false
        },
        onclose: (reason) => {
          console.log('Notes subscription closed:', reason)
          isLoading.value = false
        }
      })

      // Store subscription for cleanup
      return subscription

    } catch (err) {
      console.error('Failed to fetch notes:', err)
      error.value = 'Failed to fetch notes: ' + err.message
      isLoading.value = false
    }
  }

  // Publish note to Nostr
  const publishNote = async (content, tags = []) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (!content.trim()) {
      throw new Error('Note content cannot be empty')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Publishing note to Nostr...')

      // Extract hashtags from content
      const contentHashtags = extractHashtags(content)
      
      // Combine provided tags with hashtags from content
      const allTags = [...new Set([...tags, ...contentHashtags])]

      // Create note event
      let eventTemplate = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: allTags.map(tag => ['t', tag]), // Add hashtags as 't' tags
        content: content.trim()
      }

      console.log('Signing note event...')
      
      // Sign the event using the browser extension
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      console.log('Publishing note to relays...')

      // Publish to Nostr relays
      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Note published successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })

      // Add the note to our local state immediately
      const newNote = {
        ...signedEvent,
        title: createNoteTitle(content),
        preview: createNotePreview(content),
        hashtags: allTags
      }

      notes.value.unshift(newNote)

      // Reset form
      noteForm.content = ''
      noteForm.tags = []

      return {
        event: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = 'Failed to publish note: ' + err.message
      console.error('❌ Note publishing error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update existing note
  const updateNote = async (noteId, newContent, tags = []) => {
    // In Nostr, we can't actually update events, so we publish a new one
    // and mark the old one as deleted with a kind:5 event
    
    try {
      // First, publish the new note
      const result = await publishNote(newContent, tags)
      
      // Then, publish a deletion event for the old note
      await deleteNote(noteId)
      
      return result
    } catch (err) {
      console.error('Failed to update note:', err)
      throw err
    }
  }

  // Delete note (publish kind:5 deletion event)
  const deleteNote = async (noteId) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      console.log('Publishing deletion event for note:', noteId)

      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', noteId]], // Reference to the event being deleted
        content: 'Note deleted'
      }

      // Sign the deletion event
      const signedEvent = await window.nostr.signEvent(deletionEvent)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Deletion event signature verification failed')
      }

      // Publish to Nostr relays
      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful > 0) {
        // Remove from local state
        const index = notes.value.findIndex(note => note.id === noteId)
        if (index !== -1) {
          notes.value.splice(index, 1)
        }
        
        console.log('✅ Note deletion published successfully')
      }

      return result

    } catch (err) {
      error.value = 'Failed to delete note: ' + err.message
      console.error('❌ Note deletion error:', err)
      throw err
    }
  }

  // View management
  const setView = (view) => {
    currentView.value = view
    error.value = ''
  }

  const viewNote = (note) => {
    selectedNote.value = note
    currentView.value = 'view'
  }

  const editNote = (note) => {
    editingNote.value = note
    noteForm.content = note.content
    noteForm.tags = note.hashtags || []
    currentView.value = 'edit'
  }

  const createNewNote = () => {
    editingNote.value = null
    noteForm.content = ''
    noteForm.tags = []
    currentView.value = 'create'
  }

  // Format date for display
  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    
    return date.toLocaleDateString()
  }

  // Initialize notes when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      setTimeout(() => {
        fetchUserNotes()
      }, 1000) // Small delay to ensure relay manager is ready
    } else {
      notes.value = []
    }
  }, { immediate: true })

  return {
    // State
    notes: sortedNotes,
    noteForm,
    currentView,
    selectedNote,
    editingNote,
    isLoading,
    error,

    // Actions
    fetchUserNotes,
    publishNote,
    updateNote,
    deleteNote,
    
    // View management
    setView,
    viewNote,
    editNote,
    createNewNote,
    
    // Utilities
    formatDate,
    createNoteTitle,
    createNotePreview,
    extractHashtags
  }
}