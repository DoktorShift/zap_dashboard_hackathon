<template>
  <div class="flex-1 min-h-0">
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-start space-x-3">
        <IconAlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <h3 class="text-sm font-medium text-red-800 mb-1">Something went wrong</h3>
          <p class="text-sm text-red-700 mb-3">
            {{ error.message || 'An unexpected error occurred' }}
          </p>
          <p v-if="showInfo && errorInfo" class="text-xs text-red-600/70 mb-3 font-mono">
            {{ errorInfo }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              @click="retry"
              class="px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <IconRefresh class="w-4 h-4" />
              Try again
            </button>
            <button
              @click="reloadPage"
              class="px-3 py-1.5 rounded bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium transition-colors"
            >
              Reload page
            </button>
            <button
              v-if="changePage"
              @click="goToDashboard"
              class="px-3 py-1.5 rounded bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
    <!--
      Keyed wrapper so "Try again" remounts the child tree. Without a
      key bump, the child's setup() doesn't re-run after clearing the
      error ref — stale state survives and the same error is likely
      to fire immediately. Bumping the key forces a fresh mount.
    -->
    <div v-else :key="retryVersion" class="contents">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured, inject, watch } from 'vue'
import { IconAlertTriangle, IconRefresh } from '@iconify-prerendered/vue-tabler'

const error = ref(null)
const errorInfo = ref('')
const retryVersion = ref(0)
const showInfo = ref(false)

const changePage = inject('changePage', null)
const currentPage = inject('currentPage', null)

onErrorCaptured((err, _instance, info) => {
  console.error('[ErrorBoundary] captured:', err?.message, info)
  error.value = err
  errorInfo.value = info || ''
  // Show the Vue error source line when the app is not in production —
  // helps developers; invisible to users in a production build.
  showInfo.value = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || false
  return false // stop propagation to Vue's default warn handler
})

// Auto-clear on navigation so an error on Page A doesn't linger when
// the user moves to Page B.
if (currentPage) {
  watch(currentPage, () => {
    if (error.value) {
      error.value = null
      errorInfo.value = ''
    }
  })
}

/**
 * Clear the error AND bump the retry version so the child tree
 * fully remounts — its setup() re-runs, composables re-initialize,
 * and transient-failure code paths get a real second chance.
 */
const retry = () => {
  error.value = null
  errorInfo.value = ''
  retryVersion.value++
}

/**
 * Hard reload — the nuclear option for errors deep in third-party
 * libraries or anywhere Vue-level remount isn't enough.
 */
const reloadPage = () => {
  try { window.location.reload() } catch { /* SSR, ignore */ }
}

const goToDashboard = () => {
  error.value = null
  errorInfo.value = ''
  changePage?.('dashboard')
}
</script>
