import { defineConfig, devices } from '@playwright/test';

// Browser tests against a production-style build of the app (`--mode e2e`, which points
// Firebase at the local emulators), at phone and desktop sizes. Run through
// `npm run test:e2e`, which starts the Auth + Firestore emulators and seeds market data
// (e2e/global-setup.ts). In CI the browser comes from `npx playwright install chromium`;
// in a Claude cloud session set PW_CHROMIUM=/opt/pw-browsers/chromium.
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/app/',
    // Most tests skip the launch animation and the first sign-in welcome; e2e/welcome.spec.ts
    // turns both back on.
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:4173', localStorage: [{ name: 'zelosSplashOff', value: '1' }, { name: 'zelosWelcomeSkip', value: '1' }] }] },
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npx vite build --mode e2e --outDir dist-e2e && npx vite preview --outDir dist-e2e --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:4173/app/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
