/** Author real discovery journeys; the shared fixture captures errors before initial navigation. */
import { test, expect } from './fixtures.js';

test('unknown address offers a working Back to Home fallback', async ({ page }) => {
  await page.goto('/unknown-address');
  await expect(page).toHaveURL(/\/unknown-address$/);
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Get Started Free', exact: true })).toBeVisible();
});

/** Prepare explicitly test-owned local records before navigation, never application seed data. */
async function prepare(page, session = null) {
  await page.addInitScript(({ identity }) => {
    if (localStorage.getItem('landing_test_prepared')) return;
    const posts = ['older', 'newest', 'middle', 'oldest'].map((title, index) => ({
      id: title, title, content: `Stored test content for ${title}.`,
      createdAt: ['2024-01-01', '2026-01-01', '2025-01-01', '2020-01-01'][index],
      authorId: 'writer', authorName: 'Mira',
    }));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
    if (identity) localStorage.setItem('writespace_session', JSON.stringify(identity));
    localStorage.setItem('landing_test_prepared', 'true');
  }, { identity: session });
}

test('guest discovers newest three and activates a protected preview without altering local posts', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['newest', 'middle', 'older']);
  await expect(latest.getByText('Stored test content for newest.')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await latest.getByRole('link', { name: 'Read newest' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')).length)).toBe(4);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('link', { name: 'WriteSpace.' }).click();
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Display Name')).toBeVisible();
});

for (const role of ['user', 'admin']) {
  test(`authenticated ${role} Start Reading opens blogs and session survives reload`, async ({ page }) => {
    const identity = role === 'admin'
      ? { userId: 'admin', username: 'admin', displayName: 'Admin', role }
      : { userId: 'writer', username: 'mira', displayName: 'Mira', role };
    await prepare(page, identity);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', role === 'admin' ? '/admin' : '/blogs');
    await page.getByRole('link', { name: 'Start Reading' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await page.reload();
    await expect(page.getByRole('button', { name: `${identity.displayName} profile` })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(identity);
    await page.getByRole('link', { name: 'WriteSpace.' }).click();
    await page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
  });
}

test('mobile empty discovery retains readable copy and functional reading/register controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByText('Writing illustration · not a saved post')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'WriteSpace.' }).click();
  await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Display Name')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBeNull();
});

test('unreadable local data remains untouched while guest entry stays available', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('landing_corruption_prepared')) return;
    localStorage.setItem('writespace_posts', '{broken');
    localStorage.setItem('landing_corruption_prepared', 'true');
  });
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Nothing was changed.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{broken');
  await page.reload();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Nothing was changed.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{broken');
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expect(page).toHaveURL(/\/register$/);
});
