/** Verify reader and administration appearance without replacing domain operations. */
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { ADMIN_SESSION, setSession } from '../utils/auth.js';
import { savePosts, saveUsers, readPosts, readUsers, POSTS_KEY, USERS_KEY } from '../utils/storage.js';

const writer = { userId: 'mira', username: 'mira', displayName: 'Mira', role: 'user' };
const post = {
  id: 'notes', title: 'Field notes', content: 'First line\nPlain text <img src=x>',
  authorId: 'mira', authorName: 'Mira', createdAt: '2026-01-22T12:00:00Z',
};
const account = {
  id: 'staff', username: 'staff', displayName: 'Staff', role: 'admin',
  password: 'never-render', createdAt: '2026-01-22T12:00:00Z',
};

/** Expose the actual router destination for explicit activation assertions. */
function Location() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}

/** Mount the real root coordinator and guarded pages under repeated-effect conditions. */
function mount(mode, path, session = writer) {
  setSession(session);
  localStorage.setItem('writespace_theme', mode);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const view = render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
  expect(write).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(document.documentElement.classList.contains('dark')).toBe(mode === 'dark');
  expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', String(mode === 'dark'));
  expect(screen.getByLabelText('Location')).toHaveTextContent(path);
  return { ...view, write, confirm };
}

/** Fill the short account form through its native labels. */
async function fill(user, username = 'new-user') {
  await user.type(screen.getByLabelText('Display Name', { exact: true }), 'New Writer');
  await user.type(screen.getByLabelText('Username', { exact: true }), username);
  await user.type(screen.getByLabelText('Password', { exact: true }), 'demo');
  await user.selectOptions(screen.getByLabelText('Role', { exact: true }), 'user');
}

afterEach(() => document.documentElement.classList.remove('dark'));

