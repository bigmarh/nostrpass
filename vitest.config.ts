import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/build/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@nostrpass/types': resolve(__dirname, 'packages/types/src'),
      '@nostrpass/messenger': resolve(__dirname, 'packages/messenger/src'),
      '@nostrpass/provider': resolve(__dirname, 'packages/provider/src'),
      '@nostrpass/nostrHelpers': resolve(__dirname, 'packages/nostrHelpers/src'),
      '@nostrpass/worker-messenger': resolve(__dirname, 'packages/worker-messenger/src')
    }
  }
});

