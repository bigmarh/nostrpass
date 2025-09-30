import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 4000,
    host: true,
    open: false
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  // Serve existing public assets
  publicDir: 'public'
});