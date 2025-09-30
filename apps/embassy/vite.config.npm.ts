import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/embassy.ts'),
      name: 'NostrPassEmbassy',
      formats: ['es', 'cjs'],
      fileName: (format) => `embassy.${format === 'es' ? 'js' : 'cjs'}`
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: ['nostr-tools', '@noble/secp256k1'],
      output: {
        preserveModules: false
      }
    },
    sourcemap: true,
    minify: false
  }
});