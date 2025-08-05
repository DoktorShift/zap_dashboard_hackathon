<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IconUsers,
  IconSearch,
  IconPlus,
  IconHeart,
  IconUserPlus,
  IconUserMinus,
  IconLoader,
  IconAlertCircle,
  IconBolt,
  IconShield,
  IconGlobe,
  IconEye,
  IconCheck,
  IconX,
  IconHash,
  IconStar,
  IconTrendingUp,
  IconFilter,
  IconRefresh,
  IconChevronRight,
  IconChevronDown,
  IconExternalLink
} from '@iconify-prerendered/vue-tabler'
import { useAudience } from '../composables/useAudience.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'

const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

const {
  followLists,
  currentFollows,
  suggestedUsers,
  interestBasedLists,
  selectedInterests,
  searchQuery,
  activeTab,
  isLoading,
  error,
  filteredFollows,
  followStats,
  interestStats,
  fetchCurrentFollows,
  fetchInterestBasedLists,
  generateSmartSuggestions,
  followUser,
  unfollowUser,
  createFollowList,
  followAllFromList,
  toggleInterest,
  searchInterests,
  fetchUserProfile,
  initializeAudience,
  interests
} = useAudience()

// Local UI state
const showCreateListModal = ref(false)
const showInterestDetails = ref(false)
const selectedInterestForDetails = ref(null)
const interestSearchQuery = ref('')
const isFollowingUser = ref(new Set())
const expandedSections = ref(new Set(['discover']))

// Create list form
const createListForm = ref({
  title: '',
  description: '',
  selectedFollows: new Set(),
  selectedInterests: new Set()
})

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Filter interests based on search
const filteredInterests = computed(() => {
  return searchInterests(interestSearchQuery.value)
})

// Get lists for selected interests
const getListsForInterests = computed(() => {
  const lists = []
  selectedInterests.value.forEach(interest => {
    const interestLists = interestBasedLists.value.get(interest) || []
    lists.push(...interestLists)
  })
  
  // Remove duplicates and sort by creation date
  const uniqueLists = lists.filter((list, index, self) => 
    index === self.findIndex(l => l.id === list.id)
  )
  
  return uniqueLists.sort((a, b) => b.createdAt - a.createdAt)
})

// Handle follow user with loading state
const handleFollowUser = async (user) => {
  const pubkey = user.pubkey || user
  isFollowingUser.value.add(pubkey)
  
  try {
    await followUser(pubkey)
    
    // Remove from suggestions if it was a suggestion
    const suggestionIndex = suggestedUsers.value.findIndex(s => s.pubkey === pubkey)
    if (suggestionIndex !== -1) {
      suggestedUsers.value.splice(suggestionIndex, 1)
    }
  } catch (error) {
    console.error('Failed to follow user:', error)
  } finally {
    isFollowingUser.value.delete(pubkey)
  }
}

// Handle unfollow user
const handleUnfollowUser = async (user) => {
  const pubkey = user.pubkey || user
  
  try {
    await unfollowUser(pubkey)
  } catch (error) {
    console.error('Failed to unfollow user:', error)
  }
}

// Handle follow all from list
const handleFollowAllFromList = async (list) => {
  try {
    const result = await followAllFromList(list)
    console.log(`Followed ${result.successful}/${result.total} users from list`)
  } catch (error) {
    console.error('Failed to follow all from list:', error)
  }
}

// Handle interest selection
const handleInterestToggle = async (interest) => {
  toggleInterest(interest)
  
  // Fetch lists for newly selected interests
  if (selectedInterests.value.has(interest) && !interestBasedLists.value.has(interest)) {
    await fetchInterestBasedLists([interest])
  }
}

// Show interest details
const showInterestDetailsModal = (interest) => {
  selectedInterestForDetails.value = interest
  showInterestDetails.value = true
}

