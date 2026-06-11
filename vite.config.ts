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
        name: "Gestion d'Église Élite",
        short_name: 'Église',
        description: 'Application de gestion paroissiale complète — membres, trésorerie, cultes et communications',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        icons: [
          {
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Ctext y='140' font-size='140'%3E%E2%9B%AA%3C/text%3E%3C/svg%3E",
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Ctext y='370' font-size='370'%3E%E2%9B%AA%3C/text%3E%3C/svg%3E",
            sizes: '512x512',
            type: 'image/svg+xml',
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
