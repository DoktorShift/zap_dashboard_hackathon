import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {VitePWA} from 'vite-plugin-pwa'

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
                theme_color: '#fb933c',
                id: '/',
                dir: 'ltr',
                categories: ['productivity', 'finance', 'utilities'],
                iarc_rating_id: '',
                prefer_related_applications: false,
                related_applications: [],
                scope_extensions: [],
                orientation: 'portrait',
                launch_handler: {
                    client_mode: 'auto'
                },
                icons: [
                    {
                        src: 'new_logo3.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'new_logo3.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ],
                screenshots: [
                    {
                        src: 'dashboard.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Main dashboard view'
                    },
                    {
                        src: 'wallet.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Wallet overview'
                    },
                    {
                        src: 'analytics.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Analytics dashboard'
                    },
                    {
                        src: 'zaps.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Zap feed view'
                    },
                    {
                        src: 'chat_zap_2.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Zap feed view'
                    }
                ]
            }
        })
    ],
})
