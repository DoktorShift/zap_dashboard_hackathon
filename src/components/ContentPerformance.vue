<script setup>
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { IconTrendingUp, IconBolt, IconEye, IconUsers } from '@iconify-prerendered/vue-tabler'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
])

const props = defineProps({
  contentItems: {
    type: Array,
    required: true
  }
})

// Revenue trend chart
const revenueChartOption = computed(() => {
  // Mock data for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.floor(Math.random() * 20000) + 5000
    }
  })
  
  return {
    title: {
      text: 'Revenue Trend (Last 7 Days)',
      textStyle: { color: '#7c2d12', fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#f97316',
      textStyle: { color: '#374151' },
      formatter: function(params) {
        const data = params[0]
        return `${data.name}: ${data.value.toLocaleString()} sats`
      }
    },
    xAxis: {
      type: 'category',
      data: last7Days.map(d => d.date),
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { color: '#9a3412' }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { color: '#9a3412' }
    },
    series: [{
      data: last7Days.map(d => d.revenue),
      type: 'line',
      smooth: true,
      lineStyle: { color: '#f97316', width: 3 },
      itemStyle: { color: '#f97316' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(249, 115, 22, 0.3)' },
            { offset: 1, color: 'rgba(249, 115, 22, 0.05)' }
          ]
        }
      }
    }]
  }
})

// Content performance chart
const performanceChartOption = computed(() => {
  const topContent = props.contentItems
    .slice(0, 5)
    .map(item => ({
      name: item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title,
      revenue: item.revenue,
      unlocks: item.unlocks
    }))
  
  return {
    title: {
      text: 'Top Performing Content',
      textStyle: { color: '#7c2d12', fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#f97316',
      textStyle: { color: '#374151' }
    },
    legend: {
      data: ['Revenue (sats)', 'Unlocks'],
      textStyle: { color: '#7c2d12' }
    },
    xAxis: {
      type: 'category',
      data: topContent.map(item => item.name),
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { 
        color: '#9a3412',
        rotate: 45,
        fontSize: 10
      }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Revenue (sats)',
        position: 'left',
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412' }
      },
      {
        type: 'value',
        name: 'Unlocks',
        position: 'right',
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412' }
      }
    ],
    series: [
      {
        name: 'Revenue (sats)',
        type: 'bar',
        yAxisIndex: 0,
        data: topContent.map(item => item.revenue),
        itemStyle: { color: '#f97316' }
      },
      {
        name: 'Unlocks',
        type: 'line',
        yAxisIndex: 1,
        data: topContent.map(item => item.unlocks),
        lineStyle: { color: '#10b981', width: 3 },
        itemStyle: { color: '#10b981' }
      }
    ]
  }
})

// Performance insights
const insights = computed(() => {
  const totalRevenue = props.contentItems.reduce((sum, item) => sum + item.revenue, 0)
  const totalUnlocks = props.contentItems.reduce((sum, item) => sum + item.unlocks, 0)
  const avgPrice = props.contentItems.length > 0 
    ? Math.round(props.contentItems.reduce((sum, item) => sum + item.price, 0) / props.contentItems.length)
    : 0
  const conversionRate = totalUnlocks > 0 ? ((totalRevenue / totalUnlocks) / avgPrice * 100).toFixed(1) : 0
  
  return [
    {
      title: 'Avg Revenue per Content',
      value: props.contentItems.length > 0 
        ? Math.round(totalRevenue / props.contentItems.length).toLocaleString() + ' sats'
        : '0 sats',
      description: 'Average earnings per piece',
      icon: IconBolt,
      trend: '+12%'
    },
    {
      title: 'Conversion Rate',
      value: conversionRate + '%',
      description: 'Views to purchases',
      icon: IconTrendingUp,
      trend: '+5%'
    },
    {
      title: 'Avg Views per Content',
      value: props.contentItems.length > 0 
        ? Math.round(props.contentItems.reduce((sum, item) => sum + item.views, 0) / props.contentItems.length)
        : 0,
      description: 'Average views per piece',
      icon: IconEye,
      trend: '+8%'
    },
    {
      title: 'Subscriber Growth',
      value: props.contentItems.reduce((sum, item) => sum + item.subscribers, 0),
      description: 'Total active subscribers',
      icon: IconUsers,
      trend: '+15%'
    }
  ]
})
</script>

<template>
  <div class="space-y-6">
    <!-- Performance Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Revenue Trend -->
      <div class="bg-white/90 backdrop-blur-sm p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <VChart :autoresize="true" :option="revenueChartOption" style="height: 300px;" />
      </div>
      
      <!-- Content Performance -->
      <div class="bg-white/90 backdrop-blur-sm p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <VChart :autoresize="true" :option="performanceChartOption" style="height: 300px;" />
      </div>
    </div>
    
    <!-- Performance Insights -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <IconTrendingUp class="w-5 h-5 text-orange-600" />
        <span>Performance Insights</span>
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="insight in insights"
          :key="insight.title"
          class="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <component :is="insight.icon" class="w-5 h-5 text-orange-600" />
            </div>
            <span class="text-xs font-medium text-green-500">{{ insight.trend }}</span>
          </div>
          <h4 class="font-medium text-gray-900 mb-1">{{ insight.title }}</h4>
          <p class="text-2xl font-bold text-orange-600 mb-1">{{ insight.value }}</p>
          <p class="text-xs text-gray-600">{{ insight.description }}</p>
        </div>
      </div>
    </div>
    
    <!-- Monetization Tips -->
    <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-6 rounded-xl shadow-lg">
      <div class="flex items-start space-x-4">
        <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconBolt class="w-6 h-6" />
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold mb-2">💡 Monetization Tips</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 class="font-medium mb-1">Pricing Strategy</h4>
              <ul class="space-y-1 text-orange-100">
                <li>• Start with lower prices to build audience</li>
                <li>• Offer bundle deals for multiple articles</li>
              </ul>
            </div>
            <div>
              <h4 class="font-medium mb-1">Content Quality</h4>
              <ul class="space-y-1 text-orange-100">
                <li>• Provide substantial value in previews</li>
                <li>• Deliver on promises made in previews</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
