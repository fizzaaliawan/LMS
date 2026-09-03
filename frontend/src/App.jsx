import { Component, useEffect, useState } from "react";

import { api, setToken } from "./api.js";
import Catalog from "./components/Catalog.jsx";
import Login from "./components/Login.jsx";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ color: "#f43f5e" }}>Something went wrong</h1>
          <p style={{ color: "#a3b0a7", maxWidth: "500px" }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#67756d", fontFamily: "monospace" }}>
            Check the browser console (F12) for more details
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    // On load, if a token is already stored, try to resume the session
    // instead of forcing a fresh login every page refresh.
    console.log("Checking session...");
    api
      .me()
      .then((u) => {
        console.log("Session user:", u);
        setUser(u);
      })
      .catch((err) => {
        console.error("Session check failed:", err);
        setToken(null);
      })
      .finally(() => {
        console.log("Session check complete");
        setCheckedSession(true);
      });
  }, []);

  function handleLogout() {
    setToken(null);
    setUser(null);
  }

  return (
    <ErrorBoundary>
      {!checkedSession ? null : !user ? (
        <Login onLoggedIn={setUser} />
      ) : (
        <Catalog user={user} onLogout={handleLogout} />
      )}
    </ErrorBoundary>
  );
}

