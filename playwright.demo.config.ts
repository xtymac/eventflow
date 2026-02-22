import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './demo-tests',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.DEMO_BASE_URL || 'https://eventflow.uixai.org',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
    screenshot: 'off',
    trace: 'off',
    launchOptions: {
      args: ['--window-size=1920,1080'],
    },
  },
  projects: [
    { name: 'demo', use: { channel: 'chrome' } },
  ],
  outputDir: 'artifacts/demo/raw',
});
