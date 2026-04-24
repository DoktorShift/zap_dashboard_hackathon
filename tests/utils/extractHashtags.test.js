import { describe, it, expect } from 'vitest'
import { extractHashtags } from '../../src/utils/nostr/extractHashtags.js'

describe('extractHashtags', () => {
  it('returns empty for empty or non-string input', () => {
    expect(extractHashtags('')).toEqual([])
    expect(extractHashtags(null)).toEqual([])
    expect(extractHashtags(undefined)).toEqual([])
    expect(extractHashtags(42)).toEqual([])
  })

  it('extracts a single hashtag', () => {
    expect(extractHashtags('loving #nostr today')).toEqual(['nostr'])
  })

  it('extracts multiple hashtags in order', () => {
    expect(extractHashtags('#bitcoin and #nostr and #zaps')).toEqual([
      'bitcoin', 'nostr', 'zaps',
    ])
  })

  it('normalizes to lowercase', () => {
    expect(extractHashtags('#Nostr #BTC #btC')).toEqual(['nostr', 'btc'])
  })

  it('dedupes within a single note', () => {
    expect(extractHashtags('#nostr #NOSTR #nostr')).toEqual(['nostr'])
  })

  it('handles hashtags terminated by punctuation', () => {
    expect(extractHashtags('love #nostr, and #bitcoin!')).toEqual([
      'nostr', 'bitcoin',
    ])
  })

  it('handles unicode tags (Japanese, emoji-adjacent letters)', () => {
    expect(extractHashtags('#日本 #café')).toEqual(['日本', 'café'])
  })

  it('rejects hashtags shorter than minLength', () => {
    expect(extractHashtags('#a #ab #abc')).toEqual(['ab', 'abc'])
    expect(extractHashtags('#ab #abc', { minLength: 3 })).toEqual(['abc'])
  })

  it('ignores hashes not followed by word chars', () => {
    expect(extractHashtags('# alone and ## and #!')).toEqual([])
  })

  it('handles underscores and digits in tags', () => {
    expect(extractHashtags('#nostr_asia #btc2026')).toEqual([
      'nostr_asia', 'btc2026',
    ])
  })
})
