import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['eventflow.uixai.org', 'localhost'],
    proxy: {
      '/api': {
        // Use API_PROXY_TARGET for server-side proxy (Docker: http://api:3000)
        // VITE_API_URL is for browser-side and should be /api to use proxy
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
