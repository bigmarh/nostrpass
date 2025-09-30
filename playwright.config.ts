import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 60_000,
  testDir: './tests/e2e',
  use: {
    headless: false, // Set to false for debugging
    viewport: { width: 1280, height: 800 },
    baseURL: 'http://localhost:3000'
  },
  reporter: [['list']],
  webServer: [
    {
      command: 'cd apps/vault && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'cd apps/website && npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    {
      name: 'vault',
      testMatch: '**/vault.spec.ts',
      use: { baseURL: 'http://localhost:3001' }
    },
    {
      name: 'provider',
      testMatch: '**/provider.spec.ts',
      use: { baseURL: 'http://localhost:3000' }
    }
  ]
};

export default config;


