<script setup>
import { inject } from 'vue'
import '../assets/explore-theme.css'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'

import ExploreMasthead from '../components/explore/ExploreMasthead.vue'
import ZapsTodayHeadline from '../components/explore/ZapsTodayHeadline.vue'
import ZapWire from '../components/explore/ZapWire.vue'
import YourStoryStrip from '../components/explore/YourStoryStrip.vue'
import TopZappersSection from '../components/explore/TopZappersSection.vue'
import TopCreatorsSection from '../components/explore/TopCreatorsSection.vue'
import TrendingRail from '../components/explore/TrendingRail.vue'

const emit = defineEmits(['trigger-login', 'show-help'])

// Matches the injection pattern used elsewhere in the app.
const injectedAuth = inject('isAuthenticated', null)
const { isAuthenticated: localAuth, isLoading: isLoginLoading } = useNostrAuth()
// Fall back to the composable if provide/inject isn't set up in a test harness.
const isAuthenticated = injectedAuth ?? localAuth
</script>

<template>
  <article class="explore-paper min-h-full pb-16">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div class="ep-reveal" style="--ep-delay: 0ms;">
        <ExploreMasthead />
      </div>

      <!-- Headline + Zap Wire: two-column on md+, stacked on small -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-x-10 gap-y-6 mt-4">
        <div class="md:col-span-3 ep-reveal" style="--ep-delay: 60ms;">
          <ZapsTodayHeadline
            :show-connect-cta="!isAuthenticated"
            :is-login-loading="isLoginLoading"
            @connect="emit('trigger-login')"
          />
        </div>
        <div class="md:col-span-2 ep-reveal" style="--ep-delay: 120ms;">
          <ZapWire />
        </div>
      </div>

      <div v-if="isAuthenticated" class="mt-6 ep-reveal" style="--ep-delay: 180ms;">
        <YourStoryStrip />
      </div>

      <!-- Leaderboards: two-column on md+, stacked on small -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 mt-10">
        <div class="ep-reveal" style="--ep-delay: 220ms;">
          <TopZappersSection />
        </div>
        <div class="ep-reveal" style="--ep-delay: 260ms;">
          <TopCreatorsSection />
        </div>
      </div>

      <hr class="ep-rule-strong mt-10" />

      <div class="ep-reveal" style="--ep-delay: 320ms;">
        <TrendingRail />
      </div>

      <!-- Footer -->
      <footer class="pt-10 pb-6">
        <hr class="ep-rule" />
        <div class="flex items-baseline justify-between pt-4">
          <span class="ep-eyebrow">Everything on this page is live from your relays.</span>
          <button
            v-if="!isAuthenticated"
            type="button"
            class="ep-body-muted underline underline-offset-4 decoration-dotted"
            style="font-size: 0.875rem;"
            @click="emit('show-help')"
          >
            How it works
          </button>
        </div>
      </footer>
    </div>
  </article>
</template>
