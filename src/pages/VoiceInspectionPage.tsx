/**
 * DEPLOY66 — VoiceInspectionPage.tsx v2
 * src/pages/VoiceInspectionPage.tsx
 *
 * Major upgrade:
 *   - Reality Extraction Panel with confirmed/inferred/unknown states
 *   - Unknown Critical Variables callout
 *   - Decision Trace ("Why This Plan")
 *   - Inline What-If Panel (3 scenarios)
 *   - Numeric Risk Score
 *   - Enhanced method cards with justification tags
 *   - Editable fields (user can correct before committing)
 *
 * CONSTRAINT: No backtick template literals — string concatenation only
 */

import { useState, useRef } from "react";

var SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f59e0b",
  critical: "#ef4444",
};

var DISP_LABELS: Record<string, string> = {
  continue_normal: "Continue Normal",
  continue_with_monitoring: "Continue with Monitoring",
  targeted_inspection: "Targeted Inspection",
  priority_inspection_required: "Priority Inspection Required",
  restricted_operation: "Restricted Operation",
  inspection_before_return: "Inspection Before Return",
  shutdown_consideration: "Shutdown Consideration",
};

var EXAMPLES = [
  { label: "Bridge Impact", text: "A large truck traveling approximately 70 mph hit a 5 foot diameter concrete bridge support." },
  { label: "Tornado over Pipeline", text: "A tornado with 150 mph winds crossed over a 10 inch gas pipeline." },
  { label: "Ship Rudder Strike", text: "A cargo ship hit an unknown object with suspected rudder damage." },
  { label: "Diver Found Corrosion", text: "A diver found heavy corrosion on a splash zone brace with marine growth." },
  { label: "Tree on Pressure Vessel", text: "A tree fell on a pressure vessel near the saddle." },
  { label: "Hurricane on Platform", text: "An offshore platform sustained 90 mph winds, 25 foot waves, and debris strikes during a hurricane." },
  { label: "Dam Face Deterioration", text: "Diver observed concrete spalling and possible undermining at the dam face near the foundation." },
  { label: "Subsea Crack Found", text: "ROV observed a crack-like indication at a welded node joint on the subsea jacket brace." },
];

function stateIcon(state: string): string {
  if (state === "confirmed") return "\u2705";
  if (state === "inferred") return "\u26A0\uFE0F";
  return "\u2753";
}

function stateClass(state: string): string {
  if (state === "confirmed") return "re-confirmed";
  if (state === "inferred") return "re-inferred";
  return "re-unknown";
}

