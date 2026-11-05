/** Oversee real browser-local accounts and the five newest posts. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { readPosts, readUsers } from '../utils/storage.js';
import { deletePost, selectRecent } from '../utils/posts.js';
import { isDefaultAdmin } from '../utils/users.js';
import { StatCard } from '../components/StatCard.jsx';

/** Render route-entry snapshots and update them only after durable explicit deletion. */
export default function AdminDashboard() {
  const [posts, setPosts] = useState(readPosts);
  const [users] = useState(readUsers);
  const [error, setError] = useState('');
  const accounts = (users.ok ? users.value : []).filter((user) => !isDefaultAdmin(user));
  const writing = posts.ok ? posts.value : [];
  const linkStyle = 'rounded-lg px-4 py-2 font-medium focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900';

  /** Confirm once, then let the domain operation read current storage and identity. */
  function remove(id) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const result = deletePost(id, true);
    setError(result.ok ? '' : result.message);
    if (result.ok) setPosts(readPosts());
  }

  return (
    <main id="main" className="mx-auto max-w-6xl space-y-8 px-4 py-10 text-slate-900 dark:text-slate-100 sm:px-6">
      <header className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white sm:p-8">
        <p className="text-sm font-semibold">
          WriteSpace / Administration
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Admin Dashboard
        </h1>
        <p className="mt-3">
          A clear view of the writing and accounts in this browser.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={writing.length} tone="indigo" />
        <StatCard label="Total Users" value={accounts.length + 1} tone="teal" />
        <StatCard label="Total Admins" value={accounts.filter((user) => user.role === 'admin').length + 1} tone="violet" />
        <StatCard label="Total users" pending />
      </div>
      {(!posts.ok || !users.ok) && (
        <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-900 dark:text-amber-200">
          {!posts.ok ? posts.message : users.message}
        </p>
      )}
      <nav aria-label="Quick actions" className="flex flex-wrap gap-3">
        <Link to="/write" className={
          linkStyle + ' bg-indigo-600 text-white hover:bg-indigo-700'
        }>
          Write New Post
        </Link>
        <Link to="/users" className={
          linkStyle + ' border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 ' +
            'dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800'
        }>
          Manage Users
        </Link>
      </nav>
      <section aria-label="Recent posts" className={
        'rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 p-6'
      }>
        <h2 className="font-display text-2xl font-bold">
          Recent posts
        </h2>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 dark:bg-red-950 p-3 text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        {writing.length === 0 ? (
          <p className="mt-5 text-slate-600 dark:text-slate-300">
            No posts yet.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-700">
            {selectRecent(writing, 5).map((post) => (
              <li key={post.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">
                    <Link to={'/blog/' + encodeURIComponent(post.id)} className={
                      'rounded hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500'
                    }>
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {post.authorName}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={'/edit/' + encodeURIComponent(post.id)} aria-label={'Edit ' + post.title}
                    className={
                      linkStyle +
                      ' border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800'
                    }>
                    Edit
                  </Link>
                  <button type="button" aria-label={'Delete ' + post.title} onClick={() => remove(post.id)}
                    className={
                      linkStyle +
                      ' border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 ' +
                        'hover:bg-red-100 dark:hover:bg-red-900'
                    }>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
