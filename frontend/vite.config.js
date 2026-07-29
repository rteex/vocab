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
        name:             'Vocab',
        short_name:       'Vocab',
        description:      'Personal vocabulary trainer',
        theme_color:      '#6db88a',
        background_color: '#0f1612',
        display:          'standalone',
        start_url:        '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache the app shell and API responses
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*\/me$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-me' },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/.*\/review$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-review' },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
