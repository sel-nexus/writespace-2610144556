/** Exercise public/auth themes through real links, local records and shared console-error fixtures. */
import { test, expect } from './fixtures.js';

/** Assert rendered colors rather than utility names alone. */
async function expectSurface(locator, background, color) {
  await expect(locator).toHaveCSS('background-color', background);
  if (color) await expect(locator).toHaveCSS('color', color);
}

for (const mode of ['light', 'dark']) {
  test(`${mode} public and auth surfaces preserve validation, registration and local data`, async ({ page }) => {
    await page.setViewportSize({ width: mode === 'dark' ? 390 : 1280, height: 900 });
    await page.goto('/');
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
    await page.getByRole('button', { name: 'Dark mode' }).click();
    if (mode === 'light') await page.getByRole('button', { name: 'Dark mode' }).click();
    const dark = mode === 'dark';
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', String(dark));
    await expectSurface(page.getByRole('region', { name: 'WriteSpace' }), dark ? 'rgb(15, 23, 42)' : 'rgb(248, 250, 252)');
    await expectSurface(page.getByRole('figure'), dark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    await expectSurface(page.getByRole('region', { name: 'Features' }), dark ? 'rgb(2, 6, 23)' : 'rgb(255, 255, 255)');
    await expectSurface(page.getByRole('contentinfo'), dark ? 'rgb(2, 6, 23)' : 'rgb(15, 23, 42)');
    await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expectSurface(page.getByRole('region', { name: 'Login form' }), dark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    await expectSurface(page.getByLabel('Username', { exact: true }), dark ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)', dark ? 'rgb(241, 245, 249)' : 'rgb(15, 23, 42)');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Username is required.')).toBeVisible();
    await page.getByLabel('Username').fill('wrong');
    await page.getByLabel('Password', { exact: true }).fill('wrong');
    await page.getByLabel('Username').click();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    expect(await page.getByLabel('Password', { exact: true }).evaluate((input) => getComputedStyle(input).boxShadow)).not.toBe('none');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expectSurface(page.getByText('Invalid username or password.'), dark ? 'rgb(69, 10, 10)' : 'rgb(254, 242, 242)', dark ? 'rgb(252, 165, 165)' : 'rgb(185, 28, 28)');
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    await page.getByRole('link', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expectSurface(page.getByRole('region', { name: 'Registration form' }), dark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByText('Display Name is required.')).toBeVisible();
    await page.getByLabel('Display Name', { exact: true }).fill('Public Writer');
    await page.getByLabel('Username', { exact: true }).fill('ADMIN');
    await page.getByLabel('Password', { exact: true }).fill('demo');
    await page.getByLabel('Confirm Password', { exact: true }).fill('other');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
    await page.getByLabel('Confirm Password', { exact: true }).fill('demo');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByLabel('Username')).toHaveAttribute('aria-describedby', 'username-error');
    await expect(page.locator('#username-error')).toContainText('Username already exists');
    expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
    await page.getByLabel('Username', { exact: true }).fill('public-writer');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    const account = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users'))[0]);
    expect(account).toMatchObject({ username: 'public-writer', displayName: 'Public Writer', role: 'user' });
    // Create data through the real authoring UI, not by patching browser storage.
    if (dark) await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Public theme post');
    await page.getByLabel('Content', { exact: true }).fill('A real browser-local thought.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const posts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ title: 'Public theme post', content: 'A real browser-local thought.', authorId: account.id });
    await page.getByRole('link', { name: 'WriteSpace.', exact: true }).click();
    const latest = page.getByRole('region', { name: 'Latest from the Blog' });
    await expect(latest.getByText(posts[0].title)).toBeVisible();
    await expect(latest.getByText(posts[0].content)).toBeVisible();
    await expectSurface(latest.getByRole('article'), dark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    await expect(latest.getByRole('heading', { level: 3 })).toHaveCSS('color', dark ? 'rgb(241, 245, 249)' : 'rgb(15, 23, 42)');
    await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
    await page.getByRole('button', { name: 'Public Writer profile' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    await latest.getByRole('link', { name: `Read ${posts[0].title}` }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', String(dark));
    expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(mode);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
    await page.getByRole('link', { name: 'Register', exact: true }).click();
    await page.getByRole('region', { name: 'Registration form' }).getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('public-writer');
    await page.getByLabel('Password', { exact: true }).fill('demo');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).userId)).toBe(account.id);
    await page.screenshot({ path: `test-results/public-theme-${mode}.png`, fullPage: true });
  });
}
