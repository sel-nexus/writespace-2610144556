/** Select local writing and check demo ownership without changing records or storage. */
import { isPost, isRecord, isText, readPosts, savePosts, storageFailure } from './storage.js';
import { isSession, getSession } from './auth.js';

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

/** Collect field errors without coercing submitted values.
 * Args: input contains the proposed title and plain-text content.
 * Returns: Field-specific errors, empty when both fields are usable.
 * @param {*} input Proposed writing.
 * @returns {object} Inline validation errors.
 */
export function validatePost(input) {
  const value = isRecord(input) ? input : {};
  const errors = {};
  if (!isText(value.title)) errors.title = 'Title is required.';
  if (!isText(value.content)) errors.content = 'Content is required.';
  return errors;
}

/** Create a post from fresh browser data and the current local identity.
 * Args: input supplies title and content; extra metadata is ignored.
 * Returns: Saved collection and post, or an explicit failure without a write.
 * @param {*} input Proposed writing.
 * @returns {object} Persistence outcome.
 */
export function createPost(input) {
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { ok: false, code: 'required', errors, message: 'Check the highlighted fields.' };
  const posts = readPosts();
  if (!posts.ok) return posts;
  const session = getSession();
  if (!isSession(session)) return { ok: false, code: 'unauthorized', message: 'Your session is unavailable. Log in before saving.' };
  let post;
  try {
    post = {
      id: crypto.randomUUID(), title: input.title.trim(), content: input.content,
      createdAt: new Date().toISOString(), authorId: session.userId, authorName: session.displayName,
    };
  } catch (error) {
    return storageFailure(error);
  }
  const result = savePosts([...posts.value, post]);
  return result.ok ? { ...result, post } : result;
}

/** Edit only a freshly read post permitted by the current session.
 * Args: id identifies the persisted post; input supplies replacement text only.
 * Returns: Saved collection and post; original identity and author metadata are retained.
 * @param {*} id Target identity.
 * @param {*} input Proposed writing.
 * @returns {object} Persistence outcome.
 */
export function editPost(id, input) {
  const posts = readPosts();
  if (!posts.ok) return posts;
  const existing = posts.value.find((post) => post.id === id);
  if (!existing) return { ok: false, code: 'not_found', message: 'Post not found' };
  if (!canMutatePost(getSession(), existing)) {
    return { ok: false, code: 'unauthorized', message: 'You cannot change this post with your current session.' };
  }
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { ok: false, code: 'required', errors, message: 'Check the highlighted fields.' };
  const post = { ...existing, title: input.title.trim(), content: input.content };
  const result = savePosts(posts.value.map((value) => value.id === id ? post : value));
  return result.ok ? { ...result, post } : result;
}

/** Remove a permitted current post only after explicit accepted confirmation.
 * Args: id identifies the target; confirmed must be exactly true.
 * Returns: Saved collection, cancellation, or an explicit denial/storage failure.
 * @param {*} id Target identity.
 * @param {boolean} confirmed Accepted destructive action.
 * @returns {object} Persistence outcome.
 */
export function deletePost(id, confirmed = false) {
  if (confirmed !== true) return { ok: false, code: 'cancelled', message: 'Deletion cancelled.' };
  const posts = readPosts();
  if (!posts.ok) return posts;
  const existing = posts.value.find((post) => post.id === id);
  if (!existing) return { ok: false, code: 'not_found', message: 'Post not found' };
  if (!canMutatePost(getSession(), existing)) {
    return { ok: false, code: 'unauthorized', message: 'You cannot change this post with your current session.' };
  }
  return savePosts(posts.value.filter((post) => post.id !== id));
}
