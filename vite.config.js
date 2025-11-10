import { defineConfig, loadEnv } from 'vite';

// Vite dev proxy: allow the SPA on :5173 to call the API on :8888 via the same origin (/api/*)
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
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
    // Make sure env vars are defined
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL),
    },
  };
});
