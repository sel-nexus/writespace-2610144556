/** Exercise real counted authoring; the shared fixture rejects console and page errors. */
import { test, expect } from './fixtures.js';

/** Read actual browser records for exact-schema and no-save assertions. */
async function posts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

for (const mode of ['light', 'dark']) {
  test(`${mode} counter follows create, read, edit, cancel and reload through real controls`, async ({ page }) => {
    await page.goto('/');
    if (mode === 'dark') await page.getByRole('button', { name: 'Dark mode' }).click();
    await page.getByRole('link', { name: 'Get Started', exact: true }).click();
    await page.getByLabel('Display Name', { exact: true }).fill('Mira');
    await page.getByLabel('Username', { exact: true }).fill('mira');
    await page.getByLabel('Password', { exact: true }).fill('demo');
    await page.getByLabel('Confirm Password', { exact: true }).fill('demo');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
    const content = page.getByLabel('Content', { exact: true });
    const counter = page.locator('#content-count');
    await expect(counter).toHaveText('0 characters');
    await expect(content).not.toHaveAttribute('maxlength', /.+/);
    await expect(page.locator('main form')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    await expect(counter).toHaveCSS('color', mode === 'dark' ? 'rgb(203, 213, 225)' : 'rgb(71, 85, 105)');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
    await expect(page.getByText('Content is required.', { exact: true })).toBeVisible();
    expect(await posts(page)).toBeNull();
    const text = '  First 😀 line\nSecond e\u0301 line  ';
    await page.getByLabel('Title', { exact: true }).fill('Counter notes');
    await content.fill(text);
    await expect(counter).toHaveText(`${text.length} characters`);
    expect(await posts(page)).toBeNull();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const [created] = await posts(page);
    expect(Object.keys(created).sort()).toEqual(['authorId', 'authorName', 'content', 'createdAt', 'id', 'title']);
    expect(created.content).toBe(text);
    expect(created.title).toBe('Counter notes');
    const identity = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
    expect(created.authorId).toBe(identity.userId);
    expect(created.authorName).toBe('Mira');
    await expect(page).toHaveURL(new RegExp('/blog/' + created.id + '$'));
    expect(await page.locator('article p').first().textContent()).toBe(text);
    await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
    await page.getByRole('link', { name: 'Read Counter notes', exact: true }).click();
    expect(await page.locator('article p').first().textContent()).toBe(created.content);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(content).toHaveValue(created.content);
    await expect(counter).toHaveText(`${created.content.length} characters`);
    await content.fill('');
    await expect(counter).toHaveText('0 characters');
    const revised = '  Revised 😀\nKeep whitespace  ';
    await content.fill(revised);
    await expect(counter).toHaveText(`${revised.length} characters`);
    expect(await posts(page)).toEqual([created]);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = { ...created, content: revised };
    expect(await posts(page)).toEqual([saved]);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(counter).toHaveText(`${revised.length} characters`);
    await content.fill('Discarded edit');
    await expect(counter).toHaveText('14 characters');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    expect(await posts(page)).toEqual([saved]);
    expect(await page.locator('article p').first().textContent()).toBe(revised);
    await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
    await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
    await content.fill('Discarded new draft');
    await expect(counter).toHaveText('19 characters');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    expect(await posts(page)).toEqual([saved]);
    await page.getByRole('link', { name: 'Read Counter notes', exact: true }).click();
    await page.reload();
    expect(await posts(page)).toEqual([saved]);
    expect(await page.locator('article p').first().textContent()).toBe(revised);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(content).toHaveValue(revised);
    await expect(counter).toHaveText(`${revised.length} characters`);
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', String(mode === 'dark'));
    await page.screenshot({ path: `test-results/counter-${mode}.png`, fullPage: true });
  });
}
