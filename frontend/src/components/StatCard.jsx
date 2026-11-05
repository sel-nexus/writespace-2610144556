/** Present a defined metric or an explicitly neutral pending definition. */
import PropTypes from 'prop-types';

const tones = {
  indigo: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100',
  violet: 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100',
  teal: 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100',
  neutral: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-800 dark:text-slate-100',
};

/** Keep undefined metrics visibly unassigned rather than inventing a number.
 * Args: label names the metric; value is its count; pending omits the count; tone selects its accent.
 * Returns: A named metric surface with tabular numerals.
 */
export function StatCard({ label, value, pending = false, tone = 'neutral' }) {
  return (
    <section aria-label={label} className={
      'rounded-2xl border p-5 ' + tones[pending ? 'neutral' : tone]
    }>
      <h2 className="text-sm font-semibold">
        {label}
      </h2>
      <p className="mt-3 text-3xl font-bold tabular-nums">
        {pending ? '—' : value}
      </p>
      {pending && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Metric pending definition
        </p>
      )}
    </section>
  );
}
StatCard.propTypes = {
  label: PropTypes.string.isRequired, value: PropTypes.number,
  pending: PropTypes.bool, tone: PropTypes.oneOf(Object.keys(tones)),
};
