import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 3001,
    headers: {
      'Content-Security-Policy': "frame-ancestors *;",
      'X-Frame-Options': 'ALLOWALL'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info', 'console.warn']
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'nostr': ['nostr-tools'],
          'crypto': ['@noble/secp256k1', '@noble/hashes']
        }
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(process.env.VITE_SENTRY_DSN || ''),
    'import.meta.env.VITE_VAULT_ORIGIN': '"https://vault.nostrpass.com"'
  },
  // Ensure WASM files are served with correct MIME type
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@nostrpass/crypto-wasm']
  }
});