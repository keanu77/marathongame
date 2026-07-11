import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Fresh pages bake a 48-frame atlas and some result flows encode a 1080px
  // share card. Keep real actionability checks, while allowing slower CI and
  // mobile-emulation hosts enough time to finish trusted clicks.
  timeout: 60_000,
  // Runtime vector-atlas baking is intentionally exercised on every fresh
  // page. A single worker avoids mobile timeouts caused by two Chromium tabs
  // baking the 48-frame atlas at the same time on constrained machines.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    actionTimeout: 20_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