export default function VoiceInspectionPage() {
  var [transcript, setTranscript] = useState("");
  var [listening, setListening] = useState(false);
  var [loading, setLoading] = useState(false);
  var [result, setResult] = useState<any>(null);
  var [showDecisionTrace, setShowDecisionTrace] = useState(false);
  var recognitionRef = useRef<any>(null);

  function startListening() {
    var SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    var recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = function() { setListening(true); };
    recognition.onresult = function(event: any) {
      var text = "";
      for (var i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text.trim());
    };
    recognition.onerror = function() { setListening(false); };
    recognition.onend = function() { setListening(false); };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  }

  async function generatePlan() {
    if (!transcript.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      var resp = await fetch("/api/voice-incident-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript }),
      });
      var data = await resp.json();
      setResult(data);
    } catch (err) {
      setResult({ error: "Failed to generate plan." });
    }
    setLoading(false);
  }

  function loadExample(text: string) {
    setTranscript(text);
    setResult(null);
    setShowDecisionTrace(false);
  }

  var plan = result && result.plan ? result.plan : null;
  var parsed = result && result.parsed ? result.parsed : null;
  var extraction = parsed && parsed.reality_extraction ? parsed.reality_extraction : null;

  return (
    <div className="page">
      <div className="case-header">
        <h1>Voice-to-Inspection Plan</h1>
        <p className="voice-subtitle">Speak what happened. Get an instant inspection plan.</p>
      </div>

      {/* MIC + CONTROLS */}
      <div className="voice-controls">
        <button
          className={"voice-mic-btn" + (listening ? " mic-active" : "")}
          onClick={listening ? stopListening : startListening}
          type="button"
        >
          {listening ? "\uD83D\uDD34 Listening..." : "\uD83C\uDF99\uFE0F Start Mic"}
        </button>
        <button
          className="voice-generate-btn"
          onClick={generatePlan}
          disabled={loading || !transcript.trim()}
          type="button"
        >
          {loading ? "Generating..." : "\u26A1 Generate Inspection Plan"}
        </button>
      </div>

      {/* TRANSCRIPT */}
      <textarea
        className="voice-transcript-input"
        value={transcript}
        onChange={function(e) { setTranscript(e.target.value); }}
        rows={4}
        placeholder="Speak or type the incident here..."
      />

      {/* SPEECH CORRECTION NOTICE */}
      {parsed && parsed.corrected_text && (
        <div className="voice-correction-notice">
          <span className="vcn-icon">{"\uD83D\uDD27"}</span>
          <span>Speech corrections applied. Engine interpreted: <em>{parsed.corrected_text}</em></span>
        </div>
      )}

      {/* EXAMPLES */}
      <div className="voice-examples">
        <span className="voice-examples-label">Try an example:</span>
        <div className="voice-examples-grid">
          {EXAMPLES.map(function(ex, idx) {
            return (
              <button key={idx} className="voice-example-btn" onClick={function() { loadExample(ex.text); }} type="button">
                {ex.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ERROR */}
      {result && result.error && <div className="voice-error">{result.error}</div>}

      {/* ======== REALITY EXTRACTION PANEL ======== */}
      {extraction && (
        <div className="reality-extraction-panel">
          <div className="re-header">
            <h3>REALITY EXTRACTION</h3>
            <div className="re-confidence-ring">
              <span className="re-conf-value">{parsed.confidence || 0}%</span>
              <span className="re-conf-label">Parse Confidence</span>
            </div>
          </div>

          <div className="re-grid">
            {/* Asset */}
            <div className="re-group">
              <div className="re-group-title">Asset</div>
              {extraction.asset && extraction.asset.map(function(item: any, idx: number) {
                return (
                  <div key={idx} className={"re-item " + stateClass(item.state)}>
                    <span className="re-state-icon">{stateIcon(item.state)}</span>
                    <span className="re-item-label">{item.label}:</span>
                    <span className="re-item-value">{item.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Event / Finding */}
            <div className="re-group">
              <div className="re-group-title">{parsed.intake_path === "event_driven" ? "Event" : "Finding"}</div>
              {extraction.event_or_finding && extraction.event_or_finding.map(function(item: any, idx: number) {
                return (
                  <div key={idx} className={"re-item " + stateClass(item.state)}>
                    <span className="re-state-icon">{stateIcon(item.state)}</span>
                    <span className="re-item-label">{item.label}:</span>
                    <span className="re-item-value">{item.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Measured / Interpreted */}
            <div className="re-group">
              <div className="re-group-title">Measured / Interpreted</div>
              {extraction.measured && extraction.measured.map(function(item: any, idx: number) {
                return (
                  <div key={idx} className={"re-item " + stateClass(item.state)}>
                    <span className="re-state-icon">{stateIcon(item.state)}</span>
                    <span className="re-item-label">{item.label}:</span>
                    <span className="re-item-value">{item.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Environment */}
            {extraction.environment && extraction.environment.length > 0 && (
              <div className="re-group">
                <div className="re-group-title">Environment</div>
                {extraction.environment.map(function(item: any, idx: number) {
                  return (
                    <div key={idx} className={"re-item " + stateClass(item.state)}>
                      <span className="re-state-icon">{stateIcon(item.state)}</span>
                      <span className="re-item-value">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* UNKNOWN CRITICAL VARIABLES */}
          {extraction.unknowns && extraction.unknowns.length > 0 && (
            <div className="re-unknowns">
              <div className="re-unknowns-title">{"\u26A0\uFE0F"} UNKNOWN CRITICAL VARIABLES</div>
              {extraction.unknowns.map(function(u: string, idx: number) {
                return <div key={idx} className="re-unknown-item">{"\u2753"} {u}</div>;
              })}
            </div>
          )}
        </div>
      )}

      {/* ======== INSPECTION PLAN ======== */}
      {plan && (
        <div className="voice-plan-section">
          {/* HEADER WITH RISK SCORE */}
          <div className="voice-plan-header">
            <h2>{plan.title}</h2>
            <div className="voice-plan-badges">
              {plan.risk_score != null && (
                <span className="voice-risk-score" style={{ borderColor: SEVERITY_COLORS[plan.severity_band] || "#666" }}>
                  {Math.round(plan.risk_score)}<span className="vrs-label">/100</span>
                </span>
              )}
              <span className="voice-severity-badge" style={{ backgroundColor: SEVERITY_COLORS[plan.severity_band] || "#666" }}>
                {(plan.severity_band || "").toUpperCase()}
              </span>
              <span className="voice-disp-badge">
                {DISP_LABELS[plan.operational_disposition] || plan.operational_disposition.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          <p className="voice-plan-summary">{plan.summary}</p>

          {/* DECISION TRACE (collapsible) */}
          {plan.decision_trace && plan.decision_trace.length > 0 && (
            <div className="decision-trace-section">
              <button
                className="decision-trace-toggle"
                onClick={function() { setShowDecisionTrace(!showDecisionTrace); }}
                type="button"
              >
                {showDecisionTrace ? "\u25BC" : "\u25B6"} Why This Plan Was Generated
              </button>
              {showDecisionTrace && (
                <div className="decision-trace-list">
                  {plan.decision_trace.map(function(dt: string, idx: number) {
                    return <div key={idx} className="dt-item">{"\u2192"} {dt}</div>;
                  })}
                </div>
              )}
            </div>
          )}

          {/* IMMEDIATE ACTIONS */}
          {plan.immediate_actions && plan.immediate_actions.length > 0 && (
            <div className="voice-plan-block">
              <h3>{"\u26A0\uFE0F"} Immediate Actions</h3>
              {plan.immediate_actions.map(function(a: string, idx: number) {
                return <div key={idx} className="voice-action-item">{a}</div>;
              })}
            </div>
          )}

          {/* RECOMMENDED METHODS (enhanced) */}
          {plan.recommended_methods && plan.recommended_methods.length > 0 && (
            <div className="voice-plan-block">
              <h3>Recommended Methods</h3>
              <div className="voice-methods-grid">
                {plan.recommended_methods.map(function(m: any, idx: number) {
                  return (
                    <div key={idx} className={"voice-method-card priority-" + m.priority}>
                      <div className="voice-method-header">
                        <span className="voice-method-name">{m.method}</span>
                        <span className="voice-method-priority">{"P" + m.priority}</span>
                      </div>
                      <div className="voice-method-reason">{m.reason}</div>
                      {m.justification && (
                        <div className="voice-method-justification">{"\u2192"} {m.justification}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DAMAGE MECHANISMS */}
          {plan.probable_damage_mechanisms && plan.probable_damage_mechanisms.length > 0 && (
            <div className="voice-plan-block">
              <h3>Probable Damage Mechanisms</h3>
              <div className="voice-chip-list">
                {plan.probable_damage_mechanisms.map(function(d: string, idx: number) {
                  return <span key={idx} className="voice-mech-chip">{d.replace(/_/g, " ")}</span>;
                })}
              </div>
            </div>
          )}

          {/* INSPECTION ZONES */}
          {plan.prioritized_inspection_zones && plan.prioritized_inspection_zones.length > 0 && (
            <div className="voice-plan-block">
              <h3>Prioritized Inspection Zones</h3>
              <div className="voice-chip-list">
                {plan.prioritized_inspection_zones.map(function(z: string, idx: number) {
                  return <span key={idx} className="voice-zone-chip">{z.replace(/_/g, " ")}</span>;
                })}
              </div>
            </div>
          )}

          {/* FAILURE MODES */}
          {plan.likely_failure_modes && plan.likely_failure_modes.length > 0 && (
            <div className="voice-plan-block">
              <h3>Likely Failure Modes</h3>
              <div className="voice-chip-list">
                {plan.likely_failure_modes.map(function(f: string, idx: number) {
                  return <span key={idx} className="voice-fail-chip">{f.replace(/_/g, " ")}</span>;
                })}
              </div>
            </div>
          )}

          {/* ======== WHAT-IF PANEL ======== */}
          {plan.what_if_scenarios && plan.what_if_scenarios.length > 0 && (
            <div className="whatif-panel">
              <h3>{"\uD83D\uDD2E"} What Happens If You...</h3>
              <div className="whatif-grid">
                {plan.what_if_scenarios.map(function(wi: any, idx: number) {
                  return (
                    <div key={idx} className={"whatif-card whatif-" + (wi.risk_change === "increases" ? "bad" : "neutral")}>
                      <div className="whatif-header">
                        <span className="whatif-icon">{wi.risk_change === "increases" ? "\u274C" : "\u26A0\uFE0F"}</span>
                        <span className="whatif-title">{wi.scenario}</span>
                      </div>
                      {wi.consequences && wi.consequences.map(function(c: string, cidx: number) {
                        return <div key={cidx} className="whatif-consequence">{"\u2192"} {c}</div>;
                      })}
                      {wi.projected_severity && (
                        <div className="whatif-projected">
                          Risk: <span style={{ color: SEVERITY_COLORS[wi.projected_severity] || "#fff" }}>
                            {wi.projected_severity.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RATIONALE */}
          {plan.rationale && plan.rationale.length > 0 && (
            <div className="voice-plan-block">
              <h3>Rationale</h3>
              {plan.rationale.map(function(r: string, idx: number) {
                return <div key={idx} className="voice-rationale-item">{r}</div>;
              })}
            </div>
          )}

          {/* FOLLOW-UP */}
          {plan.follow_up_questions && plan.follow_up_questions.length > 0 && (
            <div className="voice-plan-block">
              <h3>Follow-Up Questions</h3>
              {plan.follow_up_questions.map(function(q: string, idx: number) {
                return <div key={idx} className="voice-question-item">{"? " + q}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
