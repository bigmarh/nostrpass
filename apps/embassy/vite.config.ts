import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/embassy.ts'),
      name: 'NostrPassEmbassy',
      fileName: 'embassy',
      formats: ['iife', 'es', 'umd']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  },
});