<script setup>
import { computed } from 'vue'
import { useNetworkZapActivity } from '../../composables/explore/useNetworkZapActivity.js'

defineProps({
  showConnectCta: { type: Boolean, default: false },
  isLoginLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['connect'])

const { last24hTotal, isLoading } = useNetworkZapActivity()

const formatted = computed(() => Number(last24hTotal.value || 0).toLocaleString('en-US'))
</script>

<template>
  <section class="py-6 md:py-10">
    <p class="ep-eyebrow">Today on the network</p>
    <div class="mt-4 md:mt-6">
      <span
        class="ep-display block"
        style="font-size: clamp(3rem, 10vw, 7.5rem);"
      >{{ formatted }}</span>
      <p class="ep-body mt-3" style="font-size: 1.125rem;">
        sats zapped across Nostr in the last twenty-four hours.
      </p>
      <p v-if="isLoading && last24hTotal === 0" class="ep-body-muted mt-2" style="font-size: 0.875rem;">
        Counting from your relays&hellip;
      </p>
    </div>

    <div v-if="showConnectCta" class="mt-8 flex items-center gap-4 flex-wrap">
      <button
        type="button"
        class="ep-cta"
        :disabled="isLoginLoading"
        @click="emit('connect')"
      >
        {{ isLoginLoading ? 'Connecting' : 'Connect with Nostr' }}
      </button>
      <span class="ep-body-muted" style="font-size: 0.875rem;">
        Reading the wire is free. Joining takes a browser extension.
      </span>
    </div>
  </section>
</template>