describe.each(['light', 'dark'])('workspace in %s mode', (mode) => {
  it('preserves populated cards, author, date, text and explicit detail/edit links', async () => {
    savePosts([post, { ...post, id: 'other', title: 'Other notes', authorId: 'other' }]);
    const { write } = mount(mode, '/blogs');
    const read = screen.getByRole('link', { name: 'Read Field notes' });
    expect(read.closest('article')).toHaveClass('bg-white', 'dark:bg-slate-800');
    expect(screen.getByRole('heading', { name: 'Field notes' })).toHaveClass('text-slate-900', 'dark:text-slate-100');
    expect(within(read).getByText((text, element) => element.tagName === 'P' && element.textContent === post.content).textContent).toBe(post.content);
    expect(read).toHaveTextContent('Jan 22, 2026');
    expect(screen.getByRole('link', { name: 'Edit Field notes' })).toHaveClass('dark:text-indigo-300');
    expect(screen.queryByRole('link', { name: 'Edit Other notes' })).toBeNull();
    const user = userEvent.setup();
    await user.click(read);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/notes');
    expect(screen.getByText((text, element) => element.tagName === 'P' && element.textContent === post.content)).toHaveClass('whitespace-pre-wrap', 'dark:text-slate-200');
    expect(screen.getByRole('link', { name: 'Edit', exact: true })).toHaveClass('dark:hover:bg-indigo-950');
    expect(write).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    expect(screen.getByLabelText('Title')).toHaveValue(post.title);
    expect(readPosts().value).toEqual([post, { ...post, id: 'other', title: 'Other notes', authorId: 'other' }]);
  });

  it('themes empty list and missing detail while retaining working writing/back entries', async () => {
    mount(mode, '/blog/missing');
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toHaveClass(
      'bg-white', 'dark:bg-slate-800', 'dark:border-slate-700', 'dark:text-slate-300',
    );
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/write');
  });

  it.each(['/blogs', '/blog/notes', '/admin', '/users'])('themes corrupt storage warning at %s without repair', (path) => {
    const key = path === '/users' ? USERS_KEY : POSTS_KEY;
    localStorage.setItem(key, '{');
    mount(mode, path, ADMIN_SESSION);
    const warning = within(screen.getByRole('main')).getByRole('status');
    expect(warning).toHaveClass('bg-amber-50', 'dark:bg-amber-950', 'dark:text-amber-200');
    expect(localStorage.getItem(key)).toBe('{');
  });

  it.each(['owner', 'admin', 'other'])('retains %s reader controls and confirmed/cancelled deletion', async (kind) => {
    savePosts([post]);
    const session = kind === 'admin' ? ADMIN_SESSION : kind === 'owner' ? writer : { ...writer, userId: 'other' };
    const { confirm, write, container } = mount(mode, '/blog/notes', session);
    expect(container.querySelector('article')).toHaveClass('dark:bg-slate-800', 'dark:border-slate-700');
    expect(container.querySelector('article img')).toBeNull();
    if (kind === 'other') {
      expect(screen.queryByRole('button', { name: 'Delete', exact: true })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Edit', exact: true })).toBeNull();
      return;
    }
    const remove = screen.getByRole('button', { name: 'Delete', exact: true });
    expect(remove).toHaveClass('dark:bg-red-950', 'dark:text-red-300', 'dark:focus-visible:ring-offset-slate-800');
    const user = userEvent.setup();
    await user.click(remove);
    expect(write).not.toHaveBeenCalled();
    expect(readPosts().value).toEqual([post]);
    confirm.mockReturnValue(true);
    await user.click(remove);
    expect(readPosts().value).toEqual([]);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
  });

  it.each(['/blog/notes', '/admin'])('themes failed delete at %s and retains durable post', async (path) => {
    savePosts([post]);
    const { confirm, write } = mount(mode, path, ADMIN_SESSION);
    confirm.mockReturnValue(true);
    write.mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: path === '/admin' ? 'Delete Field notes' : 'Delete', exact: true }));
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50', 'dark:bg-red-950', 'dark:text-red-300');
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/);
    expect(readPosts().value).toEqual([post]);
    expect(screen.getByLabelText('Location')).toHaveTextContent(path);
  });

  it.each([false, true])('themes dashboard cards and keeps the pending metric with populated=%s', async (populated) => {
    if (populated) { savePosts([post]); saveUsers([account]); }
    mount(mode, '/admin', ADMIN_SESSION);
    for (const [label, count, tone] of [
      ['Total Posts', populated ? '1' : '0', 'indigo'],
      ['Total Users', populated ? '2' : '1', 'teal'],
      ['Total Admins', populated ? '2' : '1', 'violet'],
    ]) {
      const card = screen.getByRole('region', { name: label, exact: true });
      expect(card).toHaveTextContent(count);
      expect(card).toHaveClass('dark:bg-' + tone + '-950', 'dark:text-' + tone + '-200');
    }
    const pending = screen.getByRole('region', { name: 'Total users', exact: true });
    expect(pending).toHaveTextContent('—');
    expect(pending).toHaveTextContent('Metric pending definition');
    expect(pending).toHaveClass('bg-white', 'dark:bg-slate-800');
    expect(screen.getByRole('region', { name: 'Recent posts' })).toHaveClass('dark:border-slate-700', 'dark:bg-slate-800');
    if (!populated) expect(screen.getByText('No posts yet.')).toHaveClass('dark:text-slate-300');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Manage Users' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/users');
  });

  it('themes form validation, duplicate feedback, creation and protected table/mobile rows', async () => {
    saveUsers([account]);
    const session = { ...ADMIN_SESSION, userId: 'staff', username: 'staff' };
    const { write, confirm, container } = mount(mode, '/users', session);
    const table = screen.getByRole('table', { name: 'User accounts' });
    expect(table.parentElement).toHaveClass('hidden', 'sm:block', 'dark:bg-slate-800');
    const cards = container.querySelector('[aria-label="User cards"]');
    expect(cards).toHaveClass('sm:hidden');
    expect(within(cards).getByRole('article', { name: 'Account staff' })).toHaveClass('dark:bg-slate-800');
    expect(within(within(table).getByRole('button', { name: 'Delete staff' }).closest('tr')).getByText('Admin', { selector: 'span.ring-1' })).toHaveClass('dark:bg-violet-950', 'dark:text-violet-300');
    for (const name of ['Delete admin', 'Delete staff']) {
      const button = within(table).getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('dark:disabled:bg-slate-900', 'dark:disabled:text-slate-400');
    }
    for (const label of ['Display Name', 'Username', 'Password', 'Role']) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveClass(
        'bg-white', 'text-slate-900', 'dark:bg-slate-900', 'dark:text-slate-100',
        'dark:border-slate-600', 'dark:focus-visible:ring-offset-slate-900',
      );
    }
    const user = userEvent.setup();
    await user.click(within(table).getByRole('button', { name: 'Delete staff' }));
    expect(confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    for (const label of ['Display Name', 'Username', 'Password', 'Role']) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
    }
    expect(screen.getByText('Display Name is required.')).toHaveClass('dark:text-red-300');
    expect(write).not.toHaveBeenCalled();
    await fill(user, 'ADMIN');
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(/already exists/);
    expect(write).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'new-user');
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(readUsers().value).toHaveLength(2);
    expect(screen.getByText('Account created.')).toHaveClass('dark:text-indigo-300');
    expect(table).not.toHaveTextContent('never-render');
    expect(within(table).getByText('user', { selector: 'span' })).toHaveClass('dark:bg-indigo-950', 'dark:text-indigo-300');
    const remove = within(table).getByRole('button', { name: 'Delete new-user' });
    confirm.mockReturnValue(false);
    await user.click(remove);
    expect(readUsers().value).toHaveLength(2);
    confirm.mockReturnValue(true);
    await user.click(remove);
    expect(readUsers().value).toEqual([account]);
    expect(screen.getByText('Account deleted.')).toBeVisible();
  });

  it('themes account save failure without losing fields or claiming creation', async () => {
    const { write } = mount(mode, '/users', ADMIN_SESSION);
    const user = userEvent.setup();
    await fill(user);
    write.mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveClass('dark:bg-red-950', 'dark:text-red-300');
    expect(screen.getByLabelText('Password')).toHaveValue('demo');
    expect(localStorage.getItem(USERS_KEY)).toBeNull();
    expect(screen.queryByText('Account created.')).toBeNull();
  });
});
