/** Verify durable local identity transitions, reserved-account precedence and fail-closed sessions. */
import { describe, it, expect, vi } from 'vitest';
import { login, register, getSession, setSession, clearSession, homeFor, isSession, validateLogin, validateRegistration, ADMIN_SESSION } from './auth.js';
import { getUsers, saveUsers } from './storage.js';
const input = { displayName: ' Mira ', username: ' Mira ', password: ' demo ', confirmation: ' demo ' };
const session = { userId: 'u', username: 'mira', displayName: 'Mira', role: 'user' };

describe('local identity', () => {
  it('rejects wrong password for an existing regular account without persisting a session', () => {
    register(input); clearSession();
    expect(login({ username: 'mira', password: 'wrong' }).message).toBe('Invalid username or password.');
    expect(getSession()).toBeNull(); expect(getUsers()).toHaveLength(1);
  });
  it('keeps built-in admin independent of unavailable account reads', () => {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
      if (key === 'writespace_users') throw new DOMException('blocked', 'SecurityError');
      return original.call(this, key);
    });
    expect(login({ username: 'admin', password: 'admin' }).ok).toBe(true);
    expect(getSession()).toEqual(ADMIN_SESSION);
  });
  it('logs in built-in admin before stored impersonators and reserves its password', () => {
    saveUsers([{ id: 'fake', username: 'admin', displayName: 'Fake', role: 'user', password: 'other', createdAt: 'date' }]);
    expect(login({ username: 'admin', password: 'admin' })).toMatchObject({ ok: true, destination: '/admin', session: ADMIN_SESSION });
    expect(getSession()).toEqual(ADMIN_SESSION);
    expect(login({ username: 'admin', password: 'other' }).code).toBe('invalid_credentials'); expect(getSession()).toEqual(ADMIN_SESSION);
  });
  it('registers a trimmed user and re-reads both exact durable keys; preserves password spaces', () => {
    expect(register(input)).toMatchObject({ ok: true, destination: '/blogs' });
    const users = getUsers(); expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ displayName: 'Mira', username: 'Mira', password: ' demo ', role: 'user' });
    expect(users[0].id).toMatch(/^[0-9a-f-]{36}$/); expect(Number.isNaN(Date.parse(users[0].createdAt))).toBe(false);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(getSession()); expect(getSession()).not.toHaveProperty('password');
    clearSession(); expect(login({ username: 'mIRA', password: ' demo ' }).ok).toBe(true); expect(getSession().userId).toBe(users[0].id);
  });
  it('allows stored administrators with approved role', () => {
    saveUsers([{ id: 'a', username: 'editor', displayName: 'Editor', role: 'admin', password: 'demo', createdAt: 'date' }]);
    expect(login({ username: 'editor', password: 'demo' }).destination).toBe('/admin'); expect(getSession().role).toBe('admin');
  });
  it.each(['displayName', 'username', 'password', 'confirmation'])('requires registration field %s before any write', (field) => {
    expect(register({ ...input, [field]: ' ' })).toMatchObject({ ok: false, code: 'required' }); expect(localStorage.length).toBe(0);
  });
  it.each([null, [], 'x', 42, true, undefined])('rejects invalid auth input %j', (value) => {
    expect(register(value).ok).toBe(false); expect(login(value).ok).toBe(false); expect(localStorage.length).toBe(0);
  });
  it.each(['displayName', 'username', 'password', 'confirmation'])('rejects object/array registration field %s', (field) => {
    expect(register({ ...input, [field]: {} }).ok).toBe(false); expect(register({ ...input, [field]: [] }).ok).toBe(false);
  });
  it.each(['username', 'password'])('requires login field %s', (field) => {
    expect(login({ username: 'admin', password: 'admin', [field]: null }).code).toBe('required'); expect(localStorage.length).toBe(0);
  });
  it('rejects mismatch without writing', () => {
    expect(register({ ...input, confirmation: 'wrong' })).toMatchObject({ code: 'mismatch', errors: { confirmation: 'Passwords do not match.' } });
    expect(localStorage.length).toBe(0);
  });
  it.each(['ADMIN', ' Admin '])('rejects reserved duplicate %s', (username) => {
    expect(register({ ...input, username }).code).toBe('duplicate'); expect(getUsers()).toEqual([]);
  });
  it('rejects duplicate case-insensitively and explains partial account recovery', () => {
    register(input); clearSession(); expect(register({ ...input, username: 'mIRA' }).message).toMatch(/go to Login/); expect(getUsers()).toHaveLength(1);
  });
  it('shows exact invalid credential message and does not replace existing session', () => {
    setSession(session);
    expect(login({ username: 'missing', password: 'wrong' })).toEqual({ ok: false, code: 'invalid_credentials', message: 'Invalid username or password.' });
    expect(getSession()).toEqual(session);
  });
  it.each(['bad', '[{}]', '{}'])('refuses registration over corrupt account storage %s', (raw) => {
    localStorage.setItem('writespace_users', raw); expect(register(input).code).toBe('storage_error');
    expect(login({ username: 'mira', password: 'demo' }).code).toBe('storage_error'); expect(localStorage.getItem('writespace_users')).toBe(raw);
  });
  it('reports unavailable account reads without saving', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(register(input).code).toBe('storage_error'); expect(login({ username: 'mira', password: 'demo' }).code).toBe('storage_error');
  });
  it('reports account write quota failure and retains no session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(register(input).code).toBe('storage_error'); expect(getUsers()).toEqual([]); expect(getSession()).toBeNull();
  });
  it('retains a partially saved account when session write fails and duplicate retry remains one account', () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key === 'writespace_session') throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    expect(register(input).message).toMatch(/account was saved locally/); expect(getUsers()).toHaveLength(1); expect(getSession()).toBeNull();
    expect(register(input).code).toBe('duplicate'); expect(getUsers()).toHaveLength(1);
  });
  it('reports UUID generation failure before creating an account', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    expect(register(input).code).toBe('storage_error'); expect(getUsers()).toEqual([]);
  });
  it('writes only identity fields and removes only the session', () => {
    localStorage.setItem('writespace_posts', '[]'); localStorage.setItem('writespace_users', '[]'); localStorage.setItem('unrelated', 'keep');
    expect(setSession({ ...session, password: 'never' }).ok).toBe(true); expect(getSession()).toEqual(session);
    expect(localStorage.getItem('writespace_session')).not.toContain('never'); expect(clearSession()).toEqual({ ok: true, value: null });
    expect(getSession()).toBeNull(); expect(localStorage.getItem('unrelated')).toBe('keep'); expect(localStorage.getItem('writespace_posts')).toBe('[]'); expect(localStorage.getItem('writespace_users')).toBe('[]');
  });
  it.each([null, [], 1, true, 'x', {}, { ...session, role: 'Admin' }, { ...session, userId: '' }, { ...session, username: [] }, { ...session, displayName: {} }])('fails closed on invalid session %j', (value) => {
    localStorage.setItem('writespace_session', JSON.stringify(value)); expect(getSession()).toBeNull(); expect(isSession(value)).toBe(false);
    expect(setSession(value)).toMatchObject({ ok: false, error: 'invalid' }); expect(homeFor(value)).toBe('/');
  });
  it('fails closed on missing, invalid JSON and inaccessible session reads', () => {
    expect(getSession()).toBeNull(); localStorage.setItem('writespace_session', 'bad'); expect(getSession()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error(); }); expect(getSession()).toBeNull();
  });
  it.each(['SecurityError', 'QuotaExceededError', 'Error'])('reports session write failure %s', (name) => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', name); });
    expect(setSession(session).ok).toBe(false); expect(login({ username: 'admin', password: 'admin' }).code).toBe('storage_error'); expect(getSession()).toBeNull();
  });
  it('reports failed session removal and leaves the durable session intact', () => {
    setSession(session); vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(clearSession().message).toMatch(/Could not log out/); expect(getSession()).toEqual(session);
  });
  it('selects both role homes and validates happy inputs', () => {
    expect(homeFor(session)).toBe('/blogs'); expect(homeFor(ADMIN_SESSION)).toBe('/admin');
    expect(validateLogin({ username: 'a', password: 'a' })).toEqual({}); expect(validateRegistration(input)).toEqual({});
  });
});
