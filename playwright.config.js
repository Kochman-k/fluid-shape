import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
