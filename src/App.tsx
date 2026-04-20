// @ts-nocheck
import { Routes, Route, Navigate } from "react-router-dom";
import { Component } from "react";
import { useAuth } from "./lib/auth";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import NewCase from "./pages/NewCase";
import CaseDetail from "./pages/CaseDetail";
import VoiceInspectionPage from "./pages/VoiceInspectionPage";

// Error Boundary — catches any render crash and shows recovery UI instead of black screen
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, info) {
    console.error("FORGED Error Boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#0d1117", color: "#e6edf3", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>!</div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>Something went wrong</h2>
          <p style={{ color: "#8b949e", fontSize: "13px", maxWidth: "400px", marginBottom: "20px" }}>
            A component crashed while rendering. This is usually caused by missing data on an older case.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={function() { window.location.href = "/"; }}
              style={{ padding: "8px 20px", fontSize: "13px", backgroundColor: "#238636", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
            >
              Back to Dashboard
            </button>
            <button
              onClick={function() { window.location.href = "/cases"; }}
              style={{ padding: "8px 20px", fontSize: "13px", backgroundColor: "#30363d", color: "#e6edf3", border: "1px solid #484f58", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
            >
              Back to Cases
            </button>
          </div>
          <details style={{ marginTop: "24px", color: "#8b949e", fontSize: "11px", maxWidth: "500px", textAlign: "left" }}>
            <summary style={{ cursor: "pointer" }}>Error details</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: "8px", padding: "12px", backgroundColor: "#161b22", borderRadius: "6px", border: "1px solid #30363d" }}>
              {this.state.error ? String(this.state.error) : "Unknown error"}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  var auth = useAuth();
  var user = auth.user;
  var loading = auth.loading;
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading NDT Intelligence OS...</p>
      </div>
    );
  }
  if (!user) {
    return <Login />;
  }
  return (
    <ErrorBoundary>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/new" element={<NewCase />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/voice" element={<VoiceInspectionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </ErrorBoundary>
  );
}
