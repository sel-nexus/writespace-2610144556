/** Present all browser-local posts without writing during rendering. */
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { getSession } from '../utils/auth.js';
import { readPosts } from '../utils/storage.js';
import { selectRecent } from '../utils/posts.js';

/** Render newest-first cards or an honest empty/error state with a writing entry. */
export default function Home() {
  const result = readPosts();
  const posts = selectRecent(result.ok ? result.value : [], Infinity);
  const session = getSession();
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">WriteSpace / Local edition</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">All Blogs</h1>
          <p className="mt-3 text-slate-600">Fresh perspectives, kept in this browser.</p>
        </div>
        <Link to="/write" className={
          'inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm ' +
          'hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ' +
          'focus-visible:ring-offset-2 motion-safe:transition-colors motion-reduce:transition-none'
        }>
          Write
        </Link>
      </header>
      {!result.ok && (
        <p role="status" className="mb-6 rounded-xl bg-amber-50 p-4 text-amber-900">{result.message}</p>
      )}
      {posts.length ? (
        <section aria-label="Blog posts" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} session={session} />
          ))}
        </section>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-lg text-slate-600">
          No blogs yet. Be the first to write one!
        </p>
      )}
    </main>
  );
}
