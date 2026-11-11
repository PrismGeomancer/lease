import { defineConfig, devices } from '@playwright/test';

// Second build has an office address baked in (so "Record on-chain" exists) and is served on 4174.
export const E2E_OFFICE = 'So11111111111111111111111111111111111111112';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: [
    { command: 'npm run build && npm run preview -- --port 4173', port: 4173, reuseExistingServer: true },
    {
      command: `VITE_OFFICE_ADDRESS=${E2E_OFFICE} npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4174`,
      port: 4174, reuseExistingServer: true,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
