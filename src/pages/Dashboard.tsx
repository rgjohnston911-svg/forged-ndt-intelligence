import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import MethodBadge from "../components/MethodBadge";
import { DISPOSITION_COLORS } from "../lib/constants";

export default function Dashboard() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, methods: {} as Record<string, number>, dispositions: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.org_id) return;
    loadDashboard();
  }, [profile?.org_id]);

  async function loadDashboard() {
    setLoading(true);

    const { data: caseData } = await supabase
      .from("inspection_cases")
      .select("id, case_number, title, method, status, final_disposition, final_confidence, created_at, updated_at")
      .eq("org_id", profile.org_id)
      .order("updated_at", { ascending: false })
      .limit(10);

    const allCases = caseData || [];
    setCases(allCases);

    const { data: allForStats } = await supabase
      .from("inspection_cases")
      .select("method, final_disposition")
      .eq("org_id", profile.org_id);

    const methods: Record<string, number> = {};
    const dispositions: Record<string, number> = {};
    (allForStats || []).forEach((c: any) => {
      methods[c.method] = (methods[c.method] || 0) + 1;
      if (c.final_disposition) {
        dispositions[c.final_disposition] = (dispositions[c.final_disposition] || 0) + 1;
      }
    });

    setStats({ total: (allForStats || []).length, methods, dispositions });
    setLoading(false);
  }

  if (loading) {
    return <div className="page-loading">Loading dashboard...</div>;
  }

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/cases/new" className="btn-primary">+ New Case</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Cases</div>
        </div>
        {Object.entries(stats.methods).map(([method, count]) => (
          <div key={method} className="stat-card">
            <div className="stat-value">{count}</div>
            <div className="stat-label"><MethodBadge method={method} size="sm" /></div>
          </div>
        ))}
      </div>

      <h2>Recent Cases</h2>
      {cases.length === 0 ? (
        <div className="empty-state">
          <p>No inspection cases yet.</p>
          <Link to="/cases/new" className="btn-primary">Create Your First Case</Link>
        </div>
      ) : (
        <div className="case-list">
          {cases.map((c) => (
            <Link key={c.id} to={"/cases/" + c.id} className="case-card">
              <div className="case-card-header">
                <span className="case-number">{c.case_number}</span>
                <MethodBadge method={c.method} size="sm" />
              </div>
              <div className="case-card-title">{c.title}</div>
              <div className="case-card-footer">
                <span className="case-status">{c.status.replace(/_/g, " ")}</span>
                {c.final_disposition && (
                  <span className="case-disposition" style={{ color: DISPOSITION_COLORS[c.final_disposition] || "#333" }}>
                    {c.final_disposition.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
