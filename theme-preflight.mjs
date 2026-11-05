/** Capture representative themed interfaces for source-guided human review. */
import { chromium } from './frontend/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const output = [];
try {
  await mkdir('review-evidence', { recursive: true });
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(baseURL);
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      output.push(JSON.stringify({ width, theme, url: page.url(), accessibility: await page.accessibility.snapshot(), styles: await page.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily, main: getComputedStyle(document.querySelector('main')).backgroundColor, root: document.documentElement.className })), html: await page.content() }));
      await page.screenshot({ path: `review-evidence/landing-${width}-${theme}.png`, fullPage: true });
    }
    await page.getByRole('link', { name: 'Login', exact: true }).first().click();
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    output.push(JSON.stringify({ width, state: 'dark-login-errors', accessibility: await page.accessibility.snapshot(), html: await page.content() }));
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.waitForURL('**/admin');
    await page.screenshot({ path: `review-evidence/admin-${width}-dark.png`, fullPage: true });
    output.push(JSON.stringify({ width, state: 'dark-admin-empty', accessibility: await page.accessibility.snapshot(), html: await page.content() }));
    await page.close();
  }
  await writeFile('review-evidence/theme-preflight.txt', output.join('\n'), 'utf8');
  console.log('Preflight captured desktop/mobile light/dark and error/admin states.');
} finally {
  await browser.close();
}
