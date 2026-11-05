/** Exercise valid durable collection transitions and every browser-data failure boundary. */
import { describe, it, expect, vi } from 'vitest';
import { getThemePreference, saveThemePreference, THEME_KEY } from './storage.js';
import { getPosts, savePosts, getUsers, saveUsers, readUsers, isText, isRecord, isRole, isPost, isUser, storageFailure } from './storage.js';
const post = { id: 'p', title: 'Title', content: 'Text', createdAt: 'invalid-date', authorId: 'u', authorName: 'Writer' };
const user = { id: 'u', displayName: 'Writer', username: 'writer', password: 'demo', role: 'user', createdAt: '2026-01-01' };

describe('isolated appearance preference', () => {
  it('defaults missing preference to light without any writes or removals', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(getThemePreference()).toBe('light');
    expect(localStorage.length).toBe(0);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it.each(['light', 'dark'])('saves and freshly reads exact raw %s', (theme) => {
    expect(saveThemePreference(theme)).toEqual({ ok: true, value: theme });
    expect(localStorage.getItem(THEME_KEY)).toBe(theme);
    expect(getThemePreference()).toBe(theme);
  });
  it.each(['', 'Dark', 'LIGHT', ' dark ', '"dark"', '{}', 'null', 'true', '1', '<script>'])
    ('defaults invalid raw %s without repairing it', (raw) => {
      localStorage.setItem(THEME_KEY, raw);
      const write = vi.spyOn(Storage.prototype, 'setItem');
      const remove = vi.spyOn(Storage.prototype, 'removeItem');
      expect(getThemePreference()).toBe('light');
      expect(localStorage.getItem(THEME_KEY)).toBe(raw);
      expect(write).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  it.each([undefined, null, 1, true, {}, [], new String('dark'), 'Dark', ' dark ', '"dark"'])
    ('rejects invalid write %j without changing the previous preference', (value) => {
      expect(saveThemePreference('dark')).toEqual({ ok: true, value: 'dark' });
      expect(saveThemePreference(value)).toEqual({ ok: false, error: 'invalid' });
      expect(getThemePreference()).toBe('dark');
    });
  it.each(['SecurityError', 'QuotaExceededError', 'Error'])('handles %s reads without writes', (name) => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', name); });
    expect(getThemePreference()).toBe('light');
    expect(write).not.toHaveBeenCalled();
  });
  it.each([
    ['SecurityError', 'unavailable'], ['QuotaExceededError', 'quota'], ['Error', 'unknown'],
    ['ReferenceError', 'unavailable'], ['TypeError', 'unavailable'],
  ])('reports %s writes without losing prior data or exposing exception details', (name, kind) => {
    expect(saveThemePreference('light')).toEqual({ ok: true, value: 'light' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('sensitive credentials', name); });
    expect(saveThemePreference('dark')).toEqual({ ok: false, error: kind });
    expect(getThemePreference()).toBe('light');
  });
  it('handles absent storage for both read and write', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getThemePreference()).toBe('light');
    expect(saveThemePreference('dark')).toEqual({ ok: false, error: 'unavailable' });
  });
  it('changes only the theme key and preserves collection and session bytes', () => {
    const keys = ['writespace_posts', 'writespace_users', 'writespace_session', 'unrelated'];
    keys.forEach((key) => localStorage.setItem(key, `unchanged:${key}`));
    expect(saveThemePreference('dark')).toEqual({ ok: true, value: 'dark' });
    expect(saveThemePreference('light')).toEqual({ ok: true, value: 'light' });
    expect(localStorage.length).toBe(5);
    keys.forEach((key) => expect(localStorage.getItem(key)).toBe(`unchanged:${key}`));
    expect(getThemePreference()).toBe('light');
  });
});

describe('browser collections', () => {
  it('rejects sparse arrays rather than saving null records', () => {
    expect(saveUsers(new Array(1)).ok).toBe(false);
    expect(savePosts(new Array(1)).ok).toBe(false);
    expect(localStorage.length).toBe(0);
  });
  it('reads missing keys without seeding', () => {
    expect(getPosts()).toEqual([]); expect(getUsers()).toEqual([]); expect(localStorage.length).toBe(0);
  });
  it.each([['writespace_posts', savePosts, getPosts, post], ['writespace_users', saveUsers, getUsers, user]])('saves and freshly reads %s', (key, save, get, record) => {
    expect(save([record])).toEqual({ ok: true, value: [record] });
    expect(JSON.parse(localStorage.getItem(key))).toEqual([record]); expect(get()).toEqual([record]);
    expect(save([]).ok).toBe(true); expect(get()).toEqual([]);
  });
  it.each(['oops', '{}', 'null', '4', 'true', '"x"', '[null]', '[1]', '[[]]', '[{}]'])('falls back without changing corrupt data %s', (raw) => {
    localStorage.setItem('writespace_posts', raw); localStorage.setItem('writespace_users', raw);
    expect(getPosts()).toEqual([]); expect(getUsers()).toEqual([]); expect(readUsers().ok).toBe(false);
    expect(localStorage.getItem('writespace_users')).toBe(raw);
  });
  it.each([null, 1, true, 'x', {}, [null], [[]], [1], [{}]])('rejects invalid write input %j', (value) => {
    expect(savePosts(value)).toMatchObject({ ok: false, error: 'invalid' });
    expect(saveUsers(value)).toMatchObject({ ok: false, error: 'invalid' }); expect(localStorage.length).toBe(0);
  });
  it.each(Object.keys(post))('rejects a malformed post field %s', (field) => {
    expect(isPost({ ...post, [field]: {} })).toBe(false); expect(savePosts([{ ...post, [field]: ' ' }]).ok).toBe(false);
  });
  it.each(Object.keys(user))('rejects a malformed user field %s', (field) => {
    expect(isUser({ ...user, [field]: [] })).toBe(false); expect(saveUsers([{ ...user, [field]: '' }]).ok).toBe(false);
  });
  it('fails reads safely when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(getPosts()).toEqual([]); expect(getUsers()).toEqual([]); expect(readUsers().error).toBe('unavailable');
  });
  it.each([['SecurityError', 'unavailable'], ['QuotaExceededError', 'quota'], ['Error', 'unknown']])('reports %s writes without modifying prior data', (name, kind) => {
    saveUsers([user]); savePosts([post]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('sensitive input', name); });
    for (const result of [saveUsers([]), savePosts([])]) {
      expect(result).toMatchObject({ ok: false, error: kind }); expect(result.message).not.toContain('sensitive input');
    }
    expect(getUsers()).toEqual([user]); expect(getPosts()).toEqual([post]);
  });
  it('catches serialization failure', () => {
    const circular = { ...post }; circular.extra = circular;
    expect(savePosts([circular])).toMatchObject({ ok: false }); expect(localStorage.length).toBe(0);
  });
  it('handles an absent storage object', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getUsers()).toEqual([]); expect(saveUsers([]).error).toBe('unavailable');
  });
  it('enforces primitive and role validators', () => {
    expect(isText(' word ')).toBe(true); expect(isText(' ')).toBe(false); expect(isText(1)).toBe(false);
    expect(isRecord({})).toBe(true); expect(isRecord(null)).toBe(false); expect(isRecord([])).toBe(false);
    expect(isRole('admin')).toBe(true); expect(isRole('user')).toBe(true); expect(isRole('Admin')).toBe(false);
    expect(storageFailure(new ReferenceError()).error).toBe('unavailable'); expect(storageFailure(null).error).toBe('unknown');
  });
});
