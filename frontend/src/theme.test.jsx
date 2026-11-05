/** Verify real root appearance, native activation, identity transitions and storage failures. */
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { ADMIN_SESSION, getSession, setSession } from './utils/auth.js';

/** Mount the real shell without adding a second router or replacing storage helpers. */
function mount(path = '/') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}

afterEach(() => document.documentElement.classList.remove('dark', 'unrelated'));

describe('root-owned theme navigation', () => {
  it('pairs public empty and auth validation surfaces with readable dark classes', async () => {
    const user = userEvent.setup();
    localStorage.setItem('writespace_theme', 'dark');
    mount();
    expect(screen.getByRole('heading', { name: 'WriteSpace' })).toHaveClass('dark:text-slate-100');
    expect(screen.getByText(/No posts yet/)).toHaveClass('dark:text-slate-300', 'dark:border-slate-600');
    await user.click(screen.getByRole('link', { name: 'Get Started' }));
    expect(screen.getByRole('region', { name: 'Registration form' })).toHaveClass('dark:bg-slate-900');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Display Name')).toHaveClass('dark:bg-slate-800', 'dark:text-slate-100');
    expect(screen.getByText('Display Name is required.')).toHaveClass('dark:text-red-300');
    await user.click(within(screen.getByRole('region', { name: 'Registration form' })).getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('region', { name: 'Login form' })).toHaveClass('dark:bg-slate-900');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Username is required.')).toHaveClass('dark:text-red-300');
  });
  it.each([null, '', 'Dark', ' dark ', '"dark"', '{}', 'light'])
    ('selects light for %j without mount writes or removals', (raw) => {
      if (raw !== null) localStorage.setItem('writespace_theme', raw);
      document.documentElement.classList.add('dark', 'unrelated');
      const write = vi.spyOn(Storage.prototype, 'setItem');
      const remove = vi.spyOn(Storage.prototype, 'removeItem');
      mount();
      expect(document.documentElement).not.toHaveClass('dark');
      expect(document.documentElement).toHaveClass('unrelated');
      expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
      expect(localStorage.getItem('writespace_theme')).toBe(raw);
      expect(write).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  it('restores dark on mount without rewriting the preference', () => {
    localStorage.setItem('writespace_theme', 'dark');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount('/login');
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });
  it('defaults unavailable reads to light while public links stay usable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    mount();
    expect(document.documentElement).not.toHaveClass('dark');
    await user.click(screen.getByRole('link', { name: 'Get Started' }));
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });
  it('does not activate on focus or hover; Enter and Space change appearance and only its key', async () => {
    const user = userEvent.setup();
    localStorage.setItem('unrelated', 'keep');
    mount();
    const button = screen.getByRole('button', { name: 'Switch to dark mode' });
    await user.tab();
    await user.tab();
    await user.tab();
    expect(button).toHaveFocus();
    await user.hover(button);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('writespace_theme')).toBeNull();
    await user.keyboard('{Enter}');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveFocus();
    await user.keyboard(' ');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('writespace_theme')).toBe('light');
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(localStorage.length).toBe(2);
  });
  it('retains dark through public links and a fresh root mount', async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' }));
    await user.click(screen.getByRole('link', { name: 'Register' }));
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    view.unmount();
    document.documentElement.classList.remove('dark');
    mount('/register');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });
  it.each(['SecurityError', 'QuotaExceededError', 'Error'])
    ('keeps appearance and auth fields usable after a %s preference write failure', async (name) => {
      const user = userEvent.setup();
      localStorage.setItem('writespace_theme', 'light');
      mount('/login');
      await user.type(screen.getByLabelText('Username'), 'writer');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', name); });
      await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
      expect(document.documentElement).toHaveClass('dark');
      expect(screen.getByLabelText('Username')).toHaveValue('writer');
      expect(localStorage.getItem('writespace_theme')).toBe('light');
      await user.click(screen.getByRole('link', { name: 'Register' }));
      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(document.documentElement).toHaveClass('dark');
      await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
      expect(document.documentElement).not.toHaveClass('dark');
    });
  it('keeps dark across login, authenticated mobile navigation, public identity and logout', async () => {
    const user = userEvent.setup();
    mount('/login');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(getSession()).toEqual(ADMIN_SESSION);
    const nav = screen.getByRole('navigation', { name: 'Workspace navigation' });
    expect(within(nav).getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: 'Toggle navigation' }));
    await user.click(within(nav).getByRole('link', { name: 'All Blogs' }));
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getByRole('link', { name: 'WriteSpace.' }));
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    await user.click(screen.getByRole('button', { name: 'Admin profile' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
  });
  it('supports reverse authenticated activation without modifying session bytes', async () => {
    setSession(ADMIN_SESSION);
    localStorage.setItem('writespace_theme', 'dark');
    const before = localStorage.getItem('writespace_session');
    const user = userEvent.setup();
    mount('/admin');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('writespace_theme')).toBe('light');
    expect(localStorage.getItem('writespace_session')).toBe(before);
  });
});
