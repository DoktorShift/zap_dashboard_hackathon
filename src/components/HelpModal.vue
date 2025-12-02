<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  IconBolt,
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconChartBar,
  IconWallet,
  IconFileText,
  IconCalendar,
  IconMessageCircle,
  IconTarget,
  IconUsers,
  IconEye,
  IconLogin
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  autoShow: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'trigger-login', 'trigger-view-only'])

const currentSlide = ref(0)
const totalSlides = 10

const hasSeenWelcome = () => {
  return localStorage.getItem('zaptracker_welcome_seen') === 'true'
}

const markWelcomeSeen = () => {
  localStorage.setItem('zaptracker_welcome_seen', 'true')
}

const slides = [
  {
    id: 'welcome',
    title: 'Welcome to ZapTracker',
    subtitle: 'Your Lightning Network Command Center',
    showLogo: true
  },
  {
    id: 'analytics',
    title: 'Powerful Analytics',
    description: 'Get real-time insights into your zap activity, earnings trends, and supporter engagement. Visualize your growth with beautiful charts and detailed metrics.',
    image: '/analytics.png',
    features: [
      { icon: IconChartBar, text: 'Real-time zap tracking' },
      { icon: IconBolt, text: 'Earnings analytics' },
      { icon: IconTarget, text: 'Engagement metrics' }
    ]
  },
  {
    id: 'wallet',
    title: 'Lightning Wallet Integration',
    description: 'Connect your Lightning wallet via NWC (Nostr Wallet Connect) for seamless payment tracking and management. Monitor your balance and transactions in real-time.',
    image: '/wallet.png',
    features: [
      { icon: IconWallet, text: 'NWC wallet support' },
      { icon: IconBolt, text: 'Balance tracking' },
      { icon: IconTarget, text: 'Transaction history' }
    ]
  },
  {
    id: 'content',
    title: 'Long-Form Content & Short Notes',
    description: 'Publish long-form articles and short notes directly to Nostr. Monetize your content with zaps and track which posts resonate with your audience.',
    image: '/dashboard.png',
    features: [
      { icon: IconFileText, text: 'Long-form articles (NIP-23)' },
      { icon: IconMessageCircle, text: 'Short notes & tweets' },
      { icon: IconBolt, text: 'Content monetization' }
    ]
  },
  {
    id: 'zapfeed',
    title: 'Zap Feed & Profile Cards',
    description: 'See every zap in real-time with detailed profile cards. Discover who supports you, track top contributors, and engage with your community effectively.',
    image: '/zaps.png',
    features: [
      { icon: IconBolt, text: 'Live zap feed' },
      { icon: IconUsers, text: 'Supporter profiles' },
      { icon: IconTarget, text: 'Top contributors' }
    ]
  },
  {
    id: 'audience',
    title: 'Stay Connected with Your Audience',
    description: 'Build relationships with your supporters through integrated chat and audience insights. Track follower growth and engagement patterns to optimize your content strategy.',
    image: '/chat_zap_2.png',
    features: [
      { icon: IconUsers, text: 'Audience analytics' },
      { icon: IconMessageCircle, text: 'Integrated chat' },
      { icon: IconCalendar, text: 'Event scheduling' }
    ]
  },
  {
    id: 'zapgoals',
    title: 'Set and Track Zap Goals',
    image: '/ZapTracker_campaigns.png'
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    faqs: [
      {
        q: 'What is ZapTracker?',
        a: 'ZapTracker is a comprehensive analytics platform for Lightning Network zaps on Nostr. Track earnings, analyze engagement, and grow your Lightning presence.'
      },
      {
        q: 'Do I need a Nostr account?',
        a: 'For full features, yes. However, you can explore with view-only mode using any public npub to see what ZapTracker offers.'
      },
      {
        q: 'How do I connect my Lightning wallet?',
        a: 'Connect via NWC (Nostr Wallet Connect). We support all major Lightning wallets that offer NWC connections for secure payment tracking.'
      },
      {
        q: 'Is my data private?',
        a: 'Yes! ZapTracker only reads public Nostr data and never stores your private keys. Your wallet connection uses secure NWC protocol.'
      },
      {
        q: 'Can I publish content from ZapTracker?',
        a: 'Absolutely! Create long-form articles (NIP-23) and short notes directly to Nostr, all with built-in monetization tracking.'
      },
      {
        q: 'How much does it cost?',
        a: 'ZapTracker is free to use! Built with open-source principles for the Nostr ecosystem.'
      }
    ]
  },
  {
    id: 'howto',
    title: 'How to Get Started',
    steps: [
      {
        number: '1',
        title: 'Connect Your Account',
        description: 'Sign in with your Nostr account using any compatible extension or app.'
      },
      {
        number: '2',
        title: 'Link Your Lightning Wallet',
        description: 'Connect via NWC to enable payment tracking and wallet features.'
      },
      {
        number: '3',
        title: 'Explore Your Dashboard',
        description: 'View your analytics, check your zap feed, and discover insights about your audience.'
      },
      {
        number: '4',
        title: 'Create & Share Content',
        description: 'Publish articles or notes and track how they perform with your community.'
      }
    ]
  },
  {
    id: 'cta',
    title: 'Let\'s Dive In!',
    subtitle: 'Connect with your Nostr account for full features, or try view-only mode to explore the platform.',
    showLogo: true,
    isFinal: true
  }
]

