/** Author real publishing journeys; the shared fixture captures errors before the first navigation and asserts none. */
import { test, expect } from './fixtures.js';

/** Register through the real form after entering from a visible registration link. */
async function register(page, name, username) {
  await page.getByLabel('Display Name', { exact: true }).fill(name);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
}
/** Leave a local identity using the existing profile controls. */
async function logout(page, name) {
  await page.getByRole('button', { name: name + ' profile' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}
/** Read the actual persisted collection for metadata and no-op assertions. */
async function posts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

test('authenticated missing post offers a working Back to All Posts link', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_session', JSON.stringify({
      userId: 'writer', username: 'mira', displayName: 'Mira', role: 'user',
    }));
  });
  await page.goto('/blog/missing-post');
  await expect(page).toHaveURL(/\/blog\/missing-post$/);
  await expect(page.getByRole('button', { name: 'Mira profile', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
});

for (const mode of ['write', 'edit']) {
  test(`${mode} save failure retains text, route and prior posts until an explicit successful retry`, async ({ page }) => {
    await page.goto('/register');
    await register(page, 'Mira', 'mira');
    for (const title of ['Prior notes', 'Keep this post']) {
      await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
      await page.getByLabel('Title', { exact: true }).fill(title);
      await page.getByLabel('Content', { exact: true }).fill(title + ' content');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
    }
    const prior = await posts(page);
    const rawBefore = await page.evaluate(() => localStorage.getItem('writespace_posts'));
    if (mode === 'edit') {
      await page.getByRole('link', { name: 'Read Prior notes', exact: true }).click();
      await page.getByRole('link', { name: 'Edit', exact: true }).click();
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Prior notes');
      await expect(page.getByLabel('Content', { exact: true })).toHaveValue('Prior notes content');
    } else {
      await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
    }
    const formRoute = page.url();
    await expect(page).toHaveURL(mode === 'edit' ? new RegExp('/edit/' + prior[0].id + '$') : /\/write$/);
    const title = 'Retained ' + mode + ' draft';
    const content = '  Keep every line\nDraft text awaiting retry  ';
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Content', { exact: true }).fill(content);
    // Inject only the requested posts-write failure; reads and other storage stay real.
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.restorePostsStorage = () => {
        Storage.prototype.setItem = original;
        delete window.restorePostsStorage;
      };
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === 'writespace_posts') {
          throw new DOMException('Test posts quota exceeded', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    try {
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveText('Your browser could not save this change. Enable local storage or free space, then try again.');
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
      await expect(page.getByLabel('Content', { exact: true })).toHaveValue(content);
      await expect(page).toHaveURL(formRoute);
      expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(rawBefore);
      expect(await posts(page)).toEqual(prior);
    } finally {
      await page.evaluate(() => window.restorePostsStorage());
    }
    // Recovery alone must not save or navigate; retry the retained form explicitly.
    await expect(page).toHaveURL(formRoute);
    expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(rawBefore);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
    await expect(page.getByLabel('Content', { exact: true })).toHaveValue(content);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = await posts(page);
    const changed = mode === 'edit' ? saved[0] : saved[2];
    await expect(page).toHaveURL(new RegExp('/blog/' + changed.id + '$'));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    expect(await page.locator('article p').first().textContent()).toBe(content);
    if (mode === 'edit') {
      expect(saved).toEqual([{ ...prior[0], title, content }, prior[1]]);
    } else {
      expect(saved).toHaveLength(3);
      expect(saved.slice(0, 2)).toEqual(prior);
      expect(changed).toMatchObject({ title, content, authorId: prior[0].authorId, authorName: 'Mira' });
    }
  });
}

test('register, create, reload, read, edit, cancel and delete via real controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await register(page, 'Mira', 'mira');
  await page.getByRole('button', { name: /dark/i }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page.getByText('0 characters', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Content', { exact: true })).not.toHaveAttribute('maxlength');
  await expect(page.getByLabel('Content', { exact: true })).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Content is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Content is required.', { exact: true })).toHaveCSS('color', 'rgb(252, 165, 165)');
  expect(await posts(page)).toBeNull();
  const content = '  First line\n<img src=x onerror=alert(1)>\nLast line  ';
  await page.getByLabel('Title', { exact: true }).fill('Field notes');
  await page.getByLabel('Content', { exact: true }).fill(content);
  await expect(page.getByText(content.length + ' characters', { exact: true })).toBeVisible();
  const before = Date.now();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const [created] = await posts(page);
  expect(Object.keys(created).sort()).toEqual(['authorId', 'authorName', 'content', 'createdAt', 'id', 'title']);
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(Date.parse(created.createdAt)).toBeGreaterThanOrEqual(before);
  const identity = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(created).toMatchObject({ title: 'Field notes', content, authorId: identity.userId, authorName: 'Mira' });
  await expect(page).toHaveURL(new RegExp('/blog/' + created.id + '$'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('article')).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(page.getByRole('heading', { name: 'Field notes', exact: true })).toBeVisible();
  expect(await page.locator('article p').first().textContent()).toBe(content);
  await expect(page.locator('article img, article script')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(page.getByRole('heading', { name: 'Field notes', exact: true })).toHaveCSS('color', 'rgb(241, 245, 249)');
  await page.getByRole('link', { name: 'Read Field notes', exact: true }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Field notes');
  await expect(page.getByLabel('Content')).toHaveValue(content);
  await expect(page.getByText(content.length + ' characters', { exact: true })).toBeVisible();
  await page.getByLabel('Content').fill('');
  await expect(page.getByText('0 characters', { exact: true })).toBeVisible();
  await page.getByLabel('Content').pressSequentially('Draft');
  await expect(page.getByText('5 characters', { exact: true })).toBeVisible();
  await page.getByLabel('Title').fill('Revised notes');
  await page.getByLabel('Content').fill('Revised plain text');
  await expect(page.getByText('18 characters', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await posts(page)).toEqual([{ ...created, title: 'Revised notes', content: 'Revised plain text' }]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByText('18 characters', { exact: true })).toBeVisible();
  await page.getByLabel('Title').fill('Discard this');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revised notes', exact: true })).toBeVisible();
  const unchanged = await posts(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await posts(page)).toEqual(unchanged);
  await expect(page).toHaveURL(new RegExp('/blog/' + created.id + '$'));
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await posts(page)).toEqual([]);
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')).length)).toBe(1);
});

test('other owner sees read-only posts while Admin edits and deletes original authorship', async ({ page }) => {
  await page.goto('/register');
  await register(page, 'Owner', 'owner');
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Owned post');
  await page.getByLabel('Content').fill('Owner text');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const [original] = await posts(page);
  await logout(page, 'Owner');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await register(page, 'Reader', 'reader');
  await expect(page.getByRole('link', { name: 'Edit Owned post', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Read Owned post', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  expect(await posts(page)).toEqual([original]);
  await logout(page, 'Reader');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await page.getByRole('link', { name: 'Edit Owned post', exact: true }).click();
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await posts(page)).toEqual([{ ...original, title: 'Admin revision' }]);
  await page.reload();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await posts(page)).toEqual([]);
  await expect(page).toHaveURL(/\/blogs$/);
});

test('mobile guest guard and real single/two/three-column publishing list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/write');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('main').getByRole('link', { name: 'Register', exact: true }).click();
  await register(page, 'Mobile', 'mobile');
  for (const title of ['First', 'Second', 'Third']) {
    await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Content').fill(title + ' content');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
  }
  const grid = page.getByRole('region', { name: 'Blog posts' });
  for (const [width, columns] of [[390, 1], [800, 2], [1100, 3]]) {
    await page.setViewportSize({ width, height: 844 });
    const count = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(count).toBe(columns);
  }
  expect((await posts(page)).length).toBe(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/blogs-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Discard draft');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect((await posts(page)).length).toBe(3);
});
