<script setup>
import { inject } from 'vue'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import MediaLibrary from '../components/media/MediaLibrary.vue'
import { IconPhoto } from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const { isAuthenticated } = useNostrAuth()
</script>

<template>
  <div class="media-page">
    <MediaLibrary v-if="isAuthenticated" />
    <div v-else class="media-auth-prompt">
      <IconPhoto class="auth-prompt-icon" />
      <h3>Sign in to manage your media</h3>
      <p>Connect your Nostr extension to upload and manage files on Blossom servers.</p>
    </div>
  </div>
</template>

<style scoped>
.media-page {
  padding: 0;
}

.media-auth-prompt {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--color-text-muted);
}

.auth-prompt-icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
  color: var(--color-text-subtle);
}

.media-auth-prompt h3 {
  margin: 0 0 0.5rem;
  color: var(--color-text);
}

.media-auth-prompt p {
  margin: 0;
  font-size: 0.875rem;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}
</style>
