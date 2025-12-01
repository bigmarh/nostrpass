import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: '../website/public',
    emptyOutDir: false,  // Don't empty since app-2 will also write here
    rollupOptions: {
      output: {
        entryFileNames: 'assets/frontend.[hash].js',
        chunkFileNames: 'assets/frontend.[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.html')) {
            return 'index.html';  // frontend becomes index.html
          }
          return 'assets/frontend.[hash].[ext]';
        }
      }
    }
  }
})
