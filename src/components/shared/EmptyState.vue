<script setup>
/**
 * EmptyState — single component for the three states every list page
 * needs to distinguish clearly:
 *
 *   loading  — fetch in flight; show a skeleton or spinner
 *   error    — fetch failed; show reason + retry button
 *   empty    — fetch succeeded and returned nothing; show call-to-action
 *
 * Previously pages rendered blank-while-loading, a skeleton during fetch,
 * and a genuine-empty message once done — but the three states looked
 * similar enough that users couldn't tell which one they were in.
 *
 * Pages pass the current state + content via slots/props. The component
 * owns the visual hierarchy so every empty state in the app looks the
 * same.
 */
import { computed } from 'vue'
import {
  IconRefresh,
  IconAlertCircle,
  IconInbox,
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  /** 'loading' | 'error' | 'empty' | 'ready'. 'ready' hides the block. */
  state: { type: String, default: 'ready' },
  /** Shown in the error state. Falls back to a generic message. */
  errorMessage: { type: String, default: '' },
  /** Heading for the empty state. */
  emptyTitle: { type: String, default: 'Nothing here yet' },
  /** Body text for the empty state. */
  emptyHint: { type: String, default: '' },
  /** Optional: label for the primary action button (empty state). */
  actionLabel: { type: String, default: '' },
  /** Icon component override for the empty state. */
  emptyIcon: { type: Object, default: null },
})

const emit = defineEmits(['retry', 'action'])

const showBlock = computed(() => props.state !== 'ready')
const icon = computed(() => {
  if (props.state === 'error') return IconAlertCircle
  return props.emptyIcon || IconInbox
})
</script>

<template>
  <!-- loading: parent owns the skeleton; we just mount nothing so the
       skeleton isn't covered. State exists in the enum so callers don't
       have to special-case. -->
  <template v-if="state === 'loading'">
    <slot name="loading" />
  </template>

  <!-- error / empty: same layout, different copy + icon. -->
  <div
    v-else-if="showBlock"
    class="flex flex-col items-center justify-center text-center px-6 py-10 sm:py-14"
    role="status"
  >
    <div
      :class="[
        'w-12 h-12 rounded-full flex items-center justify-center mb-3',
        state === 'error' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600',
      ]"
    >
      <component :is="icon" class="w-6 h-6" />
    </div>

    <h3 class="text-sm font-semibold text-gray-900 mb-1">
      <template v-if="state === 'error'">Couldn't load</template>
      <template v-else>{{ emptyTitle }}</template>
    </h3>

    <p v-if="state === 'error'" class="text-sm text-gray-600 max-w-sm">
      {{ errorMessage || 'Something went wrong while loading. Try again?' }}
    </p>
    <p v-else-if="emptyHint" class="text-sm text-gray-600 max-w-sm">
      {{ emptyHint }}
    </p>

    <div class="mt-4 flex flex-wrap gap-2 justify-center">
      <button
        v-if="state === 'error'"
        @click="emit('retry')"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors"
      >
        <IconRefresh class="w-4 h-4" />
        Try again
      </button>
      <button
        v-else-if="actionLabel"
        @click="emit('action')"
        class="px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors"
      >
        {{ actionLabel }}
      </button>
    </div>

    <!-- Parents can append context (e.g. link to settings). -->
    <div v-if="$slots.default" class="mt-4 text-sm text-gray-500">
      <slot />
    </div>
  </div>
</template>
