/** Offer a controlled plain-text form with no render-time persistence. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { readPosts } from '../utils/storage.js';
import { canMutatePost, createPost, editPost } from '../utils/posts.js';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/** Prefill a permitted edit and preserve typed fields on every failed save.
 * Args: editing selects the existing-post route rather than new writing.
 * Returns: An accessible form or a denied-edit redirect.
 */
export default function WriteBlog({ editing = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [source] = useState(readPosts);
  const post = editing && source.ok ? source.value.find((value) => value.id === id) : null;
  const [form, setForm] = useState({ title: post?.title || '', content: post?.content || '' });
  const [failure, setFailure] = useState(null);

  /** Submit current text to an operation that rereads both data and identity. */
  function submit(event) {
    event.preventDefault();
    const result = editing ? editPost(id, form) : createPost(form);
    if (result.ok) navigate('/blog/' + encodeURIComponent(result.post.id));
    else setFailure(result);
  }

  if (editing && source.ok && (!post || (!failure && !canMutatePost(getSession(), post)))) {
    return <Navigate to="/blogs" replace />;
  }
  const errors = failure?.errors || {};
  const back = editing ? '/blog/' + encodeURIComponent(id) : '/blogs';
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">WriteSpace / Your words</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">{editing ? 'Edit Blog' : 'Write a Blog'}</h1>
      <p className="mb-8 mt-3 text-slate-600">Plain text. Room to think. Saved only in this browser.</p>
      {!source.ok && (
        <p role="status" className="mb-6 rounded-xl bg-amber-50 p-4 text-amber-900">{source.message}</p>
      )}
      <form noValidate onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-semibold">Title</label>
          <input id="title" name="title" type="text" required aria-required="true"
            value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined}
            className={'w-full rounded-xl border border-slate-300 px-4 py-3 ' + focus} />
          {errors.title && (
            <p id="title-error" role="alert" className="mt-2 text-sm text-red-700">{errors.title}</p>
          )}
        </div>
        <div>
          <label htmlFor="content" className="mb-2 block text-sm font-semibold">Content</label>
          <textarea id="content" name="content" required aria-required="true"
            value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })}
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? 'content-error content-count' : 'content-count'}
            className={'min-h-64 w-full rounded-xl border border-slate-300 px-4 py-3 leading-relaxed ' + focus} />
          <p id="content-count" className="mt-2 text-sm tabular-nums text-slate-600">{form.content.length} characters</p>
          {errors.content && (
            <p id="content-error" role="alert" className="mt-2 text-sm text-red-700">{errors.content}</p>
          )}
        </div>
        {failure && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{failure.message}</p>
        )}
        <div className="flex flex-col gap-3 md:flex-row">
          <button type="submit" className={
            'min-h-11 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700 ' +
            'motion-safe:transition-colors motion-reduce:transition-none ' + focus
          }>
            Save
          </button>
          <Link to={back} className={
            'inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 font-medium text-slate-600 hover:bg-slate-100 ' +
            'motion-safe:transition-colors motion-reduce:transition-none ' + focus
          }>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
WriteBlog.propTypes = { editing: PropTypes.bool };