const currentSlideData = computed(() => slides[currentSlide.value])

const canGoNext = computed(() => currentSlide.value < totalSlides - 1)
const canGoPrev = computed(() => currentSlide.value > 0)

const nextSlide = () => {
  if (canGoNext.value) {
    currentSlide.value++
  }
}

const prevSlide = () => {
  if (canGoPrev.value) {
    currentSlide.value--
  }
}

const goToSlide = (index) => {
  currentSlide.value = index
}

const handleSkip = () => {
  markWelcomeSeen()
  emit('close')
}

const handleGetStarted = () => {
  markWelcomeSeen()
  emit('close')
  emit('trigger-login')
}

const handleViewOnly = () => {
  markWelcomeSeen()
  emit('close')
  emit('trigger-view-only')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 animate-fade-in">
    <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
      <!-- Header -->
      <div class="relative p-4 border-b border-gray-200">
        <button
          @click="handleSkip"
          class="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
        >
          <IconX class="w-5 h-5" />
        </button>

        <!-- Progress Dots -->
        <div class="flex justify-center space-x-2">
          <button
            v-for="(slide, index) in slides"
            :key="index"
            @click="goToSlide(index)"
            :class="[
              'h-2 rounded-full transition-all duration-300',
              currentSlide === index
                ? 'w-8 bg-gradient-to-r from-orange-500 to-amber-500'
                : 'w-2 bg-gray-300 hover:bg-gray-400'
            ]"
          />
        </div>
      </div>

      <!-- Slide Content -->
      <div class="relative overflow-y-auto" style="max-height: calc(90vh - 140px);">
        <transition name="slide-fade" mode="out-in">
          <div :key="currentSlide" class="p-8 sm:p-12">
            <!-- Page 1: Welcome -->
            <div v-if="currentSlideData.id === 'welcome'" class="text-center space-y-6">
              <div class="flex justify-center mb-6">
                <div class="relative">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                  <img
                    src="/new_logo3.png"
                    alt="ZapTracker Logo"
                    class="relative w-32 h-32 object-contain"
                  />
                </div>
              </div>

              <h1 class="text-4xl sm:text-5xl font-bold text-gray-900">
                {{ currentSlideData.title }}
              </h1>

              <p class="text-xl sm:text-2xl text-orange-600 font-semibold mb-12">
                {{ currentSlideData.subtitle }}
              </p>

              <div class="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                <button
                  @click="nextSlide"
                  class="flex-1 px-8 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg rounded-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <span>Take a Tour</span>
                  <IconChevronRight class="w-5 h-5" />
                </button>
                <button
                  @click="handleGetStarted"
                  class="flex-1 px-8 py-5 bg-white border-2 border-orange-500 text-orange-600 text-lg rounded-xl font-bold hover:bg-orange-50 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  Connect Now
                </button>
              </div>
            </div>

            <!-- Pages 2-7: Features with Screenshots -->
            <div v-else-if="currentSlideData.features" class="space-y-6">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  {{ currentSlideData.description }}
                </p>
              </div>

              <!-- Screenshot -->
              <div v-if="currentSlideData.image" class="flex justify-center my-6">
                <div class="relative max-w-3xl w-full">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-xl blur-xl opacity-20"></div>
                  <img
                    :src="currentSlideData.image"
                    :alt="currentSlideData.title"
                    class="relative w-full h-auto rounded-xl shadow-2xl border border-gray-200"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Features List -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-6">
                <div
                  v-for="(feature, index) in currentSlideData.features"
                  :key="index"
                  class="flex items-start space-x-3 p-4 bg-orange-50 rounded-xl"
                >
                  <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <component :is="feature.icon" class="w-5 h-5 text-white" />
                  </div>
                  <span class="text-sm font-medium text-gray-700 pt-2">{{ feature.text }}</span>
                </div>
              </div>
            </div>

            <!-- Page 7: Campaigns - Custom Empty State Style -->
            <div v-else-if="currentSlideData.id === 'zapgoals'" class="space-y-6">
              <!-- Screenshot -->
              <div v-if="currentSlideData.image" class="flex justify-center mb-8">
                <div class="relative max-w-4xl w-full">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-2xl blur-3xl opacity-20"></div>
                  <img
                    :src="currentSlideData.image"
                    :alt="currentSlideData.title"
                    class="relative w-full h-auto rounded-2xl shadow-2xl border-4 border-white"
                  />
                </div>
              </div>

              <div class="text-center max-w-3xl mx-auto">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-lg text-gray-600 leading-relaxed mb-8">
                  Create fundraising campaigns with customizable goals. Share campaign links, track progress in real-time, and celebrate milestones with your community.
                </p>

                <!-- Campaign Features -->
                <div class="grid md:grid-cols-2 gap-4 text-left">
                  <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                    <div class="flex items-start space-x-3">
                      <IconTarget class="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 class="font-bold text-gray-900 mb-1">Campaign Creation</h4>
                        <p class="text-sm text-gray-600">Set goals and customize your fundraising page</p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                    <div class="flex items-start space-x-3">
                      <IconBolt class="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 class="font-bold text-gray-900 mb-1">Real-Time Tracking</h4>
                        <p class="text-sm text-gray-600">Monitor progress and supporter contributions live</p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                    <div class="flex items-start space-x-3">
                      <IconChartBar class="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 class="font-bold text-gray-900 mb-1">Progress Analytics</h4>
                        <p class="text-sm text-gray-600">Detailed insights on campaign performance</p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                    <div class="flex items-start space-x-3">
                      <IconUsers class="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 class="font-bold text-gray-900 mb-1">Community Engagement</h4>
                        <p class="text-sm text-gray-600">Share links and engage with your supporters</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Page 8: FAQ -->
            <div v-else-if="currentSlideData.id === 'faq'" class="space-y-6">
              <div class="text-center mb-8">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600">
                  Everything you need to know about ZapTracker
                </p>
              </div>

              <div class="max-w-3xl mx-auto space-y-4">
                <div
                  v-for="(faq, index) in currentSlideData.faqs"
                  :key="index"
                  class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100"
                >
                  <h3 class="font-bold text-gray-900 mb-2 flex items-start">
                    <span class="text-orange-500 mr-2">Q:</span>
                    <span>{{ faq.q }}</span>
                  </h3>
                  <p class="text-gray-600 text-sm leading-relaxed ml-6">
                    {{ faq.a }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Page 9: How to Get Started -->
            <div v-else-if="currentSlideData.id === 'howto'" class="space-y-8">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600">
                  Follow these simple steps to unlock all features
                </p>
              </div>

              <div class="max-w-2xl mx-auto space-y-6">
                <div
                  v-for="step in currentSlideData.steps"
                  :key="step.number"
                  class="flex items-start space-x-4 p-5 bg-white rounded-xl border-2 border-orange-100 hover:border-orange-300 transition-all"
                >
                  <div class="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span class="text-white text-xl font-bold">{{ step.number }}</span>
                  </div>
                  <div class="flex-1 pt-1">
                    <h3 class="font-bold text-gray-900 mb-1">{{ step.title }}</h3>
                    <p class="text-sm text-gray-600 leading-relaxed">{{ step.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Page 10: Final CTA -->
            <div v-else-if="currentSlideData.isFinal" class="text-center">
              <div class="flex justify-center mb-8">
                <div class="relative">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                  <img
                    src="/new_logo3.png"
                    alt="ZapTracker Logo"
                    class="relative w-32 h-32 object-contain"
                  />
                </div>
              </div>

              <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                {{ currentSlideData.title }}
              </h2>

              <p class="text-lg text-gray-600 max-w-2xl mx-auto mb-12">
                {{ currentSlideData.subtitle }}
              </p>

              <!-- CTAs -->
              <div class="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto mb-8">
                <button
                  @click="handleGetStarted"
                  class="flex-1 px-10 py-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg rounded-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3"
                >
                  <IconLogin class="w-6 h-6" />
                  <span>Connect with Nostr</span>
                </button>
                <button
                  @click="handleViewOnly"
                  class="flex-1 px-10 py-6 bg-white border-2 border-gray-300 text-gray-700 text-lg rounded-xl font-bold hover:bg-gray-50 hover:border-gray-400 hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3"
                >
                  <IconEye class="w-6 h-6" />
                  <span>Read-Only Mode</span>
                </button>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-2xl mx-auto">
                <p class="text-sm text-gray-700">
                  <strong>Read-Only Mode:</strong> Explore ZapTracker by entering any public Nostr npub to view their analytics and activity.
                </p>
              </div>

              <div class="mt-6">
                <a
                  href="https://usenostr.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-orange-600 hover:text-orange-700 hover:underline inline-block"
                >
                  New to Nostr? Learn more →
                </a>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Navigation Footer -->
      <div class="border-t border-gray-200 p-4 bg-gray-50">
        <div class="flex justify-between items-center">
          <button
            @click="prevSlide"
            :disabled="!canGoPrev"
            :class="[
              'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2',
              canGoPrev
                ? 'text-gray-700 hover:bg-gray-200'
                : 'text-gray-400 cursor-not-allowed'
            ]"
          >
            <IconChevronLeft class="w-5 h-5" />
            <span>Back</span>
          </button>

          <div class="text-sm text-gray-500 font-medium">
            {{ currentSlide + 1 }} / {{ totalSlides }}
          </div>

          <button
            v-if="canGoNext"
            @click="nextSlide"
            class="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
          >
            <span>Next</span>
            <IconChevronRight class="w-5 h-5" />
          </button>
          <button
            v-else
            @click="handleGetStarted"
            class="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
