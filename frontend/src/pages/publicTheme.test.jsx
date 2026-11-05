/** Verify public theme contracts alongside real browser-local auth and route interactions. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';

/** Expose route changes without substituting for actual links. */
function Location() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}

/** Mount one real route with a saved preference, without initial domain writes. */
function mount(mode, path = '/') {
  localStorage.setItem('writespace_theme', mode);
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

/** Check paired control contracts; browser computed-color checks live in E2E. */
function expectControls(labels) {
  for (const label of labels) {
    expect(screen.getByLabelText(label, { exact: true })).toHaveClass(
      'bg-white', 'text-slate-900', 'border-slate-300', 'dark:bg-slate-900',
      'dark:text-slate-100', 'dark:border-slate-600', 'focus-visible:ring-2',
      'dark:focus-visible:ring-offset-slate-900',
    );
  }
}

afterEach(() => document.documentElement.classList.remove('dark'));

describe.each(['light', 'dark'])('public surfaces in %s mode', (mode) => {
  it.each(['/login', '/register'])('does not write or navigate on initial %s render', (path) => {
    localStorage.setItem('writespace_theme', mode);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    render(
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Location />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Location')).toHaveTextContent(path);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('retains paper hero, themed empty illustration, features, footer and explicit entries', async () => {
    const user = userEvent.setup();
    localStorage.setItem('writespace_theme', mode);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Location />
      </MemoryRouter>,
    );
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(document.documentElement.classList.contains('dark')).toBe(mode === 'dark');
    expect(screen.getByRole('region', { name: 'WriteSpace' })).toHaveClass('bg-slate-50', 'dark:bg-slate-900');
    expect(screen.getByRole('figure')).toHaveClass('bg-white', 'dark:bg-slate-800', 'dark:border-slate-700');
    expect(screen.getByText('No posts yet — check back soon!')).toHaveClass('dark:text-slate-300', 'dark:border-slate-700');
    expect(screen.getByRole('region', { name: 'Features' })).toHaveClass('bg-white', 'dark:bg-slate-950');
    expect(screen.getByRole('contentinfo')).toHaveClass('bg-slate-900', 'dark:bg-slate-950');
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveClass('dark:bg-slate-800', 'dark:text-indigo-300');
    expect(view.container.querySelector('main').className).not.toContain('bg-gradient');
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    await user.click(screen.getByRole('link', { name: 'Register', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/register');
    expect(write).not.toHaveBeenCalled();
  });

  it('preserves populated previews, author/date/excerpt and guest gating without initial writes', async () => {
    const posts = [1, 2, 3, 4].map((id) => ({
      id: String(id), title: `Post ${id}`, content: `Local content ${id}`,
      authorId: 'writer', authorName: 'Mira', createdAt: `2026-01-0${id}T00:00:00Z`,
    }));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
    localStorage.setItem('writespace_theme', mode);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Location />
      </MemoryRouter>,
    );
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(['Post 4', 'Post 3', 'Post 2']);
    expect(latest.getByText('Local content 4')).toBeVisible();
    expect(latest.getByText('Jan 04, 2026')).toBeVisible();
    expect(latest.getAllByText('Mira')).toHaveLength(3);
    expect(screen.getByRole('main')).toHaveClass('dark:[&_article.bg-white]:bg-slate-800', 'dark:[&_article_h3]:text-slate-100');
    expect(write).not.toHaveBeenCalled();
    await user.click(latest.getByRole('link', { name: 'Read Post 4' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(JSON.parse(localStorage.getItem('writespace_posts'))).toEqual(posts);
  });

  it('themes storage warning and does not repair malformed posts', () => {
    localStorage.setItem('writespace_posts', '{');
    mount(mode);
    expect(within(screen.getByRole('region', { name: 'Latest from the Blog' })).getByRole('status')).toHaveClass('dark:bg-amber-950', 'dark:text-amber-200', 'dark:border-amber-800');
    expect(localStorage.getItem('writespace_posts')).toBe('{');
  });

  it('themes required and invalid-login errors, then logs in only after valid submit', async () => {
    const user = userEvent.setup();
    mount(mode, '/login');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expectControls(['Username', 'Password']);
    expect(screen.getByRole('region', { name: 'Login form' })).toHaveClass('dark:bg-slate-800', 'dark:border-slate-700');
    expect(write).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    for (const label of ['Username', 'Password']) {
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
      expect(screen.getByText(`${label} is required.`)).toHaveClass('text-red-700', 'dark:text-red-300');
    }
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(screen.getByText('Invalid username or password.')).toHaveClass('bg-red-50', 'dark:bg-red-950', 'dark:text-red-300');
    expect(write).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'admin');
    expect(localStorage.getItem('writespace_session')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/admin');
    expect(JSON.parse(localStorage.getItem('writespace_session')).role).toBe('admin');
    expect(localStorage.getItem('writespace_theme')).toBe(mode);
  });

  it('themes registration validation, mismatch and duplicate, then preserves registration/logout/login', async () => {
    const user = userEvent.setup();
    mount(mode, '/register');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const labels = ['Display Name', 'Username', 'Password', 'Confirm Password'];
    expectControls(labels);
    expect(screen.getByRole('region', { name: 'Registration form' })).toHaveClass('dark:bg-slate-800', 'dark:border-slate-700');
    expect(write).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    for (const label of labels) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveAccessibleDescription(`${label} is required.`);
    }
    for (const [label, value] of [['Display Name', 'Mira'], ['Username', 'ADMIN'], ['Password', 'demo'], ['Confirm Password', 'other']]) {
      await user.type(screen.getByLabelText(label, { exact: true }), value);
    }
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByText('Passwords do not match.')).toHaveClass('dark:text-red-300');
    await user.clear(screen.getByLabelText('Confirm Password'));
    await user.type(screen.getByLabelText('Confirm Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(/Username already exists/);
    expect(write).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'mira');
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Mira profile' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Footer' })).getByRole('link', { name: 'Login' }));
    await user.type(screen.getByLabelText('Username'), 'mira');
    await user.type(screen.getByLabelText('Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
    expect(JSON.parse(localStorage.getItem('writespace_session')).username).toBe('mira');
    expect(localStorage.getItem('writespace_theme')).toBe(mode);
  });
});
