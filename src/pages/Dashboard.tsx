// @ts-nocheck
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import MethodBadge from "../components/MethodBadge";
import { DISPOSITION_COLORS } from "../lib/constants";

function timeAgo(dateStr: string) {
  var seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  var days = Math.floor(hours / 24);
  if (days < 30) return days + "d ago";
  return new Date(dateStr).toLocaleDateString();
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    methods: {} as Record<string, number>,
    dispositions: {} as Record<string, number>,
    thisWeek: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.org_id) { setLoading(false); return; }
    loadDashboard();
  }, [profile?.org_id]);

  async function loadDashboard() {
    setLoading(true);
    try {

    const { data: caseData } = await supabase
      .from("inspection_cases")
      .select("id, case_number, title, method, status, final_disposition, final_confidence, created_at, updated_at")
      .eq("org_id", profile.org_id)
      .order("updated_at", { ascending: false })
      .limit(8);

    const allCases = caseData || [];
    setCases(allCases);

    const { data: allForStats } = await supabase
      .from("inspection_cases")
      .select("method, final_disposition, status, created_at")
      .eq("org_id", profile.org_id);

    const methods: Record<string, number> = {};
    const dispositions: Record<string, number> = {};
    var thisWeek = 0;
    var completed = 0;
    var weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    (allForStats || []).forEach((c: any) => {
      methods[c.method] = (methods[c.method] || 0) + 1;
      if (c.final_disposition) {
        dispositions[c.final_disposition] = (dispositions[c.final_disposition] || 0) + 1;
      }
      if (new Date(c.created_at) >= weekAgo) thisWeek++;
      if (c.status === "completed" || c.status === "closed") completed++;
    });

    setStats({
      total: (allForStats || []).length,
      methods,
      dispositions,
      thisWeek,
      completed,
    });
    } catch (e) { console.error("Dashboard load failed:", e); } finally { setLoading(false); }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  var firstName = (profile?.full_name || "").split(" ")[0] || "Inspector";

  return (
    <div className="page dashboard-page">
      {/* Welcome header */}
      <div className="dash-welcome">
        <div className="dash-welcome-text">
          <h1>Welcome back, {firstName}</h1>
          <p className="dash-welcome-sub">Here&apos;s what&apos;s happening with your inspections.</p>
        </div>
        <Link to="/cases/new" className="btn-primary dash-new-case-btn">
          + New Case
        </Link>
      </div>

      {/* Stats row */}
      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-icon-blue">&#x25A3;</div>
          <div className="dash-stat-info">
            <div className="dash-stat-value">{stats.total}</div>
            <div className="dash-stat-label">Total Cases</div>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-icon-green">&#x2713;</div>
          <div className="dash-stat-info">
            <div className="dash-stat-value">{stats.completed}</div>
            <div className="dash-stat-label">Completed</div>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-icon-purple">&#x25C9;</div>
          <div className="dash-stat-info">
            <div className="dash-stat-value">{stats.thisWeek}</div>
            <div className="dash-stat-label">This Week</div>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-icon-orange">&#x2699;</div>
          <div className="dash-stat-info">
            <div className="dash-stat-value">{Object.keys(stats.methods).length}</div>
            <div className="dash-stat-label">Methods Used</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="dash-quick-actions">
        <Link to="/cases/new" className="dash-quick-action">
          <span className="dash-qa-icon">&#x2795;</span>
          <span className="dash-qa-label">New Case</span>
        </Link>
        <Link to="/voice" className="dash-quick-action">
          <span className="dash-qa-icon">&#x1F399;</span>
          <span className="dash-qa-label">Voice Inspect</span>
        </Link>
        <Link to="/cases" className="dash-quick-action">
          <span className="dash-qa-icon">&#x1F4CB;</span>
          <span className="dash-qa-label">All Cases</span>
        </Link>
      </div>

      {/* Methods breakdown + Recent cases in two-column layout */}
      <div className="dash-grid">
        {/* Methods breakdown */}
        {Object.keys(stats.methods).length > 0 && (
          <div className="dash-panel">
            <h3 className="dash-panel-title">By Method</h3>
            <div className="dash-method-list">
              {Object.entries(stats.methods)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([method, count]) => (
                  <div key={method} className="dash-method-row">
                    <MethodBadge method={method} size="sm" />
                    <div className="dash-method-bar-track">
                      <div
                        className="dash-method-bar-fill"
                        style={{ width: Math.max(4, ((count as number) / stats.total * 100)) + "%" }}
                      />
                    </div>
                    <span className="dash-method-count">{count as number}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Dispositions breakdown */}
        {Object.keys(stats.dispositions).length > 0 && (
          <div className="dash-panel">
            <h3 className="dash-panel-title">Dispositions</h3>
            <div className="dash-disp-list">
              {Object.entries(stats.dispositions)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([disp, count]) => (
                  <div key={disp} className="dash-disp-row">
                    <span
                      className="dash-disp-dot"
                      style={{ backgroundColor: DISPOSITION_COLORS[disp] || "#8b949e" }}
                    />
                    <span className="dash-disp-name">
                      {disp.replace(/_/g, " ")}
                    </span>
                    <span className="dash-disp-count">{count as number}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent cases */}
      <div className="dash-recent">
        <div className="dash-recent-header">
          <h3 className="dash-panel-title">Recent Cases</h3>
          <Link to="/cases" className="dash-view-all">View all &rarr;</Link>
        </div>

        {cases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#x1F50D;</div>
            <p>No inspection cases yet.</p>
            <p className="empty-state-sub">Create your first case to get started with FORGED.</p>
            <Link to="/cases/new" className="btn-primary">Create Your First Case</Link>
          </div>
        ) : (
          <div className="dash-case-grid">
            {cases.map((c) => (
              <Link key={c.id} to={"/cases/" + c.id} className="dash-case-card">
                <div className="dash-case-top">
                  <span className="dash-case-number">{c.case_number}</span>
                  <MethodBadge method={c.method} size="sm" />
                </div>
                <div className="dash-case-title">{c.title}</div>
                <div className="dash-case-bottom">
                  <span className="dash-case-status">{c.status.replace(/_/g, " ")}</span>
                  {c.final_disposition && (
                    <span className="dash-case-disp" style={{ color: DISPOSITION_COLORS[c.final_disposition] || "#8b949e" }}>
                      {c.final_disposition.replace(/_/g, " ")}
                    </span>
                  )}
                  <span className="dash-case-time">{timeAgo(c.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
