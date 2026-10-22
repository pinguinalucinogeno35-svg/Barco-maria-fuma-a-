import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  envDir: '../..',
  server: { port: 5173 },
  plugins: [
    react(),
    // `npm run dev:*:celular` liga HTTPS de teste: a camera do celular exige conexao segura
    ...(process.env.DEV_HTTPS ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rede Frio Técnico',
        short_name: 'RF Técnico',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6fcfe',
        theme_color: '#072a69',
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
