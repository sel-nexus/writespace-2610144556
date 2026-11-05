/** Verify real root coordination across native navigation and identity changes. */
import { StrictMode } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from './App.jsx';

const session = { userId: 'writer', username: 'mira', displayName: 'Mira', role: 'user' };

/** Expose the route reached through real links without manipulating navigation. */
function Location() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}

/** Mount the real shell in StrictMode and one router at its initial entry. */
function mount(path = '/') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Assert root synchronization and the shared control's observable state. */
function expectMode(mode) {
  expect(document.documentElement.classList.contains('dark')).toBe(mode === 'dark');
  expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', String(mode === 'dark'));
}

beforeEach(() => document.documentElement.classList.remove('dark'));
afterEach(() => document.documentElement.classList.remove('dark'));

describe('root theme coordination', () => {
  it.each([null, 'light', 'dark', 'system', '"dark"'])('initializes %s safely under StrictMode without writing', (raw) => {
    if (raw !== null) localStorage.setItem('writespace_theme', raw);
    document.documentElement.classList.add('dark', 'unrelated');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const { container } = mount();
    expectMode(raw === 'dark' ? 'dark' : 'light');
    expect(document.documentElement).toHaveClass('unrelated');
    expect(container.firstChild).toHaveClass('dark:bg-slate-950', 'dark:text-slate-100');
    expect(screen.getByRole('banner')).toHaveClass('dark:bg-slate-900/95', 'dark:border-slate-700');
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_theme')).toBe(raw);
    document.documentElement.classList.remove('unrelated');
  });
  it('supports tab, Space and Enter without losing focus and persists both transitions', async () => {
    const user = userEvent.setup();
    mount();
    await user.tab();
    await user.tab();
    await user.tab();
    const button = screen.getByRole('button', { name: 'Dark mode' });
    expect(button).toHaveFocus();
    expect(button).toHaveClass('focus-visible:ring-2', 'dark:focus-visible:ring-offset-slate-900');
    await user.keyboard(' ');
    expectMode('dark');
    expect(button).toHaveFocus();
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    await user.keyboard('{Enter}');
    expectMode('light');
    expect(button).toHaveFocus();
    expect(localStorage.getItem('writespace_theme')).toBe('light');
  });
  it('retains the guest preference across login and registration links and a remount', async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    expectMode('dark');
    await user.click(screen.getByRole('link', { name: 'Register', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/register');
    expectMode('dark');
    view.unmount();
    mount('/register');
    expectMode('dark');
  });
  it.each(['user', 'admin'])('shares public/workspace controls and preserves %s identity until explicit logout', async (role) => {
    const user = userEvent.setup();
    localStorage.setItem('writespace_session', JSON.stringify({ ...session, role }));
    localStorage.setItem('writespace_posts', '[]');
    localStorage.setItem('writespace_users', '[]');
    mount();
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expectMode('dark');
    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Workspace navigation' })).getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/write');
    expectMode('dark');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expectMode('light');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual({ ...session, role });
    await user.click(screen.getByRole('button', { name: 'Mira profile' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    expectMode('dark');
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
    expect(localStorage.getItem('writespace_users')).toBe('[]');
  });
  it('defaults a failed read to light while leaving navigation and toggling usable', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    mount();
    expectMode('light');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expectMode('dark');
    await user.click(screen.getByRole('link', { name: 'Get Started', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/register');
    expectMode('dark');
  });
  it.each(['QuotaExceededError', 'SecurityError', 'Error'])('retains active UI on %s write failure and clears guidance after retry', async (name) => {
    const user = userEvent.setup();
    localStorage.setItem('writespace_theme', 'light');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Object.assign(new Error('failed'), { name }); });
    mount();
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expectMode('dark');
    expect(screen.getByRole('status', { name: 'Theme preference' })).toHaveTextContent(/Theme changed for this view but could not be saved/);
    expect(localStorage.getItem('writespace_theme')).toBe('light');
    await user.click(screen.getByRole('link', { name: 'Get Started', exact: true }));
    expectMode('dark');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expectMode('light');
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expectMode('dark');
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    expect(screen.queryByRole('status', { name: 'Theme preference' })).not.toBeInTheDocument();
  });
});
