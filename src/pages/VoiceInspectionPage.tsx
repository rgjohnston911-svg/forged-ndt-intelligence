/**
 * DEPLOY70 — VoiceInspectionPage.tsx v3
 * src/pages/VoiceInspectionPage.tsx
 *
 * Voice-to-Inspection Plan with Code Authority Trace Panel.
 * Speak what happened, get an instant plan with full code citations.
 *
 * Changes from DEPLOY62:
 * - Added codeTrace state + fetchCodeTrace function
 * - Auto-calls code-trace API after plan generation
 * - Code Trace Panel renders below plan with expandable sections
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

export default function VoiceInspectionPage() {
  var [transcript, setTranscript] = useState("");
  var [listening, setListening] = useState(false);
  var [loading, setLoading] = useState(false);
  var [result, setResult] = useState<any>(null);
  var [codeTrace, setCodeTrace] = useState<any>(null);
  var [codeTraceLoading, setCodeTraceLoading] = useState(false);
  var [enrichment, setEnrichment] = useState<any>(null);
  var [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  var recognitionRef = useRef<any>(null);

  function toggleSection(key: string) {
    var next: Record<string, boolean> = {};
    var keys = Object.keys(expandedSections);
    for (var i = 0; i < keys.length; i++) {
      next[keys[i]] = expandedSections[keys[i]];
    }
    next[key] = !next[key];
    setExpandedSections(next);
  }

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

  async function fetchCodeTrace(planData: any) {
    setCodeTraceLoading(true);
    try {
      var findings: string[] = [];
      var methods: string[] = [];
      var disposition = "";
      var asset_class = "Other";
      var underwater_contexts: string[] = [];

      var p = planData.plan;
      var pr = planData.parsed;

      // Extract findings from failure modes and damage mechanisms
      if (p && p.likely_failure_modes) {
        for (var i = 0; i < p.likely_failure_modes.length; i++) {
          findings.push(p.likely_failure_modes[i]);
        }
      }
      if (p && p.probable_damage_mechanisms) {
        for (var i = 0; i < p.probable_damage_mechanisms.length; i++) {
          findings.push(p.probable_damage_mechanisms[i]);
        }
      }

      // Extract methods
      if (p && p.recommended_methods) {
        for (var i = 0; i < p.recommended_methods.length; i++) {
          var m = p.recommended_methods[i];
          methods.push(m.method || m.name || m);
        }
      }

      // Determine disposition from severity or operational_disposition
      if (p && p.operational_disposition) {
        // Map voice dispositions to DRE dispositions
        var dispMap: Record<string, string> = {
          continue_normal: "continue_normal",
          continue_with_monitoring: "continue_monitoring",
          targeted_inspection: "immediate_inspection",
          priority_inspection_required: "immediate_inspection",
          restricted_operation: "restrict_operations",
          inspection_before_return: "immediate_inspection",
          shutdown_consideration: "shutdown_consideration"
        };
        disposition = dispMap[p.operational_disposition] || "engineering_evaluation";
      }

      // Asset class from parsed data
      if (pr && pr.asset_type) {
        var typeClassMap: Record<string, string> = {
          bridge_support: "Bridge/Civil",
          bridge: "Bridge/Civil",
          pipeline: "Pipeline",
          gas_pipeline: "Pipeline",
          oil_pipeline: "Pipeline",
          cargo_ship: "Marine Vessel",
          ship: "Marine Vessel",
          vessel: "Marine Vessel",
          rudder: "Marine Vessel",
          pressure_vessel: "Refinery/Process",
          offshore_platform: "Offshore",
          platform: "Offshore",
          jacket_brace: "Offshore",
          dam: "Dam/Hydro",
          dam_face: "Dam/Hydro",
          hydro: "Dam/Hydro",
          wind_turbine: "Wind Energy",
          storage_tank: "Storage/Terminal",
          nuclear: "Nuclear",
          rail: "Rail",
          aerospace: "Aerospace"
        };
        var assetKey = (pr.asset_type || "").toLowerCase().replace(/[\s\-]+/g, "_");
        asset_class = typeClassMap[assetKey] || "Other";
        // Check for partial match
        if (asset_class === "Other") {
          var mapKeys = Object.keys(typeClassMap);
          for (var i = 0; i < mapKeys.length; i++) {
            if (assetKey.indexOf(mapKeys[i]) >= 0 || mapKeys[i].indexOf(assetKey) >= 0) {
              asset_class = typeClassMap[mapKeys[i]];
              break;
            }
          }
        }
      }

      // Underwater detection
      if (pr && pr.environment_context) {
        for (var i = 0; i < pr.environment_context.length; i++) {
          var env = (pr.environment_context[i] || "").toLowerCase();
          if (env.indexOf("underwater") >= 0 || env.indexOf("subsea") >= 0 || env.indexOf("diver") >= 0 || env.indexOf("marine") >= 0) {
            underwater_contexts.push("adci_general");
            underwater_contexts.push("osha_diving");
            break;
          }
        }
      }
      // Also check transcript for underwater keywords
      var lowerTranscript = transcript.toLowerCase();
      if (underwater_contexts.length === 0 && (lowerTranscript.indexOf("diver") >= 0 || lowerTranscript.indexOf("underwater") >= 0 || lowerTranscript.indexOf("subsea") >= 0 || lowerTranscript.indexOf("rov") >= 0)) {
        underwater_contexts.push("adci_general");
        underwater_contexts.push("osha_diving");
      }
      // Offshore underwater
      if (asset_class === "Offshore" && underwater_contexts.length > 0) {
        underwater_contexts.push("offshore");
        underwater_contexts.push("cathodic_protection");
      }
      // Dam underwater
      if (asset_class === "Dam/Hydro" && underwater_contexts.length > 0) {
        underwater_contexts.push("dam_hydro");
      }
      // Nuclear underwater
      if (asset_class === "Nuclear" && underwater_contexts.length > 0) {
        underwater_contexts.push("nuclear_underwater");
      }
      // Marine
      if (asset_class === "Marine Vessel") {
        underwater_contexts.push("marine_vessel");
      }

      var score_dimensions = [
        "event_severity", "observed_condition_severity", "hidden_damage_likelihood",
        "inspection_urgency", "consequence", "overall_risk", "confidence"
      ];

      var response = await fetch("/api/code-trace", {
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

  async function generatePlan() {
    if (!transcript.trim()) return;
    setLoading(true);
    setResult(null);
    setCodeTrace(null);
    setEnrichment(null);
    try {
      // STEP 0: Call Master Inspection Router
      var routerResp = await fetch("/api/master-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript })
      });
      var routerData = routerResp.ok ? await routerResp.json() : null;
      var routePath = (routerData && routerData.parsed_route) ? routerData.parsed_route.intake_path : "unknown";

      // ROUTE: SCHEDULED / PROGRAMMATIC
      if (routePath === "scheduled_programmatic" && routerData.payload && routerData.payload.engine) {
        var sp = routerData.payload;
        var schedMethods: any[] = [];
        var schedDeg: string[] = [];
        var schedZones: string[] = [];
        var seenM: Record<string, boolean> = {};
        var compPlans = sp.prioritized_components || [];
        for (var ci = 0; ci < compPlans.length; ci++) {
          var cp = compPlans[ci];
          var cpMethods = cp.recommended_methods || [];
          for (var mi = 0; mi < cpMethods.length; mi++) {
            var mKey = cpMethods[mi].method;
            if (!seenM[mKey]) {
              seenM[mKey] = true;
              schedMethods.push({ method: cpMethods[mi].method, priority: cpMethods[mi].priority === "P1" ? 1 : cpMethods[mi].priority === "P2" ? 2 : 3, reason: cpMethods[mi].rationale });
            }
          }
          var cpDeg = cp.probable_degradation || [];
          for (var di = 0; di < cpDeg.length; di++) { if (schedDeg.indexOf(cpDeg[di]) < 0) schedDeg.push(cpDeg[di]); }
          if (schedZones.indexOf(cp.component_type) < 0) schedZones.push(cp.component_type);
        }
        var mappedData: any = {
          plan: {
            title: "Inspection Program - " + (sp.parsed.asset_class || "facility").replace(/_/g, " "),
            severity_band: sp.overall_priority,
            operational_disposition: (sp.disposition || "").replace(/_/g, " "),
            summary: sp.facility_summary,
            immediate_actions: sp.immediate_actions || [],
            recommended_methods: schedMethods,
            probable_damage_mechanisms: schedDeg,
            prioritized_inspection_zones: schedZones,
            likely_failure_modes: [],
            rationale: sp.what_happens_if_you_wait || [],
            follow_up_questions: sp.follow_up_questions || [],
            risk_score: sp.overall_priority === "critical" ? 85 : sp.overall_priority === "high" ? 65 : sp.overall_priority === "moderate" ? 45 : 25
          },
          parsed: {
            intake_path: "programmatic",
            asset_type: (sp.parsed.asset_class || "").replace(/_/g, " "),
            event_category: sp.parsed.program_type || "scheduled",
            confidence: sp.parsed.confidence || 0,
            environment_context: sp.parsed.service_signals || []
          }
        };
        setEnrichment({
          event_classification: {
            event_type: "programmatic",
            event_subtype: sp.parsed.program_type || "scheduled",
            confidence: sp.parsed.confidence || 0,
            trigger_words_matched: sp.parsed.detected_keywords || [],
            risk_floor_band: sp.overall_priority
          },
          rule_pack_applied: { rule_pack: "Scheduled Inspection Intelligence Engine v1" },
          enrichment_notes: [
            "Master Router: scheduled_programmatic",
            "Asset: " + (sp.parsed.asset_class || "unknown").replace(/_/g, " "),
            "Program: " + (sp.parsed.program_type || "unknown"),
            "Components: " + (sp.parsed.inferred_components || []).join(", "),
            "Disposition: " + (sp.disposition || "unknown").replace(/_/g, " ")
          ],
          enriched_plan: { regulatory_references: (sp.code_authority_trace && sp.code_authority_trace.applicable_families) ? sp.code_authority_trace.applicable_families : [] }
        });
        var ctMethods: string[] = [];
        for (var i = 0; i < schedMethods.length; i++) ctMethods.push(schedMethods[i].method);
        try {
          var ctResp = await fetch("/api/code-trace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ findings: schedDeg, methods: ctMethods, disposition: "engineering_evaluation", asset_class: "Refinery/Process", score_dimensions: ["event_severity", "observed_condition_severity", "hidden_damage_likelihood", "inspection_urgency", "consequence", "overall_risk", "confidence"], underwater_contexts: [] })
          });
          if (ctResp.ok) { setCodeTrace(await ctResp.json()); }
        } catch (ctErr) { console.error("Code trace failed:", ctErr); }
        setResult(mappedData);
        setLoading(false);
        return;
      }

      // ROUTE: EVENT-DRIVEN / OTHER (existing flow)
      var resp = await fetch("/api/voice-incident-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript }),
      });
      var data = await resp.json();
      if (data && data.plan && !data.error) {
        try {
          var enrichResp = await fetch("/api/event-enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: transcript, plan: data.plan, parsed: data.parsed })
          });
          if (enrichResp.ok) {
            var enrichData = await enrichResp.json();
            setEnrichment(enrichData);
            if (enrichData.enriched_plan) data.plan = enrichData.enriched_plan;
            if (enrichData.event_classification && enrichData.event_classification.event_type !== "unclassified") data.parsed.event_category = enrichData.event_classification.event_subtype;
            if (enrichData.enriched_plan && enrichData.enriched_plan.regulatory_references) data.regulatory_references = enrichData.enriched_plan.regulatory_references;
          }
        } catch (enrichErr) { console.error("Enrichment failed:", enrichErr); }
        fetchCodeTrace(data);
      }
      setResult(data);
    } catch (err) {
      setResult({ error: "Failed to generate plan." });
    }
    setLoading(false);
  }

  function loadExample(text: string) {
    setTranscript(text);
    setResult(null);
    setCodeTrace(null);
    setEnrichment(null);
  }

  var plan = result && result.plan ? result.plan : null;
  var parsed = result && result.parsed ? result.parsed : null;

  return (
    <div className="page">
      <div className="case-header">
        <h1>Voice-to-Inspection Plan</h1>
        <p className="voice-subtitle">Speak what happened. Get an instant inspection plan with full code authority.</p>
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

      {/* TRANSCRIPT INPUT */}
      <textarea
        className="voice-transcript-input"
        value={transcript}
        onChange={function(e) { setTranscript(e.target.value); }}
        rows={4}
        placeholder="Speak or type the incident here..."
      />

      {/* EXAMPLES */}
      <div className="voice-examples">
        <span className="voice-examples-label">Try an example:</span>
        <div className="voice-examples-grid">
          {EXAMPLES.map(function(ex, idx) {
            return (
              <button
                key={idx}
                className="voice-example-btn"
                onClick={function() { loadExample(ex.text); }}
                type="button"
              >
                {ex.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ERROR */}
      {result && result.error && (
        <div className="voice-error">{result.error}</div>
      )}

      {/* PARSED INCIDENT */}
      {parsed && (
        <div className="voice-parsed-section">
          <h3>Parsed Incident</h3>
          <div className="voice-parsed-grid">
            <div className="voice-parsed-item">
              <span className="vp-label">Intake Path</span>
              <span className="vp-value">{(parsed.intake_path || "").replace(/_/g, " ")}</span>
            </div>
            <div className="voice-parsed-item">
              <span className="vp-label">Asset Type</span>
              <span className="vp-value">{(parsed.asset_type || "").replace(/_/g, " ")}</span>
            </div>
            {parsed.event_category && (
              <div className="voice-parsed-item">
                <span className="vp-label">Event</span>
                <span className="vp-value">{parsed.event_category.replace(/_/g, " ")}</span>
              </div>
            )}
            {parsed.finding_category && (
              <div className="voice-parsed-item">
                <span className="vp-label">Finding</span>
                <span className="vp-value">{parsed.finding_category.replace(/_/g, " ")}</span>
              </div>
            )}
            {parsed.component && (
              <div className="voice-parsed-item">
                <span className="vp-label">Component</span>
                <span className="vp-value">{parsed.component.replace(/_/g, " ")}</span>
              </div>
            )}
            {parsed.impact_object && (
              <div className="voice-parsed-item">
                <span className="vp-label">Object</span>
                <span className="vp-value">{parsed.impact_object.replace(/_/g, " ")}</span>
              </div>
            )}
            {parsed.measured_values && parsed.measured_values.wind_mph && (
              <div className="voice-parsed-item">
                <span className="vp-label">Wind</span>
                <span className="vp-value">{parsed.measured_values.wind_mph + " mph"}</span>
              </div>
            )}
            {parsed.measured_values && parsed.measured_values.impact_speed_mph && (
              <div className="voice-parsed-item">
                <span className="vp-label">Impact Speed</span>
                <span className="vp-value">{parsed.measured_values.impact_speed_mph + " mph"}</span>
              </div>
            )}
            <div className="voice-parsed-item">
              <span className="vp-label">Confidence</span>
              <span className="vp-value">{parsed.confidence + "%"}</span>
            </div>
          </div>
          {parsed.environment_context && parsed.environment_context.length > 0 && (
            <div className="voice-env-chips">
              {parsed.environment_context.map(function(env: string, idx: number) {
                return <span key={idx} className="route-chip chip-env">{env.replace(/_/g, " ")}</span>;
              })}
            </div>
          )}
        </div>
      )}

      {/* INSPECTION PLAN */}
      {plan && (
        <div className="voice-plan-section">
          <div className="voice-plan-header">
            <h2>{plan.title}</h2>
            <div className="voice-plan-badges">
              <span className="voice-severity-badge" style={{ backgroundColor: SEVERITY_COLORS[plan.severity_band] || "#666" }}>
                {(plan.severity_band || "").toUpperCase()}
              </span>
              <span className="voice-disp-badge">
                {DISP_LABELS[plan.operational_disposition] || plan.operational_disposition.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          <p className="voice-plan-summary">{plan.summary}</p>

          {/* IMMEDIATE ACTIONS */}
          {plan.immediate_actions && plan.immediate_actions.length > 0 && (
            <div className="voice-plan-block">
              <h3>{"\u26A0\uFE0F"} Immediate Actions</h3>
              {plan.immediate_actions.map(function(a: string, idx: number) {
                return <div key={idx} className="voice-action-item">{a}</div>;
              })}
            </div>
          )}

          {/* RECOMMENDED METHODS */}
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

          {/* RATIONALE */}
          {plan.rationale && plan.rationale.length > 0 && (
            <div className="voice-plan-block">
              <h3>Rationale</h3>
              {plan.rationale.map(function(r: string, idx: number) {
                return <div key={idx} className="voice-rationale-item">{r}</div>;
              })}
            </div>
          )}

          {/* FOLLOW-UP QUESTIONS */}
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

      {/* EVENT CLASSIFICATION + ENRICHMENT */}
      {enrichment && enrichment.event_classification && (
        <div className="ct-panel" style={{ marginTop: "20px" }}>
          <div className="ct-panel-header">
            <h3 className="ct-title">
              <span className="ct-icon">{"\uD83C\uDFAF"}</span>
              Event Classification
            </h3>
            <span className="ct-family-count">{enrichment.event_classification.confidence + "% confidence"}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", marginTop: "8px" }}>
            <span className="ct-method-badge">{(enrichment.event_classification.event_type || "").toUpperCase()}</span>
            <span className="voice-severity-badge" style={{ backgroundColor: SEVERITY_COLORS[enrichment.event_classification.risk_floor_band] || "#666" }}>
              {"RISK FLOOR: " + enrichment.event_classification.risk_floor_band.toUpperCase()}
            </span>
            {enrichment.rule_pack_applied && (
              <span className="ct-code-family">{"Rule Pack: " + enrichment.rule_pack_applied.rule_pack}</span>
            )}
          </div>
          {enrichment.event_classification.trigger_words_matched && enrichment.event_classification.trigger_words_matched.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", color: "#8b949e" }}>{"Trigger words: "}</span>
              {enrichment.event_classification.trigger_words_matched.map(function(w: string, idx: number) {
                return <span key={"tw-" + idx} className="voice-zone-chip" style={{ marginLeft: "4px" }}>{w}</span>;
              })}
            </div>
          )}
          {enrichment.enrichment_notes && enrichment.enrichment_notes.length > 0 && (
            <div className="ct-section">
              <button className="ct-section-toggle" onClick={function() { toggleSection("enrichment_notes"); }} type="button">
                <span className="ct-section-title">{"Enrichment Log (" + enrichment.enrichment_notes.length + " changes)"}</span>
                <span className="ct-chevron">{expandedSections["enrichment_notes"] ? "\u25B2" : "\u25BC"}</span>
              </button>
              {expandedSections["enrichment_notes"] && (
                <div className="ct-section-body">
                  {enrichment.enrichment_notes.map(function(note: string, idx: number) {
                    return <div key={"note-" + idx} style={{ fontSize: "13px", color: "#c9d1d9", padding: "4px 0", borderBottom: "1px solid #21262d" }}>{note}</div>;
                  })}
                </div>
              )}
            </div>
          )}
          {enrichment.enriched_plan && enrichment.enriched_plan.regulatory_references && enrichment.enriched_plan.regulatory_references.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <span style={{ fontSize: "12px", color: "#8b949e", fontWeight: 600 }}>{"Regulatory Framework: "}</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                {enrichment.enriched_plan.regulatory_references.map(function(reg: string, idx: number) {
                  return <span key={"reg-" + idx} className="ct-code-family">{reg}</span>;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CODE TRACE LOADING */}
      {codeTraceLoading && (
        <div className="ct-loading">
          <div className="ct-loading-spinner"></div>
          Generating code authority trace...
        </div>
      )}

      {/* CODE AUTHORITY TRACE PANEL */}
      {codeTrace && (
        <div className="ct-panel">
          <div className="ct-panel-header">
            <h3 className="ct-title">
              <span className="ct-icon">{"\u2696"}</span>
              Code Authority Trace
            </h3>
            <span className="ct-family-count">{(codeTrace.applicable_code_families || []).length + " code families"}</span>
          </div>
          <p className="ct-subtitle">
            {"Applicable: " + (codeTrace.applicable_code_families || []).join(", ")}
          </p>

          {/* FINDING TRACES */}
          {codeTrace.finding_traces && codeTrace.finding_traces.length > 0 && (
            <div className="ct-section">
              <button className="ct-section-toggle" onClick={function() { toggleSection("findings"); }} type="button">
                <span className="ct-section-title">{"Finding Authority (" + codeTrace.finding_traces.length + ")"}</span>
                <span className="ct-chevron">{expandedSections["findings"] ? "\u25B2" : "\u25BC"}</span>
              </button>
              {expandedSections["findings"] && (
                <div className="ct-section-body">
                  {codeTrace.finding_traces.map(function(ft: any, idx: number) {
                    return (
                      <div key={"ft-" + idx} className="ct-card">
                        <div className="ct-card-header">
                          <span className="ct-finding-name">{ft.display_name}</span>
                          <span className="ct-ref-count">{ft.references.length + " ref" + (ft.references.length !== 1 ? "s" : "")}</span>
                        </div>
                        <div className="ct-physics">{ft.physics_basis}</div>
                        <div className="ct-rejection">{ft.rejection_basis}</div>
                        {ft.references.map(function(ref: any, ridx: number) {
                          return (
                            <div key={"fref-" + ridx} className="ct-ref">
                              <div className="ct-ref-header">
                                <span className="ct-code-family">{ref.code_family + " (" + ref.code_edition + ")"}</span>
                                <span className="ct-clause">{ref.clause}</span>
                              </div>
                              <div className="ct-ref-title">{ref.title}</div>
                              <div className="ct-ref-detail">
                                <div>{"Requirement: " + ref.requirement_summary}</div>
                                <div>{"Acceptance: " + ref.acceptance_criteria}</div>
                                <div className="ct-rationale">{"Rationale: " + ref.engineering_rationale}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* METHOD TRACES */}
          {codeTrace.method_traces && codeTrace.method_traces.length > 0 && (
            <div className="ct-section">
              <button className="ct-section-toggle" onClick={function() { toggleSection("methods"); }} type="button">
                <span className="ct-section-title">{"Method Authority (" + codeTrace.method_traces.length + ")"}</span>
                <span className="ct-chevron">{expandedSections["methods"] ? "\u25B2" : "\u25BC"}</span>
              </button>
              {expandedSections["methods"] && (
                <div className="ct-section-body">
                  {codeTrace.method_traces.map(function(mt: any, idx: number) {
                    return (
                      <div key={"mt-" + idx} className="ct-card">
                        <div className="ct-card-header">
                          <span className="ct-method-badge">{mt.method}</span>
                          <span className="ct-finding-name">{mt.display_name}</span>
                        </div>
                        <div className="ct-capability">{"Capability: " + mt.capability_summary}</div>
                        <div className="ct-limitation">{"Limitation: " + mt.limitation_summary}</div>
                        {mt.references.map(function(ref: any, ridx: number) {
                          return (
                            <div key={"mref-" + ridx} className="ct-ref">
                              <div className="ct-ref-header">
                                <span className="ct-code-family">{ref.code_family + " (" + ref.code_edition + ")"}</span>
                                <span className="ct-clause">{ref.clause}</span>
                              </div>
                              <div className="ct-ref-title">{ref.title}</div>
                              <div className="ct-ref-detail">
                                <div>{"Requirement: " + ref.requirement_summary}</div>
                                <div>{"Rationale: " + ref.engineering_rationale}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* DISPOSITION TRACE */}
          {codeTrace.disposition_trace && (
            <div className="ct-section">
              <button className="ct-section-toggle" onClick={function() { toggleSection("disposition"); }} type="button">
                <span className="ct-section-title">Disposition Authority</span>
                <span className="ct-chevron">{expandedSections["disposition"] ? "\u25B2" : "\u25BC"}</span>
              </button>
              {expandedSections["disposition"] && (
                <div className="ct-section-body">
                  <div className="ct-card ct-disp-card">
                    <div className="ct-card-header">
                      <span className="ct-disp-badge">{(codeTrace.disposition_trace.disposition || "").replace(/_/g, " ").toUpperCase()}</span>
                    </div>
                    <div className="ct-authority-stmt">{codeTrace.disposition_trace.authority_statement}</div>
                    {codeTrace.disposition_trace.references.map(function(ref: any, ridx: number) {
                      return (
                        <div key={"dref-" + ridx} className="ct-ref">
                          <div className="ct-ref-header">
                            <span className="ct-code-family">{ref.code_family + " (" + ref.code_edition + ")"}</span>
                            <span className="ct-clause">{ref.clause}</span>
                          </div>
                          <div className="ct-ref-title">{ref.title}</div>
                          <div className="ct-ref-detail">
                            <div>{"Requirement: " + ref.requirement_summary}</div>
                            <div>{"Rationale: " + ref.engineering_rationale}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCORE DIMENSION TRACES */}
          {codeTrace.score_traces && codeTrace.score_traces.length > 0 && (
            <div className="ct-section">
              <button className="ct-section-toggle" onClick={function() { toggleSection("scores"); }} type="button">
                <span className="ct-section-title">{"Scoring Basis (" + codeTrace.score_traces.length + " dimensions)"}</span>
                <span className="ct-chevron">{expandedSections["scores"] ? "\u25B2" : "\u25BC"}</span>
              </button>
              {expandedSections["scores"] && (
                <div className="ct-section-body">
                  {codeTrace.score_traces.map(function(st: any, idx: number) {
                    return (
                      <div key={"st-" + idx} className="ct-card ct-score-card">
                        <div className="ct-card-header">
                          <span className="ct-dim-name">{(st.dimension || "").replace(/_/g, " ")}</span>
                        </div>
                        <div className="ct-eng-basis">{st.engineering_basis}</div>
                        {st.references.map(function(ref: any, ridx: number) {
                          return (
                            <div key={"sref-" + ridx} className="ct-ref ct-ref-compact">
                              <span className="ct-code-family">{ref.code_family}</span>
                              <span className="ct-clause">{ref.clause}</span>
                              <span className="ct-ref-title-inline">{ref.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* UNDERWATER TRACES */}
          {codeTrace.underwater_traces && codeTrace.underwater_traces.length > 0 && (
            <div className="ct-section">
              <button className="ct-section-toggle" onClick={function() { toggleSection("underwater"); }} type="button">
                <span className="ct-section-title">{"Underwater Regulatory Authority (" + codeTrace.underwater_traces.length + ")"}</span>
                <span className="ct-chevron">{expandedSections["underwater"] ? "\u25B2" : "\u25BC"}</span>
              </button>
              {expandedSections["underwater"] && (
                <div className="ct-section-body">
                  {codeTrace.underwater_traces.map(function(ref: any, ridx: number) {
                    return (
                      <div key={"uwref-" + ridx} className="ct-ref">
                        <div className="ct-ref-header">
                          <span className="ct-code-family">{ref.code_family + " (" + ref.code_edition + ")"}</span>
                          <span className="ct-clause">{ref.clause}</span>
                        </div>
                        <div className="ct-ref-title">{ref.title}</div>
                        <div className="ct-ref-detail">
                          <div>{"Requirement: " + ref.requirement_summary}</div>
                          <div>{"Rationale: " + ref.engineering_rationale}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="ct-footer">
            {"Trace v" + codeTrace.trace_version + " | " + (codeTrace.applicable_code_families || []).length + " code families | Generated " + new Date(codeTrace.generated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
