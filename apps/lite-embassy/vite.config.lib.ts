import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'NostrPassLiteEmbassy',
      fileName: 'lite-embassy',
      formats: ['iife', 'es'],
    },
    outDir: 'dist-lib',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: [],
      output: {
        footer: `
if (typeof document !== 'undefined' && document.currentScript?.hasAttribute('data-auto-init') && typeof window !== 'undefined' && typeof window.initNostrPassLite === 'function') {
  window.initNostrPassLite();
}
`,
      },
    },
  },
});
