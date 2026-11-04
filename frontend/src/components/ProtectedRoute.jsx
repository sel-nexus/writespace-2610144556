/** Apply demo route usability checks; browser roles are not trusted security. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession } from '../utils/auth.js';

/** Re-read identity on render so stale parent snapshots never permit a protected route. */
export function ProtectedRoute({ children, adminOnly = false }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}
ProtectedRoute.propTypes = { children: PropTypes.node.isRequired, adminOnly: PropTypes.bool };
