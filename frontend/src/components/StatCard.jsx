/** Present a defined metric or an explicitly neutral pending definition. */
import PropTypes from 'prop-types';

const tones = {
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  violet: 'border-violet-200 bg-violet-50 text-violet-900',
  teal: 'border-teal-200 bg-teal-50 text-teal-900',
  neutral: 'border-slate-200 bg-white text-slate-800',
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
      <h2 className="text-sm font-semibold">{label}</h2>
      <p className="mt-3 text-3xl font-bold tabular-nums">{pending ? '—' : value}</p>
      {pending && (
        <p className="mt-2 text-sm text-slate-600">Metric pending definition</p>
      )}
    </section>
  );
}
StatCard.propTypes = {
  label: PropTypes.string.isRequired, value: PropTypes.number,
  pending: PropTypes.bool, tone: PropTypes.oneOf(Object.keys(tones)),
};
