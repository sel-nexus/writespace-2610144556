/** Verify blog routes through real forms, current browser state and explicit actions. */
import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { ADMIN_SESSION, setSession, SESSION_KEY } from '../utils/auth.js';
import { POSTS_KEY, readPosts, savePosts } from '../utils/storage.js';

const session = { userId: 'writer', username: 'mira', displayName: 'Mira', role: 'user' };
/** Build complete browser records for permission and persistence assertions. */
function post(id = 'one', overrides = {}) {
  return { id, title: id, content: 'Original text', createdAt: '2026-01-22T12:00:00Z',
    authorId: 'writer', authorName: 'Mira', ...overrides };
}
/** Expose router outcomes without asserting internal component state. */
function Location() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}
/** Mount the real shell with StrictMode and the existing single router pattern. */
function mount(path = '/blogs') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
}
/** Enter writing via the user-visible controls. */
async function fill(user, title = 'New title', content = 'New content') {
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), title);
  await user.clear(screen.getByLabelText('Content'));
  await user.type(screen.getByLabelText('Content'), content);
}

describe('blog listing and detail', () => {
  it.each([session, ADMIN_SESSION])('renders exact empty and Write CTA for $role without mutations', async (identity) => {
    setSession(identity);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const confirm = vi.spyOn(window, 'confirm');
    mount();
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
    expect(write).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/write');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it('lists every post newest first with required grid and card actions', async () => {
    setSession(session);
    savePosts([post('bad', { createdAt: 'bad' }), post('old', { createdAt: '2020-01-01' }), post('new'), post('tie')]);
    mount();
    const grid = screen.getByRole('region', { name: 'Blog posts' });
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    expect(within(grid).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['new', 'tie', 'old', 'bad']);
    const user = userEvent.setup(); await user.click(screen.getByRole('link', { name: 'Read new' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/new');
    expect(screen.getByText('Original text')).toBeVisible();
  });
  it.each(['{', '{}', '[null]'])('shows corrupt list warning without repair: %s', (raw) => {
    setSession(session); localStorage.setItem(POSTS_KEY, raw); mount();
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent(/unreadable/);
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
  it.each(['/blog/missing', '/blog/one'])('shows exact missing detail and working back: %s', async (path) => {
    setSession(session); mount(path);
    expect(screen.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    const user = userEvent.setup(); await user.click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it('escapes HTML and preserves full whitespace/content, author and date', () => {
    setSession(session);
    const content = '  <img src=x onerror=alert(1)>\n<script>bad()</script>  ' + 'x'.repeat(200);
    savePosts([post('one', { title: '<b>Title</b>', content })]);
    const confirm = vi.spyOn(window, 'confirm'); const write = vi.spyOn(Storage.prototype, 'setItem');
    const { container } = mount('/blog/one');
    expect(screen.getByRole('heading', { name: '<b>Title</b>' })).toBeVisible();
    const text = container.querySelector('article p');
    expect(text.textContent).toBe(content); expect(text).toHaveClass('whitespace-pre-wrap');
    expect(container.querySelector('script, img, b')).toBeNull();
    expect(screen.getByText('Jan 22, 2026')).toHaveAttribute('datetime', '2026-01-22T12:00:00Z');
    expect(within(screen.getByRole('article')).getByText('Mira')).toBeVisible();
    expect(write).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
  });
  it('shows date unavailable and built-in admin avatar without invalid time markup', () => {
    setSession(session); savePosts([post('one', { authorId: 'admin', authorName: 'Admin', createdAt: 'bad' })]);
    const { container } = mount('/blog/one');
    expect(screen.getByText('Date unavailable')).toBeVisible(); expect(container.querySelector('time')).toBeNull();
    expect(container.querySelector('article .bg-violet-600')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
  it.each([session, ADMIN_SESSION])('offers own/Admin edit and confirmed deletion for $role', async (identity) => {
    setSession(identity); savePosts([post(), post('keep')]); mount('/blog/one');
    expect(screen.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/edit/one');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(readPosts().value).toEqual([post('keep')]);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
  });
  it('cancelled deletion neither writes nor navigates', async () => {
    setSession(session); savePosts([post()]); mount('/blog/one');
    const write = vi.spyOn(Storage.prototype, 'setItem'); vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(write).not.toHaveBeenCalled(); expect(readPosts().value).toEqual([post()]);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/one');
  });
  it.each(['QuotaExceededError', 'SecurityError'])('failed deletion stays detail with truthful %s guidance', async (name) => {
    setSession(session); savePosts([post()]); mount('/blog/one');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('fail', name); });
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/one'); expect(readPosts().value).toEqual([post()]);
  });
  it('checks changed identity after confirm and denies deletion without write', async () => {
    setSession(session); savePosts([post()]); mount('/blog/one');
    vi.spyOn(window, 'confirm').mockImplementation(() => { setSession({ ...session, userId: 'other' }); return true; });
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot change this post/);
    expect(readPosts().value).toEqual([post()]); expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/one');
  });
});

describe('dark post surfaces', () => {
  it('keeps cards, reader, editor and required errors themed without changing saved data', async () => {
    setSession(session);
    savePosts([post()]);
    localStorage.setItem('writespace_theme', 'dark');
    mount();
    const user = userEvent.setup();
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('article')).toHaveClass('dark:bg-slate-900');
    expect(screen.getByRole('heading', { name: 'one' })).toHaveClass('dark:text-slate-100');
    await user.click(screen.getByRole('link', { name: 'Read one' }));
    expect(screen.getByRole('article')).toHaveClass('dark:bg-slate-900');
    expect(screen.getByText('Original text')).toHaveClass('dark:text-slate-200');
    await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    expect(screen.getByLabelText('Content')).toHaveClass('dark:bg-slate-800', 'dark:text-slate-100');
    expect(screen.getByText('13 characters')).toHaveClass('dark:text-slate-300');
    await user.clear(screen.getByLabelText('Content'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Content is required.', { exact: true })).toHaveClass('dark:text-red-300');
    expect(screen.getByLabelText('Content')).toHaveAccessibleDescription(/Content is required.*0 characters/);
    expect(readPosts().value).toEqual([post()]);
  });
});

describe('writing form', () => {
  it.each(['/blogs', '/blog/one', '/write', '/edit/one'])('guards guest route %s', (path) => {
    mount(path); expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it.each([post('one', { authorId: 'other' }), null])('redirects denied/missing edit without writes %j', (value) => {
    setSession(session); if (value) savePosts([value]);
    const write = vi.spyOn(Storage.prototype, 'setItem'); mount('/edit/one');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs'); expect(write).not.toHaveBeenCalled();
  });
  it('has labeled required fields, min-height counter and associated errors then saves after correction', async () => {
    setSession(session); mount('/write');
    const user = userEvent.setup(); const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(screen.getByLabelText('Content')).toHaveClass('min-h-64');
    expect(screen.getByText('0 characters')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    for (const name of ['Title', 'Content']) {
      const field = screen.getByLabelText(name);
      expect(field).toHaveAttribute('aria-required', 'true'); expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(new RegExp(name + ' is required.'));
      expect(screen.getByText(name + ' is required.', { exact: true })).toBeVisible();
    }
    expect(write).not.toHaveBeenCalled();
    await fill(user); expect(screen.getByText('11 characters')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const saved = readPosts().value[0];
    expect(saved).toMatchObject({ title: 'New title', content: 'New content', authorId: 'writer', authorName: 'Mira' });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/); expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/' + saved.id);
    expect(screen.getByRole('heading', { name: 'New title' })).toBeVisible();
  });
  it.each(['Title', 'Content'])('validates missing %s alone retaining the other typed field', async (name) => {
    setSession(session); mount('/write'); const user = userEvent.setup(); await fill(user);
    await user.clear(screen.getByLabelText(name)); await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(name + ' is required.', { exact: true })).toBeVisible();
    const other = name === 'Title' ? 'Content' : 'Title'; expect(screen.getByLabelText(other)).toHaveAttribute('aria-invalid', 'false');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it.each([session, ADMIN_SESSION])('prefills edit and saves as $role without replacing original metadata', async (identity) => {
    setSession(identity); savePosts([post()]); mount('/edit/one');
    expect(screen.getByLabelText('Title')).toHaveValue('one'); expect(screen.getByLabelText('Content')).toHaveValue('Original text');
    expect(screen.getByText('13 characters')).toBeVisible();
    const user = userEvent.setup(); await fill(user); savePosts([post(), post('concurrent')]);
    expect(screen.getByText('11 characters')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(readPosts().value).toEqual([post('one', { title: 'New title', content: 'New content' }), post('concurrent')]);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/one');
  });
  it('counts live typing, whitespace and UTF-16 content, then resets after clearing without saving', async () => {
    setSession(session);
    mount('/write');
    const user = userEvent.setup();
    const content = screen.getByLabelText('Content');
    expect(content).toHaveAccessibleDescription('0 characters');
    expect(content).not.toHaveAttribute('maxlength');
    await user.type(content, 'Hi');
    expect(screen.getByText('2 characters')).toBeVisible();
    await user.paste(' 🌿\n');
    expect(content).toHaveValue('Hi 🌿\n');
    expect(screen.getByText('6 characters')).toBeVisible();
    await user.clear(content);
    expect(screen.getByText('0 characters')).toBeVisible();
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it.each(['/write', '/edit/one'])('saves long content verbatim with only existing fields from %s', async (path) => {
    setSession(session);
    const original = post();
    savePosts([original]);
    mount(path);
    const user = userEvent.setup();
    const content = '  Long draft\n' + 'x'.repeat(10000) + '\n🌿  ';
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Long title');
    await user.clear(screen.getByLabelText('Content'));
    await user.click(screen.getByLabelText('Content'));
    await user.paste(content);
    expect(screen.getByLabelText('Content')).not.toHaveAttribute('maxlength');
    expect(screen.getByText(content.length + ' characters')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const collection = readPosts().value;
    const saved = path === '/write' ? collection[1] : collection[0];
    expect(Object.keys(saved).sort()).toEqual(['authorId', 'authorName', 'content', 'createdAt', 'id', 'title']);
    expect(saved).toMatchObject({ title: 'Long title', content, authorId: 'writer', authorName: 'Mira' });
    if (path === '/edit/one') {
      expect(collection).toEqual([{ ...original, title: 'Long title', content }]);
    } else {
      expect(collection[0]).toEqual(original);
      expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    }
    expect(screen.getByRole('article').querySelector('p').textContent).toBe(content);
  });
  it.each(['/write', '/edit/one'])('Cancel from %s leaves storage untouched', async (path) => {
    setSession(session); savePosts([post()]); mount(path); const user = userEvent.setup(); await fill(user);
    const write = vi.spyOn(Storage.prototype, 'setItem'); await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(write).not.toHaveBeenCalled(); expect(readPosts().value).toEqual([post()]);
    expect(screen.getByLabelText('Location')).toHaveTextContent(path === '/write' ? '/blogs' : '/blog/one');
  });
  for (const path of ['/write', '/edit/one']) {
    it.each(['QuotaExceededError', 'SecurityError'])('retains typed form on ' + path + ' %s failure', async (name) => {
      setSession(session); savePosts([post()]); mount(path); const user = userEvent.setup(); await fill(user);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', name); });
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('alert')).toHaveTextContent(/could not save/);
      expect(screen.getByLabelText('Title')).toHaveValue('New title'); expect(screen.getByLabelText('Content')).toHaveValue('New content');
      expect(screen.getByLabelText('Location')).toHaveTextContent(path); expect(readPosts().value).toEqual([post()]);
    });
    it('retains typed form on corrupt fresh read at ' + path, async () => {
      setSession(session); savePosts([post()]); mount(path); const user = userEvent.setup(); await fill(user);
      localStorage.setItem(POSTS_KEY, '{'); await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('alert')).toHaveTextContent(/unreadable/); expect(screen.getByLabelText('Title')).toHaveValue('New title');
      expect(localStorage.getItem(POSTS_KEY)).toBe('{'); expect(screen.getByLabelText('Location')).toHaveTextContent(path);
    });
  }
  it.each([null, { ...session, userId: 'other' }])('denies edit after changed session retaining typed form %j', async (identity) => {
    setSession(session); savePosts([post()]); mount('/edit/one'); const user = userEvent.setup(); await fill(user);
    if (identity) setSession(identity); else localStorage.removeItem(SESSION_KEY);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot change this post/);
    expect(screen.getByLabelText('Title')).toHaveValue('New title'); expect(readPosts().value).toEqual([post()]);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/edit/one');
  });
  it('creates with submit-time changed identity', async () => {
    setSession(session); mount('/write'); const user = userEvent.setup(); await fill(user);
    setSession({ ...session, userId: 'other', displayName: 'Other' }); await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(readPosts().value[0]).toMatchObject({ authorId: 'other', authorName: 'Other' });
  });
  it('retains create form when session disappeared', async () => {
    setSession(session); mount('/write'); const user = userEvent.setup(); await fill(user); localStorage.removeItem(SESSION_KEY);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/session is unavailable/); expect(screen.getByLabelText('Title')).toHaveValue('New title');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it('retains edit text when target disappears before submit', async () => {
    setSession(session); savePosts([post()]); mount('/edit/one'); const user = userEvent.setup(); await fill(user); savePosts([]);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found'); expect(screen.getByLabelText('Content')).toHaveValue('New content');
    expect(readPosts().value).toEqual([]);
  });
});


describe('storage recovery and action-time failures', () => {
  it.each(['/blogs', '/blog/one', '/write', '/edit/one'])('renders recoverable unavailable posts at %s without mutation', (path) => {
    setSession(session); savePosts([post()]);
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
      if (key === POSTS_KEY) throw new DOMException('blocked', 'SecurityError');
      return original.call(this, key);
    });
    const write = vi.spyOn(Storage.prototype, 'setItem'); mount(path);
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent(/could not save/);
    expect(write).not.toHaveBeenCalled();
    expect(original.call(localStorage, POSTS_KEY)).toBe(JSON.stringify([post()]));
  });
  it('retries a failed create only on explicit Save and preserves concurrently added posts', async () => {
    setSession(session); mount('/write'); const user = userEvent.setup(); await fill(user);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/);
    expect(localStorage.getItem(POSTS_KEY)).toBeNull(); write.mockRestore(); savePosts([post('concurrent')]);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(readPosts().value).toHaveLength(2); expect(readPosts().value[0]).toEqual(post('concurrent'));
    expect(readPosts().value[1].title).toBe('New title');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/' + readPosts().value[1].id);
  });
  it('shows missing target after confirmation without deletion navigation', async () => {
    setSession(session); savePosts([post()]); mount('/blog/one');
    vi.spyOn(window, 'confirm').mockImplementation(() => { savePosts([]); return true; });
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/one');
    expect(screen.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
    expect(readPosts().value).toEqual([]);
  });
  it('corrupt detail exposes exact not-found and a warning without repair', () => {
    setSession(session); localStorage.setItem(POSTS_KEY, '{'); mount('/blog/one');
    expect(screen.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent(/unreadable/);
    expect(localStorage.getItem(POSTS_KEY)).toBe('{');
  });
});
