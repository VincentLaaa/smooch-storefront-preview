import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

let deploy = {};
try {
  deploy = JSON.parse(readFileSync(new URL('./results/deploy.json', import.meta.url), 'utf8'));
} catch {
  // deploy.json absent — tests will fail fast with a clear message.
}

export default defineConfig({
  testDir: './tests',
  outputDir: './results/test-artifacts',
  timeout: 60_000,
  retries: 1,
  workers: 2,
  reporter: [
    ['list'],
    ['json', { outputFile: 'qa/results/playwright.json' }],
    ['html', { outputFolder: 'qa/results/html-report', open: 'never' }],
  ],
  use: {
    baseURL: deploy.store ? `https://${deploy.store}` : undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    extraHTTPHeaders: { 'Accept-Language': 'en' },
  },
});
