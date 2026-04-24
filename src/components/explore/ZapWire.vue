<script setup>
import { computed } from 'vue'
import { useNetworkZapActivity } from '../../composables/explore/useNetworkZapActivity.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const { wireFeed, profileOf, isLoading } = useNetworkZapActivity()

function displayName(pubkey) {
  if (!pubkey) return 'anonymous'
  const p = profileOf(pubkey)
  if (p?.name) return p.name
  if (p?.display_name) return p.display_name
  return pubkey.slice(0, 8)
}

function avatarFor(pubkey) {
  const p = profileOf(pubkey)
  return p?.picture || generateAvatar(pubkey || 'unknown')
}

function relativeTime(tsSeconds) {
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - tsSeconds)
  if (delta < 60) return `${delta}s`
  if (delta < 3600) return `${Math.floor(delta / 60)}m`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`
  return `${Math.floor(delta / 86400)}d`
}

const rows = computed(() => wireFeed.value.slice(0, 12))
</script>

<template>
  <section class="py-2">
    <div class="flex items-baseline justify-between mb-3">
      <p class="ep-section-title">Zap Wire</p>
      <p class="ep-body-muted ep-mono" style="font-size: 0.6875rem;">live</p>
    </div>
    <hr class="ep-rule-strong" />

    <div v-if="rows.length === 0" class="py-8 text-center">
      <p class="ep-body-muted" style="font-size: 0.9375rem;">
        {{ isLoading ? 'Opening the wire&hellip;' : 'Quiet on the network right now.' }}
      </p>
    </div>

    <ul v-else class="divide-y" style="border-color: var(--rule);">
      <li
        v-for="item in rows"
        :key="item.id"
        class="flex items-center gap-3 py-3 ep-wire-enter"
      >
        <img
          :src="avatarFor(item.zapper)"
          alt=""
          class="w-7 h-7 shrink-0"
          style="border-radius: 0; object-fit: cover; border: 1px solid var(--rule);"
          loading="lazy"
        />
        <div class="min-w-0 flex-1 flex items-baseline gap-2">
          <span class="ep-body truncate" style="font-weight: 500;">
            {{ displayName(item.zapper) }}
          </span>
          <span class="ep-mono" style="color: var(--ink-faint); font-size: 0.8125rem;">&rarr;</span>
          <span class="ep-body truncate" style="color: var(--ink-muted);">
            {{ displayName(item.recipient) }}
          </span>
        </div>
        <span class="ep-amount shrink-0">{{ Number(item.amount).toLocaleString('en-US') }}</span>
        <span class="ep-mono shrink-0 text-right" style="color: var(--ink-faint); font-size: 0.75rem; min-width: 2.5rem;">
          {{ relativeTime(item.ts) }}
        </span>
      </li>
    </ul>
  </section>
</template>
