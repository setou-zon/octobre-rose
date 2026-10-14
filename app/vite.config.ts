import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// L'application est publiée sur https://setou-zon.github.io/octobre-rose/
const BASE = process.env.BASE_PATH ?? '/octobre-rose/';

export default defineConfig({
  base: BASE,
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Octobre Rose 2026 – Collecte ADG',
        short_name: 'Octobre Rose',
        description: 'Saisie des outils de collecte et tableau de bord de la campagne Octobre Rose 2026 (ADG).',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#fdf2f6',
        theme_color: '#9c1450',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
