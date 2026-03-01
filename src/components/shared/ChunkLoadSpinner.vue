<template>
  <div class="min-h-[300px] p-6 animate-pulse">
    <!-- Generic page skeleton for lazy-loaded pages -->
    <div class="space-y-6">
      <!-- Header area -->
      <div class="flex items-center justify-between">
        <div class="h-6 bg-gray-200 rounded w-48"></div>
        <div class="h-9 bg-gray-100 rounded-lg w-28"></div>
      </div>
      <!-- Stat cards row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div class="w-8 h-8 bg-gray-100 rounded-lg mb-3"></div>
          <div class="h-3 bg-gray-200 rounded w-16 mb-1.5"></div>
          <div class="h-6 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
      <!-- Content area -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div class="space-y-4">
          <div v-for="i in 4" :key="i" class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0"></div>
            <div class="flex-1">
              <div class="h-4 bg-gray-200 rounded w-2/3 mb-1.5"></div>
              <div class="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div class="h-5 bg-gray-100 rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
