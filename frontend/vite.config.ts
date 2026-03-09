import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['nagoya.uixai.org', 'localhost', 'web', 'nagoya-web'],
    proxy: {
      '/api': {
        // API_PROXY_TARGET: Docker uses http://api:3000, local dev uses production API
        target: process.env.API_PROXY_TARGET || 'https://nagoya.uixai.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
