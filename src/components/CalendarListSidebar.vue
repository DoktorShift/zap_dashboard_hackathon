<script setup>
import { ref } from 'vue'
import {
  IconPlus,
  IconCheck,
  IconEdit,
  IconTrash,
  IconStar,
  IconStarFilled,
  IconChevronDown,
  IconChevronRight,
  IconCalendar
} from '@iconify-prerendered/vue-tabler'
import { useNostrCalendarList } from '../composables/useNostrCalendarList.js'

const emit = defineEmits(['create-calendar', 'edit-calendar'])

const {
  calendarLists,
  isCalendarSelected,
  toggleCalendarSelection,
  defaultCalendarId,
  setDefaultCalendar,
  deleteCalendarList
} = useNostrCalendarList()

const isExpanded = ref(true)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const handleToggle = (d_tag) => {
  toggleCalendarSelection(d_tag)
}

const handleSetDefault = (d_tag) => {
  setDefaultCalendar(d_tag)
}

const handleEdit = (calendar) => {
  emit('edit-calendar', calendar)
}

const handleDelete = async (calendar) => {
  if (confirm(`Delete "${calendar.title}"? This will not delete the events in it.`)) {
    try {
      await deleteCalendarList(calendar.d_tag)
    } catch (error) {
      console.error('Failed to delete calendar:', error)
    }
  }
}

const handleCreateNew = () => {
  emit('create-calendar')
}
</script>

<template>
  <div class="h-full bg-white/90 backdrop-blur-sm border-r border-gray-200/50 flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200/50">
      <div class="flex items-center justify-between mb-3">
        <button
          @click="toggleExpand"
          class="flex items-center gap-2 text-gray-900 font-semibold text-sm hover:text-orange-600 transition-colors"
        >
          <component :is="isExpanded ? IconChevronDown : IconChevronRight" class="w-4 h-4" />
          <span>My Calendars</span>
          <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {{ calendarLists.length }}
          </span>
        </button>
      </div>

      <button
        @click="handleCreateNew"
        class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
      >
        <IconPlus class="w-4 h-4" />
        New Calendar
      </button>
    </div>

    <!-- Calendar List -->
    <div v-if="isExpanded" class="flex-1 overflow-y-auto p-2">
      <div v-if="calendarLists.length === 0" class="p-6 text-center">
        <IconCalendar class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p class="text-sm text-gray-500">No calendars yet</p>
        <p class="text-xs text-gray-400 mt-1">Create your first calendar to get started</p>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="calendar in calendarLists"
          :key="calendar.d_tag"
          class="group relative"
        >
          <div
            class="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <!-- Checkbox -->
            <label class="flex items-center gap-3 flex-1 cursor-pointer">
              <input
                type="checkbox"
                :checked="isCalendarSelected(calendar.d_tag)"
                @change="handleToggle(calendar.d_tag)"
                class="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 focus:ring-2 cursor-pointer"
              />

              <!-- Color indicator -->
              <div
                class="w-3 h-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: calendar.color }"
              ></div>

              <!-- Calendar info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-medium text-gray-900 truncate">
                    {{ calendar.title }}
                  </span>
                  <component
                    :is="defaultCalendarId === calendar.d_tag ? IconStarFilled : IconStar"
                    @click.prevent="handleSetDefault(calendar.d_tag)"
                    :class="[
                      'w-3.5 h-3.5 flex-shrink-0 cursor-pointer transition-colors',
                      defaultCalendarId === calendar.d_tag
                        ? 'text-yellow-500'
                        : 'text-gray-300 hover:text-yellow-400'
                    ]"
                    :title="defaultCalendarId === calendar.d_tag ? 'Default calendar' : 'Set as default'"
                  />
                </div>
                <span class="text-xs text-gray-500">
                  {{ calendar.event_count || 0 }} events
                </span>
              </div>
            </label>

            <!-- Action buttons (show on hover) -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="handleEdit(calendar)"
                class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                title="Edit calendar"
              >
                <IconEdit class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleDelete(calendar)"
                class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors"
                title="Delete calendar"
              >
                <IconTrash class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Description tooltip on hover -->
          <div
            v-if="calendar.description"
            class="hidden group-hover:block absolute left-full ml-2 top-0 z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs whitespace-normal"
          >
            {{ calendar.description }}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer info -->
    <div v-if="isExpanded && calendarLists.length > 0" class="p-3 border-t border-gray-200/50">
      <p class="text-xs text-gray-500 text-center">
        {{ calendarLists.filter(c => isCalendarSelected(c.d_tag)).length }} of {{ calendarLists.length }} visible
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}
</style>
