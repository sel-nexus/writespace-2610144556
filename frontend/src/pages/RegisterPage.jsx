/** Present a controlled browser-local identity form with explicit submit-only persistence. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../utils/auth.js';

/** Retain entered fields on failures and refresh the shell only after durable session success. */
export default function RegisterPage({ onSessionChange }) {
  const [form, setForm] = useState({displayName: '', username: '', password: '', confirmation: ''});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  /** Validate the submitted values and navigate only when local persistence succeeds. */
  function submit(event) {
    event.preventDefault();
    const result = register(form);
    setErrors(result.errors || {});
    setMessage(result.ok ? '' : result.message);
    if (result.ok) { onSessionChange(); navigate(result.destination); }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">WriteSpace / Local edition</p>
      <h1 className="font-display text-[clamp(2.5rem,6vw,3.5rem)] font-bold leading-tight tracking-tight">Make room for your words.</h1>
      <p className="mb-8 mt-3 text-slate-600">Create a browser-local account for your writing.</p>
      <section aria-label="Registration form" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Demo only — do not use real passwords. Accounts and plaintext passwords stay in this browser. These client-side checks are not secure authentication.
        </p>

        <form noValidate onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="displayName" className="mb-2 block text-sm font-semibold">Display Name</label>
            <input id="displayName" name="displayName" type="text" autoComplete="name" required aria-required="true"
              value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? 'displayName-error' : undefined}
              className={
                "w-full rounded-xl border border-slate-300 px-4 py-3 focus-visible:outline-none " +
                "focus-visible:ring-2 focus-visible:ring-indigo-500"
                } />
            {errors.displayName && (
              <p id="displayName-error" role="alert" className="mt-2 text-sm text-red-700">{errors.displayName}</p>
            )}
          </div>
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-semibold">Username</label>
            <input id="username" name="username" type="text" autoComplete="username" required aria-required="true"
              value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })}
              aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : undefined}
              className={
                "w-full rounded-xl border border-slate-300 px-4 py-3 focus-visible:outline-none " +
                "focus-visible:ring-2 focus-visible:ring-indigo-500"
                } />
            {errors.username && (
              <p id="username-error" role="alert" className="mt-2 text-sm text-red-700">{errors.username}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required aria-required="true"
              value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}
              aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined}
              className={
                "w-full rounded-xl border border-slate-300 px-4 py-3 focus-visible:outline-none " +
                "focus-visible:ring-2 focus-visible:ring-indigo-500"
                } />
            {errors.password && (
              <p id="password-error" role="alert" className="mt-2 text-sm text-red-700">{errors.password}</p>
            )}
          </div>
          <div>
            <label htmlFor="confirmation" className="mb-2 block text-sm font-semibold">Confirm Password</label>
            <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required aria-required="true"
              value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })}
              aria-invalid={Boolean(errors.confirmation)} aria-describedby={errors.confirmation ? 'confirmation-error' : undefined}
              className={
                "w-full rounded-xl border border-slate-300 px-4 py-3 focus-visible:outline-none " +
                "focus-visible:ring-2 focus-visible:ring-indigo-500"
                } />
            {errors.confirmation && (
              <p id="confirmation-error" role="alert" className="mt-2 text-sm text-red-700">{errors.confirmation}</p>
            )}
          </div>
          {message && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>
          )}
          <button type="submit"
            className={
              "w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
              "focus-visible:ring-offset-2 motion-safe:transition-colors motion-reduce:transition-none"
              }>
            Register
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have a local account?
          <Link to="/login" className={
            "ml-2 rounded text-indigo-700 underline underline-offset-4 focus-visible:outline-none " +
            "focus-visible:ring-2 focus-visible:ring-indigo-500"
            }>
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
RegisterPage.propTypes = { onSessionChange: PropTypes.func.isRequired };
