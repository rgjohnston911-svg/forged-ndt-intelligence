/**
 * DEPLOY69 — Code Trace Panel v1
 * FORGED NDT Intelligence OS
 * 
 * Frontend component for displaying code authority traces.
 * This file contains:
 * 1. API helper function to call code-trace endpoint
 * 2. React component JSX for the Code Trace Panel
 * 3. CSS to append to styles.css
 * 
 * INTEGRATION:
 * - Add fetchCodeTrace() function to VoiceInspectionPage.tsx
 * - Add CodeTracePanel JSX below the existing what-if panel
 * - Append CSS to styles.css
 * - Call fetchCodeTrace() after voice plan or DRE result is received
 */

// ============================================================
// PART 1: API HELPER (add to VoiceInspectionPage.tsx)
// ============================================================

/*
Add this function inside VoiceInspectionPage component:

const [codeTrace, setCodeTrace] = useState<any>(null);
const [codeTraceLoading, setCodeTraceLoading] = useState(false);

async function fetchCodeTrace(planResult: any) {
  setCodeTraceLoading(true);
  try {
    // Extract findings, methods, disposition from plan result
    var findings: string[] = [];
    var methods: string[] = [];
    var disposition = "";
    var asset_class = "Other";
    var underwater_contexts: string[] = [];

    // From voice plan
    if (planResult.inspection_plan) {
      var plan = planResult.inspection_plan;
      if (plan.failure_modes) {
        for (var i = 0; i < plan.failure_modes.length; i++) {
          findings.push(plan.failure_modes[i].mode || plan.failure_modes[i]);
        }
      }
      if (plan.methods) {
        for (var i = 0; i < plan.methods.length; i++) {
          var m = plan.methods[i];
          methods.push(m.method || m.name || m);
        }
      }
      if (plan.risk_score !== undefined) {
        if (plan.risk_score >= 80) disposition = "shutdown_consideration";
        else if (plan.risk_score >= 60) disposition = "immediate_inspection";
        else if (plan.risk_score >= 40) disposition = "engineering_evaluation";
        else if (plan.risk_score >= 20) disposition = "continue_monitoring";
        else disposition = "continue_normal";
      }
    }

    // From DRE result
    if (planResult.evaluation) {
      var eval_ = planResult.evaluation;
      if (eval_.disposition) disposition = eval_.disposition;
      if (eval_.findings) findings = eval_.findings;
    }

    // Asset class from context
    if (planResult.asset_class) asset_class = planResult.asset_class;
    if (planResult.reality_extraction && planResult.reality_extraction.asset_class) {
      asset_class = planResult.reality_extraction.asset_class;
    }

    // Underwater contexts
    if (planResult.underwater || (planResult.reality_extraction && planResult.reality_extraction.underwater)) {
      underwater_contexts.push("adci_general");
      underwater_contexts.push("osha_diving");
    }

    // Score dimensions — always request all
    var score_dimensions = [
      "event_severity", "observed_condition_severity", "hidden_damage_likelihood",
      "inspection_urgency", "consequence", "overall_risk", "confidence"
    ];

    var response = await fetch("/.netlify/functions/code-trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findings: findings,
        methods: methods,
        disposition: disposition,
        asset_class: asset_class,
        score_dimensions: score_dimensions,
        underwater_contexts: underwater_contexts
      })
    });

    if (response.ok) {
      var data = await response.json();
      setCodeTrace(data);
    }
  } catch (err) {
    console.error("Code trace fetch failed:", err);
  }
  setCodeTraceLoading(false);
}

// Call after plan generation:
// In the existing handlePlanGeneration or similar:
//   const planResult = await response.json();
//   setPlanResult(planResult);
//   fetchCodeTrace(planResult);  // <-- ADD THIS LINE
*/

// ============================================================
// PART 2: REACT JSX COMPONENT (add to VoiceInspectionPage.tsx render)
// ============================================================

