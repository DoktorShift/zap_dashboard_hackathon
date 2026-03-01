<script setup>
const handleReload = () => {
  window.location.reload()
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[300px] p-6">
    <div class="text-center max-w-sm">
      <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-100 flex items-center justify-center">
        <svg class="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-1">Page failed to load</h3>
      <p class="text-sm text-gray-500 mb-5 leading-relaxed">
        A new version may be available. Reload to get the latest update.
      </p>
      <button
        @click="handleReload"
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Reload page
      </button>
    </div>
  </div>
</template>
