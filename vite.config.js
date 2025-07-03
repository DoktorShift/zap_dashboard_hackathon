import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Zap Dashboard',
        short_name: 'ZapDash',
        description: 'Lightning-powered dashboard for Nostr and more!',
        theme_color: '#42b883',
        icons: [
          {
            src: 'dashboard.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'dashboard.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
