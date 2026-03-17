/**
 * nostrImports.js — Single source of truth for all Nostr protocol imports.
 *
 * Every file in the codebase that needs Nostr primitives should import
 * from HERE, never directly from 'nostr-core' or 'nostr-tools'.
 *
 * This file re-exports nostr-core v0.6.0 functions, mapping them to
 * the API shapes the codebase already uses (from nostr-tools).
 *
 * When nostr-core's API differs from nostr-tools, compatibility shims
 * are provided at the bottom of this file.
 */

// ── Event handling ────────────────────────────────────────────────
export {
  finalizeEvent,
  verifyEvent,
  getEventHash,
  serializeEvent,
  validateEvent,
  verifiedSymbol,
} from 'nostr-core'

// ── Crypto / Key management ──────────────────────────────────────
export {
  generateSecretKey,
  getPublicKey,
} from 'nostr-core'

// ── Relay & Pool ─────────────────────────────────────────────────
export {
  Relay,
  RelayPool,
} from 'nostr-core'

// ── Signer ───────────────────────────────────────────────────────
export {
  Nip07Signer,
  getExtension,
  createSecretKeySigner,
  Nip07Error,
  Nip07NotAvailableError,
} from 'nostr-core'

// ── NWC (Nostr Wallet Connect) ───────────────────────────────────
export { NWC } from 'nostr-core'

// ── Error types ──────────────────────────────────────────────────
export {
  NWCError,
  NWCWalletError,
  NWCTimeoutError,
  NWCPublishTimeoutError,
  NWCReplyTimeoutError,
  NWCPublishError,
  NWCConnectionError,
  NWCDecryptionError,
  LightningAddressError,
  FiatConversionError,
  Nip05Error,
  ZapError,
  LnurlError,
} from 'nostr-core'

// ── Lightning Address ────────────────────────────────────────────
export {
  fetchInvoice,
  validateLightningAddress,
  parseLightningAddress,
} from 'nostr-core'

// ── Fiat conversion ──────────────────────────────────────────────
export {
  getExchangeRate,
  fiatToSats,
  satsToFiat,
} from 'nostr-core'

// ── LNURL ────────────────────────────────────────────────────────
export { lnurl } from 'nostr-core'
export {
  encodeLnurl,
  decodeLnurl,
  isLnurl,
  fetchPayRequest,
  parseLnurlMetadata,
} from 'nostr-core'

// ── Encoding / Utils ─────────────────────────────────────────────
export {
  normalizeURL,
  bytesToHex,
  hexToBytes,
  randomBytes,
} from 'nostr-core'

// ── Filter matching ──────────────────────────────────────────────
export {
  matchFilter,
  matchFilters,
} from 'nostr-core'

// ── NIP namespace re-exports ─────────────────────────────────────
// These match the `import * as nipXX from 'nostr-tools/nipXX'` pattern
export {
  nip02,
  nip04,
  nip05,
  nip06,
  nip09,
  nip10,
  nip11,
  nip13,
  nip17,
  nip18,
  nip19,
  nip21,
  nip22,
  nip23,
  nip24,
  nip25,
  nip27,
  nip28,
  nip29,
  nip30,
  nip31,
  nip36,
  nip40,
  nip42,
  nip44,
  nip46,
  nip48,
  nip50,
  nip51,
  nip56,
  nip57,
  nip58,
  nip59,
  nip65,
  nip98,
} from 'nostr-core'

// ── Commonly used NIP functions (direct exports for convenience) ──

// NIP-19: bech32 encoding — re-exported from the nip19 namespace for convenience.
// Files that do `import * as nip19 from '...'` use the namespace above.
// Files that do `import { npubEncode } from '...'` use these direct exports.
import { nip19 as _nip19 } from 'nostr-core'
export const npubEncode = _nip19.npubEncode
export const nsecEncode = _nip19.nsecEncode
export const noteEncode = _nip19.noteEncode
export const neventEncode = _nip19.neventEncode
export const naddrEncode = _nip19.naddrEncode
export const nprofileEncode = _nip19.nprofileEncode
export const nip19Decode = _nip19.decode

