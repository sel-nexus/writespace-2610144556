/** Display local writing as escaped plain text and require explicit destructive actions. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { getSession } from '../utils/auth.js';
import { readPosts } from '../utils/storage.js';
import { canMutatePost, deletePost } from '../utils/posts.js';

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
          "dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 " +
          "dark:focus-visible:ring-offset-slate-800";

/** Retain the detail on failed deletion and navigate only after confirmed persistence. */
export default function ReadBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const result = readPosts();
  const post = result.ok ? result.value.find((value) => value.id === id) : null;
  const allowed = canMutatePost(getSession(), post);

  /** Recheck current ownership inside the operation after the browser confirmation. */
  function remove() {
    const outcome = deletePost(id, window.confirm('Delete this post? This cannot be undone.'));
    if (outcome.ok) navigate('/blogs');
    else if (outcome.code !== 'cancelled') setMessage(outcome.message);
  }

  const date = post ? new Date(post.createdAt) : null;
  const dateText = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)
    : 'Date unavailable';
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Link to="/blogs" className={'inline-flex min-h-11 items-center rounded-lg text-indigo-700 dark:text-indigo-300 underline ' + focus}>
        Back to All Posts
      </Link>
      {!result.ok && (
        <p role="status" className={
          "mt-6 rounded-xl bg-amber-50 dark:bg-amber-950 p-4 text-amber-900 dark:text-amber-200"
        }>
          {result.message}
        </p>
      )}
      {post ? (
        <article className={
          "mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 " +
          "p-6 shadow-sm sm:p-10"
        }>
          <h1 className={
            "break-words font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
          }>
            {post.title}
          </h1>
          <div className={
            "mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300"
          }>
            <Avatar role={post.authorId === 'admin' ? 'admin' : 'user'} />
            <span className="break-words font-medium">{post.authorName}</span>
            {dateText === 'Date unavailable' ? (
              <span>{dateText}</span>
            ) : (
              <time dateTime={post.createdAt}>{dateText}</time>
            )}
          </div>
          <p className={
            "mt-10 break-words whitespace-pre-wrap text-lg leading-relaxed text-slate-800 " +
            "dark:text-slate-200"
          }>
            {post.content}
          </p>
          {message && (
            <p role="alert" className={
              "mt-6 rounded-xl bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300"
            }>
              {message}
            </p>
          )}
          {allowed && (
            <div className={
              "mt-10 flex flex-wrap gap-3 border-t border-slate-100 dark:border-slate-700 pt-6"
            }>
              <Link to={'/edit/' + encodeURIComponent(post.id)} className={
                "inline-flex min-h-11 items-center rounded-lg border border-indigo-200 " +
                "dark:border-indigo-700 px-4 py-2 font-medium text-indigo-700 dark:text-indigo-300 " +
                'hover:bg-indigo-50 dark:hover:bg-indigo-950 motion-safe:transition-colors motion-reduce:transition-none ' + focus
              }>
                Edit
              </Link>
              <button type="button" onClick={remove} className={
                "min-h-11 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 " +
                "px-4 py-2 font-medium text-red-700 dark:text-red-300 hover:bg-red-100 " +
                "dark:hover:bg-red-900 " +
                'motion-safe:transition-colors motion-reduce:transition-none ' + focus
              }>
                Delete
              </button>
            </div>
          )}
        </article>
      ) : (
        <h1 className="mt-8 font-display text-4xl font-bold">Post not found</h1>
      )}
    </main>
  );
}
