import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { getAuthErrorMessage, useAuth } from "./AuthContext";
import GoogleIcon from "./GoogleIcon";

export default function SignIn() {
  const {
    signIn,
    signInWithGoogle,
    firebaseEnabled,
    firebaseGoogleEnabled,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice] = useState(
    location.state?.signedOut ? "You have successfully signed out." : "",
  );
  const destination = location.state?.from || "/";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password, rememberMe);
      navigate(destination, { replace: true });
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setError("");
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      console.log("Signed in with Google:", user?.email);
      navigate(destination, { replace: true });
    } catch (authError) {
      console.error("Google sign-in error:", authError);
      const code = authError?.code;
      const msg = getAuthErrorMessage(authError);
      setError(code ? `${msg} (${code})` : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back."
      description="Sign in to return to your private space."
    >
      <div className="auth-form">
        {notice && <div className="auth-success" role="status">{notice}</div>}
        {location.state?.verificationSent && (
          <div className="auth-success" role="status">
            Your account is ready. Check your inbox for the verification email.
          </div>
        )}
        {error && <div className="auth-error" role="alert">{error}</div>}
        {!firebaseEnabled && (
          <div className="auth-error" role="status">
            Add the Firebase web app settings from <code>.env.example</code> to enable sign-in.
          </div>
        )}

        {firebaseGoogleEnabled && (
          <div className="auth-google-section">
            <button
              type="button"
              className="auth-google"
              disabled={!firebaseEnabled || loading}
              onClick={googleSignIn}
            >
              <GoogleIcon size={18} />
              <span>Continue with Google</span>
            </button>
            <div className="auth-divider"><span>or sign in with email</span></div>
          </div>
        )}

        <form onSubmit={submit} className="auth-form" style={{ gap: "16px" }}>
          <label className="auth-field">
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label-row">
              <span>Password</span>
              <Link to="/forgot-password">Forgot password?</Link>
            </span>
            <span className="auth-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                aria-label="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <label className="auth-check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Remember me on this device</span>
          </label>
          <button className="auth-submit" disabled={!firebaseEnabled || loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch-copy">
          New to MindMate? <Link to="/sign-up" state={location.state}>Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
