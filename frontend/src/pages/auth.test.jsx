/** Exercise actual auth forms, fresh localStorage state, route guards and explicit navigation. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { setSession, getSession, ADMIN_SESSION } from '../utils/auth.js';
import { getUsers } from '../utils/storage.js';
import { getAvatar } from '../components/Avatar.jsx';

/** Expose router location as user-readable evidence without changing navigation. */
function Location() {
  const location = useLocation();
  return <output aria-label="Location">{location.pathname}</output>;
}
/** Mount the real shell at one initial route. */
function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}
/** Fill the actual stable form controls using user input events. */
async function fillRegistration(user, overrides = {}) {
  const values = { 'Display Name': 'Mira', Username: 'mira', Password: 'demo', 'Confirm Password': 'demo', ...overrides };
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(label, { exact: true }), value);
  }
}
/** Activate logout through the profile control, never a direct helper call. */
async function logout(user, name = 'Mira') {
  await user.click(screen.getByRole('button', { name: `${name} profile` }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
}

describe('auth pages and navigation', () => {
  it('browser transition logout ends at public home without a competing guard redirect', async () => {
    const user = userEvent.setup();
    setSession(ADMIN_SESSION);
    window.history.replaceState({}, '', '/admin');
    render(<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /><Location /></BrowserRouter>);
    await logout(user, 'Admin');
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toBeInTheDocument();
    window.history.replaceState({}, '', '/');
  });
  it.each(['/login', '/register', '/unknown'])('never invokes storage writes on render at %s', (path) => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    mount(path);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it('fails closed on an unapproved role at the guard', () => {
    localStorage.setItem('writespace_session', JSON.stringify({ userId: 'x', username: 'x', displayName: 'X', role: 'Admin' }));
    mount('/admin');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
  });
  it('returns regular public identity to its role home only on dashboard activation', async () => {
    const user = userEvent.setup();
    setSession({ userId: 'u', username: 'mira', displayName: 'Mira', role: 'user' });
    mount('/');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/');
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
  });
  it('renders the public landing without writing or navigating until activation', async () => {
    const user = userEvent.setup(); mount(); expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
    expect(localStorage.length).toBe(0); expect(screen.getByLabelText('Location')).toHaveTextContent('/');
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    expect(localStorage.length).toBe(0); expect(screen.getByText(/do not use real passwords/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Register' })); expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
  });
  it('opens registration from Get Started', async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole('link', { name: 'Get Started' }));
    expect(screen.getByRole('heading', { name: 'Make room for your words.' })).toBeInTheDocument();
  });
  it('shows associated login required errors and exact invalid credential message without persistence', async () => {
    const user = userEvent.setup(); mount('/login'); await user.click(screen.getByRole('button', { name: 'Login' }));
    for (const label of ['Username', 'Password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
    }
    await user.type(screen.getByLabelText('Username'), 'wrong'); await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' })); expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
    expect(getSession()).toBeNull(); expect(localStorage.length).toBe(0);
  });
  it('logs in built-in Admin, updates navbar and highlights activated navigation', async () => {
    const user = userEvent.setup(); mount('/login');
    await user.type(screen.getByLabelText('Username'), 'admin'); await user.type(screen.getByLabelText('Password'), 'admin');
    expect(getSession()).toBeNull(); await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/admin'); expect(getSession()).toEqual(ADMIN_SESSION);
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'All Blogs' })); expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('link', { name: 'WriteSpace.' }));
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' })); expect(screen.getByLabelText('Location')).toHaveTextContent('/admin');
  });
  it.each(['Display Name', 'Username', 'Password', 'Confirm Password'])('rejects missing registration field %s on submit with accessible field error', async (label) => {
    const user = userEvent.setup(); mount('/register'); await fillRegistration(user, { [label]: '' });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText(label, { exact: true })).toHaveAccessibleDescription(`${label} is required.`);
    expect(getUsers()).toEqual([]); expect(getSession()).toBeNull();
  });
  it('shows mismatch, then reserved duplicate and retains inputs', async () => {
    const user = userEvent.setup(); mount('/register'); await fillRegistration(user, { Username: 'ADMIN', 'Confirm Password': 'other' });
    await user.click(screen.getByRole('button', { name: 'Register' })); expect(screen.getByLabelText('Confirm Password')).toHaveAccessibleDescription('Passwords do not match.');
    await user.clear(screen.getByLabelText('Confirm Password')); await user.type(screen.getByLabelText('Confirm Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Register' })); expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(/Username already exists/);
    expect(screen.getByLabelText('Display Name')).toHaveValue('Mira'); expect(getUsers()).toEqual([]);
  });
  it('registers, refreshes identity, survives remount and logs in again after isolated logout', async () => {
    const user = userEvent.setup(); const view = mount('/register'); await fillRegistration(user);
    expect(localStorage.length).toBe(0); await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs'); expect(getUsers()).toHaveLength(1); expect(getSession().displayName).toBe('Mira');
    view.unmount(); mount('/blogs'); expect(screen.getByRole('button', { name: 'Mira profile' })).toBeInTheDocument();
    localStorage.setItem('writespace_posts', '[]'); localStorage.setItem('unrelated', 'keep'); await logout(user);
    expect(getSession()).toBeNull(); expect(getUsers()).toHaveLength(1); expect(localStorage.getItem('writespace_posts')).toBe('[]'); expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' })); await user.type(screen.getByLabelText('Username'), 'mira');
    await user.type(screen.getByLabelText('Password'), 'demo'); await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(getSession().username).toBe('mira'); expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });
  it('retains login values on a session write failure', async () => {
    const user = userEvent.setup(); mount('/login');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    await user.type(screen.getByLabelText('Username'), 'admin'); await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' })); expect(screen.getByText(/could not save this change/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('admin'); expect(getSession()).toBeNull(); expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
  });
  it('explains failed registration writes and preserves all fields', async () => {
    const user = userEvent.setup(); mount('/register'); await fillRegistration(user);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    await user.click(screen.getByRole('button', { name: 'Register' })); expect(screen.getByText(/could not save this change/)).toBeInTheDocument();
    expect(screen.getByLabelText('Display Name')).toHaveValue('Mira'); expect(getUsers()).toEqual([]);
  });
  it('explains partial registration and prevents duplicate retry', async () => {
    const user = userEvent.setup(); mount('/register'); await fillRegistration(user);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key === 'writespace_session') throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: 'Register' })); expect(screen.getByText(/account was saved locally/)).toBeInTheDocument();
    expect(getUsers()).toHaveLength(1); expect(getSession()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Register' })); expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(/go to Login/); expect(getUsers()).toHaveLength(1);
  });
  it('keeps session and reports failed logout', async () => {
    const user = userEvent.setup(); setSession(ADMIN_SESSION); mount('/admin');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    await logout(user, 'Admin'); expect(screen.getByRole('alert')).toHaveTextContent('Could not log out.');
    expect(getSession()).toEqual(ADMIN_SESSION); expect(screen.getByLabelText('Location')).toHaveTextContent('/admin');
  });
  it.each(['/blogs', '/blog/any', '/write', '/edit/any', '/admin', '/users'])('redirects guest from protected %s', (path) => {
    mount(path); expect(screen.getByLabelText('Location')).toHaveTextContent('/login'); expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
  it.each(['/admin', '/users'])('redirects regular user from %s', (path) => {
    setSession({ userId: 'u', username: 'mira', displayName: 'Mira', role: 'user' }); mount(path);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
  });
  it.each([['admin', '/admin', '/login'], ['user', '/blogs', '/login'], ['admin', '/admin', '/register'], ['user', '/blogs', '/register']])('redirects authenticated %s to %s from %s', (role, destination, path) => {
    setSession({ userId: 'u', username: 'x', displayName: 'X', role }); mount(path);
    expect(screen.getByLabelText('Location')).toHaveTextContent(destination); expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
  it('refreshes navbar after storage changes and route activation; menus are explicit and close on route change', async () => {
    const user = userEvent.setup(); setSession(ADMIN_SESSION); mount('/blogs');
    await user.click(screen.getByRole('button', { name: 'Toggle navigation' })); expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Admin profile' })); expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    localStorage.removeItem('writespace_session');
    await user.click(within(screen.getByRole('navigation', { name: 'Workspace navigation' })).getByRole('link', { name: 'Write' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login'); expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
  });
  it('renders unknown routes safely and both static avatar branches', () => {
    mount('/unknown'); expect(screen.getByRole('heading')).toHaveTextContent('Page not found');
    const avatar = render(
      <div>
        {getAvatar('admin')}
        {getAvatar('unknown')}
      </div>,
    );
    expect(avatar.container.textContent).toContain('👑'); expect(avatar.container.textContent).toContain('📖');
  });
});
