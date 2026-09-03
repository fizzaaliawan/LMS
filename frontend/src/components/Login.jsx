import { useState } from "react";
import { api, setToken } from "../api.js";

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.signup(email, password, role);
      }
      const { access_token } = await api.login(email, password);
      setToken(access_token);
      const me = await api.me();
      onLoggedIn(me);
    } catch (err) {
      const message = err?.message || "Something went wrong";
      const friendly = message === "Failed to fetch"
        ? "The library API is not reachable. Please make sure the backend is running on port 8000."
        : message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div className="glass-card animate-fade-in" style={{ width: "100%", maxWidth: 400, border: "1px solid var(--border-color)", padding: "2.5rem 2rem", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.35rem", color: "var(--color-navy)", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Library Management System
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Portal Access
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.25rem", background: "rgba(11, 26, 48, 0.04)", padding: "0.25rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
          <button 
            type="button"
            onClick={() => { setMode("login"); setError(""); }} 
            className="btn-secondary"
            style={{ 
              flex: 1, 
              padding: "0.5rem", 
              fontSize: "0.85rem",
              background: mode === "login" ? "var(--color-navy)" : "transparent",
              borderColor: "transparent",
              color: mode === "login" ? "#ffffff" : "var(--text-secondary)",
              boxShadow: mode === "login" ? "var(--shadow-sm)" : "none"
            }}
          >
            Log In
          </button>
          <button 
            type="button"
            onClick={() => { setMode("signup"); setError(""); }} 
            className="btn-secondary"
            style={{ 
              flex: 1, 
              padding: "0.5rem", 
              fontSize: "0.85rem",
              background: mode === "signup" ? "var(--color-navy)" : "transparent",
              borderColor: "transparent",
              color: mode === "signup" ? "#ffffff" : "var(--text-secondary)",
              boxShadow: mode === "signup" ? "var(--shadow-sm)" : "none"
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "signup" && (
            <div className="form-group">
              <label className="form-label">Account Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Library Member</option>
                <option value="librarian">Librarian Staff</option>
              </select>
            </div>
          )}

          {error && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.75rem", borderRadius: "var(--radius-sm)", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "0.8rem", marginBottom: "1.25rem", border: "1px solid rgba(155, 44, 44, 0.15)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontWeight: 500 }}>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className="btn-primary" 
            style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem" }}
          >
            {loading ? (
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: "#ffffff" }}></span>
            ) : mode === "signup" ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
