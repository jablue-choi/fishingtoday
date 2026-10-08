import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '오늘낚시 - 물때, 날씨, 낚시 기록',
        short_name: '오늘낚시',
        description: '현위치 찍고 조과 기록, 물때·금어기 자동 확인',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        background_color: '#ECEDEA',
        theme_color: '#2B2D2A',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // 오프라인에서도 앱 셸은 뜨게. API 응답은 캐시 안 함.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
