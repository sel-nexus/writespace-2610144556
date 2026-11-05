/** Share one native appearance control between public and workspace navigation. */
import PropTypes from 'prop-types';

/** Request the opposite mode while preserving native keyboard and focus behavior.
 * Args:
 *   theme: The root-selected appearance.
 *   onToggle: The root callback that updates the view and attempts persistence.
 * Returns:
 *   A visibly labeled toggle button whose pressed state means dark mode is active.
 */
export function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      type="button"
      aria-label="Dark mode"
      aria-pressed={theme === 'dark'}
      onClick={onToggle}
      className={
        'shrink-0 rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 ' +
        'hover:bg-slate-200 active:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 ' +
        'focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 ' +
        'dark:text-slate-100 dark:hover:bg-slate-700 dark:active:bg-slate-600 dark:focus-visible:ring-indigo-400 ' +
        'dark:focus-visible:ring-offset-slate-900'
      }
    >
      Dark mode: {theme === 'dark' ? 'on' : 'off'}
    </button>
  );
}

ThemeToggle.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  onToggle: PropTypes.func.isRequired,
};
