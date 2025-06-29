<script setup>
import { IconFileText, IconChartBar } from '@iconify-prerendered/vue-tabler'
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
        <IconFileText class="w-6 h-6 text-orange-600" />
        <span>Content</span>
      </h1>
      <p class="text-gray-600">Manage and analyze your content performance</p>
    </div>
    
    <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div class="text-6xl mb-4">
        <IconFileText class="w-16 h-16 mx-auto text-gray-300" />
      </div>
      <h3 class="text-xl font-semibold text-gray-900 mb-2">Content Management</h3>
      <p class="text-gray-600 mb-6">Track which content gets the most zaps and engagement.</p>
      <button class="btn-primary">
        <IconChartBar class="w-4 h-4" />
        View Analytics
      </button>
    </div>
  </div>
</template>