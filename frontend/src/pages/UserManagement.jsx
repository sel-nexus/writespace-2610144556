/** Manage local profiles through domain operations, never direct browser storage. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { readUsers } from '../utils/storage.js';
import { createUser, deleteUser, DEFAULT_ADMIN, isDefaultAdmin } from '../utils/users.js';
import { UserRow } from '../components/UserRow.jsx';

const emptyForm = { displayName: '', username: '', password: '', role: '' };
const labels = { displayName: 'Display Name', username: 'Username', password: 'Password', role: 'Role' };

/** Retain failed forms and account snapshots; refresh storage only after successful writes. */
export default function UserManagement() {
  const [users, setUsers] = useState(readUsers);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const session = getSession();
  const profiles = [DEFAULT_ADMIN, ...(users.ok ? users.value : []).filter((user) => !isDefaultAdmin(user))]
    .map(({ id, displayName, username, role, createdAt }) => ({ id, displayName, username, role, createdAt }));

  /** Submit account data once; never switch the administrator to the created identity. */
  function submit(event) {
    event.preventDefault();
    const result = createUser(form);
    setErrors(result.errors || {});
    setError(result.ok ? '' : result.message);
    setStatus(result.ok ? 'Account created.' : '');
    if (result.ok) { setUsers(readUsers()); setForm(emptyForm); }
  }

  /** Confirm an eligible row action, then recheck immutable and current identities in the operation. */
  function remove(id) {
    if (!window.confirm('Delete this account? This cannot be undone.')) return;
    const result = deleteUser(id, true);
    setError(result.ok ? '' : result.message);
    setStatus(result.ok ? 'Account deleted.' : '');
    if (result.ok) setUsers(readUsers());
  }

  return (
    <main id="main" className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <Link to="/admin" className="rounded text-indigo-700 underline focus-visible:ring-2 focus-visible:ring-indigo-500">
          Back to Dashboard
        </Link>
        <h1 className="mt-4 font-display text-4xl font-bold">User Management</h1>
        <p className="mt-3 text-slate-600">Create and manage the accounts in this browser.</p>
      </header>
      {!users.ok && (
        <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">{users.message}</p>
      )}
      <section aria-label="Create User" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-2xl font-bold">Create User</h2>
        <p className="my-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Demo only — do not use real passwords. Passwords are stored as plaintext in this browser.
          These client-side checks are not secure authentication.
        </p>
        <form noValidate onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          {['displayName', 'username', 'password'].map((field) => (
            <div key={field}>
              <label htmlFor={'account-' + field} className="mb-2 block text-sm font-semibold">{labels[field]}</label>
              <input id={'account-' + field} name={field} type={field === 'password' ? 'password' : 'text'}
                autoComplete={field === 'password' ? 'new-password' : field === 'username' ? 'off' : 'name'}
                required aria-required="true" value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? field + '-error' : undefined}
                className={
                  'w-full rounded-xl border border-slate-300 px-4 py-3 focus-visible:outline-none ' +
                  'focus-visible:ring-2 focus-visible:ring-indigo-500'
                } />
              {errors[field] && (
                <p id={field + '-error'} role="alert" className="mt-2 text-sm text-red-700">{errors[field]}</p>
              )}
            </div>
          ))}
          <div>
            <label htmlFor="account-role" className="mb-2 block text-sm font-semibold">Role</label>
            <select id="account-role" name="role" required aria-required="true" value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              aria-invalid={Boolean(errors.role)} aria-describedby={errors.role ? 'role-error' : undefined}
              className={
                'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus-visible:outline-none ' +
                'focus-visible:ring-2 focus-visible:ring-indigo-500'
              }>
              <option value="">Select a role</option>
              <option value="admin">Admin</option>
              <option value="user">user</option>
            </select>
            {errors.role && (
              <p id="role-error" role="alert" className="mt-2 text-sm text-red-700">{errors.role}</p>
            )}
          </div>
          <button type="submit" className={
            'rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 sm:col-span-2 ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2'
          }>
            Create User
          </button>
        </form>
      </section>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>
      )}
      {status && (
        <p role="status" aria-live="polite" className="text-indigo-700">{status}</p>
      )}
      <section aria-label="Accounts" className="space-y-4">
        <h2 className="font-display text-2xl font-bold">Accounts</h2>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
          <table aria-label="User accounts" className="w-full text-left">
            <thead className="bg-slate-100 text-sm text-slate-600">
              <tr>
                {['Display Name', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                  <th key={label} scope="col" className="px-5 py-3">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((user) => (
                <UserRow key={user.id} user={user} currentId={session?.userId} onDelete={remove} />
              ))}
            </tbody>
          </table>
        </div>
        <div aria-label="User cards" className="space-y-4 sm:hidden">
          {profiles.map((user) => (
            <UserRow key={user.id} user={user} currentId={session?.userId} onDelete={remove} card />
          ))}
        </div>
      </section>
    </main>
  );
}
