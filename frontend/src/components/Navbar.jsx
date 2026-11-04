/** Provide responsive local workspace navigation and explicit session removal. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../utils/auth.js';
import { Avatar } from './Avatar.jsx';

/** Refresh parent identity after logout and reset menus whenever the route changes. */
export function Navbar({ session, onSessionChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setMobileOpen(false); setProfileOpen(false); setError(''); }, [location.pathname]);
  const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
  const links = [{ to: '/blogs', label: 'All Blogs' }, { to: '/write', label: 'Write' }];
  if (session.role === 'admin') links.push({ to: '/users', label: 'Users' });

  /** Keep the current session visible on failed removal rather than claiming logout. */
  function logout() {
    const result = clearSession();
    if (!result.ok) { setError(result.message); return; }
    onSessionChange();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <nav aria-label="Workspace navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link to="/" aria-label="WriteSpace." className={`mr-auto rounded-lg font-display text-2xl font-bold tracking-tight text-slate-900 ${focus}`}>
          WriteSpace
          <span aria-hidden="true" className="text-indigo-600">.</span>
        </Link>
        <button type="button" aria-label="Toggle navigation" aria-controls="workspace-links" aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)} className={`rounded-lg p-3 text-slate-700 hover:bg-slate-100 sm:hidden ${focus}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div id="workspace-links" className={`${mobileOpen ? 'flex' : 'hidden'} order-last w-full flex-col gap-2 sm:order-none sm:flex sm:w-auto sm:flex-row`}>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to}
              className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-semibold ${focus} ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="relative">
          <button type="button" aria-expanded={profileOpen} aria-controls="profile-actions"
            onClick={() => setProfileOpen(!profileOpen)} onKeyDown={(event) => { if (event.key === 'Escape') setProfileOpen(false); }}
            className={`flex items-center gap-2 rounded-full p-1 pr-3 text-sm font-semibold hover:bg-slate-100 ${focus}`}>
            <Avatar role={session.role} />
            <span className="max-w-32 truncate">{session.displayName}</span>
            <span className="sr-only"> profile</span>
          </button>
          {profileOpen && (
            <div id="profile-actions" className="absolute right-0 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
              onKeyDown={(event) => { if (event.key === 'Escape') setProfileOpen(false); }}>
              <p className="mb-3 text-sm text-slate-600">Signed in as {session.role === 'admin' ? 'Admin' : 'user'}</p>
              <button type="button" onClick={logout} className={`w-full rounded-lg bg-slate-100 px-4 py-2 text-left font-semibold hover:bg-slate-200 ${focus}`}>
                Logout
              </button>
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
Navbar.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired }).isRequired,
  onSessionChange: PropTypes.func.isRequired,
};
