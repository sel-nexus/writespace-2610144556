/** Select local writing and check demo ownership without changing records or storage. */
import { isPost } from './storage.js';
import { isSession } from './auth.js';

/** Select newest posts without mutating the supplied array or its records.
 * Args:
 *   posts: Candidate collection; malformed records are excluded.
 *   limit: Nonnegative integer maximum; omit to select three, use Infinity for all.
 * Returns:
 *   A fresh array with valid dates first and original order retained for ties.
 * @param {*} posts Candidate local collection.
 * @param {number} limit Maximum records to return.
 * @returns {Array} Stable, newest-first selection.
 */
export function selectRecent(posts, limit = 3) {
  if (!Array.isArray(posts) || !(limit === Infinity || (Number.isInteger(limit) && limit >= 0))) return [];
  return posts.filter(isPost).map((post, index) => {
    const parsed = Date.parse(post.createdAt);
    return { post, index, time: Number.isNaN(parsed) ? -Infinity : parsed };
  }).sort((a, b) => {
    if (a.time === b.time) return a.index - b.index;
    return a.time > b.time ? -1 : 1;
  }).slice(0, limit).map(({ post }) => post);
}

/** Fail closed before checking administrator or exact author identity.
 * Args:
 *   session: Complete approved local identity.
 *   post: Complete local post to check.
 * Returns:
 *   Whether demo UI may offer an edit affordance; never trusted authorization.
 * @param {*} session Candidate identity.
 * @param {*} post Candidate post.
 * @returns {boolean} Whether the identity may mutate the post.
 */
export function canMutatePost(session, post) {
  return isSession(session) && isPost(post) && (session.role === 'admin' || session.userId === post.authorId);
}
