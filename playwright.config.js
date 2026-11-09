import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://localhost:5180', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'node scripts/e2e-server.js',
      url: 'http://127.0.0.1:4100/api/v1/health',
      timeout: 600000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -w client -- --port 5180 --strictPort',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:4100' },
      url: 'http://localhost:5180',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
