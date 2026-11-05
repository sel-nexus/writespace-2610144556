/** Verify informational UTF-16 counts through real editor interactions and persistence. */
import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { setSession } from '../utils/auth.js';
import { POSTS_KEY, readPosts, savePosts } from '../utils/storage.js';

const identity = { userId: 'writer', username: 'mira', displayName: 'Mira', role: 'user' };
const original = {
  id: 'one', title: 'Notes', content: '  Original 😀\ntext  ', createdAt: '2026-01-22T12:00:00Z',
  authorId: 'writer', authorName: 'Mira',
};
const fields = ['authorId', 'authorName', 'content', 'createdAt', 'id', 'title'];

/** Mount the actual route shell in a selected persisted theme.
 * Args: mode selects the root preference; path selects create or edit.
 * Returns: Rendered application for DOM assertions.
 */
function mount(mode, path = '/write') {
  setSession(identity);
  localStorage.setItem('writespace_theme', mode);
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Assert the displayed derivation rather than inspecting component state. */
function count(value) {
  expect(screen.getByText(`${value.length} characters`, { exact: true })).toBeVisible();
  expect(screen.getByLabelText('Content')).toHaveValue(value);
}

describe.each(['light', 'dark'])('informational editor count in %s theme', (mode) => {
  it('starts at zero below content, updates on typing and clear without saving', async () => {
    mount(mode);
    const user = userEvent.setup();
    const textarea = screen.getByLabelText('Content');
    const counter = screen.getByText('0 characters');
    count('');
    expect(textarea.nextElementSibling).toBe(counter);
    expect(textarea).not.toHaveAttribute('maxlength');
    expect(counter).toHaveAttribute('aria-live', 'polite');
    expect(textarea).toHaveAccessibleDescription('0 characters');
    expect(counter).toHaveClass('text-slate-600', 'dark:text-slate-300');
    expect(textarea).toHaveClass('bg-white', 'dark:bg-slate-900', 'dark:text-slate-100');
    expect(textarea.closest('form')).toHaveClass('bg-white', 'dark:bg-slate-800', 'dark:border-slate-700');
    expect(document.documentElement.classList.contains('dark')).toBe(mode === 'dark');
    await user.type(textarea, 'Hello');
    count('Hello');
    await user.clear(textarea);
    count('');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('counts whitespace and UTF-16 units without adding validation on input', async () => {
    mount(mode);
    const user = userEvent.setup();
    const textarea = screen.getByLabelText('Content');
    await user.click(textarea);
    await user.paste(' \n\t ');
    count(' \n\t ');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.clear(textarea);
    await user.paste('😀e\u0301');
    count('😀e\u0301');
    expect(screen.getByText('4 characters')).toBeVisible();
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });

  it('permits large pasted text and saves exact content with only the six post fields', async () => {
    mount(mode);
    const user = userEvent.setup();
    const content = '  😀\n' + 'Long pasted text '.repeat(1000) + '  ';
    await user.type(screen.getByLabelText('Title'), 'New notes');
    await user.click(screen.getByLabelText('Content'));
    await user.paste(content);
    count(content);
    expect(screen.getByLabelText('Content')).not.toHaveAttribute('maxlength');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    const [saved] = JSON.parse(localStorage.getItem(POSTS_KEY));
    expect(Object.keys(saved).sort()).toEqual(fields);
    expect(saved).toMatchObject({ title: 'New notes', content, authorId: 'writer', authorName: 'Mira' });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    expect(screen.getByRole('heading', { name: 'New notes', exact: true })).toBeVisible();
    expect(screen.getByRole('article').querySelector('p').textContent).toBe(content);
  });

  it('prefills, edits, clears and saves without changing original metadata or schema', async () => {
    savePosts([original]);
    mount(mode, '/edit/one');
    const user = userEvent.setup();
    count(original.content);
    await user.clear(screen.getByLabelText('Content'));
    count('');
    await user.type(screen.getByLabelText('Content'), 'Revised text');
    count('Revised text');
    expect(readPosts().value).toEqual([original]);
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    const [saved] = JSON.parse(localStorage.getItem(POSTS_KEY));
    expect(saved).toEqual({ ...original, content: 'Revised text' });
    expect(Object.keys(saved).sort()).toEqual(fields);
  });

  it.each(['', ' \n\t '])('retains unchanged required-field errors for empty/whitespace content %j', async (content) => {
    mount(mode);
    const user = userEvent.setup();
    if (content) {
      await user.click(screen.getByLabelText('Content'));
      await user.paste(content);
    }
    count(content);
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    for (const name of ['Title', 'Content']) {
      expect(screen.getByText(`${name} is required.`, { exact: true })).toBeVisible();
      expect(screen.getByLabelText(name)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(name)).toHaveAccessibleDescription(new RegExp(`${name} is required.`));
    }
    count(content);
    expect(screen.getByLabelText('Content')).toHaveAttribute('aria-describedby', 'content-error content-count');
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });

  it.each(['/write', '/edit/one'])('cancel discards counted draft without saving from %s', async (path) => {
    savePosts([original]);
    mount(mode, path);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Content'));
    await user.type(screen.getByLabelText('Content'), 'Discard me');
    count('Discard me');
    const raw = localStorage.getItem(POSTS_KEY);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('link', { name: 'Cancel', exact: true }));
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: path === '/write' ? 'All Blogs' : 'Notes', exact: true })).toBeVisible();
  });

  for (const path of ['/write', '/edit/one']) {
    it.each(['QuotaExceededError', 'SecurityError'])(`failed save at ${path} retains input/count on %s`, async (name) => {
      savePosts([original]);
      mount(mode, path);
      const user = userEvent.setup();
      await user.clear(screen.getByLabelText('Title'));
      await user.type(screen.getByLabelText('Title'), 'Retained title');
      await user.clear(screen.getByLabelText('Content'));
      await user.type(screen.getByLabelText('Content'), 'Retained content');
      const raw = localStorage.getItem(POSTS_KEY);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', name); });
      await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
      expect(screen.getByRole('alert')).toHaveTextContent(/could not save/);
      expect(screen.getByRole('alert')).toHaveClass('bg-red-50', 'dark:bg-red-950', 'dark:text-red-300');
      expect(screen.getByLabelText('Title')).toHaveValue('Retained title');
      count('Retained content');
      expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
      await user.type(screen.getByLabelText('Content'), '!');
      count('Retained content!');
      expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    });
  }
});
