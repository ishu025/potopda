import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds straight into ../public, which is the folder Express already
// serves as static files — so `npm run build` here is the only step
// needed before `npm start` in production. In dev, Vite runs its own
// server (default port 5173) and proxies API + Socket.IO traffic to the
// Express server on PORT (default 5000), so cookies/auth behave exactly
// like production without CORS headaches.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
});
