import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { getAuthErrorMessage, useAuth } from "./AuthContext";

export default function ForgotPassword() {
  const { sendPasswordReset, firebaseEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSuccess("If an account exists for this address, a reset link is on its way.");
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="A fresh start."
      description="Enter your email and we’ll send a link to reset your password."
    >
      <form className="auth-form" onSubmit={submit}>
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
        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && <div className="auth-success" role="status">{success}</div>}
        {!firebaseEnabled && (
          <div className="auth-error" role="status">Firebase configuration is required to send a reset link.</div>
        )}
        <button className="auth-submit" disabled={!firebaseEnabled || loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <p className="auth-switch-copy"><Link to="/sign-in">Back to sign in</Link></p>
      </form>
    </AuthLayout>
  );
}