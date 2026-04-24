<script setup>
import { useTrendingHashtags } from '../../composables/explore/useTrendingHashtags.js'

const { trending, isLoading } = useTrendingHashtags()
</script>

<template>
  <section class="py-4">
    <div class="flex items-baseline justify-between mb-3">
      <p class="ep-section-title">Trending on Nostr</p>
      <span class="ep-eyebrow">past two hours</span>
    </div>
    <hr class="ep-rule" />

    <div v-if="trending.length === 0" class="py-4">
      <p class="ep-body-muted" style="font-size: 0.9375rem;">
        {{ isLoading ? 'Tuning in&hellip;' : 'Nothing is breaking through right now.' }}
      </p>
    </div>

    <div
      v-else
      class="flex flex-wrap items-baseline gap-x-5 gap-y-2 pt-3"
    >
      <span
        v-for="item in trending"
        :key="item.tag"
        class="ep-chip"
      >
        <span class="ep-chip-hash">#</span><span>{{ item.tag }}</span>
        <span class="ep-chip-count">{{ item.count }}</span>
      </span>
    </div>
  </section>
</template>
