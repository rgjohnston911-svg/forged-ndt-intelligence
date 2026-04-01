import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import MethodBadge from "../components/MethodBadge";
import { DISPOSITION_COLORS } from "../lib/constants";

export default function Cases() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.org_id) return;
    loadCases();
  }, [profile?.org_id, methodFilter]);

  async function loadCases() {
    setLoading(true);
    let query = supabase
      .from("inspection_cases")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("updated_at", { ascending: false });

    if (methodFilter !== "ALL") {
      query = query.eq("method", methodFilter);
    }

    const { data } = await query;
    setCases(data || []);
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Inspection Cases</h1>
        <Link to="/cases/new" className="btn-primary">+ New Case</Link>
      </div>

      <div className="filter-bar">
        {["ALL", "VT", "PT", "MT", "UT", "RT", "ET"].map((m) => (
          <button
            key={m}
            className={"filter-btn" + (methodFilter === m ? " filter-active" : "")}
            onClick={() => setMethodFilter(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="empty-state"><p>No cases found.</p></div>
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
