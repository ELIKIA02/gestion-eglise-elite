import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  const API_PORT = process.env.API_PORT || '3001';
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      manifest: {
        name: "ELIKIA EKLESIA",
        short_name: 'EKLESIA',
        description: 'Application de gestion paroissiale complète — membres, trésorerie, cultes et communications',
        lang: 'fr',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [
          '**/dist/**',
          '**/wa_auth/**',
          '**/server.ts',
          '**/whatsapp-client.ts',
          '**/pinned-groups.json',
          '**/scheduled-messages.json',
          '**/node_modules/**',
        ],
      },
      proxy: {
        '/api': {
          target: `http://localhost:${API_PORT}`,
          changeOrigin: true,
        },
      },
    },
  };
});
