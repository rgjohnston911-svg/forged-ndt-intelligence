// @ts-nocheck
/**
 * DEPLOY226 - InspectorAdjudicationCard.tsx
 * src/components/InspectorAdjudicationCard.tsx
 *
 * Inspector Adjudication UI. Allows inspectors to:
 *   - CONCUR with the system decision
 *   - OVERRIDE with alternative decision + rationale
 *   - ESCALATE to senior review with priority
 *   - View adjudication history and agreement stats
 *
 * var only. String concatenation only. No backticks.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

var TYPE_CONFIG = {
  concur: { color: "#22c55e", bg: "#22c55e22", label: "CONCUR", icon: "OK", description: "I agree with the system decision" },
  override: { color: "#ef4444", bg: "#ef444422", label: "OVERRIDE", icon: "!!", description: "I disagree — here is my decision" },
  escalate: { color: "#f59e0b", bg: "#f59e0b22", label: "ESCALATE", icon: ">>", description: "This needs senior review" }
};

var PRIORITY_COLOR = {
  routine: "#8b949e",
  elevated: "#f59e0b",
  urgent: "#ef4444",
  emergency: "#dc2626"
};

export default function InspectorAdjudicationCard(props) {
  var caseId = props.caseId;
  var [loading, setLoading] = useState(false);
  var [submitting, setSubmitting] = useState(false);
  var [error, setError] = useState("");
  var [success, setSuccess] = useState("");
  var [history, setHistory] = useState(null);
  var [showForm, setShowForm] = useState(false);
  var [showHistory, setShowHistory] = useState(false);

  // Form state
  var [adjType, setAdjType] = useState("");
  var [rationale, setRationale] = useState("");
  var [overrideDecision, setOverrideDecision] = useState("");
  var [overrideDisposition, setOverrideDisposition] = useState("");
  var [escalateTo, setEscalateTo] = useState("");
  var [escalatePriority, setEscalatePriority] = useState("routine");
  var [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(function() { if (caseId) loadHistory(); }, [caseId]);

  async function loadHistory() {
    setLoading(true);
    try {
      var resp = await fetch("/api/inspector-adjudication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_history", case_id: caseId })
      });
      var json = await resp.json();
      if (json.success) setHistory(json);
    } catch (e) { /* non-critical */ }
    setLoading(false);
  }

  async function submitAdjudication() {
    setSubmitting(true); setError(""); setSuccess("");
    try {
      var session = await supabase.auth.getSession();
      var token = (session.data && session.data.session && session.data.session.access_token) || "";

      var payload = {
        action: "submit",
        case_id: caseId,
        adjudication_type: adjType,
        rationale: rationale,
        additional_notes: additionalNotes || null
      };

      if (adjType === "override") {
        payload.override_decision = overrideDecision;
        payload.override_disposition = overrideDisposition || null;
      }
      if (adjType === "escalate") {
        payload.escalate_to = escalateTo;
        payload.escalation_priority = escalatePriority;
      }

      var resp = await fetch("/api/inspector-adjudication", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
      var json = await resp.json();

      if (json.success) {
        setSuccess("Adjudication recorded: " + adjType.toUpperCase());
        setShowForm(false);
        setAdjType(""); setRationale(""); setOverrideDecision(""); setEscalateTo("");
        await loadHistory();
      } else {
        setError(json.error || "Failed to submit adjudication");
      }
    } catch (e) { setError(String(e)); }
    setSubmitting(false);
  }

  // ---------- styles ----------
  var card = {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    fontFamily: "Inter, system-ui, sans-serif"
  };
  var headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  };
  var titleStyle = { fontSize: 15, fontWeight: 700, color: "#e6edf3", margin: 0 };
  var badge = { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: 1 };
  var btn = {
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  };
  var btnSecondary = {
    background: "#30363d",
    color: "#c9d1d9",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  };
  var inputStyle = {
    width: "100%",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#e6edf3",
    fontSize: 13,
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box"
  };
  var textareaStyle = Object.assign({}, inputStyle, { minHeight: 80, resize: "vertical" });
  var labelStyle = { fontSize: 12, fontWeight: 600, color: "#c9d1d9", marginBottom: 4, display: "block" };

  // ---------- override active banner ----------
  var overrideActive = history && history.current_state && history.current_state.inspector_override_active;
  var effectiveDecision = history && history.current_state ? history.current_state.effective_decision : null;
  var adjudications = history ? (history.adjudications || []) : [];
  var summaryData = history ? (history.summary || {}) : {};

  return (
    <div style={card}>
      {/* Header */}
      <div style={headerStyle}>
        <p style={titleStyle}>Inspector Adjudication</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={Object.assign({}, badge, { background: "#238636", color: "#fff" })}>DETERMINISTIC</span>
          <span style={Object.assign({}, badge, { background: "#30363d", color: "#8b949e" })}>DEPLOY226</span>
        </div>
      </div>

      {/* Override Active Banner */}
      {overrideActive && (
        <div style={{
          background: "#ef444422",
          border: "1px solid #ef4444",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#ef4444" }}>!!</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#ef4444" }}>INSPECTOR OVERRIDE ACTIVE</div>
            <div style={{ fontSize: 12, color: "#c9d1d9" }}>
              {"Inspector has overridden the system decision. Effective decision: " + (effectiveDecision || "unknown")}
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      {history && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#22c55e15", border: "1px solid #22c55e44", borderRadius: 6, padding: "8px 14px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>{summaryData.concurs || 0}</div>
            <div style={{ fontSize: 10, color: "#8b949e" }}>CONCUR</div>
          </div>
          <div style={{ background: "#ef444415", border: "1px solid #ef444444", borderRadius: 6, padding: "8px 14px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{summaryData.overrides || 0}</div>
            <div style={{ fontSize: 10, color: "#8b949e" }}>OVERRIDE</div>
          </div>
          <div style={{ background: "#f59e0b15", border: "1px solid #f59e0b44", borderRadius: 6, padding: "8px 14px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{summaryData.escalations || 0}</div>
            <div style={{ fontSize: 10, color: "#8b949e" }}>ESCALATE</div>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "8px 14px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>
              {summaryData.agreement_rate !== null ? (summaryData.agreement_rate + "%") : "-"}
            </div>
            <div style={{ fontSize: 10, color: "#8b949e" }}>AGREEMENT</div>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</p>}
      {success && <p style={{ color: "#22c55e", fontSize: 12, marginBottom: 8 }}>{success}</p>}

      {/* Adjudication Form */}
      {!showForm ? (
        <button style={btn} onClick={function() { setShowForm(true); setError(""); setSuccess(""); }}>
          Record Adjudication
        </button>
      ) : (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 12 }}>
            Inspector Decision
          </div>

          {/* Type Selection */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["concur", "override", "escalate"].map(function(t) {
              var tc = TYPE_CONFIG[t];
              var isSelected = adjType === t;
              return (
                <button
                  key={t}
                  style={{
                    flex: 1,
                    background: isSelected ? tc.bg : "#161b22",
                    border: "2px solid " + (isSelected ? tc.color : "#30363d"),
                    borderRadius: 8,
                    padding: "10px 8px",
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                  onClick={function() { setAdjType(t); }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? tc.color : "#8b949e" }}>{tc.label}</div>
                  <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{tc.description}</div>
                </button>
              );
            })}
          </div>

          {/* Override fields */}
          {adjType === "override" && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Override Decision *</label>
              <input
                style={inputStyle}
                placeholder="What should the decision be instead?"
                value={overrideDecision}
                onChange={function(e) { setOverrideDecision(e.target.value); }}
              />
              <label style={Object.assign({}, labelStyle, { marginTop: 8 })}>Override Disposition</label>
              <select
                style={inputStyle}
                value={overrideDisposition}
                onChange={function(e) { setOverrideDisposition(e.target.value); }}
              >
                <option value="">Select disposition...</option>
                <option value="accept">Accept</option>
                <option value="reject">Reject</option>
                <option value="monitor">Monitor</option>
                <option value="repair_required">Repair Required</option>
                <option value="review_required">Review Required</option>
              </select>
            </div>
          )}

          {/* Escalation fields */}
          {adjType === "escalate" && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Escalate To *</label>
              <input
                style={inputStyle}
                placeholder="Name or role (e.g., Senior Inspector, Engineering Manager)"
                value={escalateTo}
                onChange={function(e) { setEscalateTo(e.target.value); }}
              />
              <label style={Object.assign({}, labelStyle, { marginTop: 8 })}>Priority</label>
              <div style={{ display: "flex", gap: 6 }}>
                {["routine", "elevated", "urgent", "emergency"].map(function(p) {
                  var pc = PRIORITY_COLOR[p];
                  var isSelected = escalatePriority === p;
                  return (
                    <button
                      key={p}
                      style={{
                        flex: 1,
                        background: isSelected ? pc + "22" : "#161b22",
                        border: "1px solid " + (isSelected ? pc : "#30363d"),
                        borderRadius: 4,
                        padding: "4px 6px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: isSelected ? pc : "#8b949e",
                        cursor: "pointer",
                        textTransform: "uppercase"
                      }}
                      onClick={function() { setEscalatePriority(p); }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rationale (always required) */}
          {adjType && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Rationale * (minimum 10 characters)</label>
              <textarea
                style={textareaStyle}
                placeholder="Explain your reasoning. Why do you concur, disagree, or need escalation?"
                value={rationale}
                onChange={function(e) { setRationale(e.target.value); }}
              />
            </div>
          )}

          {/* Additional Notes */}
          {adjType && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Additional Notes (optional)</label>
              <textarea
                style={Object.assign({}, textareaStyle, { minHeight: 50 })}
                placeholder="Any additional context, references, or observations..."
                value={additionalNotes}
                onChange={function(e) { setAdditionalNotes(e.target.value); }}
              />
            </div>
          )}

          {/* Submit / Cancel */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={Object.assign({}, btn, {
                background: adjType ? (TYPE_CONFIG[adjType] ? TYPE_CONFIG[adjType].color : "#238636") : "#30363d",
                opacity: adjType && rationale.length >= 10 ? 1 : 0.5
              })}
              onClick={submitAdjudication}
              disabled={!adjType || rationale.length < 10 || submitting}
            >
              {submitting ? "Submitting..." : ("Submit " + (adjType ? adjType.charAt(0).toUpperCase() + adjType.slice(1) : ""))}
            </button>
            <button style={btnSecondary} onClick={function() { setShowForm(false); setAdjType(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History (expandable) */}
      {adjudications.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8, cursor: "pointer" }}
            onClick={function() { setShowHistory(!showHistory); }}
          >
            {(showHistory ? "- " : "+ ") + "Adjudication History (" + adjudications.length + ")"}
          </div>
          {showHistory && adjudications.map(function(a, ai) {
            var tc = TYPE_CONFIG[a.type] || TYPE_CONFIG.concur;
            return (
              <div key={ai} style={{
                background: "#0d1117",
                border: "1px solid #21262d",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 6
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 6px",
                      borderRadius: 3, background: tc.bg, color: tc.color,
                      letterSpacing: 0.5
                    }}>{tc.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3" }}>
                      {a.inspector_name || a.inspector_email || "Inspector"}
                    </span>
                    {a.inspector_cert_level && (
                      <span style={{ fontSize: 10, color: "#8b949e" }}>{"(" + a.inspector_cert_level + ")"}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>

                {/* System state at time */}
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>
                  {"System was: " + (a.system_state_at_time || "unknown") +
                   " @ " + (a.system_confidence_at_time ? Math.round(a.system_confidence_at_time * 100) + "%" : "?") + " confidence"}
                </div>

                {/* Override decision */}
                {a.type === "override" && a.override_decision && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", marginBottom: 4 }}>
                    {"Override: " + a.override_decision}
                  </div>
                )}

                {/* Escalation */}
                {a.type === "escalate" && a.escalate_to && (
                  <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 4 }}>
                    {"Escalated to: " + a.escalate_to}
                    {a.escalation_priority && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, marginLeft: 6,
                        padding: "1px 5px", borderRadius: 3,
                        background: (PRIORITY_COLOR[a.escalation_priority] || "#8b949e") + "22",
                        color: PRIORITY_COLOR[a.escalation_priority] || "#8b949e"
                      }}>{a.escalation_priority.toUpperCase()}</span>
                    )}
                  </div>
                )}

                {/* Rationale */}
                <div style={{ fontSize: 12, color: "#c9d1d9", lineHeight: 1.4 }}>
                  {a.rationale}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
