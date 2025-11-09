import { defineConfig } from 'vite';

// Vite dev proxy: allow the SPA on :5173 to call the API on :8888 via the same origin (/api/*)
export default defineConfig({
  base: '/LANGUAGE_GAME/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
