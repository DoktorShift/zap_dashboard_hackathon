<template>
  <div class="space-y-6 animate-pulse">
    <!-- Stat Bar Skeleton -->
    <div class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 p-4 sm:p-5 rounded-xl shadow-lg">
      <div class="flex flex-wrap gap-6 sm:gap-10">
        <div v-for="i in 4" :key="i">
          <div class="h-3 bg-white/30 rounded w-16 mb-1.5"></div>
          <div class="h-7 bg-white/30 rounded w-20"></div>
        </div>
      </div>
    </div>

    <!-- Charts Grid Skeleton -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div v-for="i in 2" :key="i" class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="h-5 bg-gray-200 rounded w-36 mb-6"></div>
        <div class="h-64 bg-gray-50 rounded-lg flex items-end justify-center gap-2 p-4">
          <!-- Fake bar chart bars -->
          <div v-for="j in 7" :key="j"
            class="bg-gray-200 rounded-t"
            :style="{ width: '28px', height: (20 + Math.random() * 60) + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Full Width Chart Skeleton -->
    <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
      <div class="h-5 bg-gray-200 rounded w-44 mb-6"></div>
      <div class="h-56 bg-gray-50 rounded-lg flex items-end justify-center gap-3 p-4">
        <div v-for="j in 10" :key="j"
          class="bg-gray-200 rounded-t"
          :style="{ width: '24px', height: (15 + Math.random() * 65) + '%' }"
        ></div>
      </div>
    </div>
  </div>
</template>
