/** Offer a shared native control for the root-owned appearance preference. */
import PropTypes from 'prop-types';

/** Activate the next theme without owning state or browser persistence.
 * Args: theme identifies the current appearance; onToggle activates its opposite.
 * Returns: A labelled button available at every viewport width.
 */
export function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onToggle}
      className={
        'inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 ' +
        'text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none ' +
        'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ' +
        'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ' +
        'dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-900'
      }
    >
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

ThemeToggle.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  onToggle: PropTypes.func.isRequired,
};
