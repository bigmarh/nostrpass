import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), solid()],
  base: './',
  server: { port: 3411 },
  build: {
    rollupOptions: {
      input: {
        // Vault SPA (iframe) + top-level Google auth popup page.
        main: `${root}index.html`,
        auth: `${root}auth.html`,
      },
    },
  },
});
