import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    watch: { usePolling: true },
    proxy: {
      '/api': { target: 'http://backend:4000', changeOrigin: true },
      '/uploads': { target: 'http://backend:4000', changeOrigin: true },
      '/socket.io': { target: 'http://backend:4000', ws: true, changeOrigin: true },
      '/cp-proxy': {
        target: 'https://sepomex.icalialabs.com/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cp-proxy/, ''),
        secure: true,
      },
    },
  },
});
