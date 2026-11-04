/** Verify account operations against real browser storage and action-time identities. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser, deleteUser, validateUser, isDefaultAdmin, DEFAULT_ADMIN } from './users.js';
import { ADMIN_SESSION, SESSION_KEY, setSession, getSession } from './auth.js';
import { USERS_KEY, POSTS_KEY, readUsers, saveUsers } from './storage.js';

const input = { displayName: ' Mira ', username: ' Mira ', password: ' demo ', role: 'user' };
/** Build a complete stored record for fresh-read tests. */
function account(id = 'one', overrides = {}) {
  return { id, displayName: id, username: id, password: 'demo', role: 'user',
    createdAt: '2026-01-22T12:00:00Z', ...overrides };
}
beforeEach(() => setSession(ADMIN_SESSION));

describe('account validation and creation', () => {
  it.each(['user', 'admin'])('persists UUID/time and selected %s without switching session or touching posts', (role) => {
    const before = Date.now(); const result = createUser({ ...input, role, id: 'forged', createdAt: 'forged' });
    expect(result.ok).toBe(true);
    expect(result.user).toMatchObject({ displayName: 'Mira', username: 'Mira', password: ' demo ', role });
    expect(result.user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(result.user.createdAt)).toBeGreaterThanOrEqual(before);
    expect(readUsers().value).toEqual([result.user]); expect(getSession()).toEqual(ADMIN_SESSION);
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });
  for (const field of ['displayName', 'username', 'password', 'role']) {
    it.each([undefined, null, 1, false, {}, [], '', '   '])('rejects ' + field + ' invalid value %j without writes', (value) => {
      const write = vi.spyOn(Storage.prototype, 'setItem');
      const form = { ...input, [field]: value };
      expect(validateUser(form)[field]).toBeTruthy();
      expect(createUser(form)).toMatchObject({ ok: false, code: 'required', errors: { [field]: expect.any(String) } });
      expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem(USERS_KEY)).toBeNull();
    });
  }
  it.each([null, undefined, 1, false, [], 'input'])('rejects invalid whole input %j', (value) => {
    expect(Object.keys(validateUser(value))).toHaveLength(4);
    expect(createUser(value).ok).toBe(false); expect(localStorage.getItem(USERS_KEY)).toBeNull();
  });
  it.each(['Admin', 'USER', 'owner'])('denies unsupported role %s', (role) => {
    expect(createUser({ ...input, role })).toMatchObject({ ok: false, errors: { role: 'Select Admin or user.' } });
    expect(localStorage.getItem(USERS_KEY)).toBeNull();
  });
  it.each(['admin', ' AdMiN ', 'MIRA', ' mira '])('rejects reserved or case-insensitive duplicate %s', (username) => {
    saveUsers([account('one', { username: ' Mira ' })]);
    const before = localStorage.getItem(USERS_KEY);
    expect(createUser({ ...input, username })).toMatchObject({ ok: false, code: 'duplicate', errors: { username: expect.any(String) } });
    expect(localStorage.getItem(USERS_KEY)).toBe(before);
  });
  it('preserves accounts created since the page snapshot', () => {
    const stale = readUsers().value; saveUsers([account('concurrent')]);
    const result = createUser(input, stale);
    expect(readUsers().value).toEqual([account('concurrent'), result.user]);
  });
  it('reports UUID failure without writing or leaking credentials', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error(input.password); });
    const result = createUser(input); expect(result).toMatchObject({ ok: false, error: 'unknown' });
    expect(JSON.stringify(result)).not.toContain(input.password); expect(localStorage.getItem(USERS_KEY)).toBeNull();
  });
});

describe('action-time authorization', () => {
  it.each(['absent', 'corrupt', 'role', 'incomplete', 'user', 'unavailable'])('denies fresh %s session for both operations', (kind) => {
    saveUsers([account()]); const before = localStorage.getItem(USERS_KEY);
    if (kind === 'absent') localStorage.removeItem(SESSION_KEY);
    if (kind === 'corrupt') localStorage.setItem(SESSION_KEY, '{');
    if (kind === 'role') localStorage.setItem(SESSION_KEY, JSON.stringify({ ...ADMIN_SESSION, role: 'Admin' }));
    if (kind === 'incomplete') localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'admin' }));
    if (kind === 'user') setSession({ ...ADMIN_SESSION, role: 'user' });
    if (kind === 'unavailable') {
      const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
        if (key === SESSION_KEY) throw new DOMException('blocked', 'SecurityError');
        return original.call(this, key);
      });
    }
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createUser(input, ADMIN_SESSION)).toMatchObject({ ok: false, code: 'unauthorized' });
    expect(deleteUser('one', true, ADMIN_SESSION)).toMatchObject({ ok: false, code: 'unauthorized' });
    expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem(USERS_KEY)).toBe(before);
  });
});

