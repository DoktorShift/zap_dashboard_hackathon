/**
 * Extract hashtags from a Nostr note's content.
 *
 * Accepts unicode word characters (so non-Latin tags like #nostrasia,
 * #日本 work). Normalizes to lowercase and dedupes within a single note
 * — a tag used twice in one note counts once for frequency purposes
 * (consistent with how users intuitively read "trending").
 *
 * @param {string} content
 * @param {{ minLength?: number }} [opts]
 * @returns {string[]} unique, lowercased hashtags (without the `#` prefix)
 */
export function extractHashtags(content, { minLength = 2 } = {}) {
  if (typeof content !== 'string' || content.length === 0) return []

  // `\p{L}\p{N}\p{M}_` = letters, numbers, marks, underscore. Unicode-aware.
  const regex = /#([\p{L}\p{N}\p{M}_]+)/gu
  const seen = new Set()
  const out = []

  let match
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1]
    if (raw.length < minLength) continue
    const normalized = raw.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }

  return out
}
