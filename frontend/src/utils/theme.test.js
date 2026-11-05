/** Verify scalar validation, safe reads, truthful writes, and key independence. */
import { describe, it, expect, vi } from 'vitest';
import { getTheme, normalizeTheme, setTheme, THEME_KEY } from './theme.js';

describe('theme preference boundary', () => {
  it.each(['light', 'dark'])('accepts and reads the exact %s scalar', (mode) => {
    expect(normalizeTheme(mode)).toBe(mode);
    localStorage.setItem(THEME_KEY, mode);
    expect(getTheme()).toBe(mode);
  });
  it.each([undefined, null, '', 'system', 'Dark', ' dark ', '"dark"', '{}', 1, true, {}, [], '<script>dark</script>'])
    ('normalizes unsupported value %j to light and rejects its write', (value) => {
      localStorage.setItem(THEME_KEY, 'dark');
      expect(normalizeTheme(value)).toBe('light');
      expect(setTheme(value)).toEqual({ ok: false, error: 'invalid', message: 'Choose light or dark appearance.' });
      expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    });
  it('defaults missing preference to light without creating a key', () => {
    expect(getTheme()).toBe('light');
    expect(localStorage.length).toBe(0);
  });
  it.each(['system', '"dark"', '{', 'Dark'])('reads invalid scalar %s as light without repair', (raw) => {
    localStorage.setItem(THEME_KEY, raw);
    expect(getTheme()).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe(raw);
  });
  it('falls back on a failed storage read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(getTheme()).toBe('light');
  });
  it('handles an unavailable storage global for both read and write', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getTheme()).toBe('light');
    expect(setTheme('dark')).toMatchObject({ ok: false, error: 'unavailable' });
  });
  it('handles a denied storage accessor without throwing', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(getTheme()).toBe('light');
    expect(setTheme('dark')).toMatchObject({ ok: false, error: 'unavailable' });
  });
  it.each(['light', 'dark'])('writes %s as a scalar and leaves domain and foreign keys unchanged', (mode) => {
    const other = { writespace_session: '{"role":"user"}', writespace_users: '[{"username":"mira"}]', writespace_posts: '[{"title":"notes"}]', foreign: 'keep' };
    for (const [key, raw] of Object.entries(other)) localStorage.setItem(key, raw);
    expect(setTheme(mode)).toEqual({ ok: true, value: mode });
    expect(localStorage.getItem(THEME_KEY)).toBe(mode);
    expect(getTheme()).toBe(mode);
    for (const [key, raw] of Object.entries(other)) expect(localStorage.getItem(key)).toBe(raw);
    expect(localStorage.length).toBe(5);
  });
  it.each([
    ['QuotaExceededError', 'quota'], ['NS_ERROR_DOM_QUOTA_REACHED', 'quota'],
    ['SecurityError', 'unavailable'], ['ReferenceError', 'unavailable'], ['TypeError', 'unavailable'],
    ['Error', 'unknown'],
  ])('maps %s to %s without changing durable data or exposing thrown details', (name, code) => {
    localStorage.setItem(THEME_KEY, 'light');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Object.assign(new Error('private secret'), { name }); });
    const result = setTheme('dark');
    expect(result).toMatchObject({ ok: false, error: code });
    expect(result.message).toMatch(/could not be saved.*Enable browser storage/);
    expect(result.message).not.toContain('private secret');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });
  it('maps a null thrown value to unknown without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw null; });
    expect(setTheme('dark')).toMatchObject({ ok: false, error: 'unknown' });
  });
});
