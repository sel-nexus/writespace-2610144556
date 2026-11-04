/** Verify pure recent selection and fail-closed local ownership with all boundary inputs. */
import { describe, it, expect, vi } from 'vitest';
import { selectRecent, canMutatePost } from './posts.js';
import { ADMIN_SESSION } from './auth.js';

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
