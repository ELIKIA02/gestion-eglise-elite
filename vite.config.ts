import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const API_PORT = process.env.API_PORT || '3001';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
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
