/** Offer public entry links and a role-aware return to the local workspace. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { homeFor } from '../utils/auth.js';
import { Avatar } from './Avatar.jsx';

/** Keep navigation inert until native link activation. */
export function PublicNavbar({ session }) {
  const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" aria-label="WriteSpace." className={`font-display text-2xl font-bold tracking-tight text-slate-900 ${focus}`}>
          WriteSpace
          <span aria-hidden="true" className="text-indigo-600">.</span>
        </Link>
        {session ? (
          <div className="flex flex-wrap items-center gap-3">
            <Avatar role={session.role} />
            <span className="max-w-40 truncate text-sm font-semibold">{session.displayName}</span>
            <Link to={homeFor(session)} className={`bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 ${focus}`}>
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link to="/login" className={`px-2 py-2 font-semibold text-indigo-700 hover:text-indigo-900 ${focus}`}>
              Login
            </Link>
            <Link to="/register" className={`bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 ${focus}`}>
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
PublicNavbar.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired }),
};
