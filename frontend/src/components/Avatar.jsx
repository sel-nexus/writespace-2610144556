/** Present the explicitly specified static role avatars without state changes. */
import PropTypes from 'prop-types';

/** Render a decorative avatar alongside a separately labeled identity. */
export function Avatar({ role }) {
  const styles = { admin: 'bg-violet-600', user: 'bg-indigo-500' };
  const glyphs = { admin: '👑', user: '📖' };
  return (
    <span aria-hidden="true" className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles[role] || styles.user}`}>
      {glyphs[role] || glyphs.user}
    </span>
  );
}
Avatar.propTypes = { role: PropTypes.oneOf(['admin', 'user']).isRequired };

/** Return static JSX for consumers that need the source-specified role helper. */
export function getAvatar(role) {
  return <Avatar role={role === 'admin' ? 'admin' : 'user'} />;
}
