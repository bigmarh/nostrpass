import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    writeBundle() {
      if (!existsSync('dist')) {
        mkdirSync('dist', { recursive: true });
      }
      copyFileSync('public/manifest.json', 'dist/manifest.json');
    },
  };
}

export default defineConfig({
  plugins: [copyManifestPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'window-nostr': resolve(__dirname, 'src/content/window-nostr.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (['background', 'content', 'window-nostr'].includes(chunk.name)) {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'esnext',
  },
});
