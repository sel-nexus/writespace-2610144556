/** Exercise public discovery through the real shell, storage boundary, and native card links. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { BlogCard } from '../components/BlogCard.jsx';
import { ADMIN_SESSION, setSession } from '../utils/auth.js';
import { POSTS_KEY, readPosts, getPosts } from '../utils/storage.js';

const session = { userId: 'writer', username: 'mira', displayName: 'Mira', role: 'user' };
/** Create a complete local test record without seeding the application. */
function post(id, createdAt = '2026-01-22T12:00:00Z', overrides = {}) {
  return { id, title: id, content: 'A local thought.', createdAt, authorId: 'writer', authorName: 'Mira', ...overrides };
}
/** Expose the current route as observable navigation evidence. */
function Location() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}
/** Mount a real landing shell or isolated card in the existing single-router pattern. */
function mount(element = <App />) {
  return render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
      <Location />
    </MemoryRouter>,
  );
}
/** Scope assertions to the latest-three section, excluding the real hero preview. */
function latest() {
  return within(screen.getByRole('region', { name: 'Latest from the Blog' }));
}

describe('landing discovery', () => {
  it('renders exact copy, feature disclaimers, footer and an explicitly unsaved illustration without writes', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
    for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
      expect(screen.getByRole('heading', { name })).toBeVisible();
    }
    expect(screen.getByText(/No cross-device sync or encryption/)).toBeVisible();
    expect(screen.getByText(/Do not use real passwords or sensitive data/)).toBeVisible();
    expect(screen.getByText('Writing illustration · not a saved post')).toBeVisible();
    expect(latest().getByText('No posts yet — check back soon!')).toBeVisible();
    expect(latest().queryByRole('status')).not.toBeInTheDocument();
    const footer = within(screen.getByRole('navigation', { name: 'Footer' }));
    for (const [name, href] of [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
      expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    expect(screen.getByText(`© ${new Date().getFullYear()} WriteSpace. All rights reserved.`)).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
  it.each(['{', '{}', 'null', '[null]', '[{"id":"bad"}]'])('shows empty plus warning for malformed data %s without repair', (raw) => {
    localStorage.setItem(POSTS_KEY, raw);
    mount();
    expect(latest().getByText('No posts yet — check back soon!')).toBeVisible();
    expect(latest().getByRole('status')).toHaveTextContent(/could not be read/);
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    expect(readPosts().ok).toBe(false);
    expect(getPosts()).toEqual([]);
  });
  it('keeps guest controls usable when local storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    const user = userEvent.setup();
    mount();
    expect(latest().getByText('No posts yet — check back soon!')).toBeVisible();
    expect(latest().getByRole('status')).toHaveTextContent(/Enable browser storage/);
    expect(readPosts().error).toBe('unavailable');
    await user.click(screen.getByRole('link', { name: 'Get Started Free' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/register');
  });
  it('treats a stored empty array as empty, not an error', () => {
    localStorage.setItem(POSTS_KEY, '[]');
    mount();
    expect(latest().getByText('No posts yet — check back soon!')).toBeVisible();
    expect(latest().queryByRole('status')).not.toBeInTheDocument();
    expect(readPosts()).toEqual({ ok: true, value: [] });
  });
  it('shows sorted maximum three records and a functional real hero preview, never fabricated posts', () => {
    const input = [post('invalid', 'bad'), post('older', '2024-01-01'), post('newest', '2026-01-01'), post('middle', '2025-01-01')];
    localStorage.setItem(POSTS_KEY, JSON.stringify(input));
    mount();
    expect(latest().getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['newest', 'middle', 'older']);
    expect(screen.getAllByRole('link', { name: 'Read newest' })).toHaveLength(2);
    expect(screen.queryByText(/Writing illustration/)).not.toBeInTheDocument();
    expect(latest().queryByText('invalid')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual(input);
  });
  it('preserves invalid-date and equal-date stability in the page', () => {
    localStorage.setItem(POSTS_KEY, JSON.stringify([post('invalid', 'bad'), post('first'), post('second')]));
    mount();
    expect(latest().getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['first', 'second', 'invalid']);
    expect(latest().getByText('Date unavailable')).toBeVisible();
  });
  it.each([['Start Reading', '/login'], ['Get Started Free', '/register']])('activates guest %s only on click', async (name, path) => {
    const user = userEvent.setup();
    mount();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    await user.click(screen.getByRole('link', { name, exact: true }));
    expect(screen.getByLabelText('Location')).toHaveTextContent(path);
  });
  it('gates a real guest preview via the existing protected route on activation', async () => {
    localStorage.setItem(POSTS_KEY, JSON.stringify([post('one')]));
    const user = userEvent.setup();
    mount();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    await user.click(latest().getByRole('link', { name: 'Read one' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    expect(screen.getByLabelText('Username')).toBeVisible();
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });
  it.each([session, ADMIN_SESSION])('sends authenticated $role Start Reading to blogs, not role home', async (identity) => {
    setSession(identity);
    const user = userEvent.setup();
    mount();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', identity.role === 'admin' ? '/admin' : '/blogs');
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
  });
  it('allows authenticated preview entry without changing session or posts', async () => {
    setSession(session);
    localStorage.setItem(POSTS_KEY, JSON.stringify([post('one')]));
    const user = userEvent.setup();
    mount();
    await user.click(latest().getByRole('link', { name: 'Read one' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/one');
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
    expect(getPosts()).toEqual([post('one')]);
  });
});

describe('BlogCard', () => {
  it.each([[0, 'indigo'], [1, 'violet'], [2, 'pink'], [3, 'teal'], [4, 'indigo'], [-1, 'teal'], [NaN, 'indigo']])(
    'cycles index %s to %s and supplies visible focus', (index, accent) => {
      mount(<BlogCard post={post('one')} index={index} />);
      expect(screen.getByRole('article')).toHaveClass('border-t-4', `border-${accent}-500`);
      expect(screen.getByRole('link', { name: 'Read one' }).className).toContain('focus-visible:ring-2');
    },
  );
  it.each([1, 120, 121])('shows exactly the first 120 characters for content length %s', (length) => {
    const content = 'x'.repeat(length);
    mount(<BlogCard post={post('one', undefined, { content })} />);
    expect(screen.getByText(content.slice(0, 120))).toHaveTextContent(new RegExp(`^x{${Math.min(length, 120)}}$`));
  });
  it('formats the date and renders native encoded links with no nested links', async () => {
    const user = userEvent.setup();
    const { container } = mount(<BlogCard post={post('one/two')} session={session} />);
    expect(screen.getByText('Jan 22, 2026')).toHaveAttribute('datetime', '2026-01-22T12:00:00Z');
    expect(screen.getByText('Mira')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Read one/two' })).toHaveAttribute('href', '/blog/one%2Ftwo');
    expect(screen.getByRole('link', { name: 'Edit one/two' })).toHaveAttribute('href', '/edit/one%2Ftwo');
    expect(container.querySelector('a a')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Edit one/two' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/edit/one%2Ftwo');
  });
  it.each([null, { ...session, userId: 'other' }])('hides Edit for guest or non-owner %j', (identity) => {
    mount(<BlogCard post={post('one')} session={identity} />);
    expect(screen.queryByRole('link', { name: 'Edit one' })).not.toBeInTheDocument();
  });
  it('uses the built-in author avatar and denies editing to a different user', () => {
    const { container } = mount(<BlogCard post={post('one', 'bad', { authorId: 'admin', authorName: 'Admin' })} session={session} />);
    expect(screen.getByText('Date unavailable')).toBeVisible();
    expect(container.querySelector('time')).toBeNull();
    expect(container.querySelector('.bg-violet-600')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('link', { name: 'Edit one' })).not.toBeInTheDocument();
  });
  it('offers Admin editing for another author and escapes plain text', () => {
    const value = post('<script>', undefined, { content: '<img src=x onerror=alert(1)>' });
    const { container } = mount(<BlogCard post={value} session={ADMIN_SESSION} />);
    expect(screen.getByRole('link', { name: 'Edit <script>' })).toBeVisible();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(container.querySelector('script, img')).toBeNull();
  });
});
