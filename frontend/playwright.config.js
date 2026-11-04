/** Run browser journeys from this tier against an environment-selected static preview. */
import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const baseURL = env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const target = new URL(baseURL);
export default defineConfig({
  testDir: './e2e', fullyParallel: false,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview',
    env: { VITE_HOST: target.hostname, VITE_PREVIEW_PORT: target.port || (target.protocol === 'https:' ? '443' : '80') },
    url: baseURL, reuseExistingServer: !process.env.CI, timeout: 30000,
  },
});
