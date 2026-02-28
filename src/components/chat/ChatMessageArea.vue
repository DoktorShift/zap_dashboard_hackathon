<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import ChatMessageBubble from './ChatMessageBubble.vue'
import ChatDaySeparator from './ChatDaySeparator.vue'
import ChatEmptyState from './ChatEmptyState.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  currentUserPubkey: { type: String, default: '' },
  conversationProfile: { type: Object, default: null }
})

const containerRef = ref(null)

// Group messages by day and determine avatar visibility
const groupedItems = computed(() => {
  const items = []
  let currentDay = null

  for (let i = 0; i < props.messages.length; i++) {
    const msg = props.messages[i]
    const msgDate = new Date(msg.timestamp)
    const msgDay = msgDate.toDateString()

    // Insert day separator
    if (msgDay !== currentDay) {
      items.push({ type: 'separator', date: msgDate, key: 'sep-' + msgDay })
      currentDay = msgDay
    }

    // Show avatar on first message or when sender changes
    const isOutgoing = msg.sender === props.currentUserPubkey
    const prevMsg = i > 0 ? props.messages[i - 1] : null
    const nextMsg = i < props.messages.length - 1 ? props.messages[i + 1] : null
    const isLastInGroup = !nextMsg || nextMsg.sender !== msg.sender ||
      new Date(nextMsg.timestamp).toDateString() !== msgDay

    items.push({
      type: 'message',
      data: msg,
      isOutgoing,
      showAvatar: !isOutgoing && isLastInGroup,
      key: msg.id
    })
  }
  return items
})

const scrollToBottom = (smooth = false) => {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTo({
        top: containerRef.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      })
    }
  })
}

// Scroll on new messages
watch(() => props.messages.length, () => {
  scrollToBottom(true)
})

onMounted(() => {
  scrollToBottom()
})

defineExpose({ scrollToBottom })
</script>

<template>
  <div ref="containerRef" class="flex-1 overflow-y-auto px-3 py-2 sm:px-4 scrollbar-thin">
    <ChatEmptyState v-if="messages.length === 0" type="no-messages" />
    <template v-else>
      <template v-for="item in groupedItems" :key="item.key">
        <ChatDaySeparator v-if="item.type === 'separator'" :date="item.date" />
        <ChatMessageBubble
          v-else
          :message="item.data"
          :is-outgoing="item.isOutgoing"
          :show-avatar="item.showAvatar"
          :avatar-url="conversationProfile?.picture"
        />
      </template>
    </template>
  </div>
</template>
