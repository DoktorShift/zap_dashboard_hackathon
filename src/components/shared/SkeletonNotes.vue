<template>
  <div class="space-y-6 animate-pulse">
    <!-- Stat Cards Skeleton -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Revenue card -->
      <div class="bg-gradient-to-r from-orange-400 to-amber-400 p-6 rounded-xl shadow-lg">
        <div class="h-4 bg-white/30 rounded w-24 mb-2"></div>
        <div class="h-8 bg-white/30 rounded w-40 mb-1"></div>
        <div class="h-3 bg-white/20 rounded w-20"></div>
      </div>
      <!-- 3 white stat cards -->
      <div v-for="i in 3" :key="i" class="bg-white p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="h-4 bg-gray-200 rounded w-20 mb-2"></div>
        <div class="h-8 bg-gray-200 rounded w-16 mb-1"></div>
        <div v-if="i === 3" class="flex gap-2 mt-1">
          <div class="h-3 bg-gray-100 rounded w-8" v-for="j in 4" :key="j"></div>
        </div>
      </div>
    </div>

    <!-- Notes List Skeleton -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <div class="divide-y divide-gray-100">
        <div v-for="i in 5" :key="i" class="p-5">
          <div class="flex items-start gap-3">
            <!-- Avatar -->
            <div class="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <!-- Name + time -->
              <div class="flex items-center gap-2 mb-2">
                <div class="h-4 bg-gray-200 rounded w-28"></div>
                <div class="h-3 bg-gray-100 rounded w-14"></div>
                <div class="h-4 bg-purple-100 rounded-full w-14"></div>
              </div>
              <!-- Content lines -->
              <div class="space-y-1.5 mb-3">
                <div class="h-4 bg-gray-100 rounded w-full"></div>
                <div class="h-4 bg-gray-100 rounded w-5/6"></div>
                <div class="h-4 bg-gray-100 rounded w-2/3"></div>
              </div>
              <!-- Hashtags -->
              <div class="flex gap-1.5 mb-3">
                <div class="h-5 bg-orange-50 rounded-full w-16"></div>
                <div class="h-5 bg-orange-50 rounded-full w-20"></div>
              </div>
              <!-- Engagement row -->
              <div class="flex gap-4">
                <div class="h-4 bg-gray-100 rounded w-10" v-for="j in 4" :key="j"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
