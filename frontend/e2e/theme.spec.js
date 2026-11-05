/** Exercise appearance through real public, user and Admin UI journeys. */
import { test, expect } from './fixtures.js';

/** Verify accessible state and the actual scalar preference/root class. */
async function expectMode(page, mode) {
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', String(mode === 'dark'));
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(mode === 'dark');
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(mode);
}

test('keyboard preference survives registration, workspace navigation, reload and logout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBeNull();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const toggle = page.getByRole('button', { name: 'Dark mode' });
  await expect(toggle).toBeFocused();
  expect(await toggle.evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe('none');
  await page.keyboard.press('Space');
  await expectMode(page, 'dark');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expectMode(page, 'light');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name', { exact: true }).fill('Theme Writer');
  await page.getByLabel('Username', { exact: true }).fill('theme-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expectMode(page, 'dark');
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expectMode(page, 'dark');
  await page.reload();
  await expectMode(page, 'dark');
  await page.getByRole('button', { name: 'Theme Writer profile' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectMode(page, 'dark');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users'))[0].username)).toBe('theme-writer');
});

test('mobile Admin toggle remains visible with collapsed navigation and survives logout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Dark mode' })).toBeInViewport();
  await expectMode(page, 'dark');
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expectMode(page, 'light');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expectMode(page, 'light');
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await page.screenshot({ path: 'test-results/theme-mobile-admin.png', fullPage: true });
  await page.getByRole('button', { name: 'Admin profile' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectMode(page, 'dark');
});

test('failed preference save keeps the UI responsive and retries only on activation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expectMode(page, 'dark');
  await page.evaluate(() => {
    window.themeOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'writespace_theme') throw new DOMException('full', 'QuotaExceededError');
      return window.themeOriginalSetItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  await expect(page.getByRole('status')).toContainText('could not be saved');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => { Storage.prototype.setItem = window.themeOriginalSetItem; });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expectMode(page, 'dark');
  await expect(page.getByRole('status')).toHaveCount(0);
});
