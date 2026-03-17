/**
 * SignerService — signer abstraction.
 *
 * Phase 1: wraps window.nostr (NIP-07 browser extension) directly.
 * Phase 6: replaced with nostr-core Nip07Signer + NostrConnect support.
 *
 * All code that needs to sign events, get pubkeys, or encrypt/decrypt
 * should go through this service.
 */

class SignerService {

  /**
   * Check if a NIP-07 browser extension is available.
   */
  isExtensionAvailable() {
    return typeof window !== 'undefined' && !!window.nostr
  }

  /**
   * Get the current signer (window.nostr in Phase 1).
   * @returns {object|null}
   */
  getSigner() {
    if (this.isExtensionAvailable()) {
      return window.nostr
    }
    return null
  }

  /**
   * Get the user's public key from the signer.
   * @returns {Promise<string>} hex pubkey
   * @throws if no signer available
   */
  async getPublicKey() {
    const signer = this.getSigner()
    if (!signer) {
      throw new Error('No Nostr signer available. Please install a NIP-07 extension (e.g. Alby, nos2x).')
    }
    return signer.getPublicKey()
  }

  /**
   * Sign an event template.
   * @param {object} eventTemplate — { kind, content, tags, created_at }
   * @returns {Promise<object>} signed event with id and sig
   * @throws if no signer available
   */
  async signEvent(eventTemplate) {
    const signer = this.getSigner()
    if (!signer) {
      throw new Error('No Nostr signer available.')
    }
    return signer.signEvent(eventTemplate)
  }

  /**
   * Encrypt content for a recipient.
   * @param {string} pubkey — recipient hex pubkey
   * @param {string} plaintext
   * @param {'nip44'|'nip04'} [preferredNip='nip44'] — which NIP to prefer
   * @returns {Promise<{ciphertext: string, nip: 'nip44'|'nip04'}>}
   */
  async encrypt(pubkey, plaintext, preferredNip = 'nip44') {
    const signer = this.getSigner()
    if (!signer) throw new Error('No Nostr signer available.')

    // Try preferred NIP first, then fallback
    const order = preferredNip === 'nip44'
      ? ['nip44', 'nip04']
      : ['nip04', 'nip44']

    for (const nip of order) {
      if (signer[nip]?.encrypt) {
        const ciphertext = await signer[nip].encrypt(pubkey, plaintext)
        return { ciphertext, nip }
      }
    }
    throw new Error('Signer does not support encryption.')
  }

  /**
   * Decrypt content from a sender.
   * @param {string} pubkey — sender hex pubkey
   * @param {string} ciphertext
   * @param {'nip44'|'nip04'} [nip] — which NIP to use (if known)
   * @returns {Promise<string>} plaintext
   */
  async decrypt(pubkey, ciphertext, nip) {
    const signer = this.getSigner()
    if (!signer) throw new Error('No Nostr signer available.')

    // If specific NIP requested, use it
    if (nip && signer[nip]?.decrypt) {
      return signer[nip].decrypt(pubkey, ciphertext)
    }

    // Otherwise try NIP-44 then NIP-04
    if (signer.nip44?.decrypt) {
      return signer.nip44.decrypt(pubkey, ciphertext)
    }
    if (signer.nip04?.decrypt) {
      return signer.nip04.decrypt(pubkey, ciphertext)
    }
    throw new Error('Signer does not support decryption.')
  }

  /**
   * Get relays from the signer extension (if supported).
   * @returns {Promise<object>} relay map { url: { read, write } }
   */
  async getRelays() {
    const signer = this.getSigner()
    if (!signer?.getRelays) return {}
    try {
      return await signer.getRelays()
    } catch {
      return {}
    }
  }
}

// Singleton
export const signerService = new SignerService()
