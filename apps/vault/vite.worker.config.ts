import { defineConfig } from 'vite';
import path from 'path';
import { wasmPlugin } from './vite-plugin-wasm';

// Separate Vite config for building the SharedWorker as classic script (IIFE)
export default defineConfig({
  plugins: [wasmPlugin()],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/workers/crypto.worker.shared.ts'),
      name: 'CryptoWorker',
      formats: ['iife'],
      fileName: () => 'crypto.worker.js',
    },
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        // Ensure all dependencies are bundled
        manualChunks: undefined,
      },
      // Bundle all external dependencies
      external: [],
    },
    // Target older browsers for better compatibility
    target: 'es2015',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.url': JSON.stringify(''),
    'import.meta': JSON.stringify({ url: '' }),
  },
});