// NIP-57: zaps
export {
  createZapRequestEventTemplate,
  createZapRequestEvent,
  parseZapReceipt,
  validateZapReceipt,
  fetchZapInvoice,
} from 'nostr-core'

// NIP-65: relay lists
export {
  parseRelayList,
  createRelayListEventTemplate,
  createRelayListEvent,
  getReadRelays,
  getWriteRelays,
} from 'nostr-core'

// NIP-05: DNS identity
export {
  queryNip05,
  verifyNip05,
  parseNip05Address,
} from 'nostr-core'

// NIP-02: contacts
export {
  createFollowListEventTemplate,
  createFollowListEvent,
  parseFollowList,
  isFollowing,
  getFollowedPubkeys,
} from 'nostr-core'

// NIP-58: badges
export {
  createBadgeDefinitionTemplate,
  createBadgeDefinitionEvent,
  parseBadgeDefinition,
  createBadgeAwardTemplate,
  createBadgeAwardEvent,
  parseBadgeAward,
  createProfileBadgesTemplate,
  createProfileBadgesEvent,
  parseProfileBadges,
} from 'nostr-core'

// NIP-23: long-form content
export {
  createLongFormEventTemplate,
  createLongFormEvent,
  parseLongForm,
} from 'nostr-core'

// NIP-25: reactions
export {
  createReactionEventTemplate,
  createReactionEvent,
  parseReaction,
} from 'nostr-core'

// NIP-09: deletion
export {
  createDeletionEventTemplate,
  createDeletionEvent,
} from 'nostr-core'

// NIP-46: remote signer
export {
  NostrConnect,
  parseConnectionURI,
} from 'nostr-core'

// ── Compatibility shims ──────────────────────────────────────────

/**
 * queryProfile — nostr-tools nip05 compatibility.
 * nostr-tools: queryProfile(address) → { pubkey, relays } | null
 * nostr-core:  queryNip05(address)   → { pubkey, relays } (throws on error)
 *
 * This shim catches errors and returns null (matching nostr-tools behavior).
 */
import { queryNip05 as _queryNip05, decodeLnurl as _decodeLnurl } from 'nostr-core'
export async function queryProfile(address) {
  try {
    return await _queryNip05(address)
  } catch {
    return null
  }
}

/**
 * isNip05 — nostr-tools nip05 compatibility.
 * Simple regex check for name@domain format.
 */
const NIP05_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export function isNip05(value) {
  return NIP05_REGEX.test(value || '')
}

/**
 * makeZapRequest — nostr-tools nip57 compatibility.
 * nostr-tools: makeZapRequest({ profile, event, amount, relays, comment })
 * nostr-core:  createZapRequestEventTemplate({ recipientPubkey, eventId, amount, relays, content })
 *
 * This shim maps the old API shape to the new one.
 */
import { createZapRequestEventTemplate as _createZapRequest } from 'nostr-core'
export function makeZapRequest({ profile, event, amount, relays, comment = '' }) {
  // Callers may pass an event ID string or a full event object
  const eventId = typeof event === 'string' ? event : event?.id
  return _createZapRequest({
    recipientPubkey: profile,
    eventId: eventId || undefined,
    amount,
    relays,
    content: comment,
  })
}

/**
 * getZapEndpoint — nostr-tools nip57 compatibility.
 * Extracts the LNURL/Lightning Address callback URL from a profile event.
 * nostr-tools had this built in; nostr-core doesn't have an exact equivalent,
 * so we implement it here.
 */
export async function getZapEndpoint(profileEvent) {
  try {
    const content = JSON.parse(profileEvent.content || '{}')
    const lud16 = content.lud16
    const lud06 = content.lud06

    if (lud16) {
      const [name, domain] = lud16.split('@')
      if (name && domain) {
        const url = `https://${domain}/.well-known/lnurlp/${name}`
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        if (data.allowsNostr && data.nostrPubkey) {
          return data.callback
        }
        return null
      }
    }

    if (lud06) {
      const url = _decodeLnurl(lud06)
      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      if (data.allowsNostr && data.nostrPubkey) {
        return data.callback
      }
    }

    return null
  } catch {
    return null
  }
}

// ── Kind constants (replacing nostr-tools/kinds) ──────────────────
export const LongFormArticle = 30023
