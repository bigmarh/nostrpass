import { defineConfig } from 'vite';
import path from 'path';
import { version } from './package.json';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/embassy.ts'),
      name: 'NostrPassEmbassy',
      formats: ['iife'],
      fileName: () => 'embassy.iife.js'
    },
    outDir: `dist/cdn/${version}`,
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true
      }
    },
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info']
      },
      format: {
        comments: false
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    '__EMBASSY_VERSION__': JSON.stringify(version)
  }
});