<script setup>
import { ref, computed, watch } from 'vue'
import { IconX, IconCheck, IconLoader, IconPalette } from '@iconify-prerendered/vue-tabler'
import { useNostrCalendarList, CALENDAR_COLORS } from '../composables/useNostrCalendarList.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  calendar: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const { createCalendarList, updateCalendarList, isLoading } = useNostrCalendarList()

// Form state
const formData = ref({
  title: '',
  description: '',
  color: CALENDAR_COLORS[0].value
})

const isEditMode = computed(() => !!props.calendar)

// Define resetForm before it's used in watch
const resetForm = () => {
  formData.value = {
    title: '',
    description: '',
    color: CALENDAR_COLORS[0].value
  }
}

// Watch for calendar changes to populate form
watch(() => props.calendar, (calendar) => {
  if (calendar) {
    formData.value = {
      title: calendar.title,
      description: calendar.description,
      color: calendar.color
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const isFormValid = computed(() => {
  return formData.value.title.trim().length > 0
})

const handleSubmit = async () => {
  if (!isFormValid.value) return

  try {
    if (isEditMode.value) {
      await updateCalendarList(props.calendar.d_tag, formData.value)
    } else {
      await createCalendarList(formData.value)
    }
    handleClose()
  } catch (error) {
    console.error('Failed to save calendar:', error)
  }
}

const handleClose = () => {
  resetForm()
  emit('close')
}

const selectColor = (color) => {
  formData.value.color = color
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-end sm:items-center justify-center z-[10000]"
        @click.self="handleClose"
      >
        <!-- Mobile: Bottom Sheet, Desktop: Center Modal -->
        <div
          class="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="sticky top-0 bg-white/95 backdrop-blur-sm px-6 py-4 border-b border-gray-100/50 flex justify-between items-center rounded-t-3xl sm:rounded-t-2xl z-10">
            <h3 class="text-xl font-bold text-gray-900">
              {{ isEditMode ? 'Edit Calendar' : 'New Calendar' }}
            </h3>
            <button
              @click="handleClose"
              class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <IconX class="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <!-- Form Content -->
          <div class="p-6 space-y-6">
            <!-- Title -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                Calendar Name <span class="text-orange-600">*</span>
              </label>
              <input
                v-model="formData.title"
                type="text"
                placeholder="e.g., Work, Personal, Events"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white text-base placeholder-gray-400"
                maxlength="50"
              />
              <p class="mt-1 text-xs text-gray-500">
                {{ formData.title.length }}/50 characters
              </p>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                v-model="formData.description"
                rows="3"
                placeholder="Describe what this calendar is for..."
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white text-base placeholder-gray-400 resize-none"
                maxlength="200"
              ></textarea>
              <p class="mt-1 text-xs text-gray-500">
                {{ formData.description.length }}/200 characters
              </p>
            </div>

            <!-- Color Picker -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-3">
                <IconPalette class="w-4 h-4 inline mr-1" />
                Calendar Color
              </label>
              <div class="grid grid-cols-4 gap-3">
                <button
                  v-for="color in CALENDAR_COLORS"
                  :key="color.value"
                  @click="selectColor(color.value)"
                  :class="[
                    'h-14 rounded-xl border-2 transition-all duration-200 flex items-center justify-center',
                    formData.color === color.value
                      ? 'border-gray-900 scale-105 shadow-lg'
                      : 'border-transparent hover:border-gray-300 hover:scale-105'
                  ]"
                  :style="{ backgroundColor: color.value }"
                  :title="color.name"
                >
                  <IconCheck
                    v-if="formData.color === color.value"
                    class="w-6 h-6 text-white drop-shadow-lg"
                  />
                </button>
              </div>
              <p class="mt-2 text-xs text-gray-500 text-center">
                {{ CALENDAR_COLORS.find(c => c.value === formData.color)?.name }} selected
              </p>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="sticky bottom-0 bg-white/95 backdrop-blur-sm px-6 py-4 border-t border-gray-100/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 rounded-b-3xl sm:rounded-b-2xl">
            <button
              @click="handleClose"
              class="w-full sm:w-auto px-6 py-3 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleSubmit"
              :disabled="!isFormValid || isLoading"
              class="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-300 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:shadow-none"
            >
              <IconLoader v-if="isLoading" class="w-5 h-5 animate-spin" />
              <IconCheck v-else class="w-5 h-5" />
              {{ isEditMode ? 'Update Calendar' : 'Create Calendar' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.modal-transition-enter-from,
.modal-transition-leave-to {
  opacity: 0;
}

/* Mobile bottom sheet animation */
@media (max-width: 640px) {
  .modal-transition-enter-from .bg-white,
  .modal-transition-leave-to .bg-white {
    transform: translateY(100%);
  }

  .modal-transition-enter-active .bg-white,
  .modal-transition-leave-active .bg-white {
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
}

/* Desktop center modal animation */
@media (min-width: 641px) {
  .modal-transition-enter-from .bg-white,
  .modal-transition-leave-to .bg-white {
    transform: scale(0.9) translateY(-20px);
  }

  .modal-transition-enter-active .bg-white,
  .modal-transition-leave-active .bg-white {
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
}

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
