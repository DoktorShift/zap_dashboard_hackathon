<script setup>
import { computed } from 'vue'
import {
  IconBolt,
  IconChartBar,
  IconWallet,
  IconFileText,
  IconTarget,
  IconUsers,
  IconCurrencyBitcoin,
  IconTrendingUp
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

// Trigger nostr-login widget
const handleConnect = () => {
  console.log('🚀 Triggering nostr-login widget from EmptyStateDashboard...')
  document.dispatchEvent(new Event('nlLaunch'))
}

// Network stats (these would come from backend in production)
const networkStats = [
  {
    icon: IconBolt,
    value: '1.2M+',
    label: 'Total Zaps Tracked',
    description: 'Across the ZapTracker network'
  },
  {
    icon: IconCurrencyBitcoin,
    value: '50K',
    label: 'Sats Average Daily',
    description: 'Median creator earnings'
  },
  {
    icon: IconUsers,
    value: '5,000+',
    label: 'Active Users',
    description: 'Growing every day'
  }
]

const features = [
  {
    icon: IconChartBar,
    name: 'Real-Time Dashboard',
    description: 'Monitor all your Lightning activity in one place',
    image: '/dashboard.png'
  },
  {
    icon: IconChartBar,
    name: 'Deep Analytics',
    description: 'Understand trends and optimize your earnings',
    image: '/analytics.png'
  },
  {
    icon: IconWallet,
    name: 'Wallet Management',
    description: 'Seamlessly connect and manage your NWC wallet',
    image: '/wallet.png'
  },
  {
    icon: IconFileText,
    name: 'Content Tracking',
    description: 'See which content drives the most zaps',
    image: '/ZapStore_Preview_1.png'
  },
  {
    icon: IconTarget,
    name: 'Campaign Builder',
    description: 'Create and track fundraising campaigns',
    image: '/ZapTracker_campaigns.png'
  },
  {
    icon: IconUsers,
    name: 'Audience Insights',
    description: 'Understand and grow your supporter base',
    image: '/ZapStore_Preview_2.png'
  }
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
    <!-- Hero Section -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16">
      <div class="text-center space-y-8">
        <!-- Animated Logo -->
        <div class="flex justify-center">
          <div class="relative">
            <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
            <div class="relative w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-xl">
              <IconBolt class="w-12 h-12 sm:w-16 sm:h-16 text-white" />
            </div>
          </div>
        </div>

        <!-- Main Headline -->
        <div class="space-y-4">
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            Track Your Lightning Earnings
            <span class="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
              Like a Pro
            </span>
          </h1>
          <p class="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto">
            ZapTracker gives you complete visibility into your Bitcoin Lightning ecosystem
          </p>
        </div>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button
            @click="handleConnect"
            class="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-bold rounded-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <IconBolt class="w-6 h-6" />
            <span>Connect with Nostr</span>
          </button>
          <a
            href="https://usenostr.org"
            target="_blank"
            rel="noopener noreferrer"
            class="px-8 py-4 bg-white border-2 border-orange-500 text-orange-600 text-lg font-semibold rounded-xl hover:bg-orange-50 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <span>Learn About Nostr</span>
            <IconTrendingUp class="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>

    <!-- Network Stats Section -->
    <div class="bg-white/80 backdrop-blur-sm border-y border-orange-100 py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Join the Lightning Community
          </h2>
          <p class="text-lg text-gray-600">
            Trusted by creators and builders worldwide
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div
            v-for="(stat, index) in networkStats"
            :key="index"
            class="bg-white p-8 rounded-2xl shadow-lg border border-orange-100 hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <div class="flex flex-col items-center text-center space-y-4">
              <div class="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
                <component :is="stat.icon" class="w-8 h-8 text-white" />
              </div>
              <div>
                <div class="text-4xl font-bold text-gray-900 mb-2">{{ stat.value }}</div>
                <div class="text-lg font-semibold text-gray-700 mb-1">{{ stat.label }}</div>
                <div class="text-sm text-gray-500">{{ stat.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Everything You Need to Succeed
        </h2>
        <p class="text-lg text-gray-600 max-w-2xl mx-auto">
          Powerful features designed to help you track, analyze, and grow your Lightning presence
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div
          v-for="(feature, index) in features"
          :key="index"
          class="group bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105"
        >
          <!-- Feature Image -->
          <div class="relative h-48 bg-gradient-to-br from-orange-100 to-amber-100 overflow-hidden">
            <img
              :src="feature.image"
              :alt="feature.name"
              class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
              loading="lazy"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
          </div>

          <!-- Feature Content -->
          <div class="p-6">
            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <component :is="feature.icon" class="w-6 h-6 text-white" />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold text-gray-900 mb-2">{{ feature.name }}</h3>
                <p class="text-sm text-gray-600">{{ feature.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom CTA Section -->
    <div class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 py-20">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-white mb-6">
          Ready to Get Started?
        </h2>
        <p class="text-xl text-orange-50 mb-8">
          Connect your Nostr account in seconds and start tracking your Lightning earnings
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            @click="handleConnect"
            class="px-10 py-5 bg-white text-orange-600 text-lg font-bold rounded-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <IconBolt class="w-6 h-6" />
            <span>Connect with Nostr</span>
          </button>
          <a
            href="https://usenostr.org"
            target="_blank"
            rel="noopener noreferrer"
            class="px-10 py-5 bg-transparent border-2 border-white text-white text-lg font-semibold rounded-xl hover:bg-white/10 transition-all duration-200 flex items-center justify-center"
          >
            Need help? Learn about Nostr
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
