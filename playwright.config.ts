import { defineConfig, devices } from '@playwright/test';

// Smoke tests against a production build. Spotify is fully mocked (see
// tests/e2e/mockSpotify.ts), so no account or network access is needed.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SPOTIFY_CLIENT_ID: 'e2e-test-client-id', VITE_ACCESS_FORM_KEY: 'e2e-form-key' },
  },
});
