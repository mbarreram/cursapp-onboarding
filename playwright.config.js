const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.CURSAPP_URL || 'https://cursapp-onboarding.pages.dev',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } }
  ],
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']]
});
