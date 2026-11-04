/** Verify pure recent selection and fail-closed local ownership with all boundary inputs. */
import { describe, it, expect, vi } from 'vitest';
import { selectRecent, canMutatePost, validatePost, createPost, editPost, deletePost } from './posts.js';
import { ADMIN_SESSION, setSession, SESSION_KEY } from './auth.js';

const session = { userId: 'writer', username: 'mira', displayName: 'Mira', role: 'user' };
/** Build a complete test post with deliberate date and ownership overrides. */
function post(id, createdAt = '2026-01-22T12:00:00Z', overrides = {}) {
  return { id, title: id, content: 'Plain text', createdAt, authorId: 'writer', authorName: 'Mira', ...overrides };
}

describe('selectRecent', () => {
  it('defaults to three newest posts and does not mutate frozen collections or records', () => {
    const input = Object.freeze([
      Object.freeze(post('old', '2020-01-01')), Object.freeze(post('new', '2026-01-01')),
      Object.freeze(post('middle', '2024-01-01')), Object.freeze(post('last', '2019-01-01')),
    ]);
    const before = JSON.stringify(input);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const result = selectRecent(input);
    expect(result.map((value) => value.id)).toEqual(['new', 'middle', 'old']);
    expect(result[0]).toBe(input[1]);
    expect(result).not.toBe(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(write).not.toHaveBeenCalled();
  });
  it('preserves equivalent timestamp and invalid-date order with valid pre-epoch dates first', () => {
    const input = [post('bad-one', 'bad'), post('utc', '2026-01-22T12:00:00Z'),
      post('offset', '2026-01-22T13:00:00+01:00'), post('bad-two', 'not a date'), post('epoch', '1960-01-01')];
    expect(selectRecent(input, Infinity).map((value) => value.id)).toEqual(['utc', 'offset', 'epoch', 'bad-one', 'bad-two']);
    expect(selectRecent([input[0], input[3]], Infinity)).toEqual([input[0], input[3]]);
  });
  it.each([null, undefined, {}, 'posts', 1, true])('returns empty for invalid collection %j', (value) => {
    expect(selectRecent(value)).toEqual([]);
  });
  it.each([-1, 1.5, NaN, -Infinity, null, '3', {}, true])('returns empty for invalid limit %j', (limit) => {
    expect(selectRecent([post('one')], limit)).toEqual([]);
  });
  it('handles zero, one, five, oversized, infinite and empty selections', () => {
    const input = Array.from({ length: 6 }, (_, index) => post(String(index)));
    expect(selectRecent(input, 0)).toEqual([]);
    expect(selectRecent(input, 1)).toEqual([input[0]]);
    expect(selectRecent(input, 5)).toEqual(input.slice(0, 5));
    expect(selectRecent(input, 100)).toEqual(input);
    expect(selectRecent(input, Infinity)).toEqual(input);
    expect(selectRecent([], 3)).toEqual([]);
  });
  it('excludes malformed and sparse records without coercion', () => {
    const input = [null, false, [], {}, post('bad', 'bad', { title: {} }), , post('good')];
    expect(selectRecent(input)).toEqual([input[6]]);
  });
});

describe('canMutatePost', () => {
  it('allows exact owners and approved administrators but denies other users', () => {
    const value = Object.freeze(post('one'));
    expect(canMutatePost(Object.freeze(session), value)).toBe(true);
    expect(canMutatePost(ADMIN_SESSION, value)).toBe(true);
    expect(canMutatePost({ ...session, userId: 'Writer' }, value)).toBe(false);
    expect(canMutatePost({ ...session, userId: 'other' }, value)).toBe(false);
  });
  it.each([null, undefined, {}, [], 'admin', { ...session, role: 'Admin' }, { ...session, role: 'owner' }])(
    'rejects invalid session %j even for matching authorship', (value) => {
      expect(canMutatePost(value, post('one'))).toBe(false);
    },
  );
  it.each(['userId', 'username', 'displayName', 'role'])('validates session field %s before permission', (field) => {
    expect(canMutatePost({ ...ADMIN_SESSION, [field]: '' }, post('one'))).toBe(false);
    expect(canMutatePost({ ...session, [field]: {} }, post('one'))).toBe(false);
  });
  it.each([null, undefined, {}, [], 'post', 0])('rejects invalid post %j even for Admin', (value) => {
    expect(canMutatePost(ADMIN_SESSION, value)).toBe(false);
  });
  it.each(['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'])('validates required post field %s', (field) => {
    expect(canMutatePost(ADMIN_SESSION, post('one', 'bad', { [field]: '' }))).toBe(false);
    expect(canMutatePost(session, post('one', 'bad', { [field]: {} }))).toBe(false);
  });
  it('treats invalid date text as a valid record and never writes or modifies input', () => {
    const value = Object.freeze(post('one', 'invalid'));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(canMutatePost(session, value)).toBe(true);
    expect(value.createdAt).toBe('invalid');
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

import { POSTS_KEY, readPosts, savePosts } from './storage.js';
const form = { title: ' New title ', content: '  Text\nwith whitespace  ' };
const mutations = [['create', () => createPost(form)], ['edit', () => editPost('one', form)], ['delete', () => deletePost('one', true)]];
/** Establish real browser data before observing a mutation. */
function prepare() { setSession(session); savePosts([post('one')]); }

describe('publishing mutations', () => {
  it('creates UUID/current ISO time/current authorship ignoring forged metadata', () => {
    prepare();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-id');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-02-03T04:05:06Z'));
    try {
      const result = createPost({ ...form, id: 'forged', authorId: 'other', createdAt: 'yesterday' });
      expect(result.ok).toBe(true);
      expect(result.post).toEqual({ id: 'generated-id', title: 'New title', content: form.content,
        createdAt: '2030-02-03T04:05:06.000Z', authorId: 'writer', authorName: 'Mira' });
      expect(readPosts().value).toEqual([post('one'), result.post]);
      expect(result.value).toEqual(readPosts().value);
    } finally { vi.useRealTimers(); }
  });
  it.each([session, ADMIN_SESSION])('edits as $role preserving original metadata and latest unrelated records', (identity) => {
    prepare(); setSession(identity);
    const latest = post('one', '2020-01-01', { authorName: 'Original name', extra: 'retain' });
    savePosts([latest, post('concurrent')]);
    const result = editPost('one', { ...form, id: 'forged', authorName: 'forged' });
    expect(result.ok).toBe(true);
    expect(readPosts().value).toEqual([{ ...latest, title: 'New title', content: form.content }, post('concurrent')]);
    expect(result.post).toEqual(readPosts().value[0]);
  });
  it.each([session, ADMIN_SESSION])('deletes as $role preserving unrelated latest records', (identity) => {
    prepare(); setSession(identity); savePosts([post('one'), post('concurrent')]);
    expect(deletePost('one', true)).toEqual({ ok: true, value: [post('concurrent')] });
    expect(readPosts().value).toEqual([post('concurrent')]);
  });
  it('rereads current session for create and preserves concurrent posts', () => {
    prepare(); savePosts([post('one'), post('concurrent')]);
    const changed = { ...session, userId: 'new-writer', displayName: 'New Writer' };
    setSession(changed);
    const result = createPost(form, session);
    expect(result.post.authorId).toBe(changed.userId);
    expect(result.post.authorName).toBe(changed.displayName);
    expect(readPosts().value).toEqual([post('one'), post('concurrent'), result.post]);
  });
  it('creates on absent collection without seeds and accepts large escaped-text candidates', () => {
    setSession(session);
    const result = createPost({ title: 'x', content: '<script>'.repeat(10000) });
    expect(result.ok).toBe(true);
    expect(readPosts().value).toEqual([result.post]);
    expect(result.post.content.length).toBe(80000);
  });
  it.each([null, undefined, [], {}, 'text', 4, true])('rejects invalid form %j without writes', (input) => {
    prepare(); const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(validatePost(input)).toEqual({ title: 'Title is required.', content: 'Content is required.' });
    expect(createPost(input).ok).toBe(false); expect(editPost('one', input).ok).toBe(false);
    expect(write).not.toHaveBeenCalled(); expect(readPosts().value).toEqual([post('one')]);
  });
  for (const field of ['title', 'content']) {
    it.each([undefined, null, '', '  \n', {}, [], 4, false])('rejects ' + field + ' value %j separately', (value) => {
      prepare(); const input = { ...form, [field]: value };
      const errors = { [field]: field === 'title' ? 'Title is required.' : 'Content is required.' };
      expect(validatePost(input)).toEqual(errors);
      const write = vi.spyOn(Storage.prototype, 'setItem');
      expect(createPost(input).errors).toEqual(errors); expect(editPost('one', input).errors).toEqual(errors);
      expect(write).not.toHaveBeenCalled(); expect(readPosts().value).toEqual([post('one')]);
    });
  }
  it.each(mutations)('%s denies absent, corrupt and malformed sessions', (_, mutate) => {
    prepare();
    for (const raw of [null, '{', '{}', JSON.stringify({ ...session, role: 'Admin' }), JSON.stringify({ ...session, userId: '' })]) {
      if (raw === null) localStorage.removeItem(SESSION_KEY); else localStorage.setItem(SESSION_KEY, raw);
      const before = localStorage.getItem(POSTS_KEY); const write = vi.spyOn(Storage.prototype, 'setItem');
      expect(mutate()).toMatchObject({ ok: false, code: 'unauthorized' });
      expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem(POSTS_KEY)).toBe(before); write.mockRestore();
    }
  });
  it.each(mutations.slice(1))('%s denies changed identity and freshly changed ownership', (_, mutate) => {
    prepare(); setSession({ ...session, userId: 'other' }); expect(mutate().code).toBe('unauthorized');
    setSession(session); savePosts([post('one', undefined, { authorId: 'other' })]);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(mutate().code).toBe('unauthorized'); expect(write).not.toHaveBeenCalled();
    expect(readPosts().value[0].authorId).toBe('other');
  });
  it.each([undefined, null, '', 'missing', 7, {}, []])('denies missing/invalid target %j without writes', (id) => {
    prepare(); const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(editPost(id, form)).toMatchObject({ ok: false, code: 'not_found', message: 'Post not found' });
    expect(deletePost(id, true)).toMatchObject({ ok: false, code: 'not_found' });
    expect(write).not.toHaveBeenCalled(); expect(readPosts().value).toEqual([post('one')]);
  });
  it.each([undefined, false, null, 1, 'true', {}, []])('cancel %j never reads or writes', (confirmed) => {
    prepare(); const read = vi.spyOn(Storage.prototype, 'getItem'); const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deletePost('one', confirmed).code).toBe('cancelled');
    expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  });
  it.each(mutations)('%s propagates corrupt reads preserving raw data', (_, mutate) => {
    prepare();
    for (const raw of ['{', '{}', 'null', '[null]', '[{"id":"one"}]']) {
      localStorage.setItem(POSTS_KEY, raw); const write = vi.spyOn(Storage.prototype, 'setItem');
      expect(mutate()).toMatchObject({ ok: false, error: 'invalid' });
      expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem(POSTS_KEY)).toBe(raw); write.mockRestore();
    }
  });
  it.each(mutations)('%s propagates unavailable reads without writes', (_, mutate) => {
    prepare(); const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
      if (key === POSTS_KEY) throw new DOMException('blocked', 'SecurityError');
      return original.call(this, key);
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(mutate()).toMatchObject({ ok: false, error: 'unavailable' }); expect(write).not.toHaveBeenCalled();
    expect(original.call(localStorage, POSTS_KEY)).toBe(JSON.stringify([post('one')]));
  });
  for (const [name, kind] of [['QuotaExceededError', 'quota'], ['SecurityError', 'unavailable'], ['Error', 'unknown']]) {
    it.each(mutations)('%s retains data on ' + name, (_, mutate) => {
      prepare(); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private content', name); });
      const result = mutate(); expect(result).toMatchObject({ ok: false, error: kind });
      expect(result.message).not.toContain('private content'); expect(result.post).toBeUndefined();
      expect(readPosts().value).toEqual([post('one')]);
    });
  }
  it('reports UUID generation failure without a false save', () => {
    prepare(); vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new TypeError('unsupported'); });
    expect(createPost(form)).toMatchObject({ ok: false, error: 'unavailable' }); expect(readPosts().value).toEqual([post('one')]);
  });
});
