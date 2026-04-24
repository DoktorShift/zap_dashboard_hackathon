<script setup>
import { useNetworkZapActivity } from '../../composables/explore/useNetworkZapActivity.js'
import LeaderboardTable from './LeaderboardTable.vue'

const { topZappers7d } = useNetworkZapActivity()
</script>

<template>
  <section>
    <div class="flex items-baseline justify-between mb-3">
      <p class="ep-section-title">Top zappers</p>
      <span class="ep-eyebrow">past 7 days</span>
    </div>
    <LeaderboardTable :entries="topZappers7d" secondary="zaps" />
  </section>
</template>
