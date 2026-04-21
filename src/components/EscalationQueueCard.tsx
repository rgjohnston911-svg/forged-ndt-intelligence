// @ts-nocheck
/**
 * DEPLOY228 - EscalationQueueCard.tsx
 * src/components/EscalationQueueCard.tsx
 *
 * Escalation Workflow UI for individual cases.
 * Shows active escalations, history, and resolution controls.
 */

import { useState, useEffect } from "react";

var API_BASE = "/api/escalation-workflow";

function post(body) {
  return fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); });
}

var cardStyle = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "16px",
  color: "#e6edf3"
};

var inputStyle = {
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#e6edf3",
  fontSize: "13px",
  width: "100%"
};

var selectStyle = {
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#e6edf3",
  fontSize: "13px",
  width: "100%",
  cursor: "pointer"
};

var btnStyle = {
  padding: "8px 16px",
  borderRadius: "6px",
  border: "none",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer"
};

function badgeStyle(color) {
  return {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.5px",
    background: color + "22",
    color: color,
    border: "1px solid " + color + "44"
  };
}

function priorityColor(p) {
  if (p === "emergency") return "#ef4444";
  if (p === "urgent") return "#f59e0b";
  if (p === "elevated") return "#3b82f6";
  return "#8b949e";
}

function statusColor(s) {
  if (s === "open") return "#f59e0b";
  if (s === "assigned") return "#3b82f6";
  if (s === "in_review") return "#a855f7";
  if (s === "resolved") return "#22c55e";
  if (s === "expired") return "#ef4444";
  if (s === "cancelled") return "#6e7681";
  return "#8b949e";
}

function resolutionColor(r) {
  if (r === "upheld") return "#22c55e";
  if (r === "overturned") return "#ef4444";
  if (r === "modified") return "#f59e0b";
  if (r === "deferred") return "#8b949e";
  return "#8b949e";
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + "m ago";
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  var days = Math.floor(hours / 24);
  return days + "d ago";
}

function timeUntil(dateStr) {
  if (!dateStr) return "";
  var diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return "OVERDUE";
  var hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) {
    var mins = Math.floor(diff / 60000);
    return mins + "m remaining";
  }
  if (hours < 24) return hours + "h remaining";
  var days = Math.floor(hours / 24);
  return days + "d remaining";
}

