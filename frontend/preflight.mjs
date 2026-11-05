/** Capture representative accessible structure and styling for human review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await mkdir('preflight', { recursive: true });
const captures = [];
for (const [name, path, width, theme, session] of [
  ['public-light', '/', 1280, 'light', null],
  ['public-dark-mobile', '/', 390, 'dark', null],
  ['login-error-dark', '/login', 390, 'dark', null],
  ['editor-dark', '/write', 1280, 'dark', { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' }],
  ['admin-dark-mobile', '/users', 390, 'dark', { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }],
]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(base);
  await page.evaluate(({ theme, session }) => {
    localStorage.clear();
    localStorage.setItem('writespace_theme', theme);
    if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
  }, { theme, session });
  await page.goto(base + path);
  if (name === 'login-error-dark') await page.getByRole('button', { name: 'Login', exact: true }).click();
  if (name === 'editor-dark') await page.getByLabel('Content', { exact: true }).fill('A working draft.');
  if (name === 'admin-dark-mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.screenshot({ path: `preflight/${name}.png`, fullPage: true });
  captures.push({ name, accessibility: await page.accessibility.snapshot(), styles: await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.querySelector('#root > div'));
    return { font: body.fontFamily, rootBackground: root.backgroundColor, rootColor: root.color, dark: document.documentElement.classList.contains('dark') };
  }), html: await page.content() });
}
await writeFile('preflight/evidence.json', JSON.stringify(captures, null, 2));
await browser.close();
