<script setup>
import { computed, ref, onMounted } from 'vue'
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
  IconStar,
  IconRocket,
  IconTrendingUp,
  IconEye,
  IconCheck,
  IconChevronRight,
  IconSparkles,
  IconNetwork
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useAudience } from '../composables/useAudience.js'

const emit = defineEmits(['create-list', 'switch-tab', 'follow-suggestions'])

const { userProfile } = useNostrAuth()
const { getFollowingCount, getFollowersCount, myLists } = useAudience()

// UI state
const showQuickStart = ref(true)
const completedSteps = ref(new Set())

// Check user's progress
const userProgress = computed(() => {
  const following = getFollowingCount()
  const followers = getFollowersCount()
  const lists = myLists.value.length
  
  return {
    hasFollowing: following > 0,
    hasFollowers: followers > 0,
    hasLists: lists > 0,
    isNewUser: following === 0 && followers === 0 && lists === 0
  }
})

// Onboarding steps for new users
const onboardingSteps = computed(() => [
  {
    id: 'discover',
    title: 'Discover People',
    description: 'Find interesting people to follow',
    icon: IconSearch,
    color: 'from-blue-400 to-cyan-400',
    action: () => emit('switch-tab', 'suggestions'),
    completed: userProgress.value.hasFollowing,
    priority: 1
  },
  {
    id: 'organize',
    title: 'Create Lists',
    description: 'Organize your network into themed lists',
    icon: IconList,
    color: 'from-green-400 to-emerald-400',
    action: () => emit('create-list'),
    completed: userProgress.value.hasLists,
    priority: 2
  },
  {
    id: 'engage',
    title: 'Build Community',
    description: 'Share your profile to gain followers',
    icon: IconUsers,
    color: 'from-purple-400 to-pink-400',
    action: () => emit('switch-tab', 'followers'),
    completed: userProgress.value.hasFollowers,
    priority: 3
  }
])

// Quick stats for existing users
const quickStats = computed(() => [
  {
    label: 'Following',
    value: getFollowingCount(),
    icon: IconUserPlus,
    color: 'text-orange-600 bg-orange-100',
    action: () => emit('switch-tab', 'following')
  },
  {
    label: 'Followers',
    value: getFollowersCount(),
    icon: IconUsers,
    color: 'text-blue-600 bg-blue-100',
    action: () => emit('switch-tab', 'followers')
  },
  {
    label: 'Lists',
    value: myLists.value.length,
    icon: IconList,
    color: 'text-green-600 bg-green-100',
    action: () => emit('switch-tab', 'lists')
  }
])

// Mark step as completed
const markStepCompleted = (stepId) => {
  completedSteps.value.add(stepId)
}

// Get next recommended action
const nextAction = computed(() => {
  const incompleteSteps = onboardingSteps.value.filter(step => !step.completed)
  return incompleteSteps.length > 0 ? incompleteSteps[0] : null
})

onMounted(() => {
  // Auto-hide quick start for experienced users
  if (!userProgress.value.isNewUser) {
    showQuickStart.value = false
  }
})
</script>

