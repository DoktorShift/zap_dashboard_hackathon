<template>
  <div class="media-filters">
    <!-- Type filter chips -->
    <div class="filter-chips">
      <button
        v-for="chip in chips"
        :key="chip.value"
        class="filter-chip"
        :class="{ 'filter-chip--active': mediaState.filterType.value === chip.value }"
        @click="mediaState.filterType.value = chip.value"
      >
        <component :is="chip.icon" class="filter-chip-icon" />
        <span class="filter-chip-count">{{ chip.count }}</span>
        <span class="filter-chip-label">{{ chip.label }}</span>
      </button>
    </div>

    <!-- Sort control -->
    <div class="sort-control">
      <IconSortDescending class="sort-icon" />
      <select v-model="mediaState.sortBy.value" class="sort-select">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="largest">Largest</option>
        <option value="smallest">Smallest</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMediaState } from '../../composables/media/useMediaState.js'
import {
  IconLayoutGrid,
  IconPhoto,
  IconPlayerPlay,
  IconMusic,
  IconSortDescending
} from '@iconify-prerendered/vue-tabler'

const mediaState = useMediaState()

const chips = computed(() => [
  { value: 'all', icon: IconLayoutGrid, label: 'All', count: mediaState.fileCount.value },
  { value: 'image', icon: IconPhoto, label: 'Images', count: mediaState.imageCount.value },
  { value: 'video', icon: IconPlayerPlay, label: 'Video', count: mediaState.videoCount.value },
  { value: 'audio', icon: IconMusic, label: 'Audio', count: mediaState.audioCount.value }
])
</script>

<style scoped>
.media-filters {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.filter-chips {
  display: flex;
  gap: 0.25rem;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0.3125rem 0.625rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  color: #9ca3af;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-chip:hover {
  color: #6b7280;
  background: #f9fafb;
}

.filter-chip--active {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #ea580c;
}

.filter-chip--active:hover {
  background: #fff7ed;
  color: #ea580c;
}

.filter-chip-icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.filter-chip-count {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.filter-chip-label {
  display: inline;
}

/* Sort */
.sort-control {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  color: #9ca3af;
  transition: all 0.15s ease;
}

.sort-control:hover {
  background: #f9fafb;
}

.sort-icon {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
}

.sort-select {
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 0.8125rem;
  cursor: pointer;
  outline: none;
  padding: 0.1875rem 0;
}

.sort-select option {
  background: white;
  color: #111827;
}

/* Mobile */
@media (max-width: 480px) {
  .filter-chip-label {
    display: none;
  }

  .filter-chip {
    padding: 0.375rem 0.5rem;
    min-height: 2rem;
  }
}
</style>
