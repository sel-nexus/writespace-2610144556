/** Author real admin journeys; fixtures capture errors before navigation and assert none after each journey. */
import { test, expect } from './fixtures.js';

/** Submit the real local login form. */
async function login(page, username, password = 'demo') {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}
/** Clear session using profile controls, then enter Login via a visible link. */
async function logout(page, name) {
  await page.getByRole('button', { name: name + ' profile' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
}
/** Submit all required fields with an explicitly selected role. */
async function create(page, name, username, role) {
  await page.getByLabel('Display Name', { exact: true }).fill(name);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByText('Account created.', { exact: true })).toBeVisible();
}
/** Inspect the actual serialized collection after mutations. */
async function stored(page, key) {
  return page.evaluate((name) => JSON.parse(localStorage.getItem(name)), key);
}

test('create both roles, publish as created writer, oversee as created admin, protect default/self and confirm deletes', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'admin', 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('No posts yet.', { exact: true })).toBeVisible();
  const pending = page.getByRole('region', { name: 'Total users', exact: true });
  await expect(pending).toContainText('—');
  await expect(pending).toContainText('Metric pending definition');
  expect(await stored(page, 'writespace_users')).toBeNull();
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  const table = page.getByRole('table', { name: 'User accounts' });
  const permanent = table.getByRole('button', { name: 'Delete admin', exact: true });
  await expect(permanent).toBeDisabled();
  await expect(permanent).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  for (const name of ['Display Name', 'Username', 'Password', 'Role']) {
    await expect(page.getByLabel(name, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  }
  await create(page, 'Mira', 'mira', 'user');
  await create(page, 'Editor', 'editor', 'admin');
  const accounts = await stored(page, 'writespace_users');
  expect(accounts).toHaveLength(2);
  expect(accounts.map((user) => user.role)).toEqual(['user', 'admin']);
  for (const user of accounts) {
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(user.createdAt))).toBe(false);
  }
  expect(await stored(page, 'writespace_session')).toMatchObject({ userId: 'admin', role: 'admin' });
  await page.reload();
  await expect(table.getByText('Mira', { exact: true })).toBeVisible();
  await expect(table).not.toContainText('demo');
  await logout(page, 'Admin');
  await login(page, 'mira');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Writer notes');
  await page.getByLabel('Content').fill('Original writer text');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const [original] = await stored(page, 'writespace_posts');
  expect(original).toMatchObject({ authorId: accounts[0].id, authorName: 'Mira', title: 'Writer notes' });
  await logout(page, 'Mira');
  await login(page, 'editor');
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Edit Writer notes', exact: true }).click();
  await page.getByLabel('Title').fill('Reviewed notes');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await stored(page, 'writespace_posts')).toEqual([{ ...original, title: 'Reviewed notes' }]);
  await page.getByRole('link', { name: 'WriteSpace.', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Reviewed notes', exact: true }).click();
  expect(await stored(page, 'writespace_posts')).toEqual([{ ...original, title: 'Reviewed notes' }]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Reviewed notes', exact: true }).click();
  expect(await stored(page, 'writespace_posts')).toEqual([]);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  const self = table.getByRole('button', { name: 'Delete editor', exact: true });
  await expect(self).toBeDisabled();
  await expect(self).toHaveAttribute('title', 'You cannot delete your current account.');
  await expect(permanent).toBeDisabled();
  page.once('dialog', (dialog) => dialog.dismiss());
  await table.getByRole('button', { name: 'Delete mira', exact: true }).click();
  expect(await stored(page, 'writespace_users')).toEqual(accounts);
  page.once('dialog', (dialog) => dialog.accept());
  await table.getByRole('button', { name: 'Delete mira', exact: true }).click();
  expect(await stored(page, 'writespace_users')).toEqual([accounts[1]]);
  await page.reload();
  await expect(table.getByRole('button', { name: 'Delete mira', exact: true })).toHaveCount(0);
  await expect(permanent).toBeDisabled();
  await expect(self).toBeDisabled();
});

test('table at 640 and above, mobile cards below 640 preserve profile fields and cancelled deletion', async ({ page }) => {
  await page.goto('/login');
  await login(page, 'admin', 'admin');
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await create(page, 'Mobile writer', 'mobile', 'user');
  const before = await stored(page, 'writespace_users');
  const table = page.getByRole('table', { name: 'User accounts' });
  const cards = page.locator('[aria-label="User cards"]');
  for (const width of [639, 640, 768, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 640) {
      await expect(table).toBeHidden();
      await expect(cards).toBeVisible();
      const profile = cards.getByRole('article', { name: 'Account mobile' });
      await expect(profile).toContainText('Mobile writer');
      await expect(profile).toContainText('mobile');
      await expect(profile).toContainText('user');
      await expect(profile.locator('time')).toHaveCount(1);
      await expect(profile).not.toContainText('demo');
      await expect(cards.getByRole('button', { name: 'Delete admin', exact: true })).toBeDisabled();
      page.once('dialog', (dialog) => dialog.dismiss());
      await profile.getByRole('button', { name: 'Delete mobile', exact: true }).click();
      expect(await stored(page, 'writespace_users')).toEqual(before);
      await page.screenshot({ path: 'test-results/admin-user-cards.png', fullPage: true });
    } else {
      await expect(table).toBeVisible();
      await expect(cards).toBeHidden();
      await expect(table.getByText('Mobile writer', { exact: true })).toBeVisible();
    }
  }
  await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Total Users', exact: true })).toContainText('2');
  await expect(page.getByRole('region', { name: 'Total Admins', exact: true })).toContainText('1');
  expect(await stored(page, 'writespace_users')).toEqual(before);
});
