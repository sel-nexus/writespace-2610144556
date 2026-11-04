/** Compose identity and public discovery; unbuilt destinations retain a neutral local fallback. */
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getSession, homeFor } from './utils/auth.js';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import LandingPage from './pages/LandingPage.jsx';

/** Keep an unknown or not-yet-built route usable without fabricating a feature page. */
function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-6 py-20">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">WriteSpace</p>
      <h1 className="mt-4 font-display text-4xl font-bold">Page not found</h1>
      <p className="mt-4 text-slate-600">This address is not available in this local edition.</p>
      <Link to="/" className={
        "mt-6 inline-block rounded-lg text-indigo-700 underline focus-visible:outline-none " +
        "focus-visible:ring-2 focus-visible:ring-indigo-500"
        }>
        Back to Home
      </Link>
    </main>
  );
}

/** Refresh navigation identity after auth callbacks and each router location change. */
export default function App() {
  const [session, setSession] = useState(getSession);
  const location = useLocation();
  useEffect(() => { setSession(getSession()); }, [location]);

  /** Re-read the durable session rather than trusting the submitted form result. */
  function refreshSession() { setSession(getSession()); }
  const current = getSession();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <a href="#main" className={
        "sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:absolute focus-visible:ring-2 " +
        "focus-visible:ring-indigo-500"
        }>
        Skip to content
      </a>
      {location.pathname === '/' || !session ? (
        <PublicNavbar session={session} />
      ) : (
        <Navbar session={session} onSessionChange={refreshSession} />
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={
          current ? <Navigate to={homeFor(current)} replace /> : <LoginPage onSessionChange={refreshSession} />
        } />
        <Route path="/register" element={
          current ? <Navigate to={homeFor(current)} replace /> : <RegisterPage onSessionChange={refreshSession} />
        } />
        {['/blogs', '/blog/:id', '/write', '/edit/:id', '/admin', '/users'].map((path) => (
          <Route key={path} path={path} element={
            <ProtectedRoute adminOnly={path === '/admin' || path === '/users'}>
              <NotFound />
            </ProtectedRoute>
          } />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
