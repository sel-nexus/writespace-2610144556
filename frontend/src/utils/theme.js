/** Keep the browser preference independent from identity and publishing data. */
export const THEME_KEY = 'writespace_theme';

/** Resolve unsupported preference values to the safe light appearance.
 * Args:
 *   value: Untrusted scalar read from browser storage.
 * Returns:
 *   The supported light or dark mode, without coercion.
 */
/** @param {unknown} value @returns {'light'|'dark'} */
export function normalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light';
}

/** Read the scalar preference without repairing missing or inaccessible data.
 * Returns:
 *   A supported mode; missing, invalid, or failed reads resolve to light.
 */
/** @returns {'light'|'dark'} */
export function getTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return 'light';
  }
}

/** Persist an explicit supported selection without affecting the active view.
 * Args:
 *   theme: The requested light or dark appearance.
 * Returns:
 *   A StorageResult with the saved value or a failure code and recovery guidance.
 * Notes:
 *   Never throws or writes other keys; callers retain their selection on failure.
 */
/** @param {unknown} theme @returns {{ok: boolean, value?: 'light'|'dark', error?: 'invalid'|'unavailable'|'quota'|'unknown', message?: string}} */
export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') {
    return { ok: false, error: 'invalid', message: 'Choose light or dark appearance.' };
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
    return { ok: true, value: theme };
  } catch (error) {
    let code = 'unknown';
    if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      code = 'quota';
    } else if (error?.name === 'SecurityError' || error?.name === 'ReferenceError' || error?.name === 'TypeError') {
      code = 'unavailable';
    }
    return {
      ok: false,
      error: code,
      message: 'Theme changed for this view but could not be saved for the next visit. Enable browser storage or free space, then toggle again to retry.',
    };
  }
}
