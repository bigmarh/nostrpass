import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

// Plugin to copy manifest and assets to dist
function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    writeBundle() {
      // Ensure dist exists
      if (!existsSync('dist')) {
        mkdirSync('dist', { recursive: true });
      }
      // Copy manifest
      copyFileSync('public/manifest.json', 'dist/manifest.json');
      // Copy icons directory
      if (!existsSync('dist/icons')) {
        mkdirSync('dist/icons', { recursive: true });
      }
      const iconsDir = 'public/icons';
      if (existsSync(iconsDir)) {
        readdirSync(iconsDir).forEach((file) => {
          copyFileSync(`${iconsDir}/${file}`, `dist/icons/${file}`);
        });
      }
      // Copy root-level public assets (backgrounds, etc.)
      const publicDir = 'public';
      readdirSync(publicDir).forEach((file) => {
        const src = `${publicDir}/${file}`;
        // Skip directories and manifest (already copied)
        if (file !== 'icons' && file !== 'manifest.json' && !existsSync(`${src}/`)) {
          copyFileSync(src, `dist/${file}`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [solid(), tailwindcss(), copyManifestPlugin()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'window-nostr': resolve(__dirname, 'src/content/window-nostr.ts'),
        'crypto.worker': resolve(__dirname, 'src/workers/crypto.worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background, content, and worker scripts at root level
          if (
            ['background', 'content', 'window-nostr', 'crypto.worker'].includes(chunkInfo.name)
          ) {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'esnext',
    minify: 'esbuild',
  },
});
