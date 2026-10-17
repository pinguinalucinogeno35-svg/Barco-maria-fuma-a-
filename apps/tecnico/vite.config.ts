import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  envDir: '../..',
  server: { port: 5173 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AC Técnico',
        short_name: 'AC Técnico',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#f3f6f9',
        theme_color: '#0b6fb8',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // chamadas ao Supabase nunca passam pelo cache do service worker
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
      },
    }),
  ],
});
