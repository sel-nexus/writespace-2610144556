/** Exercise administrator UI against persisted browser data and explicit controls. */
import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { ADMIN_SESSION, setSession, SESSION_KEY } from '../utils/auth.js';
import { readUsers, saveUsers, readPosts, savePosts, USERS_KEY, POSTS_KEY } from '../utils/storage.js';
import { StatCard } from '../components/StatCard.jsx';
import { UserRow } from '../components/UserRow.jsx';

/** Build a complete local account. */
function account(id = 'one', role = 'user') {
  return { id, displayName: id, username: id, role, password: 'never-render-this', createdAt: '2026-01-22T12:00:00Z' };
}
/** Build a complete post owned by a regular user. */
function post(id, createdAt = '2026-01-22T12:00:00Z') {
  return { id, title: id, content: 'Original', authorId: 'one', authorName: 'one', createdAt };
}
/** Expose actual router outcomes without internal state assertions. */
function Location() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}
/** Mount the real guarded shell under StrictMode. */
function mount(path = '/users') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
}
/** Fill account fields via their associated native labels. */
async function fill(user, role = 'user') {
  await user.type(screen.getByLabelText('Display Name', { exact: true }), 'Mira');
  await user.type(screen.getByLabelText('Username', { exact: true }), 'mira');
  await user.type(screen.getByLabelText('Password', { exact: true }), 'demo-secret');
  await user.selectOptions(screen.getByLabelText('Role', { exact: true }), role);
}
/** Select the desktop table to avoid duplicate CSS-only mobile markup in jsdom. */
function table() { return screen.getByRole('table', { name: 'User accounts' }); }

