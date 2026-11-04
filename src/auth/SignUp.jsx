import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { getAuthErrorMessage, useAuth } from "./AuthContext";

function getPasswordStrength(password) {
  if (!password) return 0;
  return [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
}

export default function SignUp() {
  const { signUp, firebaseEnabled } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = getPasswordStrength(password);
  const destination = location.state?.from || "/";

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      await signUp({ displayName, email, password });
      navigate(destination, { replace: true, state: { verificationSent: true } });
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Make a little space."
      description="Create your account for a private place to reflect."
    >
      <form className="auth-form" onSubmit={submit}>
        <label className="auth-field">
          Full name
          <input
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
          />
        </label>
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
          Password
          <span className="auth-password-wrap">
            <input
              type={showPassword ? "text" : "password"}
              aria-label="Password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
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
          <span className="password-strength" aria-live="polite">
            <span className="strength-track">
              {[1, 2, 3, 4].map((step) => (
                <span className={strength >= step ? `strength-${strength}` : ""} key={step} />
              ))}
            </span>
            <span>{!password ? "Use 8 or more characters" : ["","Needs work","Fair","Good","Strong"][strength]}</span>
          </span>
        </label>
        <label className="auth-field">
          Confirm password
          <input
            type="password"
            aria-label="Confirm password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Enter your password again"
          />
        </label>
        <label className="auth-check auth-terms">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span>I agree to the Terms and Privacy Policy.</span>
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {!firebaseEnabled && (
          <div className="auth-error" role="status">
            Add the Firebase web app settings from <code>.env.example</code> to enable account creation.
          </div>
        )}
        <button className="auth-submit" disabled={!firebaseEnabled || loading}>
          {loading ? "Creating your account…" : "Create account"}
        </button>
        <p className="auth-switch-copy">
          Already have an account? <Link to="/sign-in" state={location.state}>Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}