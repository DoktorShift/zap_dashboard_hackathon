<script setup>
import { IconChartBar, IconClock, IconBook, IconChartLine, IconRefresh } from '@iconify-prerendered/vue-tabler'
import Analytics from '../components/Analytics.vue'
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
        <IconChartBar class="w-6 h-6 text-orange-600" />
        <span>Analytics</span>
      </h1>
      <p class="text-gray-600">Deep insights into your zap performance</p>
    </div>
    
    <Analytics />
  </div>
</template>