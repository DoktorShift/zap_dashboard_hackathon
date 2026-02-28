<script setup>
import { computed } from 'vue'
import { IconUser } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  message: { type: Object, required: true },
  isOutgoing: { type: Boolean, default: false },
  showAvatar: { type: Boolean, default: false },
  avatarUrl: { type: String, default: null }
})

const formattedTime = computed(() => {
  const date = new Date(props.message.timestamp)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
})
</script>

<template>
  <div :class="['flex gap-2 mb-1', isOutgoing ? 'justify-end' : 'justify-start']">
    <!-- Avatar (received only) -->
    <div v-if="!isOutgoing" class="w-7 flex-shrink-0 self-end">
      <div v-if="showAvatar" class="w-7 h-7 rounded-full overflow-hidden">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          class="w-full h-full object-cover"
          @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
        />
        <div
          class="w-full h-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center"
          :style="{ display: avatarUrl ? 'none' : 'flex' }"
        >
          <IconUser class="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    </div>

    <div class="max-w-[70%]">
      <div
        :class="[
          'px-3 py-2 text-sm leading-relaxed break-words',
          isOutgoing
            ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-2xl rounded-br-md'
            : 'bg-white border border-gray-100 text-gray-900 rounded-2xl rounded-bl-md shadow-sm'
        ]"
      >
        {{ message.content }}
      </div>
      <div :class="['text-[10px] mt-0.5 px-1', isOutgoing ? 'text-right text-gray-400' : 'text-gray-400']">
        {{ formattedTime }}
      </div>
    </div>
  </div>
</template>
