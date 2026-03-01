<template>
  <div class="space-y-6 animate-pulse">
    <!-- ContentStats Skeleton (6 cards) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <!-- Revenue gradient card -->
      <div class="bg-gradient-to-r from-orange-400 to-amber-400 p-3 sm:p-4 rounded-xl shadow-lg">
        <div class="w-8 h-8 bg-white/20 rounded-lg mb-2"></div>
        <div class="h-3 bg-white/30 rounded w-20 mb-1"></div>
        <div class="h-6 bg-white/30 rounded w-24 mb-1"></div>
        <div class="h-3 bg-white/20 rounded w-16"></div>
      </div>
      <!-- 5 white stat cards -->
      <div v-for="i in 5" :key="i" class="bg-white/90 p-3 sm:p-4 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="w-8 h-8 bg-gray-100 rounded-lg mb-2"></div>
        <div class="h-3 bg-gray-200 rounded w-16 mb-1"></div>
        <div class="h-6 bg-gray-200 rounded w-12 mb-1"></div>
        <div class="h-3 bg-gray-100 rounded w-14"></div>
      </div>
    </div>

    <!-- Tab + Content List Skeleton -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <!-- Tab bar -->
      <div class="border-b border-orange-100/50 px-6 py-4">
        <div class="h-5 bg-gray-200 rounded w-32"></div>
      </div>
      <!-- Content items -->
      <div class="p-6 space-y-4">
        <div v-for="i in 4" :key="i" class="flex items-start gap-4 p-4 bg-gray-50/50 rounded-xl">
          <!-- Cover image placeholder -->
          <div class="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>
          <div class="flex-1 min-w-0">
            <!-- Title -->
            <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
            <!-- Description -->
            <div class="h-3 bg-gray-100 rounded w-full mb-1"></div>
            <div class="h-3 bg-gray-100 rounded w-2/3 mb-3"></div>
            <!-- Tags + meta -->
            <div class="flex gap-2">
              <div class="h-4 bg-orange-50 rounded-full w-14"></div>
              <div class="h-4 bg-orange-50 rounded-full w-18"></div>
              <div class="h-4 bg-gray-100 rounded w-20 ml-auto"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
