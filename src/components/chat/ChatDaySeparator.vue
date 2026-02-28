<script setup>
import { computed } from 'vue'

const props = defineProps({
  date: { type: Date, required: true }
})

const label = computed(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const msgDate = new Date(props.date.getFullYear(), props.date.getMonth(), props.date.getDate())

  if (msgDate.getTime() === today.getTime()) return 'Today'
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday'
  return props.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
})
</script>

<template>
  <div class="flex items-center gap-4 my-4 px-4">
    <div class="flex-1 h-px bg-gray-200"></div>
    <span class="text-[11px] text-gray-400 font-medium select-none">{{ label }}</span>
    <div class="flex-1 h-px bg-gray-200"></div>
  </div>
</template>
