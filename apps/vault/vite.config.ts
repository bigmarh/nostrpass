import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { wasmPlugin } from './vite-plugin-wasm';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    solid(),
    wasmPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'service-worker': path.resolve(__dirname, 'src/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js';
        },
      },
    },
  },
  worker: {
    format: 'es',
    plugins: () => [wasmPlugin()],
  },
  optimizeDeps: {
    exclude: ['@nostrpass/worker-messenger'],
  },
}); 