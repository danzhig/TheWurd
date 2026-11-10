import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'phone',
      testIgnore: /perf\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false },
    },
    {
      name: 'desktop',
      testIgnore: /perf\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Cross-browser QA (M7): the QA sweep on real-device profiles and the other engines.
    // Firefox and WebKit run in CI's "browsers" job (ALL_BROWSERS=1), where they are installed.
    {
      name: 'android',
      testMatch: /(qa|smoke|search)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    ...(process.env.ALL_BROWSERS
      ? [
          {
            name: 'iphone',
            testMatch: /(qa|smoke|search)\.spec\.ts/,
            use: { ...devices['iPhone 14'] },
          },
          {
            name: 'safari',
            testMatch: /(qa|smoke|search)\.spec\.ts/,
            use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
          },
          {
            name: 'firefox',
            testMatch: /(qa|smoke|search)\.spec\.ts/,
            use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
          },
        ]
      : []),
    // Frame timing runs alone, after everything else, at phone size.
    {
      name: 'perf',
      testMatch: /perf\.spec\.ts/,
      dependencies: ['phone', 'desktop', 'android'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false },
    },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs out ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
