/** /arcade (the old name) → /training, keeping the rest of the path. */
import { Navigate, useLocation } from 'react-router';

export default function ArcadeRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/^\/arcade/, '/training') + search} replace />;
}
