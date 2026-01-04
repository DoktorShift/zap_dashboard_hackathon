import { nostrRelayManager } from '../network/nostrRelayManager.js'

// Shared profile cache and in-flight promises
export const profileCache = new Map()
const profileFetchPromises = new Map()

// Normalize fetched profile according to schema
const normalizeProfileData = (pubkey, profileData) => {
  return {
    pubkey,
    name: profileData.name || profileData.display_name || `user:${pubkey.substring(0, 8)}`,
    display_name: profileData.display_name || null,
    about: profileData.about || null,
    picture: profileData.picture || null,
    banner: profileData.banner || null,
    website: profileData.website || null,
    nip05: profileData.nip05 || null,
    bot: profileData.bot || false,
    birthday: profileData.birthday || null,
    lud06: profileData.lud06 || null,
    lud16: profileData.lud16 || null,
    updated_at: Date.now()
  }
}

// Fetch single profile (caches result). Returns profile object.
export const fetchProfile = async (pubkey, { ttl = 24 * 60 * 60 * 1000 } = {}) => {
  if (!pubkey) return null

  // Return cached if fresh AND has picture (don't return incomplete cached profiles)
  const cached = profileCache.get(pubkey)
  if (cached && (Date.now() - cached.timestamp) < ttl && cached.profile?.picture) {
    console.log('📦 fetchProfile: Returning cached profile with picture for', pubkey.substring(0, 16))
    return cached.profile
  }

  // Deduplicate in-flight
  if (profileFetchPromises.has(pubkey)) {
    return profileFetchPromises.get(pubkey)
  }

  console.log('🔍 fetchProfile: Fetching from relays for', pubkey.substring(0, 16))
  const p = _fetchProfileFromRelays(pubkey)
  profileFetchPromises.set(pubkey, p)

  try {
    const profile = await p

    // Handle null profile (EOSE without profile event found)
    if (!profile) {
      console.log('⚠️ fetchProfile: No profile found on relays for', pubkey.substring(0, 16))
      // Create a minimal fallback
      const fallback = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        display_name: null,
        about: null,
        picture: null,
        banner: null,
        website: null,
        nip05: null,
        bot: false,
        birthday: null,
        lud06: null,
        lud16: null,
        updated_at: Date.now()
      }
      // Cache with shorter TTL so we retry sooner
      profileCache.set(pubkey, { profile: fallback, timestamp: Date.now() - (ttl / 2) })
      return fallback
    }

    console.log('✅ fetchProfile: Got profile for', pubkey.substring(0, 16), '- picture:', profile.picture ? 'YES' : 'NO')
    profileCache.set(pubkey, { profile, timestamp: Date.now() })
    return profile
  } catch (err) {
    console.error('❌ fetchProfile: Error for', pubkey.substring(0, 16), '-', err.message)
    // Fallback profile
    const fallback = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      display_name: null,
      about: null,
      picture: null,
      banner: null,
      website: null,
      nip05: null,
      bot: false,
      birthday: null,
      lud06: null,
      lud16: null,
      updated_at: Date.now()
    }
    profileCache.set(pubkey, { profile: fallback, timestamp: Date.now() })
    return fallback
  } finally {
    profileFetchPromises.delete(pubkey)
  }
}

// Internal single-profile fetch via subscription (uses nostrRelayManager)
const _fetchProfileFromRelays = async (pubkey) => {
  if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64) {
    throw new Error(`Invalid pubkey for profile fetch: ${pubkey}`)
  }

  console.log('🔌 _fetchProfileFromRelays: Starting fetch for', pubkey.substring(0, 16))
  console.log('🔌 _fetchProfileFromRelays: nostrRelayManager available:', !!nostrRelayManager)
  console.log('🔌 _fetchProfileFromRelays: subscribeToEvents available:', typeof nostrRelayManager?.subscribeToEvents)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('⏱️ _fetchProfileFromRelays: TIMEOUT after 15s for', pubkey.substring(0, 16))
      reject(new Error('Profile fetch timeout'))
    }, 15000)

    try {
      console.log('📡 _fetchProfileFromRelays: Calling subscribeToEvents for', pubkey.substring(0, 16))
      const sub = nostrRelayManager.subscribeToEvents([
        { kinds: [0], authors: [pubkey], limit: 1 }
      ], {
        onevent: (event) => {
          console.log('📨 _fetchProfileFromRelays: onevent fired for', pubkey.substring(0, 16))
          try {
            clearTimeout(timeout)
            const data = JSON.parse(event.content || '{}')
            const profile = normalizeProfileData(event.pubkey || pubkey, data)
            console.log('✅ _fetchProfileFromRelays: Profile parsed successfully for', pubkey.substring(0, 16))
            sub.close()
            resolve(profile)
          } catch (e) {
            console.error('❌ _fetchProfileFromRelays: Error parsing event for', pubkey.substring(0, 16), e)
            clearTimeout(timeout)
            sub.close()
            reject(e)
          }
        },
        oneose: () => {
          console.log('🏁 _fetchProfileFromRelays: EOSE received for', pubkey.substring(0, 16))
          setTimeout(() => {
            clearTimeout(timeout)
            sub.close()
            console.log('⚠️ _fetchProfileFromRelays: Resolving null (no profile found) for', pubkey.substring(0, 16))
            resolve(null)
          }, 1000)
        },
        onclose: () => {
          console.log('🔒 _fetchProfileFromRelays: onclose fired for', pubkey.substring(0, 16))
          clearTimeout(timeout)
        }
      })
      console.log('✅ _fetchProfileFromRelays: Subscription created:', !!sub, 'for', pubkey.substring(0, 16))
    } catch (e) {
      console.error('❌ _fetchProfileFromRelays: Exception during subscribe for', pubkey.substring(0, 16), e)
      clearTimeout(timeout)
      reject(e)
    }
  })
}

// Batch fetch profiles for many pubkeys. Updates profileCache as results arrive.
export const batchFetchProfiles = async (pubkeys = [], { batchSize = 50, timeoutMs = 10000 } = {}) => {
  // Filter out invalid pubkeys
  const validPubkeys = pubkeys.filter(pk => pk && typeof pk === 'string' && pk.length === 64)
  const missing = validPubkeys.filter(pk => !profileCache.has(pk))

  if (missing.length === 0) return

  // Split into batches to avoid overly long author lists
  const batches = []
  for (let i = 0; i < missing.length; i += batchSize) {
    batches.push(missing.slice(i, i + batchSize))
  }

  const promises = batches.map(batch => new Promise((resolve) => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve() }
    }, timeoutMs)

    try {
      const sub = nostrRelayManager.subscribeToEvents([
        { kinds: [0], authors: batch, limit: batch.length }
      ], {
        onevent: (event) => {
          try {
            const data = JSON.parse(event.content || '{}')
            const profile = normalizeProfileData(event.pubkey, data)
            profileCache.set(event.pubkey, { profile, timestamp: Date.now() })
          } catch (e) {
            // ignore
          }
        },
        oneose: () => {
          if (!resolved) { resolved = true; clearTimeout(timeout); resolve() }
        },
        onclose: () => {
          if (!resolved) { resolved = true; clearTimeout(timeout); resolve() }
        }
      })
    } catch (e) {
      clearTimeout(timeout)
      if (!resolved) { resolved = true; resolve() }
    }
  }))

  await Promise.all(promises)
}
