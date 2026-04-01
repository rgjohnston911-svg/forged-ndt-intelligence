import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "\u25A3" },
  { path: "/cases", label: "Cases", icon: "\u25C9" },
  { path: "/cases/new", label: "New Case", icon: "+" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <Link to="/" className="logo-link">
            <span className="logo-text">FORGED</span>
            <span className="logo-sub">NDT Intelligence OS</span>
          </Link>
        </div>
        <nav className="header-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={
                "nav-link" +
                (location.pathname === item.path ? " nav-active" : "")
              }
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-right">
          <span className="user-name">
            {profile?.full_name || profile?.email || "User"}
          </span>
          <button className="btn-text" onClick={() => signOut()}>
            Sign Out
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
