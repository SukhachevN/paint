import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false,
  use: { channel: 'chrome', locale: 'ru-RU', baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 1000 }, headless: true },
  webServer: { command: 'npm run dev -- --port 5178 --strictPort', url: 'http://127.0.0.1:5178', reuseExistingServer: !process.env.CI },
});