describe('admin routes and dashboard', () => {
  for (const path of ['/admin', '/users']) {
    it.each([null, { ...ADMIN_SESSION, role: 'user' }])('denies guest/user at ' + path + ': %j', (session) => {
      if (session) setSession(session); const write = vi.spyOn(Storage.prototype, 'setItem'); mount(path);
      expect(screen.getByLabelText('Location')).toHaveTextContent(session ? '/blogs' : '/login');
      expect(screen.queryByRole('heading', { name: 'User Management' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument();
      expect(write).not.toHaveBeenCalled();
    });
  }
  it('shows exact metrics including default, stable recent five and no render mutations', async () => {
    setSession(ADMIN_SESSION); saveUsers([account(), account('staff', 'admin')]);
    savePosts([post('bad', 'bad'), post('old', '2020-01-01'), post('a'), post('b'), post('c'), post('d'), post('e')]);
    const write = vi.spyOn(Storage.prototype, 'setItem'); const confirm = vi.spyOn(window, 'confirm'); mount('/admin');
    for (const [label, count] of [['Total Posts', '7'], ['Total Users', '3'], ['Total Admins', '2']]) {
      expect(screen.getByRole('region', { name: label, exact: true })).toHaveTextContent(count);
    }
    const pending = screen.getByRole('region', { name: 'Total users', exact: true });
    expect(pending).toHaveTextContent('—'); expect(pending).toHaveTextContent('Metric pending definition');
    expect(pending).toHaveClass('bg-white');
    const recent = screen.getByRole('region', { name: 'Recent posts' });
    expect(within(recent).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(within(recent).getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Edit a' })).toHaveAttribute('href', '/edit/a');
    expect(write).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
    const user = userEvent.setup(); await user.click(screen.getByRole('link', { name: 'Write New Post' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/write');
  });
  it('shows empty/default metrics and quick management navigation without seeding', async () => {
    setSession(ADMIN_SESSION); mount('/admin'); expect(screen.getByText('No posts yet.')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Total Users', exact: true })).toHaveTextContent('1');
    expect(screen.getByRole('region', { name: 'Total Admins', exact: true })).toHaveTextContent('1');
    const user = userEvent.setup(); await user.click(screen.getByRole('link', { name: 'Manage Users' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/users');
    expect(localStorage.getItem(USERS_KEY)).toBeNull(); expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  it('does not double count a stored built-in alias', () => {
    setSession(ADMIN_SESSION); saveUsers([account('admin', 'admin'), { ...account('alias', 'admin'), username: 'ADMIN' }]);
    mount('/admin'); expect(screen.getByRole('region', { name: 'Total Users', exact: true })).toHaveTextContent('1');
    expect(screen.getByRole('region', { name: 'Total Admins', exact: true })).toHaveTextContent('1');
  });
  it('activates inline edit for another author', async () => {
    setSession(ADMIN_SESSION); savePosts([post('one')]); mount('/admin'); const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Edit one' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/edit/one'); expect(screen.getByLabelText('Title')).toHaveValue('one');
  });
  it.each(['detail', 'edit'])('opens the intended %s from dashboard for a delimiter-containing post id', async (destination) => {
    const intended = { ...post('one/two?draft#notes'), title: 'Delimiter notes', content: 'Intended post content' };
    setSession(ADMIN_SESSION); savePosts([post('one'), intended]); mount('/admin');
    const user = userEvent.setup();
    const link = within(screen.getByRole('region', { name: 'Recent posts' })).getByRole('link', {
      name: destination === 'detail' ? intended.title : 'Edit ' + intended.title, exact: true,
    });
    const path = (destination === 'detail' ? '/blog/' : '/edit/') + encodeURIComponent(intended.id);
    expect(link).toHaveAttribute('href', path);
    await user.click(link);
    expect(screen.getByLabelText('Location').textContent).toBe(path);
    if (destination === 'detail') {
      expect(screen.getByRole('heading', { level: 1, name: intended.title })).toBeVisible();
      expect(screen.getByText(intended.content, { exact: true })).toBeVisible();
    } else {
      expect(screen.getByRole('heading', { name: 'Edit Blog' })).toBeVisible();
      expect(screen.getByLabelText('Title')).toHaveValue(intended.title);
      expect(screen.getByLabelText('Content')).toHaveValue(intended.content);
    }
    expect(readPosts().value).toEqual([post('one'), intended]);
  });
  it('cancels then confirms deletion preserving fresh concurrent posts and refreshing metrics', async () => {
    setSession(ADMIN_SESSION); savePosts([post('one')]); mount('/admin'); const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const write = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Delete one' }));
    expect(write).not.toHaveBeenCalled(); expect(readPosts().value).toEqual([post('one')]);
    confirm.mockImplementation(() => { savePosts([post('one'), post('concurrent')]); return true; });
    await user.click(screen.getByRole('button', { name: 'Delete one' }));
    expect(readPosts().value).toEqual([post('concurrent')]); expect(screen.queryByRole('link', { name: 'Edit one' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Total Posts' })).toHaveTextContent('1');
  });
  it.each(['quota', 'corrupt', 'unavailable', 'session', 'missing'])('retains dashboard snapshot and exposes failed delete %s', async (kind) => {
    setSession(ADMIN_SESSION); savePosts([post('one')]); mount('/admin');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (kind === 'corrupt') localStorage.setItem(POSTS_KEY, '{');
      if (kind === 'session') localStorage.removeItem(SESSION_KEY);
      if (kind === 'missing') savePosts([]);
      return true;
    });
    if (kind === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    if (kind === 'unavailable') {
      const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
        if (key === POSTS_KEY) throw new DOMException('blocked', 'SecurityError'); return original.call(this, key);
      });
    }
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete one' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save|unreadable|cannot change|Post not found/);
    expect(screen.getByRole('link', { name: 'Edit one' })).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/admin');
    if (kind === 'quota' || kind === 'session') expect(readPosts().value).toEqual([post('one')]);
  });
});

describe('profile presentation and creation', () => {
  it('has table/cards, exact protected tooltip, no credential rows and no render writes/confirms', async () => {
    setSession({ ...ADMIN_SESSION, userId: 'staff', username: 'staff' }); saveUsers([account(), account('staff', 'admin')]);
    const write = vi.spyOn(Storage.prototype, 'setItem'); const confirm = vi.spyOn(window, 'confirm');
    const { container } = mount();
    expect(table().parentElement).toHaveClass('hidden', 'sm:block');
    expect(container.querySelector('[aria-label="User cards"]')).toHaveClass('sm:hidden');
    expect(within(table()).getByRole('button', { name: 'Delete admin' })).toBeDisabled();
    expect(within(table()).getByRole('button', { name: 'Delete admin' })).toHaveAttribute('title', 'Default admin cannot be deleted.');
    const self = within(table()).getByRole('button', { name: 'Delete staff' }); expect(self).toBeDisabled();
    expect(self).toHaveAttribute('title', 'You cannot delete your current account.');
    expect(within(table()).getAllByText('Jan 22, 2026', { selector: 'time' })).toHaveLength(2);
    expect(table()).not.toHaveTextContent('never-render-this');
    expect(container.querySelector('[aria-label="User cards"]')).not.toHaveTextContent('never-render-this');
    expect(write).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
    const user = userEvent.setup(); await user.click(self); await user.click(within(table()).getByRole('button', { name: 'Delete admin' }));
    expect(confirm).not.toHaveBeenCalled(); expect(readUsers().value).toHaveLength(2);
  });
  it.each(['user', 'admin'])('creates persisted %s, resets form and includes concurrent accounts', async (role) => {
    setSession(ADMIN_SESSION); mount(); const user = userEvent.setup(); await fill(user, role);
    saveUsers([account('concurrent')]); await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(readUsers().value).toHaveLength(2); const created = readUsers().value[1];
    expect(created).toMatchObject({ displayName: 'Mira', username: 'mira', password: 'demo-secret', role });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/); expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
    expect(within(table()).getByText('Mira')).toBeVisible(); expect(within(table()).getByRole('button', { name: 'Delete concurrent' })).toBeVisible();
    expect(screen.getByLabelText('Password')).toHaveValue(''); expect(screen.getByLabelText('Role')).toHaveValue('');
    expect(screen.getByText('Account created.')).toBeVisible(); expect(table()).not.toHaveTextContent('demo-secret');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(ADMIN_SESSION);
  });
  it('associates every empty form error then permits correction', async () => {
    setSession(ADMIN_SESSION); mount(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Create User' }));
    for (const name of ['Display Name', 'Username', 'Password', 'Role']) {
      const field = screen.getByLabelText(name, { exact: true });
      expect(field).toHaveAttribute('aria-required', 'true'); expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(/required|Select Admin or user/); expect(field.className).toContain('focus-visible:ring-2');
    }
    expect(localStorage.getItem(USERS_KEY)).toBeNull(); await fill(user); await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(readUsers().value).toHaveLength(1); expect(screen.queryByRole('alert')).toBeNull();
  });
  it.each(['Display Name', 'Username', 'Password', 'Role'])('rejects missing %s alone retaining other fields', async (name) => {
    setSession(ADMIN_SESSION); mount(); const user = userEvent.setup(); await fill(user);
    if (name === 'Role') await user.selectOptions(screen.getByLabelText(name), ''); else await user.clear(screen.getByLabelText(name));
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByLabelText(name)).toHaveAttribute('aria-invalid', 'true'); expect(localStorage.getItem(USERS_KEY)).toBeNull();
    if (name !== 'Password') expect(screen.getByLabelText('Password')).toHaveValue('demo-secret');
  });
  it.each(['duplicate', 'reserved', 'quota', 'corrupt', 'unavailable', 'session'])('retains form and reports %s without false success', async (kind) => {
    setSession(ADMIN_SESSION); mount(); const user = userEvent.setup(); await fill(user);
    if (kind === 'duplicate') saveUsers([{ ...account(), username: 'MIRA' }]);
    if (kind === 'reserved') { await user.clear(screen.getByLabelText('Username')); await user.type(screen.getByLabelText('Username'), 'ADMIN'); }
    if (kind === 'corrupt') localStorage.setItem(USERS_KEY, '{');
    if (kind === 'session') setSession({ ...ADMIN_SESSION, role: 'user' });
    if (kind === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    if (kind === 'unavailable') {
      const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
        if (key === USERS_KEY) throw new DOMException('blocked', 'SecurityError'); return original.call(this, key);
      });
    }
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByLabelText('Password')).toHaveValue('demo-secret');
    expect(screen.getAllByRole('alert').some((alert) => /already exists|could not save|unreadable|administrator session/.test(alert.textContent))).toBe(true);
    expect(screen.queryByText('Account created.')).toBeNull(); expect(within(table()).queryByText('Mira')).toBeNull();
    if (kind === 'duplicate') expect(readUsers().value).toHaveLength(1);
    if (kind === 'quota' || kind === 'session' || kind === 'reserved') expect(localStorage.getItem(USERS_KEY)).toBeNull();
  });
});

describe('account deletion and recovery', () => {
  it('cancels without write then deletes with fresh re-read and feedback', async () => {
    setSession(ADMIN_SESSION); saveUsers([account()]); mount(); const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const write = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(within(table()).getByRole('button', { name: 'Delete one' }));
    expect(write).not.toHaveBeenCalled(); expect(readUsers().value).toEqual([account()]);
    confirm.mockImplementation(() => { saveUsers([account(), account('concurrent')]); return true; });
    await user.click(within(table()).getByRole('button', { name: 'Delete one' }));
    expect(readUsers().value).toEqual([account('concurrent')]); expect(within(table()).queryByRole('button', { name: 'Delete one' })).toBeNull();
    expect(screen.getByText('Account deleted.')).toBeVisible(); expect(within(table()).getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  });
  it.each(['quota', 'security', 'corrupt', 'session', 'self', 'missing'])('failed delete %s retains row and error', async (kind) => {
    setSession(ADMIN_SESSION); saveUsers([account('one', 'admin')]); mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (kind === 'corrupt') localStorage.setItem(USERS_KEY, '{');
      if (kind === 'session') localStorage.removeItem(SESSION_KEY);
      if (kind === 'self') setSession({ ...ADMIN_SESSION, userId: 'one', username: 'one' });
      if (kind === 'missing') saveUsers([]); return true;
    });
    if (kind === 'quota' || kind === 'security') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', kind === 'quota' ? 'QuotaExceededError' : 'SecurityError');
    });
    const user = userEvent.setup(); await user.click(within(table()).getByRole('button', { name: 'Delete one' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save|unreadable|administrator session|current account|Account not found/);
    expect(within(table()).getByRole('button', { name: 'Delete one' })).toBeInTheDocument(); expect(screen.queryByText('Account deleted.')).toBeNull();
    if (['quota', 'security', 'session', 'self'].includes(kind)) expect(readUsers().value).toEqual([account('one', 'admin')]);
  });
  for (const path of ['/admin', '/users']) {
    it.each(['corrupt', 'unavailable'])('renders warning without repairing ' + path + ' %s', (kind) => {
      setSession(ADMIN_SESSION); localStorage.setItem(USERS_KEY, '{');
      if (kind === 'unavailable') {
        const original = Storage.prototype.getItem;
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
          if (key === USERS_KEY) throw new DOMException('blocked', 'SecurityError'); return original.call(this, key);
        });
      }
      const write = vi.spyOn(Storage.prototype, 'setItem'); mount(path);
      expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent(/unreadable|could not save/); expect(write).not.toHaveBeenCalled();
    });
  }
  it('presents invalid-date mobile profile safely and activates its callback', async () => {
    const onDelete = vi.fn(); render(<UserRow user={{ ...account(), createdAt: 'bad' }} currentId="other" onDelete={onDelete} card />);
    expect(screen.getByText('Date unavailable')).toBeVisible(); expect(screen.queryByText('never-render-this')).toBeNull();
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete one' })); expect(onDelete).toHaveBeenCalledWith('one');
  });
  it('renders numeric neutral metric when pending is false', () => {
    render(<StatCard label="Count" value={0} />); expect(screen.getByRole('region')).toHaveTextContent('0');
    expect(screen.queryByText('Metric pending definition')).toBeNull();
  });
});


describe('additional fresh-read and presentation branches', () => {
  it.each(['{', '{}', '[null]'])('dashboard warns on corrupt posts %s without seeding', (raw) => {
    setSession(ADMIN_SESSION); localStorage.setItem(POSTS_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem'); mount('/admin');
    expect(screen.getByText('No posts yet.')).toBeVisible();
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent(/unreadable/);
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw); expect(write).not.toHaveBeenCalled();
  });
  it('unavailable account read during deletion retains row and durable collection', async () => {
    setSession(ADMIN_SESSION); saveUsers([account()]); mount();
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
      if (key === USERS_KEY) throw new DOMException('blocked', 'SecurityError');
      return original.call(this, key);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup(); await user.click(within(table()).getByRole('button', { name: 'Delete one' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/);
    expect(within(table()).getByRole('button', { name: 'Delete one' })).toBeVisible();
    expect(original.call(localStorage, USERS_KEY)).toBe(JSON.stringify([account()]));
  });
  it('explicit retry after failed create preserves newly added accounts and clears errors', async () => {
    setSession(ADMIN_SESSION); mount(); const user = userEvent.setup(); await fill(user);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/);
    write.mockRestore(); saveUsers([account('concurrent')]);
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(readUsers().value).toHaveLength(2); expect(readUsers().value[0]).toEqual(account('concurrent'));
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByText('Account created.')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Back to Dashboard' }));
    expect(screen.getByRole('region', { name: 'Total Users', exact: true })).toHaveTextContent('3');
  });
  it('keeps reserved-username profile deletion disabled even with a non-default id', () => {
    render(<UserRow user={{ ...account(), username: ' ADMIN ' }} currentId="other" onDelete={vi.fn()} card />);
    const button = screen.getByRole('button', { name: 'Delete ADMIN' });
    expect(button).toBeDisabled(); expect(button).toHaveAttribute('title', 'Default admin cannot be deleted.');
    expect(screen.getByText('Built-in account')).toBeVisible();
  });
  it('escapes profile names without adding HTML to either responsive presentation', () => {
    setSession(ADMIN_SESSION); saveUsers([{ ...account(), displayName: '<img src=x>', username: '<script>bad</script>' }]);
    const { container } = mount();
    expect(table()).toHaveTextContent('<img src=x>'); expect(table()).toHaveTextContent('<script>bad</script>');
    expect(container.querySelector('img, script')).toBeNull();
  });
});


describe('admin dark appearance regressions', () => {
  it.each(['indigo', 'violet', 'teal', 'neutral'])('retains numeric content and dark surface for %s metrics', (tone) => {
    render(<StatCard label="Count" value={0} tone={tone} />);
    const metric = screen.getByRole('region', { name: 'Count' });
    const color = tone === 'neutral' ? 'slate' : tone;
    expect(metric).toHaveTextContent('0');
    expect(metric).toHaveClass('dark:bg-' + color + (tone === 'neutral' ? '-900' : '-950'));
    expect(metric).toHaveClass('dark:border-' + color + (tone === 'neutral' ? '-700' : '-800'));
    expect(metric).toHaveClass('dark:text-' + color + '-100');
  });
  it('keeps the fourth metric neutral and unassigned even with a supplied value and tone', () => {
    render(<StatCard label="Total users" value={42} tone="violet" pending />);
    const metric = screen.getByRole('region', { name: 'Total users', exact: true });
    expect(metric).toHaveClass('bg-white', 'dark:bg-slate-900', 'dark:text-slate-100');
    expect(metric).toHaveTextContent('—');
    expect(metric).not.toHaveTextContent('42');
    expect(within(metric).getByText('Metric pending definition')).toHaveClass('dark:text-slate-300');
  });
  it('supplies dark forms, field errors, table and mobile surfaces without changing protected accounts', async () => {
    setSession({ ...ADMIN_SESSION, userId: 'staff', username: 'staff' });
    saveUsers([account(), account('staff', 'admin')]);
    const { container } = mount();
    expect(screen.getByRole('region', { name: 'Create User' })).toHaveClass('dark:bg-slate-900', 'dark:border-slate-700');
    expect(table().parentElement).toHaveClass('dark:bg-slate-900', 'dark:border-slate-700');
    expect(table().querySelector('thead')).toHaveClass('dark:bg-slate-800', 'dark:text-slate-300');
    expect(table().querySelector('tbody')).toHaveClass('dark:divide-slate-700');
    const cards = container.querySelector('[aria-label="User cards"]');
    for (const profile of within(cards).getAllByRole('article')) {
      expect(profile).toHaveClass('dark:bg-slate-900', 'dark:text-slate-100', 'dark:border-slate-700');
    }
    for (const presentation of [table(), cards]) {
      expect(within(presentation).getByText('user', { exact: true })).toHaveClass('dark:bg-indigo-950', 'dark:text-indigo-200');
      for (const name of ['admin', 'staff']) {
        const button = within(presentation).getByRole('button', { name: 'Delete ' + name });
        expect(button).toBeDisabled();
        expect(button).toHaveClass('dark:disabled:bg-slate-800', 'dark:disabled:text-slate-400');
      }
      expect(within(presentation).getByRole('button', { name: 'Delete one' })).toHaveClass(
        'dark:bg-red-950', 'dark:text-red-300', 'dark:hover:bg-red-900',
      );
      expect(presentation).not.toHaveTextContent('never-render-this');
    }
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    for (const name of ['Display Name', 'Username', 'Password', 'Role']) {
      const field = screen.getByLabelText(name, { exact: true });
      expect(field).toHaveClass('dark:bg-slate-950', 'dark:text-slate-100', 'dark:border-slate-600');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(container.querySelector('#' + field.getAttribute('aria-describedby'))).toHaveClass('dark:text-red-300');
    }
    expect(readUsers().value).toEqual([account(), account('staff', 'admin')]);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByText('Account created.')).toHaveClass('dark:text-indigo-300');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('keeps dashboard content and failed deletion readable with dark action and error variants', async () => {
    setSession(ADMIN_SESSION);
    savePosts([post('one')]);
    mount('/admin');
    const recent = screen.getByRole('region', { name: 'Recent posts' });
    expect(recent).toHaveClass('dark:bg-slate-900', 'dark:text-slate-100', 'dark:border-slate-700');
    expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveClass('dark:bg-slate-900', 'dark:text-indigo-300');
    expect(screen.getByRole('link', { name: 'Edit one' })).toHaveClass('dark:text-indigo-300');
    const button = screen.getByRole('button', { name: 'Delete one' });
    expect(button).toHaveClass('dark:bg-red-950', 'dark:text-red-300');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      localStorage.removeItem(SESSION_KEY);
      return true;
    });
    const user = userEvent.setup();
    await user.click(button);
    expect(screen.getByRole('alert')).toHaveClass('dark:bg-red-950', 'dark:text-red-300');
    expect(within(recent).getByRole('link', { name: 'Edit one' })).toBeVisible();
    expect(readPosts().value).toEqual([post('one')]);
  });
  it.each(['/admin', '/users'])('retains unreadable-storage warnings with dark status treatment at %s', (path) => {
    setSession(ADMIN_SESSION);
    localStorage.setItem(USERS_KEY, '{');
    mount(path);
    const warning = within(screen.getByRole('main')).getByRole('status');
    expect(warning).toHaveClass('dark:bg-amber-950', 'dark:text-amber-200');
    expect(warning).toHaveTextContent('unreadable');
    expect(localStorage.getItem(USERS_KEY)).toBe('{');
  });
});
