/** Present account profiles without ever rendering credentials. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar.jsx';
import { isDefaultAdmin } from '../utils/users.js';

const badges = {
  admin: 'bg-violet-100 text-violet-700 ring-violet-300',
  user: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
};

/** Render a table row or mobile card with immutable and current-account safeguards.
 * Args: user is a password-free profile; currentId identifies self; onDelete handles explicit actions; card selects mobile markup.
 * Returns: A responsive account presentation with a protected delete affordance.
 */
export function UserRow({ user, currentId, onDelete, card = false }) {
  const builtIn = isDefaultAdmin(user);
  const self = user.id === currentId;
  const title = builtIn ? 'Default admin cannot be deleted.' : self ? 'You cannot delete your current account.' : undefined;
  const date = Date.parse(user.createdAt);
  const dateLabel = builtIn ? 'Built-in account' : Number.isNaN(date) ? 'Date unavailable'
    : new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const identity = (
    <div className="flex items-center gap-3">
      <Avatar role={user.role} />
      <span className="break-words font-semibold">{user.displayName}</span>
    </div>
  );
  const role = (
    <span className={'inline-block rounded-full px-3 py-0.5 text-sm font-medium ring-1 ' + badges[user.role]}>
      {user.role === 'admin' ? 'Admin' : 'user'}
    </span>
  );
  const created = Number.isNaN(date) || builtIn ? dateLabel : (
    <time dateTime={user.createdAt}>{dateLabel}</time>
  );
  const remove = (
    <button type="button" disabled={builtIn || self} title={title} aria-label={'Delete ' + user.username}
      onClick={() => onDelete(user.id)} className={
        'rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 ' +
        'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'
      }>
      Delete
    </button>
  );
  if (card) return (
    <article aria-label={'Account ' + user.username} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {identity}
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-slate-600">Username</dt>
          <dd className="break-all">{user.username}</dd>
        </div>
        <div>
          <dt className="sr-only">Role</dt>
          <dd>{role}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Created</dt>
          <dd>{created}</dd>
        </div>
      </dl>
      {remove}
    </article>
  );
  return (
    <tr>
      <td className="px-5 py-4">{identity}</td>
      <td className="break-all px-5 py-4">{user.username}</td>
      <td className="px-5 py-4">{role}</td>
      <td className="px-5 py-4 text-sm text-slate-600">{created}</td>
      <td className="px-5 py-4">{remove}</td>
    </tr>
  );
}
UserRow.propTypes = {
  user: PropTypes.shape({ id: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string }).isRequired,
  currentId: PropTypes.string, onDelete: PropTypes.func.isRequired, card: PropTypes.bool,
};
