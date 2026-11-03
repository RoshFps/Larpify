import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// `npm run screenshots` regenerates docs/screenshots from the mocked app.
export default defineConfig({
  ...base,
  testDir: 'tests/screenshots',
  projects: [{ name: 'screenshots' }],
  reporter: 'list',
});