// Create new follow list
const handleCreateList = async () => {
  if (!createListForm.value.title.trim()) return
  
  try {
    const follows = Array.from(createListForm.value.selectedFollows).map(pubkey => ({
      pubkey,
      relay: null,
      petname: null
    }))
    
    const interests = Array.from(createListForm.value.selectedInterests)
    
    await createFollowList(
      createListForm.value.title,
      createListForm.value.description,
      follows,
      interests
    )
    
    // Reset form and close modal
    createListForm.value = {
      title: '',
      description: '',
      selectedFollows: new Set(),
      selectedInterests: new Set()
    }
    showCreateListModal.value = false
  } catch (error) {
    console.error('Failed to create follow list:', error)
  }
}

// Toggle section expansion
const toggleSection = (section) => {
  if (expandedSections.value.has(section)) {
    expandedSections.value.delete(section)
  } else {
    expandedSections.value.add(section)
  }
}

// Format user display name
const formatUserName = (profile) => {
  return profile?.name || profile?.display_name || `user:${profile?.pubkey?.substring(0, 8)}`
}

// Format pubkey for display
const formatPubkey = (pubkey) => {
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}

// Check if user is followed
const isUserFollowed = (pubkey) => {
  return currentFollows.value.some(follow => follow.pubkey === pubkey)
}

