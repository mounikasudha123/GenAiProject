import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AuthLoading() {
  return (
    <main className="auth-loading" role="status" aria-live="polite">
      <span className="auth-loading-mark" aria-hidden="true" />
      <span>Opening your private space…</span>
    </main>
  );
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!user)
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  return children;
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (user)
    return (
      <Navigate
        to={location.state?.from || "/"}
        replace
      />
    );
  return children;
}