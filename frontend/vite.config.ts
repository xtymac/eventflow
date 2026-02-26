import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Reject requests with malformed URIs before Vite's static middleware calls decodeURI()
function rejectMalformedUris(): Plugin {
  return {
    name: 'reject-malformed-uris',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          decodeURI(req.url!);
        } catch {
          res.statusCode = 400;
          res.end('Bad Request');
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [rejectMalformedUris(), react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['eventflow.uixai.org', 'v1.eventflow.uixai.org', 'demo.eventflow.uixai.org', 'localhost', 'web', 'demo-web', 'nagoya-web', 'nagoya-web-v1'],
    proxy: {
      '/api': {
        // API_PROXY_TARGET: Docker uses http://api:3000, local dev uses demo API
        target: process.env.API_PROXY_TARGET || 'https://demo.eventflow.uixai.org',
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
