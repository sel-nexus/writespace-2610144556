/** Introduce browser-local writing with truthful copy and real gated post previews. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { readPosts } from '../utils/storage.js';
import { selectRecent } from '../utils/posts.js';
import { BlogCard } from '../components/BlogCard.jsx';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/** Show a non-persisted writing illustration, not a fabricated published post. */
function WritingIllustration() {
  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <figcaption className="text-sm font-semibold text-indigo-700">Writing illustration · not a saved post</figcaption>
      <p className="mt-8 font-display text-3xl font-bold text-slate-900">A place for your next thought.</p>
      <p className="mt-5 leading-relaxed text-slate-600">Start with a title. Make room for a sentence. Keep writing in plain text.</p>
      <div aria-hidden="true" className="mt-8 space-y-3">
        <div className="h-2 rounded bg-slate-100" />
        <div className="h-2 w-5/6 rounded bg-slate-100" />
        <div className="h-2 w-2/3 rounded bg-indigo-100" />
      </div>
    </figure>
  );
}

/** Render an immutable route snapshot; navigation and persistence occur only on activation. */
export default function LandingPage() {
  const [result] = useState(readPosts);
  const session = getSession();
  const recent = selectRecent(result.ok ? result.value : []);
  return (
    <>
      <main id="main">
        <section aria-labelledby="hero-title" className="flex min-h-[calc(100dvh-5rem)] items-center bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 md:grid-cols-2 md:py-16">
            <div>
              <div aria-hidden="true" className="mb-8 h-1.5 w-20 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500" />
              <h1 id="hero-title" className="font-display text-[clamp(3rem,6vw,5rem)] font-bold leading-tight tracking-tight text-slate-900">
                WriteSpace
              </h1>
              <p className="mt-6 max-w-md text-xl leading-relaxed text-slate-600">Your thoughts. Your space. Beautifully simple.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={session ? '/blogs' : '/login'}
                  className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-6 font-semibold text-white
                    shadow-sm hover:bg-indigo-700 motion-safe:transition-colors ${focus}`}
                >
                  Start Reading
                </Link>
                <Link
                  to="/register"
                  className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-indigo-200 bg-white px-6
                    font-semibold text-indigo-700 hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}
                >
                  Get Started Free
                </Link>
              </div>
            </div>
            <div className="min-w-0 motion-safe:animate-float">
              {recent.length ? <BlogCard post={recent[0]} session={session} /> : <WritingIllustration />}
            </div>
          </div>
        </section>
        <section aria-labelledby="features-title" className="bg-white px-6 py-16 md:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 id="features-title" className="font-display text-3xl font-bold text-slate-900">Features</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <article className="rounded-2xl bg-indigo-50 p-7">
                <h3 className="font-display text-2xl font-bold text-slate-900">Write Freely</h3>
                <p className="mt-4 leading-relaxed text-slate-700">Plain-text, distraction-free writing. Just your title, your words, and room to think.</p>
              </article>
              <article className="rounded-2xl bg-slate-50 p-7">
                <h3 className="font-display text-2xl font-bold text-slate-900">Private &amp; Local</h3>
                <p className="mt-4 leading-relaxed text-slate-700">Data stays in this browser, not on a shared server. No cross-device sync or encryption.</p>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  Demo only: passwords are stored in plaintext. Do not use real passwords or sensitive data.
                </p>
              </article>
              <article className="rounded-2xl bg-teal-50 p-7">
                <h3 className="font-display text-2xl font-bold text-slate-900">Instant &amp; Fast</h3>
                <p className="mt-4 leading-relaxed text-slate-700">Read and write locally without waiting on a server. Your browser holds this edition.</p>
              </article>
            </div>
          </div>
        </section>
        <section aria-labelledby="latest-title" className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 id="latest-title" className="font-display text-3xl font-bold text-slate-900">Latest from the Blog</h2>
          {!result.ok && (
            <p role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              Local posts could not be read. Enable browser storage or restore valid local data, then reload. Nothing was changed.
            </p>
          )}
          {recent.length ? (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recent.map((post, index) => <BlogCard key={post.id} post={post} index={index} session={session} />)}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-600">
              No posts yet — check back soon!
            </p>
          )}
        </section>
      </main>
      <footer className="bg-slate-900 px-6 py-10 text-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            {[['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']].map(([label, to]) => (
              <Link key={to} to={to} className={`inline-flex min-h-11 items-center rounded-lg hover:text-white ${focus}`}>
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-sm">© {new Date().getFullYear()} WriteSpace. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
