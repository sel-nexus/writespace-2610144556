/** Verify local identity journeys through real clicks; do not execute until parent approval. */
import { test, expect } from './fixtures.js';

test('register, reload, logout and log in again with durable browser data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name', { exact: true }).fill('Mira');
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users'))[0].username)).toBe('mira');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mira profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Mira profile' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).displayName)).toBe('Mira');
});

test('validates errors then logs in Admin and uses mobile profile/navigation controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Username is required.', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Invalid username or password.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await page.screenshot({ path: 'test-results/auth-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Admin profile' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  for (const field of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
    await expect(page.getByLabel(field, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  }
  await page.getByLabel('Display Name').fill('Writer');
  await page.getByLabel('Username').fill('ADMIN');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('other');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible();
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
});

test('partial-save recovery and failed logout remain truthful under injected browser failures', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Display Name').fill('Recovery');
  await page.getByLabel('Username').fill('recovery');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.evaluate(() => {
    window.originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'writespace_session') throw new DOMException('full', 'QuotaExceededError');
      return window.originalSet.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText(/account was saved locally/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')).length)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSet; });
  await page.getByRole('link', { name: 'Login', exact: true }).last().click();
  await page.getByLabel('Username').fill('recovery');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.evaluate(() => { Storage.prototype.removeItem = () => { throw new DOMException('blocked', 'SecurityError'); }; });
  await page.getByRole('button', { name: 'Recovery profile' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not log out.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).username)).toBe('recovery');
});