export default function EscalationQueueCard(props) {
  var caseId = props.caseId;

  var escalationsState = useState([]);
  var escalations = escalationsState[0];
  var setEscalations = escalationsState[1];

  var loadingState = useState(true);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var expandedState = useState(true);
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];

  var showResolveState = useState(null);
  var showResolve = showResolveState[0];
  var setShowResolve = showResolveState[1];

  var showAssignState = useState(null);
  var showAssign = showAssignState[0];
  var setShowAssign = showAssignState[1];

  // Resolve form state
  var resTypeState = useState("upheld");
  var resType = resTypeState[0];
  var setResType = resTypeState[1];

  var resDecisionState = useState("");
  var resDecision = resDecisionState[0];
  var setResDecision = resDecisionState[1];

  var resRationaleState = useState("");
  var resRationale = resRationaleState[0];
  var setResRationale = resRationaleState[1];

  // Assign form state
  var assignToState = useState("");
  var assignTo = assignToState[0];
  var setAssignTo = assignToState[1];

  var assignNameState = useState("");
  var assignName = assignNameState[0];
  var setAssignName = assignNameState[1];

  function loadEscalations() {
    setLoading(true);
    post({ action: "get_case_escalations", case_id: caseId }).then(function(data) {
      setEscalations(data.escalations || []);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() {
    if (caseId) loadEscalations();
  }, [caseId]);

  function handleResolve(escalationId) {
    if (!resRationale || resRationale.length < 10) {
      alert("Rationale must be at least 10 characters");
      return;
    }
    post({
      action: "resolve",
      escalation_id: escalationId,
      resolution_type: resType,
      resolution_decision: resDecision,
      resolution_rationale: resRationale,
      resolved_by: "current_user",
      resolved_by_name: "Inspector"
    }).then(function() {
      setShowResolve(null);
      setResType("upheld");
      setResDecision("");
      setResRationale("");
      loadEscalations();
    });
  }

  function handleAssign(escalationId) {
    if (!assignTo) {
      alert("Assign to field is required");
      return;
    }
    post({
      action: "assign",
      escalation_id: escalationId,
      assigned_to: assignTo,
      assigned_to_name: assignName || assignTo
    }).then(function() {
      setShowAssign(null);
      setAssignTo("");
      setAssignName("");
      loadEscalations();
    });
  }

  var activeCount = 0;
  var resolvedCount = 0;
  for (var ci = 0; ci < escalations.length; ci++) {
    if (escalations[ci].status === "resolved" || escalations[ci].status === "cancelled") resolvedCount++;
    else activeCount++;
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? "16px" : "0" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            Escalation Workflow
            {activeCount > 0 && <span style={badgeStyle("#f59e0b")}>{activeCount + " ACTIVE"}</span>}
            {activeCount === 0 && escalations.length > 0 && <span style={badgeStyle("#22c55e")}>ALL RESOLVED</span>}
            {escalations.length === 0 && <span style={badgeStyle("#8b949e")}>NO ESCALATIONS</span>}
          </div>
          <div style={{ fontSize: "12px", color: "#8b949e", marginTop: "2px" }}>DEPLOY228 — Track, assign, and resolve escalated reviews</div>
        </div>
        <button
          style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: "18px" }}
          onClick={function() { setExpanded(!expanded); }}
        >{expanded ? "\u25B2" : "\u25BC"}</button>
      </div>

      {expanded && (
        <div>
          {loading && <div style={{ color: "#8b949e", fontSize: "13px" }}>Loading escalations...</div>}

          {!loading && escalations.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px", color: "#8b949e", fontSize: "13px" }}>
              No escalations for this case. Escalations are created from the Inspector Adjudication panel.
            </div>
          )}

          {!loading && escalations.map(function(esc) {
            var isActive = esc.status !== "resolved" && esc.status !== "cancelled";
            var overdueText = isActive ? timeUntil(esc.deadline) : "";
            var isOverdue = overdueText === "OVERDUE";

            return (
              <div key={esc.id} style={{ background: "#0d1117", borderRadius: "8px", padding: "16px", marginBottom: "12px", border: isOverdue ? "1px solid #ef444466" : "1px solid #21262d" }}>
                {/* Escalation header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={badgeStyle(statusColor(esc.status))}>{esc.status.toUpperCase().replace("_", " ")}</span>
                    <span style={badgeStyle(priorityColor(esc.priority))}>{esc.priority.toUpperCase()}</span>
                    {isOverdue && <span style={badgeStyle("#ef4444")}>OVERDUE</span>}
                    {esc.resolution_type && <span style={badgeStyle(resolutionColor(esc.resolution_type))}>{esc.resolution_type.toUpperCase()}</span>}
                  </div>
                  <div style={{ fontSize: "11px", color: "#8b949e" }}>{timeAgo(esc.escalated_at)}</div>
                </div>

                {/* Details */}
                <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "8px" }}>
                  <div style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#e6edf3", fontWeight: 600 }}>Escalated by: </span>
                    {esc.escalated_by_name || esc.escalated_by_email || esc.escalated_by}
                  </div>
                  {esc.escalation_reason && (
                    <div style={{ marginBottom: "4px" }}>
                      <span style={{ color: "#e6edf3", fontWeight: 600 }}>Reason: </span>
                      {esc.escalation_reason}
                    </div>
                  )}
                  {esc.assigned_to && (
                    <div style={{ marginBottom: "4px" }}>
                      <span style={{ color: "#e6edf3", fontWeight: 600 }}>Assigned to: </span>
                      {esc.assigned_to_name || esc.assigned_to}
                    </div>
                  )}
                  {isActive && esc.deadline && (
                    <div style={{ marginBottom: "4px", color: isOverdue ? "#ef4444" : "#8b949e" }}>
                      <span style={{ color: "#e6edf3", fontWeight: 600 }}>Deadline: </span>
                      {new Date(esc.deadline).toLocaleString()} ({overdueText})
                    </div>
                  )}
                </div>

                {/* Resolution details if resolved */}
                {esc.status === "resolved" && (
                  <div style={{ background: "#161b22", borderRadius: "6px", padding: "12px", marginBottom: "8px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#e6edf3" }}>Resolution</div>
                    {esc.resolution_decision && <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "2px" }}>{esc.resolution_decision}</div>}
                    {esc.resolution_rationale && <div style={{ fontSize: "12px", color: "#6e7681", fontStyle: "italic" }}>{esc.resolution_rationale}</div>}
                    <div style={{ fontSize: "11px", color: "#6e7681", marginTop: "4px" }}>
                      Resolved by {esc.resolved_by_name || esc.resolved_by} {esc.resolved_at ? " \u00B7 " + timeAgo(esc.resolved_at) : ""}
                    </div>
                  </div>
                )}

                {/* Action buttons for active escalations */}
                {isActive && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    {!esc.assigned_to && (
                      <button
                        style={Object.assign({}, btnStyle, { background: "#1f6feb", color: "#fff" })}
                        onClick={function() { setShowAssign(showAssign === esc.id ? null : esc.id); }}
                      >Assign</button>
                    )}
                    <button
                      style={Object.assign({}, btnStyle, { background: "#238636", color: "#fff" })}
                      onClick={function() { setShowResolve(showResolve === esc.id ? null : esc.id); }}
                    >Resolve</button>
                  </div>
                )}

                {/* Assign form */}
                {showAssign === esc.id && (
                  <div style={{ background: "#161b22", borderRadius: "6px", padding: "12px", marginTop: "8px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>Assign Reviewer</div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                      <input style={Object.assign({}, inputStyle, { flex: 1 })} placeholder="Reviewer ID or email" value={assignTo} onChange={function(e) { setAssignTo(e.target.value); }} />
                      <input style={Object.assign({}, inputStyle, { flex: 1 })} placeholder="Reviewer name (optional)" value={assignName} onChange={function(e) { setAssignName(e.target.value); }} />
                    </div>
                    <button style={Object.assign({}, btnStyle, { background: "#1f6feb", color: "#fff" })} onClick={function() { handleAssign(esc.id); }}>Confirm Assignment</button>
                  </div>
                )}

                {/* Resolve form */}
                {showResolve === esc.id && (
                  <div style={{ background: "#161b22", borderRadius: "6px", padding: "12px", marginTop: "8px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>Resolve Escalation</div>

                    {/* Resolution type buttons */}
                    <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                      {["upheld", "overturned", "modified", "deferred"].map(function(rt) {
                        var isSelected = resType === rt;
                        var color = resolutionColor(rt);
                        return (
                          <button
                            key={rt}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: isSelected ? "2px solid " + color : "1px solid #30363d",
                              background: isSelected ? color + "22" : "transparent",
                              color: isSelected ? color : "#8b949e",
                              fontWeight: 700,
                              fontSize: "11px",
                              cursor: "pointer",
                              textTransform: "uppercase"
                            }}
                            onClick={function() { setResType(rt); }}
                          >{rt}</button>
                        );
                      })}
                    </div>

                    <input
                      style={Object.assign({}, inputStyle, { marginBottom: "8px" })}
                      placeholder="Resolution decision (what was decided)"
                      value={resDecision}
                      onChange={function(e) { setResDecision(e.target.value); }}
                    />

                    <textarea
                      style={Object.assign({}, inputStyle, { minHeight: "60px", resize: "vertical", marginBottom: "8px" })}
                      placeholder="Rationale (min 10 characters - why this resolution)"
                      value={resRationale}
                      onChange={function(e) { setResRationale(e.target.value); }}
                    />

                    <button
                      style={Object.assign({}, btnStyle, { background: "#238636", color: "#fff" })}
                      onClick={function() { handleResolve(esc.id); }}
                    >Submit Resolution</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
