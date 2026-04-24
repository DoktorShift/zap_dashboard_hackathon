<script setup>
import { computed } from 'vue'

const todayIso = computed(() => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})
</script>

<template>
  <header class="flex items-baseline justify-between px-1 pt-2 pb-3">
    <div class="flex items-baseline gap-3">
      <span class="ep-display" style="font-size: 1.5rem;">Explore</span>
      <span class="ep-ornament">&#9642;</span>
      <span class="ep-eyebrow">The Nostr wire, read daily</span>
    </div>
    <span class="ep-mono" style="font-size: 0.75rem; color: var(--ink-faint);">
      Vol. {{ todayIso }}
    </span>
  </header>
  <hr class="ep-rule-strong" />
</template>
