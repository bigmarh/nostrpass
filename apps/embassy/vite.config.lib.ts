import { defineConfig } from 'vite';
import path from 'path';

// Separate config for building embassy.js library
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/embassy.ts'),
      name: 'NostrPassEmbassy',
      fileName: 'embassy',
      formats: ['iife'] // Single file for <script> tag
    },
    outDir: 'dist-lib',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: [], // Bundle everything
      output: {
        // Make it self-initializing if data-auto-init is present
        footer: `
// Auto-initialize with default config if script has data-auto-init
if (document.currentScript?.hasAttribute('data-auto-init')) {
  window.initNostrPass();
}`
      }
    }
  }
});