// @ts-nocheck
/**
 * DEPLOY217 - PlannerAgentCard.tsx
 * src/components/PlannerAgentCard.tsx
 *
 * UI surface for the rule-based planner-agent. Reads the action_plan
 * column on inspection_cases (populated by /api/planner-agent) and
 * renders a prioritized, owner-assigned action list with rationale.
 *
 * Why this matters: the Decision Spine answers "what does the machine
 * believe and can you prove it." The Planner-Agent answers "so what do
 * I, the inspector / engineer / supervisor, do RIGHT NOW to close this
 * case?" Together they convert raw findings into auditable next steps.
 *
 * Mount on the Decision tab in CaseDetail.tsx, below DecisionSpineCard.
 *
 * No backticks. var only. String concatenation only.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

var PRIORITY_COLOR = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#8b949e",
  info: "#6b7280"
};

var STATUS_COLOR = {
  ready_to_lock: "#22c55e",
  actions_required: "#f59e0b",
  escalate: "#ef4444",
  unknown: "#8b949e"
};

var STATUS_LABEL = {
  ready_to_lock: "READY TO LOCK",
  actions_required: "ACTIONS REQUIRED",
  escalate: "ESCALATE",
  unknown: "UNKNOWN"
};

function ownerLabel(o) {
  if (!o) return "unassigned";
  return o.replace(/_/g, " ");
}

export default function PlannerAgentCard(props) {
  var caseId = props.caseId;
  var [running, setRunning] = useState(false);
  var [error, setError] = useState("");
  var [plan, setPlan] = useState(null);
  var [generatedAt, setGeneratedAt] = useState(null);

  useEffect(function() {
    if (!caseId) return;
    loadExisting();
  }, [caseId]);

  async function loadExisting() {
    var res = await supabase
      .from("inspection_cases")
      .select("action_plan, action_plan_generated_at, action_plan_status")
      .eq("id", caseId)
      .single();
    if (!res.error && res.data && res.data.action_plan) {
      setPlan(res.data.action_plan);
      setGeneratedAt(res.data.action_plan_generated_at);
    }
  }

  async function runPlanner() {
    setRunning(true);
    setError("");
    try {
      var resp = await fetch("/api/planner-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var json = await resp.json();
      if (!resp.ok || !json.success) {
        setError(json.error || "Planner run failed");
      } else {
        setPlan(json.plan);
        setGeneratedAt(json.generated_at);
      }
    } catch (err) {
      setError("Network error: " + String(err));
    }
    setRunning(false);
  }

  var status = plan && plan.status;
  var actions = (plan && plan.actions) || [];

  return (
    <div style={{ marginTop: "16px", padding: "14px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div>
          <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "14px" }}>Planner Agent</h3>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>
            Prioritized next-step actions &middot; owner-assigned &middot; rationale-bearing
          </div>
        </div>
        <button
          type="button"
          onClick={runPlanner}
          disabled={running}
          style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: running ? "#374151" : "#1f6feb", color: "#fff", border: "none", borderRadius: "4px", cursor: running ? "wait" : "pointer" }}>
          {running ? "Planning..." : (plan ? "Re-plan" : "Run planner")}
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 10px", backgroundColor: "#7f1d1d44", border: "1px solid #ef4444", borderRadius: "4px", color: "#fecaca", fontSize: "11px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {!plan && !running && !error && (
        <div style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic" }}>
          No action plan generated yet. Click "Run planner" after the Decision Spine has produced a signed bundle.
        </div>
      )}

      {plan && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
            <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid " + (STATUS_COLOR[status] || "#30363d") }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Status</div>
              <div style={{ fontSize: "12px", color: STATUS_COLOR[status] || "#c9d1d9", fontWeight: 700 }}>{STATUS_LABEL[status] || "UNKNOWN"}</div>
            </div>
            <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Actions</div>
              <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{actions.length}</div>
            </div>
            {generatedAt && (
              <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Generated</div>
                <div style={{ fontSize: "11px", color: "#c9d1d9" }}>{new Date(generatedAt).toLocaleString()}</div>
              </div>
            )}
          </div>

          {plan.summary && (
            <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", color: "#c9d1d9", fontSize: "12px", lineHeight: "1.55", marginBottom: "10px" }}>
              {plan.summary}
            </div>
          )}

          {actions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {actions.map(function(a, idx) {
                var pcolor = PRIORITY_COLOR[a.priority] || "#8b949e";
                return (
                  <div key={a.action_id || idx} style={{ padding: "10px 12px", backgroundColor: "#161b22", border: "1px solid #30363d", borderLeft: "3px solid " + pcolor, borderRadius: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "4px" }}>
                      <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{a.title}</div>
                      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                        <span style={{ padding: "2px 6px", fontSize: "9px", color: "#fff", backgroundColor: pcolor, borderRadius: "3px", textTransform: "uppercase", fontWeight: 700 }}>
                          {a.priority}
                        </span>
                        <span style={{ padding: "2px 6px", fontSize: "9px", color: "#c9d1d9", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "3px" }}>
                          {ownerLabel(a.owner_role)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: "#8b949e", lineHeight: "1.5", marginBottom: "6px" }}>
                      {a.rationale}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "10px", color: "#6b7280" }}>
                      {a.expected_information_gain && (
                        <span><span style={{ color: "#58a6ff" }}>gain:</span> {a.expected_information_gain}</span>
                      )}
                      {a.estimated_effort && (
                        <span><span style={{ color: "#58a6ff" }}>effort:</span> {a.estimated_effort}</span>
                      )}
                      {a.source_check_id && (
                        <span><span style={{ color: "#58a6ff" }}>source:</span> {a.source_check_id}</span>
                      )}
                      {a.references && a.references.length > 0 && (
                        <span><span style={{ color: "#58a6ff" }}>refs:</span> {a.references.join(", ")}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {plan.inputs_considered && (
            <details style={{ marginTop: "10px" }}>
              <summary style={{ fontSize: "10px", color: "#8b949e", cursor: "pointer" }}>Inputs considered</summary>
              <pre style={{ fontSize: "10px", color: "#8b949e", backgroundColor: "#0d1117", padding: "8px", borderRadius: "4px", marginTop: "6px", overflow: "auto" }}>
                {JSON.stringify(plan.inputs_considered, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
