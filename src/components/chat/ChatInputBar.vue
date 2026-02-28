<script setup>
import { ref, nextTick, watch } from 'vue'
import { IconSend, IconLoader } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  sending: { type: Boolean, default: false }
})

const emit = defineEmits(['send'])

const content = ref('')
const inputRef = ref(null)

const handleSend = () => {
  if (!content.value.trim() || props.disabled || props.sending) return
  emit('send', content.value)
  content.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// Auto-resize textarea
watch(content, () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 120) + 'px'
    }
  })
})

const focus = () => {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="px-3 py-3 sm:px-4 border-t border-gray-100 bg-white flex-shrink-0">
    <div class="flex items-end gap-2">
      <div class="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 transition-colors focus-within:border-orange-300 focus-within:bg-white">
        <textarea
          ref="inputRef"
          v-model="content"
          @keydown="handleKeydown"
          placeholder="Message..."
          rows="1"
          class="w-full bg-transparent resize-none text-sm outline-none leading-relaxed max-h-[120px]"
          :disabled="disabled || sending"
        ></textarea>
      </div>
      <button
        @click="handleSend"
        :disabled="!content.trim() || disabled || sending"
        class="w-9 h-9 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:shadow-md transition-all active:scale-95"
        title="Send message"
      >
        <IconLoader v-if="sending" class="w-4 h-4 animate-spin" />
        <IconSend v-else class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
