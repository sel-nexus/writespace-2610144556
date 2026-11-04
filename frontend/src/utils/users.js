/** Manage browser-local demo accounts without trusting page snapshots.
 * Notes: Passwords remain plaintext demo data; never use real passwords.
 */
import { ADMIN_SESSION, getSession } from './auth.js';
import { isRecord, isRole, isText, readUsers, saveUsers, storageFailure } from './storage.js';

export const DEFAULT_ADMIN = Object.freeze({
  id: ADMIN_SESSION.userId, username: ADMIN_SESSION.username,
  displayName: ADMIN_SESSION.displayName, role: ADMIN_SESSION.role, createdAt: null,
});

/** Recognize either immutable built-in identifier, including reserved username aliases.
 * Args: user is a candidate account profile.
 * Returns: Whether the profile represents the permanent default administrator.
 */
export function isDefaultAdmin(user) {
  return isRecord(user) && (user.id === DEFAULT_ADMIN.id ||
    (typeof user.username === 'string' && user.username.trim().toLowerCase() === DEFAULT_ADMIN.username));
}

/** Collect field errors without coercing untrusted values.
 * Args: input contains displayName, username, password and role.
 * Returns: Associated errors, empty for a complete approved form.
 */
export function validateUser(input) {
  const value = isRecord(input) ? input : {};
  const errors = {};
  if (!isText(value.displayName)) errors.displayName = 'Display Name is required.';
  if (!isText(value.username)) errors.username = 'Username is required.';
  if (!isText(value.password)) errors.password = 'Password is required.';
  if (!isRole(value.role)) errors.role = 'Select Admin or user.';
  return errors;
}

/** Refuse mutation unless the action-time session is an administrator. */
function authorize() {
  const session = getSession();
  return session?.role === 'admin' ? { ok: true, session } : {
    ok: false, code: 'unauthorized', message: 'An administrator session is required. Log in again before changing accounts.',
  };
}

/** Append a unique account to freshly read storage, leaving the active session unchanged.
 * Args: input supplies account fields only; supplied metadata is ignored.
 * Returns: A durable account and collection or explicit validation/storage failure.
 */
export function createUser(input) {
  const access = authorize();
  if (!access.ok) return access;
  const errors = validateUser(input);
  if (Object.keys(errors).length) return { ok: false, code: 'required', errors, message: 'Check the highlighted fields.' };
  const users = readUsers();
  if (!users.ok) return users;
  const username = input.username.trim();
  if (username.toLowerCase() === DEFAULT_ADMIN.username ||
      users.value.some((user) => user.username.trim().toLowerCase() === username.toLowerCase())) {
    const message = 'Username already exists. Choose a different username.';
    return { ok: false, code: 'duplicate', errors: { username: message }, message };
  }
  let user;
  try {
    user = { id: crypto.randomUUID(), displayName: input.displayName.trim(), username,
      password: input.password, role: input.role, createdAt: new Date().toISOString() };
  } catch (error) {
    return storageFailure(error);
  }
  const result = saveUsers([...users.value, user]);
  return result.ok ? { ...result, user } : result;
}

/** Delete only a fresh eligible target after explicit confirmation.
 * Args: id identifies a stored account; confirmed must be exactly true.
 * Returns: Saved collection or cancellation, protection, missing-target or storage failure.
 */
export function deleteUser(id, confirmed = false) {
  if (confirmed !== true) return { ok: false, code: 'cancelled', message: 'Deletion cancelled.' };
  const access = authorize();
  if (!access.ok) return access;
  if (id === DEFAULT_ADMIN.id) return { ok: false, code: 'protected', message: 'Default admin cannot be deleted.' };
  if (id === access.session.userId) return { ok: false, code: 'self', message: 'You cannot delete your current account.' };
  const users = readUsers();
  if (!users.ok) return users;
  const target = users.value.find((user) => user.id === id);
  if (!target) return { ok: false, code: 'not_found', message: 'Account not found. Reload to refresh the account list.' };
  if (isDefaultAdmin(target)) return { ok: false, code: 'protected', message: 'Default admin cannot be deleted.' };
  return saveUsers(users.value.filter((user) => user.id !== id));
}
