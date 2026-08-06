import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Offline MVP QA — runs against the local render harness (dev/server.mjs).
    No Shopify credentials involved; auto-starts the server. */
export default defineConfig({
  testDir: './tests-local',
  outputDir: './results/local-artifacts',
  timeout: 45_000,
  retries: 1,
  workers: 1, // harness cart is a single shared state; serialize
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/local-playwright.json' }],
    ['html', { outputFolder: 'results/local-html-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:9292',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node dev/server.mjs',
    cwd: repoRoot,
    url: 'http://127.0.0.1:9292/',
    reuseExistingServer: true,
    timeout: 30_000,
    env: { HARNESS_BADGE: process.env.HARNESS_BADGE ?? '1' },
  },
});
