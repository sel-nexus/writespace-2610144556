/** Present a controlled browser-local identity form with explicit submit-only persistence. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../utils/auth.js';

/** Retain entered fields on failures and refresh the shell only after durable session success. */
export default function LoginPage({ onSessionChange }) {
  const [form, setForm] = useState({username: '', password: ''});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  /** Validate the submitted values and navigate only when local persistence succeeds. */
  function submit(event) {
    event.preventDefault();
    const result = login(form);
    setErrors(result.errors || {});
    setMessage(result.ok ? '' : result.message);
    if (result.ok) { onSessionChange(); navigate(result.destination); }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">
        WriteSpace / Local edition
      </p>
      <h1 className="font-display text-[clamp(2.5rem,6vw,3.5rem)] font-bold leading-tight tracking-tight">
        Welcome back.
      </h1>
      <p className="mb-8 mt-3 text-slate-600 dark:text-slate-300">
        Log in to your local writing space.
      </p>
      <section aria-label="Login form" className={
        'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 ' +
        'shadow-xl shadow-slate-200/60 dark:shadow-black/30 sm:p-8'
      }>
        <p className={
          'mb-6 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-4 ' +
          'text-sm leading-relaxed text-amber-900 dark:text-amber-200'
        }>
          Demo only — do not use real passwords. Accounts and plaintext passwords stay in this browser. These client-side checks are not secure authentication.
        </p>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Try the built-in demo: username <strong>admin</strong>, password <strong>admin</strong>.
        </p>
        <form noValidate onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-semibold">
              Username
            </label>
            <input id="username" name="username" type="text" autoComplete="username" required aria-required="true"
              value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })}
              aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : undefined}
              className={
                "w-full rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 focus-visible:outline-none " +
                "focus-visible:ring-2 focus-visible:ring-indigo-500"
                } />
            {errors.username && (
              <p id="username-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
                {errors.username}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold">
              Password
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required aria-required="true"
              value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}
              aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined}
              className={
                "w-full rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-4 py-3 focus-visible:outline-none " +
                "focus-visible:ring-2 focus-visible:ring-indigo-500"
                } />
            {errors.password && (
              <p id="password-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
                {errors.password}
              </p>
            )}
          </div>
          {message && (
            <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
              {message}
            </p>
          )}
          <button type="submit"
            className={
              "w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
              "focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 motion-safe:transition-colors motion-reduce:transition-none"
              }>
            Login
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
          New to WriteSpace?
          <Link to="/register" className={
            "ml-2 rounded text-indigo-700 dark:text-indigo-300 underline underline-offset-4 focus-visible:outline-none " +
            "focus-visible:ring-2 focus-visible:ring-indigo-500"
            }>
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
LoginPage.propTypes = { onSessionChange: PropTypes.func.isRequired };
