import { defineConfig } from 'vite';
import path from 'path';
import { version } from './package.json';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'NostrPassLiteEmbassy',
      formats: ['iife'],
      fileName: () => 'lite-embassy.iife.js',
    },
    outDir: `dist/cdn/${version}`,
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
        footer: `
if (typeof document !== 'undefined' && document.currentScript?.hasAttribute('data-auto-init') && typeof window !== 'undefined' && typeof window.initNostrPassLite === 'function') {
  window.initNostrPassLite();
}
`,
      },
    },
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
      format: {
        comments: false,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    '__LITE_EMBASSY_VERSION__': JSON.stringify(version),
  },
});
