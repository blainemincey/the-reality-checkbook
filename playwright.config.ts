import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests gate Phase 2. They require:
 *   - TEST_DATABASE_URL pointing at a throwaway Postgres (NOT the dev DB)
 *   - a working `pnpm build` — Playwright boots `next start` under webServer
 *
 * Run with:
 *   TEST_DATABASE_URL=postgres://... npm run test:e2e
 *
 * First time only:
 *   npx playwright install chromium
 */

const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? '',
      SESSION_SECRET:
        process.env['SESSION_SECRET'] ??
        'playwright-test-session-secret-not-for-prod-use',
      NODE_ENV: 'production',
    },
  },
});
