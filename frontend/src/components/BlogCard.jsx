/** Render a real local post with separate native reading and optional editing links. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { canMutatePost } from '../utils/posts.js';

const accents = ['border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500'];
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
          "dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 " +
          "dark:focus-visible:ring-offset-slate-800";

/** Format a valid date in UTC so calendar labels do not shift between browser time zones. */
function displayDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

/** Present a post without clickable containers or nested links.
 * Args: post supplies content; index selects an accent; session determines edit visibility.
 * Returns: A semantic article with a native detail link and sibling Edit link.
 */
export function BlogCard({ post, index = 0, session = null }) {
  const accentIndex = Number.isInteger(index) ? ((index % 4) + 4) % 4 : 0;
  const date = displayDate(post.createdAt);
  return (
    <article className={
      "flex h-full min-w-0 flex-col rounded-2xl border-t-4 bg-white dark:bg-slate-800 shadow-sm " +
      accents[accentIndex]
    }>
      <Link
        to={`/blog/${encodeURIComponent(post.id)}`}
        aria-label={`Read ${post.title}`}
        className={
          "flex flex-1 flex-col rounded-t-xl p-6 hover:bg-slate-50 dark:hover:bg-slate-700 " +
          focus
        }
      >
        <h3 className={
          "break-words font-display text-2xl font-bold leading-snug text-slate-900 " +
          "dark:text-slate-100"
        }>
          {post.title}
        </h3>
        <p className={
          "mt-4 break-words whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300"
        }>
          {post.content.slice(0, 120)}
        </p>
        <span className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          {date === 'Date unavailable' ? date : <time dateTime={post.createdAt}>{date}</time>}
        </span>
      </Link>
      <div className={
        "flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700 " +
        "px-6 py-4"
      }>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar role={post.authorId === 'admin' ? 'admin' : 'user'} />
          <span className="break-words text-sm font-medium text-slate-700 dark:text-slate-200">{post.authorName}</span>
        </div>
        {canMutatePost(session, post) && (
          <Link
            to={`/edit/${encodeURIComponent(post.id)}`}
            aria-label={`Edit ${post.title}`}
            className={
              "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-indigo-700 " +
              "dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 " +
              focus
            }
          >
            Edit
          </Link>
        )}
      </div>
    </article>
  );
}
BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired, authorId: PropTypes.string.isRequired, authorName: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