/*
Add this JSX after the what-if panel section, before the closing div:

{/* CODE TRACE PANEL */}
{codeTrace && (
  <div className="code-trace-panel">
    <h3 className="code-trace-title">
      <span className="code-trace-icon">&#9878;</span>
      Code Authority Trace
    </h3>
    <p className="code-trace-subtitle">
      Every decision traces to a specific code clause.
      Applicable code families: {codeTrace.applicable_code_families.join(", ")}
    </p>

    {/* FINDING TRACES */}
    {codeTrace.finding_traces && codeTrace.finding_traces.length > 0 && (
      <div className="code-trace-section">
        <h4 className="code-trace-section-title">Finding Authority</h4>
        {codeTrace.finding_traces.map(function(ft: any, idx: number) {
          return (
            <div key={"ft-" + idx} className="code-trace-card">
              <div className="code-trace-card-header">
                <span className="code-trace-finding-name">{ft.display_name}</span>
                <span className="code-trace-ref-count">{ft.references.length} code reference{ft.references.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="code-trace-physics">
                <strong>Physics Basis:</strong> {ft.physics_basis}
              </div>
              <div className="code-trace-rejection">
                <strong>Rejection Basis:</strong> {ft.rejection_basis}
              </div>
              <div className="code-trace-refs">
                {ft.references.map(function(ref: any, ridx: number) {
                  return (
                    <div key={"ref-" + ridx} className="code-trace-ref">
                      <div className="code-trace-ref-header">
                        <span className="code-trace-code-family">{ref.code_family} ({ref.code_edition})</span>
                        <span className="code-trace-clause">{ref.clause}</span>
                      </div>
                      <div className="code-trace-ref-title">{ref.title}</div>
                      <div className="code-trace-ref-detail">
                        <div><strong>Requirement:</strong> {ref.requirement_summary}</div>
                        <div><strong>Acceptance:</strong> {ref.acceptance_criteria}</div>
                        <div className="code-trace-rationale"><strong>Engineering Rationale:</strong> {ref.engineering_rationale}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* METHOD TRACES */}
    {codeTrace.method_traces && codeTrace.method_traces.length > 0 && (
      <div className="code-trace-section">
        <h4 className="code-trace-section-title">Method Authority</h4>
        {codeTrace.method_traces.map(function(mt: any, idx: number) {
          return (
            <div key={"mt-" + idx} className="code-trace-card code-trace-method-card">
              <div className="code-trace-card-header">
                <span className="code-trace-method-badge">{mt.method}</span>
                <span className="code-trace-finding-name">{mt.display_name}</span>
              </div>
              <div className="code-trace-capability">
                <strong>Capability:</strong> {mt.capability_summary}
              </div>
              <div className="code-trace-limitation">
                <strong>Limitation:</strong> {mt.limitation_summary}
              </div>
              <div className="code-trace-refs">
                {mt.references.map(function(ref: any, ridx: number) {
                  return (
                    <div key={"mref-" + ridx} className="code-trace-ref">
                      <div className="code-trace-ref-header">
                        <span className="code-trace-code-family">{ref.code_family} ({ref.code_edition})</span>
                        <span className="code-trace-clause">{ref.clause}</span>
                      </div>
                      <div className="code-trace-ref-title">{ref.title}</div>
                      <div className="code-trace-ref-detail">
                        <div><strong>Requirement:</strong> {ref.requirement_summary}</div>
                        <div><strong>Engineering Rationale:</strong> {ref.engineering_rationale}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* DISPOSITION TRACE */}
    {codeTrace.disposition_trace && (
      <div className="code-trace-section">
        <h4 className="code-trace-section-title">Disposition Authority</h4>
        <div className="code-trace-card code-trace-disposition-card">
          <div className="code-trace-card-header">
            <span className="code-trace-disposition-badge">{codeTrace.disposition_trace.disposition.replace(/_/g, " ").toUpperCase()}</span>
          </div>
          <div className="code-trace-authority-statement">
            {codeTrace.disposition_trace.authority_statement}
          </div>
          <div className="code-trace-refs">
            {codeTrace.disposition_trace.references.map(function(ref: any, ridx: number) {
              return (
                <div key={"dref-" + ridx} className="code-trace-ref">
                  <div className="code-trace-ref-header">
                    <span className="code-trace-code-family">{ref.code_family} ({ref.code_edition})</span>
                    <span className="code-trace-clause">{ref.clause}</span>
                  </div>
                  <div className="code-trace-ref-title">{ref.title}</div>
                  <div className="code-trace-ref-detail">
                    <div><strong>Requirement:</strong> {ref.requirement_summary}</div>
                    <div><strong>Engineering Rationale:</strong> {ref.engineering_rationale}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* SCORE DIMENSION TRACES */}
    {codeTrace.score_traces && codeTrace.score_traces.length > 0 && (
      <div className="code-trace-section">
        <h4 className="code-trace-section-title">Scoring Engineering Basis</h4>
        {codeTrace.score_traces.map(function(st: any, idx: number) {
          return (
            <div key={"st-" + idx} className="code-trace-card code-trace-score-card">
              <div className="code-trace-card-header">
                <span className="code-trace-dimension-name">{st.dimension.replace(/_/g, " ")}</span>
              </div>
              <div className="code-trace-engineering-basis">
                {st.engineering_basis}
              </div>
              {st.references.map(function(ref: any, ridx: number) {
                return (
                  <div key={"sref-" + ridx} className="code-trace-ref code-trace-ref-compact">
                    <span className="code-trace-code-family">{ref.code_family}</span>
                    <span className="code-trace-clause">{ref.clause}</span>
                    <span className="code-trace-ref-title-inline">{ref.title}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    )}

    {/* UNDERWATER TRACES */}
    {codeTrace.underwater_traces && codeTrace.underwater_traces.length > 0 && (
      <div className="code-trace-section">
        <h4 className="code-trace-section-title">Underwater Regulatory Authority</h4>
        {codeTrace.underwater_traces.map(function(ref: any, ridx: number) {
          return (
            <div key={"uwref-" + ridx} className="code-trace-ref">
              <div className="code-trace-ref-header">
                <span className="code-trace-code-family">{ref.code_family} ({ref.code_edition})</span>
                <span className="code-trace-clause">{ref.clause}</span>
              </div>
              <div className="code-trace-ref-title">{ref.title}</div>
              <div className="code-trace-ref-detail">
                <div><strong>Requirement:</strong> {ref.requirement_summary}</div>
                <div><strong>Engineering Rationale:</strong> {ref.engineering_rationale}</div>
              </div>
            </div>
          );
        })}
      </div>
    )}

    <div className="code-trace-footer">
      Trace v{codeTrace.trace_version} | Generated {new Date(codeTrace.generated_at).toLocaleString()}
    </div>
  </div>
)}

{codeTraceLoading && (
  <div className="code-trace-loading">
    <div className="code-trace-loading-spinner"></div>
    Generating code authority trace...
  </div>
)}
*/

// ============================================================
// PART 3: CSS (append to styles.css)
// ============================================================

/*
APPEND THE FOLLOWING TO styles.css:

/* ============================================================
   CODE TRACE PANEL — DEPLOY69
   ============================================================ */

.code-trace-panel {
  margin-top: 24px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 24px;
}

.code-trace-title {
  font-size: 18px;
  font-weight: 700;
  color: #f0f6fc;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-trace-icon {
  font-size: 20px;
  color: #f78166;
}

.code-trace-subtitle {
  font-size: 13px;
  color: #8b949e;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.code-trace-section {
  margin-bottom: 20px;
}

.code-trace-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #21262d;
}

.code-trace-card {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.code-trace-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.code-trace-finding-name {
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
}

.code-trace-ref-count {
  font-size: 11px;
  color: #8b949e;
  background: #21262d;
  padding: 2px 8px;
  border-radius: 10px;
}

.code-trace-physics,
.code-trace-rejection,
.code-trace-capability,
.code-trace-limitation,
.code-trace-authority-statement,
.code-trace-engineering-basis {
  font-size: 13px;
  color: #c9d1d9;
  line-height: 1.5;
  margin-bottom: 8px;
}

.code-trace-physics strong,
.code-trace-rejection strong,
.code-trace-capability strong,
.code-trace-limitation strong {
  color: #f0f6fc;
}

.code-trace-rejection {
  color: #f85149;
}

.code-trace-limitation {
  color: #d29922;
}

.code-trace-authority-statement {
  font-size: 14px;
  font-weight: 500;
  color: #f0f6fc;
  padding: 8px 12px;
  background: #21262d;
  border-radius: 6px;
  margin-bottom: 12px;
}

.code-trace-refs {
  margin-top: 10px;
}

.code-trace-ref {
  border-left: 3px solid #30363d;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #0d1117;
  border-radius: 0 6px 6px 0;
}

.code-trace-ref:hover {
  border-left-color: #58a6ff;
}

.code-trace-ref-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.code-trace-code-family {
  font-size: 12px;
  font-weight: 600;
  color: #7ee787;
  background: rgba(126, 231, 135, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

.code-trace-clause {
  font-size: 12px;
  font-weight: 600;
  color: #f78166;
}

.code-trace-ref-title {
  font-size: 13px;
  font-weight: 500;
  color: #c9d1d9;
  margin-bottom: 6px;
}

.code-trace-ref-detail {
  font-size: 12px;
  color: #8b949e;
  line-height: 1.5;
}

.code-trace-ref-detail strong {
  color: #c9d1d9;
}

.code-trace-rationale {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid #21262d;
  color: #8b949e;
  font-style: italic;
}

.code-trace-method-badge {
  font-size: 13px;
  font-weight: 700;
  color: #f0f6fc;
  background: #1f6feb;
  padding: 2px 10px;
  border-radius: 4px;
  margin-right: 8px;
}

.code-trace-disposition-badge {
  font-size: 13px;
  font-weight: 700;
  color: #f0f6fc;
  background: #da3633;
  padding: 4px 12px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.code-trace-dimension-name {
  font-size: 14px;
  font-weight: 600;
  color: #d2a8ff;
  text-transform: capitalize;
}

.code-trace-score-card {
  padding: 12px 16px;
}

.code-trace-ref-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin-bottom: 4px;
  border-left-width: 2px;
}

.code-trace-ref-title-inline {
  font-size: 12px;
  color: #8b949e;
}

.code-trace-footer {
  text-align: center;
  font-size: 11px;
  color: #484f58;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #21262d;
}

.code-trace-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: #8b949e;
  font-size: 14px;
}

.code-trace-loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #30363d;
  border-top-color: #58a6ff;
  border-radius: 50%;
  animation: code-trace-spin 0.8s linear infinite;
}

@keyframes code-trace-spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 640px) {
  .code-trace-panel {
    padding: 16px;
  }
  .code-trace-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .code-trace-ref-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .code-trace-ref-compact {
    flex-direction: column;
    align-items: flex-start;
  }
}

*/
