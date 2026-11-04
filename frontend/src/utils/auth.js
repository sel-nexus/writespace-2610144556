/** Implement browser-local demo identity, not trusted authentication.
 * Notes: Passwords are plaintext. Never use real passwords; browser owners can change roles.
 */
import { isRecord, isRole, isText, readUsers, saveUsers, storageFailure } from './storage.js';

export const SESSION_KEY = 'writespace_session';
export const ADMIN_SESSION = Object.freeze({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });

/** Validate every session field and fail closed on unknown role values.
 * @param {*} value Candidate browser identity.
 * @returns {boolean} Whether fields and role permit client-side access.
 */
export function isSession(value) {
  return isRecord(value) && ['userId', 'username', 'displayName'].every((field) => isText(value[field])) && isRole(value.role);
}

/** Project identity fields only; credentials never enter the session. */
function identity(value) {
  return { userId: value.userId, username: value.username, displayName: value.displayName, role: value.role };
}

/** Return a freshly read identity or null for absent, corrupt, or unavailable storage. */
export function getSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY));
    return isSession(value) ? identity(value) : null;
  } catch {
    return null;
  }
}

/** Persist only approved session fields and explicitly report write failure.
 * @param {object} session Identity to persist; extra fields are omitted.
 * @returns {object} Explicit persistence outcome.
 */
export function setSession(session) {
  if (!isSession(session)) return { ok: false, error: 'invalid', message: 'The session is invalid and was not saved.' };
  try {
    const value = identity(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    return { ok: true, value };
  } catch (error) {
    return storageFailure(error);
  }
}

/** Remove only the session key; a failed removal must not claim logout. */
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    return { ok: true, value: null };
  } catch (error) {
    return { ...storageFailure(error), message: 'Could not log out. Enable browser storage and try Logout again.' };
  }
}

/** Select a role destination only for a fully valid identity.
 * @param {object|null} session Identity used to select the local route.
 * @returns {string} Role home or public root for invalid identity.
 */
export function homeFor(session) {
  if (!isSession(session)) return '/';
  return session.role === 'admin' ? '/admin' : '/blogs';
}

/** Collect required-field errors without coercing objects or primitive input into strings.
 * @param {*} input Submitted credentials without coercion.
 * @returns {object} Field-specific errors, empty when valid.
 */
export function validateLogin(input) {
  const value = isRecord(input) ? input : {};
  const errors = {};
  if (!isText(value.username)) errors.username = 'Username is required.';
  if (!isText(value.password)) errors.password = 'Password is required.';
  return errors;
}

/** Collect every missing registration field and associate mismatch with confirmation.
 * @param {*} input Submitted account fields.
 * @returns {object} Required-field or confirmation errors.
 */
export function validateRegistration(input) {
  const value = isRecord(input) ? input : {};
  const errors = validateLogin(value);
  if (!isText(value.displayName)) errors.displayName = 'Display Name is required.';
  if (!isText(value.confirmation)) errors.confirmation = 'Confirm Password is required.';
  if (!errors.password && !errors.confirmation && value.password !== value.confirmation) errors.confirmation = 'Passwords do not match.';
  return errors;
}

/** Persist a matched identity before returning any successful navigation destination. */
function finish(session) {
  const result = setSession(session);
  return result.ok ? { ok: true, session: result.value, destination: homeFor(result.value) }
    : { ok: false, code: 'storage_error', message: result.message };
}

/** Match the fixed administrator first, then case-insensitive local usernames.
 * Args: input contains username and plaintext demo password.
 * Returns: A saved-session result or an actionable error, never navigation itself.
 */
export function login(input) {
  const errors = validateLogin(input);
  if (Object.keys(errors).length) return { ok: false, code: 'required', errors, message: 'Complete the required fields.' };
  const username = input.username.trim().toLowerCase();
  if (username === 'admin') {
    return input.password === 'admin' ? finish(ADMIN_SESSION)
      : { ok: false, code: 'invalid_credentials', message: 'Invalid username or password.' };
  }
  const users = readUsers();
  if (!users.ok) return { ok: false, code: 'storage_error', message: users.message };
  const user = users.value.find((record) => record.username.trim().toLowerCase() === username && record.password === input.password);
  if (!user) return { ok: false, code: 'invalid_credentials', message: 'Invalid username or password.' };
  return finish({ userId: user.id, username: user.username, displayName: user.displayName, role: user.role });
}

/** Save a unique regular account, then session; retain a partial account for explicit login recovery.
 * @param {object} input Required local account fields and password confirmation.
 * @returns {object} Durable identity success or validation/storage guidance.
 */
export function register(input) {
  const errors = validateRegistration(input);
  if (Object.keys(errors).length) return { ok: false, code: errors.confirmation === 'Passwords do not match.' ? 'mismatch' : 'required', errors, message: 'Check the highlighted fields.' };
  const username = input.username.trim();
  const users = readUsers();
  if (!users.ok) return { ok: false, code: 'storage_error', message: users.message };
  if (username.toLowerCase() === 'admin' || users.value.some((user) => user.username.trim().toLowerCase() === username.toLowerCase())) {
    const message = 'Username already exists. If you previously saved this account, go to Login.';
    return { ok: false, code: 'duplicate', errors: { username: message }, message };
  }
  let user;
  try {
    user = { id: crypto.randomUUID(), displayName: input.displayName.trim(), username, password: input.password, role: 'user', createdAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, code: 'storage_error', message: storageFailure(error).message };
  }
  const saved = saveUsers([...users.value, user]);
  if (!saved.ok) return { ok: false, code: 'storage_error', message: saved.message };
  const result = finish({ userId: user.id, username, displayName: user.displayName, role: user.role });
  return result.ok ? result : { ...result, message: 'Your account was saved locally, but the session could not be saved. Enable browser storage, then go to Login with this account. Do not register again.' };
}