onMounted(() => {
  // Initialize if authenticated
  if (isAuthenticated.value) {
    initializeAudience()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-start space-x-4">
          <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <IconUsers class="w-6 h-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
            <p class="text-purple-100 text-sm">
              Connect your Nostr identity to discover and manage your audience on the decentralized network.
            </p>
          </div>
        </div>
        <button
          @click="handleNostrLogin"
          class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
        >
          <IconBolt class="w-4 h-4" />
          <span>Connect with Nostr</span>
        </button>
      </div>
    </div>

    <!-- Authenticated Content -->
    <div v-else class="space-y-6">
      <!-- Page Header with Stats -->
      <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-6 rounded-xl shadow-lg">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold mb-2 flex items-center space-x-2">
              <IconUsers class="w-6 h-6" />
              <span>Audience Builder</span>
            </h1>
            <p class="text-orange-100 text-sm">
              Discover and connect with your community on Nostr
            </p>
          </div>
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold">{{ followStats.total }}</div>
              <div class="text-orange-100 text-xs">Following</div>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ interestStats.selected }}</div>
              <div class="text-orange-100 text-xs">Interests</div>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ suggestedUsers.length }}</div>
              <div class="text-orange-100 text-xs">Suggestions</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>

      <!-- 🔎 Discover Interests Section -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <button
          @click="toggleSection('discover')"
          class="w-full p-6 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-all duration-300 group"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <IconHash class="w-5 h-5 text-orange-600" />
              </div>
              <div class="text-left">
                <h3 class="text-lg font-semibold text-gray-900">Discover Interests</h3>
                <p class="text-sm text-gray-600">
                  {{ selectedInterests.size }} selected • {{ getListsForInterests.length }} lists found
                </p>
              </div>
            </div>
            <component 
              :is="expandedSections.has('discover') ? IconChevronDown : IconChevronRight" 
              class="w-5 h-5 text-gray-400 transition-all duration-300 group-hover:text-orange-600" 
            />
          </div>
        </button>

        <div v-if="expandedSections.has('discover')" class="p-6 border-t border-orange-100/50">
          <!-- Interest Search -->
          <div class="mb-6">
            <div class="relative">
              <input
                v-model="interestSearchQuery"
                type="text"
                placeholder="Search interests..."
                class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base"
              />
              <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <!-- Interest Tags Wall -->
          <div class="mb-6">
            <h4 class="font-medium text-gray-900 mb-3">Select Your Interests</h4>
            <div class="flex flex-wrap gap-2 max-h-64 overflow-y-auto scrollbar-thin">
              <button
                v-for="interest in filteredInterests.slice(0, 100)"
                :key="interest"
                @click="handleInterestToggle(interest)"
                :class="[
                  'px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 touch-target',
                  selectedInterests.has(interest)
                    ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-md'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                ]"
              >
                #{{ interest }}
              </button>
            </div>
          </div>

          <!-- Interest-Based Follow Lists -->
          <div v-if="getListsForInterests.length > 0">
            <h4 class="font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <IconTrendingUp class="w-4 h-4 text-orange-600" />
              <span>Recommended Follow Lists</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                v-for="list in getListsForInterests.slice(0, 6)"
                :key="list.id"
                class="bg-white border border-orange-100 rounded-lg p-4 hover:shadow-md transition-all duration-200"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1 min-w-0">
                    <h5 class="font-semibold text-gray-900 truncate">{{ list.title }}</h5>
                    <p class="text-sm text-gray-600 line-clamp-2">{{ list.description }}</p>
                  </div>
                </div>
                
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2 text-sm text-gray-500">
                    <IconUsers class="w-4 h-4" />
                    <span>{{ list.follows.length }} people</span>
                  </div>
                  <button
                    @click="handleFollowAllFromList(list)"
                    class="btn-secondary text-sm"
                  >
                    <IconUserPlus class="w-3 h-3" />
                    Follow All
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- No Lists Found -->
          <div v-else-if="selectedInterests.size > 0" class="text-center py-8">
            <IconHash class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No Lists Found</h4>
            <p class="text-gray-600 text-sm">
              No follow lists found for your selected interests. Try selecting different interests.
            </p>
          </div>
        </div>
      </div>

      <!-- 👥 Smart Suggestions Section -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <button
          @click="toggleSection('suggestions')"
          class="w-full p-6 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 group"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <IconStar class="w-5 h-5 text-blue-600" />
              </div>
              <div class="text-left">
                <h3 class="text-lg font-semibold text-gray-900">People Like You</h3>
                <p class="text-sm text-gray-600">
                  {{ suggestedUsers.length }} suggestions based on mutual connections
                </p>
              </div>
            </div>
            <component 
              :is="expandedSections.has('suggestions') ? IconChevronDown : IconChevronRight" 
              class="w-5 h-5 text-gray-400 transition-all duration-300 group-hover:text-blue-600" 
            />
          </div>
        </button>

        <div v-if="expandedSections.has('suggestions')" class="p-6 border-t border-orange-100/50">
          <div v-if="suggestedUsers.length === 0" class="text-center py-8">
            <IconUsers class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No Suggestions Yet</h4>
            <p class="text-gray-600 text-sm mb-4">
              Follow more people to get personalized suggestions based on mutual connections.
            </p>
            <button
              @click="generateSmartSuggestions"
              class="btn-secondary"
            >
              <IconRefresh class="w-4 h-4" />
              Refresh Suggestions
            </button>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="suggestion in suggestedUsers.slice(0, 9)"
              :key="suggestion.pubkey"
              class="bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md transition-all duration-200"
            >
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200">
                  <img 
                    :src="suggestion.profile?.picture" 
                    :alt="formatUserName(suggestion.profile)"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <h5 class="font-medium text-gray-900 truncate">
                    {{ formatUserName(suggestion.profile) }}
                  </h5>
                  <p class="text-sm text-gray-500">
                    {{ suggestion.mutualCount }} mutual connection{{ suggestion.mutualCount !== 1 ? 's' : '' }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button
                  @click="handleFollowUser(suggestion)"
                  :disabled="isFollowingUser.has(suggestion.pubkey)"
                  class="btn-primary flex-1 text-sm"
                >
                  <IconLoader v-if="isFollowingUser.has(suggestion.pubkey)" class="w-3 h-3 animate-spin" />
                  <IconUserPlus v-else class="w-3 h-3" />
                  {{ isFollowingUser.has(suggestion.pubkey) ? 'Following...' : 'Follow' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 📋 Manage My Follows Section -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <button
          @click="toggleSection('follows')"
          class="w-full p-6 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-all duration-300 group"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <IconHeart class="w-5 h-5 text-green-600" />
              </div>
              <div class="text-left">
                <h3 class="text-lg font-semibold text-gray-900">My Follows</h3>
                <p class="text-sm text-gray-600">
                  {{ followStats.total }} people • {{ followStats.withLightning }} with Lightning
                </p>
              </div>
            </div>
            <component 
              :is="expandedSections.has('follows') ? IconChevronDown : IconChevronRight" 
              class="w-5 h-5 text-gray-400 transition-all duration-300 group-hover:text-green-600" 
            />
          </div>
        </button>

        <div v-if="expandedSections.has('follows')" class="p-6 border-t border-orange-100/50">
          <!-- Search Follows -->
          <div class="mb-6">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search your follows..."
                class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base"
              />
              <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <!-- Follows List -->
          <div v-if="filteredFollows.length === 0" class="text-center py-8">
            <IconUsers class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">
              {{ currentFollows.length === 0 ? 'No Follows Yet' : 'No Results' }}
            </h4>
            <p class="text-gray-600 text-sm">
              {{ currentFollows.length === 0 
                ? 'Start following people to build your network' 
                : 'Try adjusting your search terms' }}
            </p>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="follow in filteredFollows.slice(0, 12)"
              :key="follow.pubkey"
              class="bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md transition-all duration-200"
            >
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200">
                  <img 
                    :src="follow.profile?.picture" 
                    :alt="formatUserName(follow.profile)"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <h5 class="font-medium text-gray-900 truncate">
                    {{ formatUserName(follow.profile) }}
                  </h5>
                  <p class="text-xs text-gray-500 truncate">
                    {{ follow.profile?.nip05 || formatPubkey(follow.pubkey) }}
                  </p>
                </div>
              </div>
              
              <!-- Status Badges -->
              <div class="flex flex-wrap gap-1 mb-3">
                <span v-if="follow.profile?.lud16" class="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                  <IconBolt class="w-3 h-3 mr-1" />
                  Zap Ready
                </span>
                <span v-if="follow.profile?.nip05" class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                  <IconShield class="w-3 h-3 mr-1" />
                  Verified
                </span>
              </div>
              
              <button
                @click="handleUnfollowUser(follow)"
                class="btn-secondary w-full text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <IconUserMinus class="w-3 h-3" />
                Unfollow
              </button>
            </div>
          </div>

          <!-- Show More Button -->
          <div v-if="filteredFollows.length > 12" class="text-center mt-6">
            <button class="btn-secondary">
              <IconEye class="w-4 h-4" />
              Show {{ filteredFollows.length - 12 }} More
            </button>
          </div>
        </div>
      </div>

      <!-- ➕ Create Follow Lists Section -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <button
          @click="toggleSection('create')"
          class="w-full p-6 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 group"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <IconPlus class="w-5 h-5 text-purple-600" />
              </div>
              <div class="text-left">
                <h3 class="text-lg font-semibold text-gray-900">My Follow Lists</h3>
                <p class="text-sm text-gray-600">
                  {{ followLists.length }} custom lists created
                </p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click.stop="showCreateListModal = true"
                class="btn-primary text-sm"
              >
                <IconPlus class="w-3 h-3" />
                Create List
              </button>
              <component 
                :is="expandedSections.has('create') ? IconChevronDown : IconChevronRight" 
                class="w-5 h-5 text-gray-400 transition-all duration-300 group-hover:text-purple-600" 
              />
            </div>
          </div>
        </button>

        <div v-if="expandedSections.has('create')" class="p-6 border-t border-orange-100/50">
          <div v-if="followLists.length === 0" class="text-center py-8">
            <IconPlus class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No Custom Lists Yet</h4>
            <p class="text-gray-600 text-sm mb-4">
              Create curated follow lists to organize your network and share with others.
            </p>
            <button
              @click="showCreateListModal = true"
              class="btn-primary"
            >
              <IconPlus class="w-4 h-4" />
              Create Your First List
            </button>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="list in followLists"
              :key="list.id"
              class="bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md transition-all duration-200"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <h5 class="font-semibold text-gray-900 truncate">{{ list.title }}</h5>
                  <p class="text-sm text-gray-600 line-clamp-2">{{ list.description }}</p>
                </div>
              </div>
              
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span class="flex items-center space-x-1">
                    <IconUsers class="w-4 h-4" />
                    <span>{{ list.follows.length }}</span>
                  </span>
                  <span class="flex items-center space-x-1">
                    <IconHash class="w-4 h-4" />
                    <span>{{ list.interests.length }}</span>
                  </span>
                </div>
                <div class="flex items-center space-x-2">
                  <button class="btn-secondary text-sm">
                    <IconEye class="w-3 h-3" />
                    View
                  </button>
                  <button class="btn-secondary text-sm">
                    <IconExternalLink class="w-3 h-3" />
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create List Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showCreateListModal" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-xl font-semibold text-gray-900">Create Follow List</h3>
              <button
                @click="showCreateListModal = false"
                class="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>

            <div class="p-6 space-y-6">
              <!-- Basic Info -->
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">List Title</label>
                  <input
                    v-model="createListForm.title"
                    type="text"
                    placeholder="My Awesome Follow List"
                    class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    v-model="createListForm.description"
                    placeholder="Describe your follow list..."
                    rows="3"
                    class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base resize-none"
                  ></textarea>
                </div>
              </div>

              <!-- Select Interests -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Related Interests</label>
                <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-thin">
                  <button
                    v-for="interest in interests.slice(0, 50)"
                    :key="interest"
                    @click="createListForm.selectedInterests.has(interest) 
                      ? createListForm.selectedInterests.delete(interest) 
                      : createListForm.selectedInterests.add(interest)"
                    :class="[
                      'px-3 py-1 rounded-full text-sm transition-all duration-200',
                      createListForm.selectedInterests.has(interest)
                        ? 'bg-orange-400 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-orange-100'
                    ]"
                  >
                    #{{ interest }}
                  </button>
                </div>
              </div>

              <!-- Select Follows -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">
                  Add People ({{ createListForm.selectedFollows.size }} selected)
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto scrollbar-thin">
                  <div
                    v-for="follow in currentFollows.slice(0, 20)"
                    :key="follow.pubkey"
                    @click="createListForm.selectedFollows.has(follow.pubkey) 
                      ? createListForm.selectedFollows.delete(follow.pubkey) 
                      : createListForm.selectedFollows.add(follow.pubkey)"
                    :class="[
                      'flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all duration-200',
                      createListForm.selectedFollows.has(follow.pubkey)
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-200 hover:bg-orange-25'
                    ]"
                  >
                    <div class="w-8 h-8 rounded-full overflow-hidden border border-orange-200">
                      <img 
                        :src="follow.profile?.picture" 
                        :alt="formatUserName(follow.profile)"
                        class="w-full h-full object-cover"
                        @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-gray-900 text-sm truncate">
                        {{ formatUserName(follow.profile) }}
                      </p>
                    </div>
                    <div v-if="createListForm.selectedFollows.has(follow.pubkey)" class="text-orange-600">
                      <IconCheck class="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Actions -->
            <div class="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                @click="showCreateListModal = false"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="handleCreateList"
                :disabled="!createListForm.title.trim() || isLoading"
                class="btn-primary disabled:opacity-50"
              >
                <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                <IconPlus v-else class="w-4 h-4" />
                Create List
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Custom scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Touch targets for mobile */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover effects */
button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .touch-target {
    min-height: 48px;
  }
  
  .text-base {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .transition-all,
  .transition-colors,
  .transition-transform {
    transition: none !important;
  }
  
  .animate-pulse,
  .animate-spin,
  .animate-bounce {
    animation: none !important;
  }
  
  button:hover:not(:disabled) {
    transform: none !important;
  }
}
</style>