describe('confirmed account deletion', () => {
  it('re-reads storage, removes target only, and preserves concurrent additions', () => {
    saveUsers([account()]); const stale = readUsers().value;
    saveUsers([account('one', { displayName: 'Updated' }), account('concurrent')]);
    expect(deleteUser('one', true, stale).ok).toBe(true);
    expect(readUsers().value).toEqual([account('concurrent')]); expect(getSession()).toEqual(ADMIN_SESSION);
  });
  it.each([undefined, false, null, 1, 'true', {}])('requires literal confirmation true: %j', (confirmed) => {
    saveUsers([account()]); const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deleteUser('one', confirmed)).toMatchObject({ ok: false, code: 'cancelled' });
    expect(write).not.toHaveBeenCalled(); expect(readUsers().value).toEqual([account()]);
  });
  it('blocks built-in id even when absent from storage', () => {
    expect(deleteUser('admin', true)).toMatchObject({ ok: false, code: 'protected', message: 'Default admin cannot be deleted.' });
    expect(localStorage.getItem(USERS_KEY)).toBeNull();
  });
  it('blocks reserved username even under a different id', () => {
    const target = account('alias', { username: ' AdMiN ' }); saveUsers([target]);
    expect(deleteUser('alias', true).code).toBe('protected'); expect(readUsers().value).toEqual([target]);
  });
  it('checks current id rather than a stale passed identity', () => {
    saveUsers([account('one', { role: 'admin' })]);
    setSession({ ...ADMIN_SESSION, userId: 'one', username: 'one' });
    expect(deleteUser('one', true, ADMIN_SESSION).code).toBe('self'); expect(readUsers().value).toHaveLength(1);
  });
  it.each(['missing', null, undefined, 1, {}])('reports missing target %j without writes', (id) => {
    saveUsers([account()]); const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deleteUser(id, true).code).toBe('not_found'); expect(write).not.toHaveBeenCalled();
    expect(readUsers().value).toEqual([account()]);
  });
  it.each([null, {}, { id: 'admin' }, { username: 'ADMIN' }, { id: 'one', username: 'one' }])('recognizes built-in invariants %j', (value) => {
    expect(isDefaultAdmin(value)).toBe(value?.id === 'admin' || value?.username === 'ADMIN');
    expect(DEFAULT_ADMIN).not.toHaveProperty('password');
  });
});

describe('storage failures', () => {
  for (const operation of ['create', 'delete']) {
    it.each(['{', '{}', '[null]'])('does not replace corrupt storage on ' + operation + ': %s', (raw) => {
      localStorage.setItem(USERS_KEY, raw); const write = vi.spyOn(Storage.prototype, 'setItem');
      const result = operation === 'create' ? createUser(input) : deleteUser('one', true);
      expect(result).toMatchObject({ ok: false, error: 'invalid' });
      expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem(USERS_KEY)).toBe(raw);
    });
    it('propagates unavailable fresh read on ' + operation, () => {
      saveUsers([account()]); const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
        if (key === USERS_KEY) throw new DOMException('blocked', 'SecurityError');
        return original.call(this, key);
      });
      const result = operation === 'create' ? createUser(input) : deleteUser('one', true);
      expect(result).toMatchObject({ ok: false, error: 'unavailable' });
      expect(original.call(localStorage, USERS_KEY)).toBe(JSON.stringify([account()]));
    });
    it.each(['QuotaExceededError', 'SecurityError', 'Error'])('preserves data on ' + operation + ' failed write %s', (name) => {
      saveUsers([account()]);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException(input.password, name); });
      const result = operation === 'create' ? createUser(input) : deleteUser('one', true);
      expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain(input.password);
      expect(readUsers().value).toEqual([account()]);
    });
  }
});
