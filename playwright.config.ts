import { defineConfig } from '@playwright/test';

const RUN_ID = process.env.RUN_ID || 'local';
const DATE = new Date().toISOString().slice(0, 10);

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { channel: 'chrome' } },
  ],
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/test-results/report.json' }],
  ],
  outputDir: `tests/test-results/${RUN_ID}-${DATE}`,
});
