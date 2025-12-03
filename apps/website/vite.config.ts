import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public', // Serve from public directory (where frontend builds to)
  server: {
    port: 4000,
    host: true,
    open: false
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});