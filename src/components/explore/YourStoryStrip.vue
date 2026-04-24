<script setup>
import { computed } from 'vue'
import { useMyNostrStory } from '../../composables/explore/useMyNostrStory.js'

const {
  accountAgeDays,
  accountAgeIsPartial,
  biggestZapReceived,
  biggestZapSenderProfile,
  creatorsZappedCount,
  firstZapSentDate,
  isLoading,
} = useMyNostrStory()

const ageCopy = computed(() => {
  if (accountAgeDays.value == null) return null
  const prefix = accountAgeIsPartial.value ? 'At least ' : ''
  const n = accountAgeDays.value
  const noun = n === 1 ? 'day' : 'days'
  return `${prefix}${n.toLocaleString('en-US')} ${noun}`
})

const biggestCopy = computed(() => {
  const bz = biggestZapReceived.value
  if (!bz) return null
  const amount = Number(bz.amount).toLocaleString('en-US')
  const from =
    biggestZapSenderProfile.value?.name ||
    biggestZapSenderProfile.value?.display_name ||
    (bz.fromPubkey || '').slice(0, 8) ||
    'someone'
  return { amount, from }
})

const firstSentCopy = computed(() => {
  if (!firstZapSentDate.value) return null
  return firstZapSentDate.value.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
})

const creatorsCopy = computed(() => {
  if (creatorsZappedCount.value == null) return null
  return Number(creatorsZappedCount.value).toLocaleString('en-US')
})
</script>

<template>
  <section class="py-5">
    <div class="flex items-baseline justify-between mb-3">
      <p class="ep-section-title">Your story</p>
      <span v-if="isLoading" class="ep-eyebrow">loading</span>
    </div>
    <hr class="ep-rule-strong" />

    <dl
      class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x"
      style="border-color: var(--rule);"
    >
      <div class="px-0 md:px-5 py-4 first:pl-0 last:pr-0">
        <dt class="ep-eyebrow">On Nostr for</dt>
        <dd class="ep-display mt-1" style="font-size: 1.875rem;">
          {{ ageCopy ?? '—' }}
        </dd>
      </div>

      <div class="px-0 md:px-5 py-4">
        <dt class="ep-eyebrow">Biggest zap received</dt>
        <dd class="mt-1">
          <template v-if="biggestCopy">
            <span class="ep-display" style="font-size: 1.875rem;">
              {{ biggestCopy.amount }}
            </span>
            <span class="ep-body-muted ml-2" style="font-size: 0.8125rem;">
              sats&nbsp;&middot;&nbsp;from {{ biggestCopy.from }}
            </span>
          </template>
          <span v-else class="ep-display" style="font-size: 1.875rem;">—</span>
        </dd>
      </div>

      <div class="px-0 md:px-5 py-4">
        <dt class="ep-eyebrow">Creators you've zapped</dt>
        <dd class="ep-display mt-1" style="font-size: 1.875rem;">
          {{ creatorsCopy ?? '—' }}
        </dd>
      </div>

      <div class="px-0 md:px-5 py-4 last:pr-0">
        <dt class="ep-eyebrow">First zap sent</dt>
        <dd class="ep-display mt-1" style="font-size: 1.875rem;">
          {{ firstSentCopy ?? '—' }}
        </dd>
      </div>
    </dl>

    <hr class="ep-rule-strong" />
  </section>
</template>
