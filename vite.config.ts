import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      selfDestroying: true,
      devOptions: {
        enabled: false,
      },
      includeAssets: [
        'favicon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-192x192.svg',
        'maskable-512x512.svg',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: null,
      },
      manifest: {
        name: 'Raiz Movimento',
        short_name: 'Raiz',
        description: 'Plataforma de treinos e negociação entre atletas e profissionais.',
        lang: 'pt-BR',
        theme_color: '#F2D9DC',
        background_color: '#faf8f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: '/',
        categories: ['fitness', 'health', 'sports'],
        screenshots: [
          {
            src: '/screenshot-home.jpg',
            sizes: '750x1334',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Dashboard inicial',
          },
        ],
        shortcuts: [
          {
            name: 'Agenda',
            short_name: 'Agenda',
            url: '/agenda',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Mensagens',
            short_name: 'Chat',
            url: '/mensagens',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Perfil',
            short_name: 'Perfil',
            url: '/perfil',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: '/maskable-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    })
  ],
})
