import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: 'online.spec.js',
  outputDir: 'test-results/online',
  use: {
    ...base.use,
    baseURL: process.env.ONLINE_BASE_URL || 'http://127.0.0.1:4187',
  },
  webServer: process.env.ONLINE_BASE_URL
    ? undefined
    : [
        {
          command: 'npm run preview -- --port 4187',
          url: 'http://127.0.0.1:4187',
          reuseExistingServer: !process.env.CI,
        },
        {
          command:
            'npx wrangler dev --config workers/wrangler.jsonc --port 8787 --persist-to /tmp/dragon-ball-online-test-state',
          url: 'http://127.0.0.1:8787/health',
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
      ],
});
