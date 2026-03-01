<script setup>
import { computed } from 'vue'
import { useBtcPrice } from '../../composables/core/useBtcPrice.js'
import {
  IconCurrencyBitcoin,
  IconFileText,
  IconBolt,
  IconHeart,
  IconTrendingUp,
  IconHash
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  stats: {
    type: Object,
    required: true
  },
  items: {
    type: Array,
    default: () => []
  },
  engagementTotal: {
    type: Number,
    default: 0
  }
})

const { satsToUSD, formatUSD } = useBtcPrice()

const revenueInUSD = computed(() => {
  return formatUSD(satsToUSD(props.stats.totalRevenue))
})

const totalZapCount = computed(() => {
  return props.items.reduce((sum, item) => sum + (item.zapCount || 0), 0)
})

const avgZapSize = computed(() => {
  if (totalZapCount.value === 0) return 0
  return Math.round(props.stats.totalRevenue / totalZapCount.value)
})

const engagementRate = computed(() => {
  if (props.stats.published === 0) return 0
  return (props.engagementTotal / props.stats.published).toFixed(1)
})

const topTag = computed(() => {
  const tagCounts = {}
  props.items
    .filter(item => item.status === 'published' && item.tags?.length)
    .forEach(item => {
      item.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
  return sorted.length > 0 ? sorted[0][0] : '—'
})
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
    <!-- Total Revenue -->
    <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-3 sm:p-4 rounded-xl shadow-lg">
      <div class="flex items-center justify-between mb-2">
        <div class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <IconCurrencyBitcoin class="w-4 h-4" />
        </div>
      </div>
      <p class="text-xs opacity-90 mb-0.5">Total Revenue</p>
      <p class="text-lg sm:text-xl font-bold">{{ stats.totalRevenue.toLocaleString() }}</p>
      <p class="text-xs opacity-75">≈ {{ revenueInUSD }}</p>
    </div>

    <!-- Avg Zap Size -->
    <div class="bg-white/90 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-orange-100/50 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div class="w-8 h-8 bg-gradient-to-r from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
          <IconBolt class="w-4 h-4 text-orange-600" />
        </div>
      </div>
      <p class="text-xs text-gray-600 mb-0.5">Avg Zap Size</p>
      <p class="text-lg sm:text-xl font-bold text-gray-900">{{ avgZapSize.toLocaleString() }}</p>
      <p class="text-xs text-gray-500">sats / zap</p>
    </div>

    <!-- Total Engagement -->
    <div class="bg-white/90 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-orange-100/50 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div class="w-8 h-8 bg-gradient-to-r from-pink-100 to-rose-100 rounded-lg flex items-center justify-center">
          <IconHeart class="w-4 h-4 text-pink-600" />
        </div>
      </div>
      <p class="text-xs text-gray-600 mb-0.5">Engagement</p>
      <p class="text-lg sm:text-xl font-bold text-gray-900">{{ engagementTotal.toLocaleString() }}</p>
      <p class="text-xs text-gray-500">reactions total</p>
    </div>

    <!-- Published Items -->
    <div class="bg-white/90 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-orange-100/50 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div class="w-8 h-8 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
          <IconFileText class="w-4 h-4 text-green-600" />
        </div>
      </div>
      <p class="text-xs text-gray-600 mb-0.5">Published</p>
      <p class="text-lg sm:text-xl font-bold text-gray-900">{{ stats.published }}</p>
      <p class="text-xs text-gray-500">{{ stats.drafts }} drafts</p>
    </div>

    <!-- Engagement Rate -->
    <div class="bg-white/90 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-orange-100/50 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div class="w-8 h-8 bg-gradient-to-r from-purple-100 to-violet-100 rounded-lg flex items-center justify-center">
          <IconTrendingUp class="w-4 h-4 text-purple-600" />
        </div>
      </div>
      <p class="text-xs text-gray-600 mb-0.5">Eng. Rate</p>
      <p class="text-lg sm:text-xl font-bold text-gray-900">{{ engagementRate }}</p>
      <p class="text-xs text-gray-500">per article</p>
    </div>

    <!-- Top Tag -->
    <div class="bg-white/90 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-orange-100/50 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div class="w-8 h-8 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
          <IconHash class="w-4 h-4 text-blue-600" />
        </div>
      </div>
      <p class="text-xs text-gray-600 mb-0.5">Top Tag</p>
      <p class="text-lg sm:text-xl font-bold text-gray-900 truncate">{{ topTag }}</p>
      <p class="text-xs text-gray-500">most used</p>
    </div>
  </div>
</template>
