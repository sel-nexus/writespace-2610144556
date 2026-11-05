/** Compose public discovery, identity, publishing and administrator routes. */
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getSession, homeFor } from './utils/auth.js';
import { getTheme, saveTheme } from './utils/storage.js';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import Home from './pages/Home.jsx';
import ReadBlog from './pages/ReadBlog.jsx';
import WriteBlog from './pages/WriteBlog.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import UserManagement from './pages/UserManagement.jsx';

/** Keep an unknown or not-yet-built route usable without fabricating a feature page. */
function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-6 py-20">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        WriteSpace
      </p>
      <h1 className="mt-4 font-display text-4xl font-bold">
        Page not found
      </h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        This address is not available in this local edition.
      </p>
      <Link to="/" className={
        "mt-6 inline-block rounded-lg text-indigo-700 dark:text-indigo-300 underline focus-visible:outline-none " +
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
  const [theme, setTheme] = useState(getTheme);
  const location = useLocation();
  useEffect(() => { setSession(getSession()); }, [location]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  /** Apply an explicit preference even when the browser cannot retain it. */
  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    saveTheme(nextTheme);
  }

  /** Re-read the durable session rather than trusting the submitted form result. */
  function refreshSession() { setSession(getSession()); }
  const current = getSession();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <a href="#main" className={
        "sr-only z-50 rounded bg-white dark:bg-slate-900 p-3 focus:not-sr-only focus:absolute focus-visible:ring-2 " +
        "focus-visible:ring-indigo-500"
        }>
        Skip to content
      </a>
      {location.pathname === '/' || !session ? (
        <PublicNavbar session={session} theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <Navbar session={session} onSessionChange={refreshSession} theme={theme} onToggleTheme={toggleTheme} />
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={
          current ? <Navigate to={homeFor(current)} replace /> : <LoginPage onSessionChange={refreshSession} />
        } />
        <Route path="/register" element={
          current ? <Navigate to={homeFor(current)} replace /> : <RegisterPage onSessionChange={refreshSession} />
        } />
        <Route path="/blogs" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />
        <Route path="/blog/:id" element={
          <ProtectedRoute>
            <ReadBlog />
          </ProtectedRoute>
        } />
        <Route path="/write" element={
          <ProtectedRoute>
            <WriteBlog key="create" />
          </ProtectedRoute>
        } />
        <Route path="/edit/:id" element={
          <ProtectedRoute>
            <WriteBlog key={location.pathname} editing />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute adminOnly>
            <UserManagement />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
