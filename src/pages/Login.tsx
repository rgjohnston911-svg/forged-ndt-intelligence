// @ts-nocheck
import { useState, useMemo } from "react";
import { useAuth } from "../lib/auth";

function getPasswordStrength(pw: string) {
  if (!pw) return { score: 0, label: "", color: "" };
  var score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: "Weak", color: "#f85149" };
  if (score <= 2) return { score: 2, label: "Fair", color: "#f78166" };
  if (score <= 3) return { score: 3, label: "Good", color: "#d29922" };
  if (score <= 4) return { score: 4, label: "Strong", color: "#3fb950" };
  return { score: 5, label: "Excellent", color: "#58a6ff" };
}

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  var strength = useMemo(function() { return getPasswordStrength(password); }, [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error: err } = await signIn(email, password);
        if (err) setError(err.message);
      } else {
        if (strength.score < 2) {
          setError("Please choose a stronger password.");
          setLoading(false);
          return;
        }
        const { error: err } = await signUp(email, password, fullName);
        if (err) setError(err.message);
        else setSuccess("Account created! Check your email to confirm.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }

    setLoading(false);
  }

  return (
    <div className="login-page">
      {/* Background decoration */}
      <div className="login-bg-glow" />

      <div className="login-container">
        {/* Left panel — branding */}
        <div className="login-brand-panel">
          <div className="login-brand-content">
            <a href="/landing.html" className="login-back-link">&larr; Back to home</a>
            <h1 className="login-brand-logo">FORGED</h1>
            <p className="login-brand-tagline">NDT Intelligence OS</p>
            <div className="login-brand-divider" />
            <p className="login-brand-desc">
              AI-powered inspection intelligence with 142+ diagnostic engines
              and 97%+ validated accuracy across 6 industrial domains.
            </p>
            <div className="login-brand-stats">
              <div className="login-brand-stat">
                <span className="login-brand-stat-value">142+</span>
                <span className="login-brand-stat-label">Engines</span>
              </div>
              <div className="login-brand-stat">
                <span className="login-brand-stat-value">97%+</span>
                <span className="login-brand-stat-label">Accuracy</span>
              </div>
              <div className="login-brand-stat">
                <span className="login-brand-stat-value">&lt;30s</span>
                <span className="login-brand-stat-label">Diagnosis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="login-form-panel">
          <div className="login-card">
            <div className="login-header">
              <h2 className="login-title">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="login-subtitle">
                {mode === "login"
                  ? "Sign in to access your inspection workspace"
                  : "Get started with FORGED in minutes"}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <>
                  <div className="form-group">
                    <label htmlFor="fullName">Full Name</label>
                    <input
                      id="fullName"
                      type="text"
                      placeholder="John Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="company">Company <span className="optional-tag">(optional)</span></label>
                    <input
                      id="company"
                      type="text"
                      placeholder="Acme Inspections LLC"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      autoComplete="organization"
                    />
                  </div>
                </>
              )}
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder={mode === "login" ? "Enter your password" : "Min. 6 characters"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                {mode === "register" && password.length > 0 && (
                  <div className="password-strength">
                    <div className="strength-bar-track">
                      <div
                        className="strength-bar-fill"
                        style={{
                          width: (strength.score / 5 * 100) + "%",
                          backgroundColor: strength.color
                        }}
                      />
                    </div>
                    <span className="strength-label" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {error && <div className="form-error">{error}</div>}
              {success && <div className="form-success">{success}</div>}

              <button type="submit" className="btn-login-submit" disabled={loading}>
                {loading ? (
                  <span className="btn-loading">
                    <span className="btn-spinner" />
                    {mode === "login" ? "Signing in..." : "Creating account..."}
                  </span>
                ) : (
                  mode === "login" ? "Sign In" : "Create Account"
                )}
              </button>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <p className="login-toggle">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                className="btn-text"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
