/**
 * Text helpers for displaying Nostr kind:1 (note) content. Pure
 * functions — no reactivity, no dependencies. Extracted from the
 * main useNostrNotes composable so components that only need the
 * string-shaping can import them without pulling the whole
 * subscription lifecycle in.
 */

const TITLE_MAX_CHARS = 50
const PREVIEW_MAX_CHARS = 200

/**
 * First line of the note, truncated to a fixed width and suffixed with
 * an ellipsis when cut. Falls back to "Untitled Note" when the content
 * is empty / whitespace.
 */
export function createNoteTitle(content) {
  const plain = (content || '').trim()
  if (!plain) return 'Untitled Note'
  const firstLine = plain.split('\n')[0]
  return firstLine.length > TITLE_MAX_CHARS
    ? firstLine.substring(0, TITLE_MAX_CHARS) + '...'
    : firstLine
}

/**
 * Single-line summary collapsing runs of newlines into spaces. Used in
 * note-card UIs where vertical space is bounded.
 */
export function createNotePreview(content) {
  const plain = (content || '').replace(/\n+/g, ' ').trim()
  return plain.length > PREVIEW_MAX_CHARS
    ? plain.substring(0, PREVIEW_MAX_CHARS) + '...'
    : plain
}
