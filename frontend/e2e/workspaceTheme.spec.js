/** Exercise real themed reader/admin journeys; the shared fixture captures and rejects console/page errors. */
import { test, expect } from './fixtures.js';

/** Assert active preference and the rendered surface color, not just class presence. */
async function surface(page, locator, mode) {
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', String(mode === 'dark'));
  await expect(locator).toHaveCSS('background-color', mode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(mode);
}

/** Register an identity through the visible form without seeding domain records. */
async function register(page, name) {
  await page.getByLabel('Display Name', { exact: true }).fill(name);
  await page.getByLabel('Username', { exact: true }).fill(name.toLowerCase());
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
}

/** Sign out through the existing profile menu, preserving posts/users/theme. */
async function logout(page, name) {
  await page.getByRole('button', { name: name + ' profile' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Read the authoritative browser-local collection for no-op and persistence checks. */
async function posts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

test('reader themes preserve owned controls, readonly ownership, confirmation and persisted writing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await register(page, 'Owner');
  await surface(page, page.getByText('No blogs yet. Be the first to write one!', { exact: true }), 'dark');
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Theme field notes');
  await page.getByLabel('Content').fill('Persisted reader content');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const original = await posts(page);
  await surface(page, page.locator('main article'), 'dark');
  await expect(page.getByText(original[0].content, { exact: true })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Dark mode' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toBeFocused();
  expect(await toggle.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
  await surface(page, page.locator('main article'), 'light');
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Content')).toHaveValue(original[0].content);
  await page.getByLabel('Title').fill('Discarded title');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(await posts(page)).toEqual(original);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await posts(page)).toEqual(original);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await surface(page, page.locator('main article'), 'light');
  await page.reload();
  expect(await posts(page)).toEqual(original);
  await logout(page, 'Owner');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await register(page, 'Reader');
  await expect(page.getByRole('link', { name: 'Edit Theme field notes' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Read Theme field notes' }).click();
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await surface(page, page.locator('main article'), 'dark');
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  expect(await posts(page)).toEqual(original);
  await logout(page, 'Reader');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username').fill('owner');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Read Theme field notes' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await posts(page)).toEqual([]);
  await surface(page, page.getByText('No blogs yet. Be the first to write one!', { exact: true }), 'dark');
});

test('mobile Admin themes preserve validation, badges, safeguards and persisted account/post actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  const pending = page.getByRole('region', { name: 'Total users', exact: true });
  await surface(page, pending, 'dark');
  await expect(pending).toContainText('Metric pending definition');
  await expect(page.getByText('No posts yet.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users' }).click();
  const form = page.getByRole('region', { name: 'Create User' });
  await surface(page, form, 'dark');
  await expect(page.getByRole('article', { name: 'Account admin' }).getByRole('button')).toBeDisabled();
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByLabel('Role', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Display Name is required.', { exact: true })).toHaveCSS('color', 'rgb(252, 165, 165)');
  await page.getByLabel('Display Name', { exact: true }).fill('Staff');
  await page.getByLabel('Username', { exact: true }).fill('ADMIN');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Role', { exact: true }).selectOption('admin');
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Username').fill('staff');
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  const savedUsers = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  const staff = page.getByRole('article', { name: 'Account staff' });
  await surface(page, staff, 'dark');
  await expect(staff.getByText('Admin', { exact: true })).toHaveCSS('color', 'rgb(196, 181, 253)');
  await page.getByRole('button', { name: 'Dark mode' }).focus();
  await page.keyboard.press('Enter');
  await surface(page, form, 'light');
  page.once('dialog', (dialog) => dialog.dismiss());
  await staff.getByRole('button', { name: 'Delete staff' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(savedUsers);
  await page.reload();
  await surface(page, staff, 'light');
  await page.setViewportSize({ width: 1100, height: 844 });
  await expect(page.getByRole('table', { name: 'User accounts' })).toBeVisible();
  await surface(page, page.getByRole('table').locator('..'), 'light');
  await page.getByRole('link', { name: 'Back to Dashboard' }).click();
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title').fill('Admin notes');
  await page.getByLabel('Content').fill('Persistent Admin writing');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('link', { name: 'WriteSpace.', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
  const recent = page.getByRole('region', { name: 'Recent posts' });
  await surface(page, recent, 'light');
  await expect(recent.getByRole('link', { name: 'Admin notes', exact: true })).toBeVisible();
  const savedPosts = await posts(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await recent.getByRole('button', { name: 'Delete Admin notes' }).click();
  expect(await posts(page)).toEqual(savedPosts);
  await page.getByRole('button', { name: 'Dark mode' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await recent.getByRole('button', { name: 'Delete Admin notes' }).click();
  expect(await posts(page)).toEqual([]);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  page.once('dialog', (dialog) => dialog.accept());
  await staff.getByRole('button', { name: 'Delete staff' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([]);
  await page.screenshot({ path: 'test-results/workspace-theme-mobile-admin.png', fullPage: true });
  await logout(page, 'Admin');
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
});
