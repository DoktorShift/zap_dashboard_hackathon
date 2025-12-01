<script setup>
import { ref, computed, watch } from 'vue'
import {
  IconWorld,
  IconBolt,
  IconCurrencyBitcoin,
  IconSearch,
  IconX,
  IconMapPin
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  countries: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const searchQuery = ref('')
const selectedCountry = ref(null)
const hoveredCountry = ref(null)

// Filter countries based on search
const filteredCountries = computed(() => {
  if (!searchQuery.value) return props.countries

  const query = searchQuery.value.toLowerCase()
  return props.countries.filter(country => {
    const name = country.name?.en?.toLowerCase() || ''
    const iso = country.iso?.toLowerCase() || ''
    return name.includes(query) || iso.includes(query)
  })
})

// Top countries sorted by node count
const topCountries = computed(() => {
  return [...props.countries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
})

// Get color based on node count
const getNodeCountColor = (count) => {
  if (count > 2000) return 'from-orange-600 to-red-600'
  if (count > 1000) return 'from-orange-500 to-amber-500'
  if (count > 500) return 'from-amber-400 to-yellow-400'
  if (count > 100) return 'from-yellow-300 to-amber-300'
  return 'from-gray-300 to-gray-400'
}

// Get size class based on node count
const getSizeClass = (count) => {
  if (count > 2000) return 'text-2xl'
  if (count > 1000) return 'text-xl'
  if (count > 500) return 'text-lg'
  return 'text-base'
}

// Format capacity
const formatCapacity = (capacity) => {
  const sats = parseInt(capacity)
  if (sats >= 1000000000) {
    return (sats / 1000000000).toFixed(1) + 'B'
  }
  if (sats >= 1000000) {
    return (sats / 1000000).toFixed(1) + 'M'
  }
  if (sats >= 1000) {
    return (sats / 1000).toFixed(1) + 'K'
  }
  return sats
}

const selectCountry = (country) => {
  selectedCountry.value = country
}

const closeDetail = () => {
  selectedCountry.value = null
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h3 class="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <IconWorld class="w-7 h-7 text-orange-600" />
          <span>Lightning Network Global Map</span>
        </h3>
        <p class="text-gray-600 mt-1">Explore nodes and capacity distribution worldwide</p>
      </div>

      <!-- Search -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search countries..."
          class="w-full sm:w-64 pl-10 pr-10 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
        />
        <IconSearch class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        >
          <IconX class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="bg-white rounded-xl p-12 text-center border border-orange-100">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
      <p class="text-gray-600">Loading Lightning Network data...</p>
    </div>

    <!-- Map View -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- World Heatmap (Visual Representation) -->
      <div class="lg:col-span-2 bg-white rounded-xl p-6 border border-orange-100 shadow-sm">
        <div class="mb-4">
          <h4 class="text-lg font-semibold text-gray-900 mb-2">Node Distribution Heatmap</h4>
          <p class="text-sm text-gray-600">Larger flags indicate more Lightning nodes</p>
        </div>

        <!-- Visual Grid Map -->
        <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-8 min-h-[400px] border-2 border-blue-100 relative overflow-hidden">
          <!-- Decorative Grid -->
          <div class="absolute inset-0 opacity-20">
            <div class="grid grid-cols-8 grid-rows-6 h-full gap-1">
              <div v-for="i in 48" :key="i" class="border border-blue-200"></div>
            </div>
          </div>

          <!-- Top Countries as Positioned Elements -->
          <div class="relative h-full flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <div
              v-for="(country, index) in topCountries.slice(0, 12)"
              :key="country.iso"
              @click="selectCountry(country)"
              @mouseenter="hoveredCountry = country"
              @mouseleave="hoveredCountry = null"
              class="flex flex-col items-center justify-center cursor-pointer transform hover:scale-125 transition-all duration-300 group"
              :class="getSizeClass(country.count)"
            >
              <div class="relative">
                <div
                  class="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-3xl sm:text-4xl shadow-lg group-hover:shadow-2xl transition-all duration-300 bg-gradient-to-br"
                  :class="getNodeCountColor(country.count)"
                >
                  <span class="drop-shadow-lg">{{ country.flagEmoji }}</span>
                </div>
                <!-- Node count badge -->
                <div class="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                  {{ country.count }}
                </div>
              </div>
              <div class="mt-2 text-center">
                <div class="text-xs font-semibold text-gray-700 group-hover:text-orange-600 transition-colors">
                  {{ country.name?.en || country.iso }}
                </div>
              </div>

              <!-- Hover Tooltip -->
              <div
                v-if="hoveredCountry === country"
                class="absolute top-full mt-2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl z-10 min-w-[200px]"
              >
                <div class="font-semibold mb-1">{{ country.name?.en }}</div>
                <div class="space-y-1 text-gray-300">
                  <div>Nodes: {{ country.count.toLocaleString() }}</div>
                  <div>Share: {{ country.share.toFixed(1) }}%</div>
                  <div>Capacity: {{ formatCapacity(country.capacity) }} sats</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="mt-4 flex flex-wrap items-center gap-4 text-xs">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-orange-600 to-red-600"></div>
            <span class="text-gray-600">2000+ nodes</span>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500"></div>
            <span class="text-gray-600">1000-2000 nodes</span>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-400"></div>
            <span class="text-gray-600">500-1000 nodes</span>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-amber-300"></div>
            <span class="text-gray-600">100-500 nodes</span>
          </div>
        </div>
      </div>

      <!-- Country List -->
      <div class="bg-white rounded-xl p-6 border border-orange-100 shadow-sm">
        <h4 class="text-lg font-semibold text-gray-900 mb-4">
          {{ searchQuery ? 'Search Results' : 'All Countries' }}
          <span class="text-sm font-normal text-gray-500 ml-2">
            ({{ filteredCountries.length }})
          </span>
        </h4>

        <div class="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          <button
            v-for="country in filteredCountries"
            :key="country.iso"
            @click="selectCountry(country)"
            class="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 text-left"
            :class="selectedCountry?.iso === country.iso ? 'bg-orange-50 border-orange-300' : ''"
          >
            <div class="flex items-center space-x-3 flex-1 min-w-0">
              <span class="text-2xl">{{ country.flagEmoji }}</span>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate text-sm">
                  {{ country.name?.en || country.iso }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ country.count }} nodes • {{ country.share.toFixed(1) }}%
                </div>
              </div>
            </div>
            <IconMapPin class="w-4 h-4 text-orange-500 flex-shrink-0" />
          </button>

          <div v-if="filteredCountries.length === 0" class="text-center py-8 text-gray-500">
            <IconSearch class="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No countries found</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Country Detail Modal -->
    <Teleport to="body">
      <transition name="modal">
        <div
          v-if="selectedCountry"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          @click.self="closeDetail"
        >
          <div class="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl transform animate-scale-in">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center space-x-3">
                <span class="text-5xl">{{ selectedCountry.flagEmoji }}</span>
                <div>
                  <h3 class="text-2xl font-bold text-gray-900">
                    {{ selectedCountry.name?.en || selectedCountry.iso }}
                  </h3>
                  <p class="text-sm text-gray-500">{{ selectedCountry.iso }}</p>
                </div>
              </div>
              <button
                @click="closeDetail"
                class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <!-- Node Count -->
              <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                <div class="flex items-center space-x-2 mb-2">
                  <IconBolt class="w-5 h-5 text-orange-600" />
                  <span class="text-sm font-medium text-gray-700">Lightning Nodes</span>
                </div>
                <div class="text-3xl font-bold text-gray-900">
                  {{ selectedCountry.count.toLocaleString() }}
                </div>
                <div class="text-sm text-gray-600 mt-1">
                  {{ selectedCountry.share.toFixed(2) }}% of global network
                </div>
              </div>

              <!-- Capacity -->
              <div class="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200">
                <div class="flex items-center space-x-2 mb-2">
                  <IconCurrencyBitcoin class="w-5 h-5 text-amber-600" />
                  <span class="text-sm font-medium text-gray-700">Total Capacity</span>
                </div>
                <div class="text-2xl font-bold text-gray-900">
                  {{ formatCapacity(selectedCountry.capacity) }} sats
                </div>
                <div class="text-sm text-gray-600 mt-1">
                  ~{{ (parseInt(selectedCountry.capacity) / 100000000).toFixed(2) }} BTC
                </div>
              </div>

              <!-- Stats Grid -->
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div class="text-xs text-gray-600 mb-1">Avg Capacity/Node</div>
                  <div class="text-lg font-semibold text-gray-900">
                    {{ formatCapacity(parseInt(selectedCountry.capacity) / selectedCountry.count) }}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div class="text-xs text-gray-600 mb-1">Global Rank</div>
                  <div class="text-lg font-semibold text-gray-900">
                    #{{ topCountries.findIndex(c => c.iso === selectedCountry.iso) + 1 }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

@keyframes scale-in {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #fb923c;
  border-radius: 10px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #f97316;
}
</style>
