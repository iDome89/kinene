import { defineConfig, devices } from '@playwright/test';

const PORT = 4331;

export const E2E_ADMIN_PASSWORD = 'e2e-password';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /responsive\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['iPhone 13'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: 'sh scripts/e2e-prepare.sh && node ./dist/server/entry.mjs',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    env: {
      HOST: '127.0.0.1',
      PORT: String(PORT),
      DATABASE_URL: 'file:./data/e2e.db',
      UPLOAD_DIR: './data/e2e-uploads',
      SESSION_SECRET: 'e2e-secret-0123456789abcdef0123456789abcdef',
      ADMIN_PASSWORD_HASH:
        'scrypt.764d810bb349a681334ec06f0b48080b.639ad251e6c14ba3cbfac801901ba20bc2e5f740c6bfbfc5f77829c127a61740',
    },
  },
});