<template>
  <div class="space-y-8">
    <!-- New User Welcome & Quick Start -->
    <div v-if="userProgress.isNewUser" class="text-center">
      <div class="w-20 h-20 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
        <IconSparkles class="w-10 h-10 text-white" />
      </div>
      <h2 class="text-3xl font-bold text-gray-900 mb-4">
        Welcome to Nostr, {{ userProfile?.name || 'Creator' }}!
      </h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
        Let's help you build your decentralized social network. Follow these simple steps to get started.
      </p>
      
      <!-- Primary CTA for New Users -->
      <button
        @click="emit('switch-tab', 'suggestions')"
        class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center space-x-3 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
      >
        <IconRocket class="w-6 h-6" />
        <span>Start Building Your Network</span>
        <IconArrowRight class="w-6 h-6" />
      </button>
    </div>

    <!-- Existing User Dashboard -->
    <div v-else class="text-center">
      <div class="w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
        <IconNetwork class="w-8 h-8 text-white" />
      </div>
      <h2 class="text-2xl font-bold text-gray-900 mb-3">
        Your Nostr Network
      </h2>
      <p class="text-gray-600 max-w-xl mx-auto leading-relaxed">
        Manage your connections and discover new people in the decentralized social network.
      </p>
    </div>

    <!-- Progress Steps for New Users -->
    <div v-if="userProgress.isNewUser" class="bg-white/90 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-lg p-6 sm:p-8">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-900">Getting Started</h3>
        <div class="text-sm text-gray-500">
          {{ onboardingSteps.filter(s => s.completed).length }}/{{ onboardingSteps.length }} completed
        </div>
      </div>
      
      <div class="space-y-4">
        <div
          v-for="(step, index) in onboardingSteps"
          :key="step.id"
          class="group"
        >
          <button
            @click="step.action"
            :class="[
              'w-full p-4 rounded-xl border-2 transition-all duration-300 text-left',
              step.completed 
                ? 'border-green-200 bg-green-50 hover:bg-green-100' 
                : index === 0 || onboardingSteps[index - 1]?.completed
                  ? 'border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 hover:shadow-md transform hover:-translate-y-1'
                  : 'border-gray-200 bg-gray-50 opacity-60'
            ]"
            :disabled="!step.completed && index > 0 && !onboardingSteps[index - 1]?.completed"
          >
            <div class="flex items-center space-x-4">
              <!-- Step Number/Status -->
              <div :class="[
                'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm',
                step.completed 
                  ? 'bg-green-500 text-white' 
                  : `bg-gradient-to-r ${step.color} text-white`
              ]">
                <IconCheck v-if="step.completed" class="w-6 h-6" />
                <component v-else :is="step.icon" class="w-6 h-6" />
              </div>
              
              <!-- Step Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <h4 class="font-semibold text-gray-900">{{ step.title }}</h4>
                  <span v-if="step.completed" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                    ✓ Done
                  </span>
                  <span v-else-if="index === 0 || onboardingSteps[index - 1]?.completed" class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium animate-pulse">
                    Next
                  </span>
                </div>
                <p class="text-gray-600 text-sm mt-1">{{ step.description }}</p>
              </div>
              
              <!-- Arrow -->
              <IconChevronRight :class="[
                'w-5 h-5 transition-all duration-200',
                step.completed ? 'text-green-500' : 'text-orange-500 group-hover:translate-x-1'
              ]" />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Stats for Existing Users -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button
        v-for="stat in quickStats"
        :key="stat.label"
        @click="stat.action"
        class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-6 text-center group transform hover:-translate-y-1"
      >
        <div :class="['w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200', stat.color]">
          <component :is="stat.icon" class="w-6 h-6" />
        </div>
        <div class="text-2xl font-bold text-gray-900 mb-1">{{ stat.value.toLocaleString() }}</div>
        <div class="text-sm text-gray-600">{{ stat.label }}</div>
      </button>
    </div>

    <!-- Next Recommended Action -->
    <div v-if="nextAction && !userProgress.isNewUser" class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-r', nextAction.color]">
            <component :is="nextAction.icon" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 mb-1">{{ nextAction.title }}</h4>
            <p class="text-gray-600 text-sm">{{ nextAction.description }}</p>
          </div>
        </div>
        <button
          @click="nextAction.action"
          class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <span>Get Started</span>
          <IconArrowRight class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Quick Actions Grid -->
    <div v-if="!userProgress.isNewUser">
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <IconTrendingUp class="w-5 h-5 text-orange-600" />
        <span>Quick Actions</span>
      </h3>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Discover New People -->
        <button
          @click="emit('switch-tab', 'suggestions')"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-6 text-left group transform hover:-translate-y-1"
        >
          <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 group-hover:scale-110 transition-transform duration-200">
            <IconUserPlus class="w-6 h-6 text-white" />
          </div>
          <h4 class="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
            Discover People
          </h4>
          <p class="text-sm text-gray-600 mb-3">Find interesting people based on your network</p>
          <div class="flex items-center text-blue-600 text-sm font-medium">
            <span>View Suggestions</span>
            <IconArrowRight class="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <!-- Create Follow List -->
        <button
          @click="emit('create-list')"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-6 text-left group transform hover:-translate-y-1"
        >
          <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-r from-green-400 to-emerald-400 group-hover:scale-110 transition-transform duration-200">
            <IconList class="w-6 h-6 text-white" />
          </div>
          <h4 class="font-semibold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
            Create List
          </h4>
          <p class="text-sm text-gray-600 mb-3">Organize people into themed collections</p>
          <div class="flex items-center text-green-600 text-sm font-medium">
            <span>Start Creating</span>
            <IconArrowRight class="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <!-- Manage Following -->
        <button
          @click="emit('switch-tab', 'following')"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-6 text-left group transform hover:-translate-y-1"
        >
          <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-r from-purple-400 to-pink-400 group-hover:scale-110 transition-transform duration-200">
            <IconUsers class="w-6 h-6 text-white" />
          </div>
          <h4 class="font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
            Manage Network
          </h4>
          <p class="text-sm text-gray-600 mb-3">Review and organize who you follow</p>
          <div class="flex items-center text-purple-600 text-sm font-medium">
            <span>View Following</span>
            <IconArrowRight class="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </div>
    </div>

    <!-- Network Health Indicator -->
    <div v-if="!userProgress.isNewUser" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <IconNetwork class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h4 class="font-semibold text-blue-900 mb-1">Network Health</h4>
            <p class="text-blue-800 text-sm">
              {{ getFollowingCount() > 0 ? 'Your network is growing!' : 'Start following people to build your network' }}
            </p>
          </div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-blue-600">
            {{ Math.round((getFollowingCount() + getFollowersCount()) / 2) || 0 }}
          </div>
          <div class="text-xs text-blue-700">Network Score</div>
        </div>
      </div>
    </div>

    <!-- Tips for Better Networking -->
    <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
      <div class="flex items-start space-x-4">
        <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <IconSparkles class="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h4 class="font-semibold text-purple-900 mb-3">Pro Tips for Building Your Audience</h4>
          <div class="space-y-2 text-sm text-purple-800">
            <div class="flex items-start space-x-2">
              <IconCheck class="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <span>Follow people who share your interests to build a relevant network</span>
            </div>
            <div class="flex items-start space-x-2">
              <IconCheck class="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <span>Create themed lists to organize different communities</span>
            </div>
            <div class="flex items-start space-x-2">
              <IconCheck class="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <span>Engage with content to attract followers naturally</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Enhanced hover effects */
.group:hover .group-hover\:scale-110 {
  transform: scale(1.1);
}

.group:hover .group-hover\:translate-x-1 {
  transform: translateX(0.25rem);
}

/* Smooth transitions for all interactive elements */
button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states for accessibility */
button:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .text-3xl {
    font-size: 1.875rem;
  }
  
  .text-lg {
    font-size: 1.125rem;
  }
  
  button {
    min-height: 44px;
  }
}

/* Animation for pulse effect */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>