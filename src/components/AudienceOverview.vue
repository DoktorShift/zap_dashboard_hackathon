<script setup>
import { computed } from 'vue'
import {
  IconUsers,
  IconList,
  IconUserPlus,
  IconSearch,
  IconBolt,
  IconShield,
  IconGlobe,
  IconArrowRight,
  IconTarget,
  IconHeart,
  IconStar
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useAudience } from '../composables/useAudience.js'

const emit = defineEmits(['create-list', 'switch-tab'])

const { userProfile } = useNostrAuth()
const { getFollowingCount, getFollowersCount, myLists } = useAudience()

// Quick start actions
const quickStartActions = [
  {
    id: 'create-first-list',
    title: 'Create Your First List',
    description: 'Organize people you follow into themed lists',
    icon: IconList,
    color: 'from-orange-400 to-amber-400',
    action: () => emit('create-list')
  },
  {
    id: 'view-following',
    title: 'Manage Following',
    description: 'See and organize who you follow',
    icon: IconUsers,
    color: 'from-green-400 to-emerald-400',
    action: () => emit('switch-tab', 'following')
  }
]

// Stats
const stats = computed(() => [
  {
    label: 'Following',
    value: getFollowingCount(),
    icon: IconUserPlus,
    color: 'text-orange-600 bg-orange-100'
  },
  {
    label: 'Followers',
    value: getFollowersCount(),
    icon: IconUsers,
    color: 'text-blue-600 bg-blue-100'
  },
  {
    label: 'My Lists',
    value: myLists.value.length,
    icon: IconList,
    color: 'text-green-600 bg-green-100'
  }
])
</script>

<template>
  <div class="space-y-8">
    <!-- Welcome Section -->
    <div class="text-center">
      <div class="w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
        <IconUsers class="w-8 h-8 text-white" />
      </div>
      <h2 class="text-2xl font-bold text-gray-900 mb-3">
        Welcome to Your Audience, {{ userProfile?.name || 'Creator' }}!
      </h2>
      <p class="text-gray-600 max-w-2xl mx-auto leading-relaxed">
        Manage your Nostr network with ease. Create follow lists, discover new people, 
        and organize your social connections in a decentralized way.
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all duration-200 p-6 text-center"
      >
        <div :class="['w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3', stat.color]">
          <component :is="stat.icon" class="w-6 h-6" />
        </div>
        <div class="text-2xl font-bold text-gray-900 mb-1">{{ stat.value.toLocaleString() }}</div>
        <div class="text-sm text-gray-600">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Quick Start Actions -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <IconTarget class="w-5 h-5 text-orange-600" />
        <span>Quick Start</span>
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          v-for="action in quickStartActions"
          :key="action.id"
          @click="action.action"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-6 text-left group transform hover:-translate-y-1"
        >
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-r', action.color]">
            <component :is="action.icon" class="w-6 h-6 text-white" />
          </div>
          <h4 class="font-semibold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
            {{ action.title }}
          </h4>
          <p class="text-sm text-gray-600 mb-3">{{ action.description }}</p>
          <div class="flex items-center text-orange-600 text-sm font-medium">
            <span>Get started</span>
            <IconArrowRight class="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </div>
    </div>

    <!-- Nostr Explainer -->
    <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
      <div class="flex items-start space-x-4">
        <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <IconShield class="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h4 class="font-semibold text-purple-900 mb-2">Your Keys, Your Network</h4>
          <p class="text-purple-800 text-sm leading-relaxed mb-3">
            Unlike traditional social media, your Nostr identity and connections are owned by you. 
            Follow lists are published to relays you choose, and you can take your network anywhere.
          </p>
          <div class="flex flex-wrap gap-2">
            <span class="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              <IconBolt class="w-3 h-3 mr-1" />
              Decentralized
            </span>
            <span class="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              <IconShield class="w-3 h-3 mr-1" />
              Self-custodial
            </span>
            <span class="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              <IconGlobe class="w-3 h-3 mr-1" />
              Relay-native
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Popular Lists Preview (placeholder) -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <IconStar class="w-5 h-5 text-orange-600" />
          <span>Popular Lists</span>
        </h3>
        <button
          @click="emit('switch-tab', 'discover')"
          class="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center space-x-1"
        >
          <span>View all</span>
          <IconArrowRight class="w-4 h-4" />
        </button>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Placeholder cards -->
        <div
          v-for="i in 3"
          :key="i"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-4"
        >
          <div class="h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center">
            <IconList class="w-8 h-8 text-gray-400" />
          </div>
          <h4 class="font-medium text-gray-900 mb-1">Popular List {{ i }}</h4>
          <p class="text-sm text-gray-600 mb-3">Curated by the community</p>
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500">{{ Math.floor(Math.random() * 100) + 20 }} members</span>
            <button class="btn-secondary text-xs">
              <IconHeart class="w-3 h-3" />
              Follow
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>