/** Validate browser-local demo collections without seeding or repairing data. */
export const POSTS_KEY = 'writespace_posts';
export const USERS_KEY = 'writespace_users';
export const THEME_KEY = 'writespace_theme';
const SAVE_MESSAGE = 'Your browser could not save this change. Enable local storage or free space, then try again.';

/** Require a non-empty primitive string at an external-data boundary.
 * @param {*} value Candidate browser or form value.
 * @returns {boolean} Whether text is usable without coercion.
 */
export function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Reject primitives and arrays before inspecting named record fields.
 * @param {*} value Candidate parsed record.
 * @returns {boolean} Whether named fields can be inspected safely.
 */
export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Accept only the two approved demo roles.
 * @param {*} role Candidate persisted role.
 * @returns {boolean} Whether the role is approved.
 */
export function isRole(role) {
  return role === 'admin' || role === 'user';
}

/** Require safe primitive post fields; invalid date strings remain sortable by consumers.
 * @param {*} value Candidate persisted post.
 * @returns {boolean} Whether every required field is usable.
 */
export function isPost(value) {
  return isRecord(value) && ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName']
    .every((field) => isText(value[field]));
}

/** Require all durable account fields, including an approved role.
 * @param {*} value Candidate persisted account.
 * @returns {boolean} Whether all account fields and its role are usable.
 */
export function isUser(value) {
  return isRecord(value) && ['id', 'displayName', 'username', 'password', 'createdAt']
    .every((field) => isText(value[field])) && isRole(value.role);
}

/** Translate browser exceptions into guidance without leaking entered values.
 * @param {*} error Browser exception, never included in the guidance.
 * @returns {object} A safe categorized failure result.
 */
export function storageFailure(error) {
  const name = error?.name;
  const kind = name === 'QuotaExceededError' ? 'quota'
    : name === 'SecurityError' || name === 'ReferenceError' || name === 'TypeError' ? 'unavailable' : 'unknown';
  return { ok: false, error: kind, message: SAVE_MESSAGE };
}

/** Read a complete valid collection; refuse corrupt data so a mutation cannot discard it.
 * Args: key identifies the collection; validate checks each record.
 * Returns: An explicit result for mutation callers, including read failures.
 */
function readCollection(key, validate) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { ok: true, value: [] };
    const value = JSON.parse(raw);
    if (!Array.isArray(value) || !Array.from(value).every(validate)) return { ok: false, error: 'invalid', message: 'Local account or post data is unreadable. Restore valid browser data before saving.' };
    return { ok: true, value };
  } catch (error) {
    return error instanceof SyntaxError
      ? { ok: false, error: 'invalid', message: 'Local data is unreadable. Restore valid browser data before saving.' }
      : storageFailure(error);
  }
}

/** Read accounts with error detail so registration never replaces unreadable accounts. */
export function readUsers() {
  return readCollection(USERS_KEY, isUser);
}

/** Return accounts or a safe empty fallback; never write during a read. */
export function getUsers() {
  const result = readUsers();
  return result.ok ? result.value : [];
}

/** Return posts or a safe empty fallback; never invent demo posts. */
export function getPosts() {
  const result = readPosts();
  return result.ok ? result.value : [];
}

/** Read posts with error detail so discovery can distinguish empty from unreadable data. */
export function readPosts() {
  return readCollection(POSTS_KEY, isPost);
}

/** Save only wholly valid arrays and report serialization or browser write failures. */
function saveCollection(key, value, validate) {
  if (!Array.isArray(value) || !Array.from(value).every(validate)) return { ok: false, error: 'invalid', message: 'This change contains invalid records and was not saved.' };
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, value };
  } catch (error) {
    return storageFailure(error);
  }
}

/** Replace posts only after validating the entire supplied collection.
 * @param {Array} posts Complete replacement collection.
 * @returns {object} Explicit persistence success or failure.
 */
export function savePosts(posts) {
  return saveCollection(POSTS_KEY, posts, isPost);
}

/** Replace accounts only after validating the entire supplied collection.
 * @param {Array} users Complete replacement collection.
 * @returns {object} Explicit persistence success or failure.
 */
export function saveUsers(users) {
  return saveCollection(USERS_KEY, users, isUser);
}

/** Read an exact raw preference, defaulting to light without repairing browser data.
 * Returns: The saved appearance or light when storage is missing, invalid or unavailable.
 */
export function getThemePreference() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === 'dark' || theme === 'light' ? theme : 'light';
  } catch {
    return 'light';
  }
}

/** Persist only an explicitly selected appearance, independently of demo domain data.
 * Args: theme is an exact light or dark preference, never coerced or serialized.
 * Returns: An explicit success or safe categorized failure; failures never block appearance.
 * @param {'light'|'dark'} theme Exact selected appearance.
 * @returns {{ok: true, value: 'light'|'dark'}|{ok: false, error: 'invalid'|'quota'|'unavailable'|'unknown'}} Persistence result.
 */
export function saveThemePreference(theme) {
  if (theme !== 'light' && theme !== 'dark') return { ok: false, error: 'invalid' };
  try {
    localStorage.setItem(THEME_KEY, theme);
    return { ok: true, value: theme };
  } catch (error) {
    return { ok: false, error: storageFailure(error).error };
  }
}
