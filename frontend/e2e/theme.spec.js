/** Exercise appearance through real public/auth links, browser storage and native controls. */
import { test, expect } from '@playwright/test';

/** Capture browser failures before navigation and assert them even if a journey fails. */
test.beforeEach(async ({ page }) => {
  page.themeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') page.themeErrors.push(message.text());
  });
  page.on('pageerror', (error) => page.themeErrors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(page.themeErrors).toEqual([]);
});

test('mobile public and workspace controls preserve dark across auth, reload and logout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Switch to dark mode' });
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await toggle.press('Enter');
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['writespace_theme']);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Username is required.', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page.getByText('No posts yet', { exact: false }).first()).toBeVisible();
  const session = await page.evaluate(() => localStorage.getItem('writespace_session'));
  expect(JSON.parse(session)).toMatchObject({ username: 'admin', role: 'admin' });
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.getByRole('button', { name: 'Switch to light mode' }).press('Space');
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(session);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('link', { name: 'WriteSpace.' }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await page.getByRole('button', { name: 'Admin profile' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.screenshot({ path: testInfo.outputPath('theme-mobile-dark.png'), fullPage: true });
});

test('desktop public links retain appearance and registration errors remain usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Display Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Display Name', { exact: true })).toHaveAccessibleDescription(/required/i);
  await page.getByRole('region', { name: 'Registration form' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await page.screenshot({ path: testInfo.outputPath('theme-desktop-light.png'), fullPage: true });
});

test('failed preference persistence does not block appearance or public routes', async ({ page }) => {
  await page.goto('/');
  // Deliberately fault only the browser persistence boundary, not app/domain code.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'writespace_theme') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBeNull();
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page.getByLabel('Display Name', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});
