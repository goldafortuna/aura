import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100';
const webServerPort = new URL(baseURL).port || '3100';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
    env: {
      ...process.env,
      DEV_BYPASS_AUTH: '1',
      DEV_BYPASS_EMAIL: process.env.DEV_BYPASS_EMAIL || 'playwright@local.test',
      DEV_BYPASS_ROLES: process.env.DEV_BYPASS_ROLES || 'secretary,super_admin',
      DEV_BYPASS_APPROVAL_STATUS: process.env.DEV_BYPASS_APPROVAL_STATUS || 'approved',
      E2E_MOCK_AI: '1',
      E2E_MOCK_GOOGLE_CALENDAR: '1',
      OBJECT_STORAGE_PROVIDER: process.env.OBJECT_STORAGE_PROVIDER || 'local',
      LOCAL_OBJECT_STORAGE_DIR: process.env.LOCAL_OBJECT_STORAGE_DIR || '.local-object-storage',
      PORT: webServerPort,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
