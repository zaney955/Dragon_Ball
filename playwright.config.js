import { defineConfig } from '@playwright/test';
const previewURL = process.env.DB_PREVIEW_URL || 'http://127.0.0.1:4173';
const nativeGPU = process.platform === 'darwin' && !process.env.DB_SOFTWARE_GPU;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 300_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: previewURL,
    viewport: { width: 1024, height: 640 },
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: {
      args: nativeGPU
        ? ['--enable-webgl', '--use-angle=metal']
        : ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: previewURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
