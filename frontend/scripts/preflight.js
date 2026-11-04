/** Capture representative browser structure and styles for source-guided UI review. */
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from 'vite';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const records = [];
await mkdir('screenshots', { recursive: true });

/** Record semantic hierarchy, actual computed styling and HTML without exposing credentials. */
async function capture(name) {
  const tree = await page.accessibility.snapshot();
  const styles = await page.evaluate(() => ({
    bodyFont: getComputedStyle(document.body).fontFamily,
    headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
    headingSize: getComputedStyle(document.querySelector('h1')).fontSize,
    background: getComputedStyle(document.querySelector('#root > div')).backgroundColor,
    viewport: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  records.push({ name, tree, styles, html: await page.content() });
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
}

try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(env.E2E_BASE_URL || 'http://127.0.0.1:4173');
  await capture('landing-desktop-empty');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await capture('login-validation');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await capture('admin-desktop-empty');
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await capture('users-mobile-open-navigation');
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
  await capture('write-mobile');
  await writeFile('preflight.txt', JSON.stringify({ errors, records }, null, 2));
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
} finally {
  await browser.close();
}
