<script setup>
import { useNetworkZapActivity } from '../../composables/explore/useNetworkZapActivity.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

defineProps({
  entries: { type: Array, required: true },
  secondary: { type: String, default: 'zaps' }, // 'zaps' or 'notes'
})

const { profileOf } = useNetworkZapActivity()

function displayName(pubkey) {
  if (!pubkey) return 'unknown'
  const p = profileOf(pubkey)
  if (p?.name) return p.name
  if (p?.display_name) return p.display_name
  return pubkey.slice(0, 8)
}

function avatarFor(pubkey) {
  const p = profileOf(pubkey)
  return p?.picture || generateAvatar(pubkey || 'unknown')
}

function secondaryFor(entry, kind) {
  if (kind === 'notes') {
    const n = entry.noteCount ?? 0
    return `${n} note${n === 1 ? '' : 's'}`
  }
  const n = entry.zapCount ?? 0
  return `${n} zap${n === 1 ? '' : 's'}`
}
</script>

<template>
  <div>
    <p v-if="entries.length === 0" class="ep-body-muted py-6" style="font-size: 0.9375rem;">
      Nothing on the board yet.
    </p>
    <ol v-else class="list-none m-0 p-0">
      <li
        v-for="(entry, idx) in entries"
        :key="entry.pubkey"
        class="ep-row"
      >
        <span class="ep-row-rank">{{ String(idx + 1).padStart(2, '0') }}</span>
        <div class="flex items-center gap-2.5 min-w-0">
          <img
            :src="avatarFor(entry.pubkey)"
            alt=""
            class="w-6 h-6 shrink-0"
            style="border-radius: 0; object-fit: cover; border: 1px solid var(--rule);"
            loading="lazy"
          />
          <div class="min-w-0">
            <span class="ep-row-name block">{{ displayName(entry.pubkey) }}</span>
            <span class="ep-mono block" style="color: var(--ink-faint); font-size: 0.6875rem;">
              {{ secondaryFor(entry, secondary) }}
            </span>
          </div>
        </div>
        <span class="ep-row-amount">{{ Number(entry.totalSats).toLocaleString('en-US') }}</span>
      </li>
    </ol>
  </div>
</template>
