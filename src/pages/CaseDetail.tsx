/**
 * DEPLOY23_CaseDetail.tsx
 * Deploy to: src/pages/CaseDetail.tsx (REPLACEMENT)
 *
 * Complete case detail page with:
 * - Evidence upload + AI analysis
 * - Measurement input (imperial default, metric toggle)
 * - Formatted physics model (no raw JSON)
 * - Conflict resolution display
 * - Authority Lock decision panel
 * - Teaching placeholder
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MethodBadge from "../components/MethodBadge";
import { DISPOSITION_COLORS } from "../lib/constants";

type TabName = "overview" | "evidence" | "physics" | "findings" | "convergence" | "rules" | "decision" | "teaching";
type UnitSystem = "imperial" | "metric";

// Unit conversion helpers
function inToMm(v: number) { return Math.round(v * 25.4 * 100) / 100; }
function mmToIn(v: number) { return Math.round(v / 25.4 * 10000) / 10000; }

// Measurement field definitions per finding type
var MEAS_FIELDS: Record<string, Array<{ key: string; label: string; stepI: number; stepM: number; maxI: number }>> = {
  undercut: [{ key: "depth", label: "Undercut Depth", stepI: 0.005, stepM: 0.1, maxI: 0.25 }, { key: "length", label: "Undercut Length", stepI: 0.0625, stepM: 1, maxI: 12 }],
  porosity: [{ key: "diameter", label: "Max Pore Diameter", stepI: 0.01, stepM: 0.25, maxI: 0.5 }, { key: "spacing", label: "Pore Spacing", stepI: 0.0625, stepM: 1, maxI: 6 }],
  slag_inclusion: [{ key: "length", label: "Indication Length", stepI: 0.0625, stepM: 1, maxI: 12 }],
  incomplete_fusion: [{ key: "length", label: "Indication Length", stepI: 0.0625, stepM: 1, maxI: 12 }],
  incomplete_penetration: [{ key: "length", label: "Indication Length", stepI: 0.0625, stepM: 1, maxI: 12 }],
  crack: [{ key: "length", label: "Crack Length", stepI: 0.0625, stepM: 1, maxI: 12 }],
  burn_through: [{ key: "diameter", label: "Burn-Through Diameter", stepI: 0.0625, stepM: 1, maxI: 1 }],
  reinforcement: [{ key: "height", label: "Reinforcement Height", stepI: 0.01, stepM: 0.25, maxI: 0.5 }],
  overlap: [{ key: "length", label: "Overlap Length", stepI: 0.0625, stepM: 1, maxI: 12 }],
  hydrogen_cracking: [{ key: "length", label: "Indication Length", stepI: 0.0625, stepM: 1, maxI: 12 }],
};

// Code limits for live comparison (imperial)
var CODE_LIMITS: Record<string, Array<{ code: string; rule: string; limit: number }>> = {
  "undercut:depth": [
    { code: "AWS D1.1", rule: "Static", limit: 0.03125 },
    { code: "AWS D1.1", rule: "Dynamic/Cyclic", limit: 0.01 },
  ],
  "burn_through:diameter": [{ code: "API 1104", rule: "Max", limit: 0.25 }],
  "reinforcement:height": [{ code: "AWS D1.1", rule: "Butt Joint", limit: 0.125 }],
  "porosity:diameter": [{ code: "AWS D1.1", rule: "Individual", limit: 0.09375 }],
};

export default function CaseDetail() {
  var { id } = useParams<{ id: string }>();
  var [caseData, setCaseData] = useState<any | null>(null);
  var [findings, setFindings] = useState<any[]>([]);
  var [rules, setRules] = useState<any[]>([]);
  var [physics, setPhysics] = useState<any | null>(null);
  var [evidence, setEvidence] = useState<any[]>([]);
  var [conflicts, setConflicts] = useState<any[]>([]);
  var [convergence, setConvergence] = useState<any | null>(null);
  var [hypotheses, setHypotheses] = useState<any[]>([]);
  var [activeTab, setActiveTab] = useState<TabName>("overview");
  var [loading, setLoading] = useState(true);

  // Evidence upload
  var [uploading, setUploading] = useState(false);
  var [analyzing, setAnalyzing] = useState(false);
  var [runningAuthority, setRunningAuthority] = useState(false);
  var [runningConvergence, setRunningConvergence] = useState(false);

  // Measurements
  var [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  var [measValues, setMeasValues] = useState<Record<string, Record<string, string>>>({});
  var [measSaved, setMeasSaved] = useState(false);
  var [savingMeas, setSavingMeas] = useState(false);

  useEffect(function() { if (id) loadCase(); }, [id]);

  async function loadCase() {
    setLoading(true);
    var cRes = await supabase.from("inspection_cases").select("*").eq("id", id).single();
    setCaseData(cRes.data);
    var fRes = await supabase.from("findings").select("*").eq("case_id", id).order("created_at", { ascending: true });
    setFindings(fRes.data || []);
    var rRes = await supabase.from("rule_evaluations").select("*").eq("case_id", id).order("created_at", { ascending: true });
    setRules(rRes.data || []);
    var pRes = await supabase.from("physics_reality_models").select("*").eq("case_id", id).single();
    setPhysics(pRes.data);
    var eRes = await supabase.from("evidence").select("*").eq("case_id", id).order("created_at", { ascending: true });
    setEvidence(eRes.data || []);
    // Load conflicts
    try {
      var crRes = await supabase.from("conflict_resolutions").select("*").eq("case_id", id);
      setConflicts(crRes.data || []);
    } catch (e) { setConflicts([]); }
    // Load convergence data
    try {
      var convRes = await supabase.from("ndt_reality_runs").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(1).single();
      if (convRes.data) {
        setConvergence(convRes.data);
        var hypRes = await supabase.from("ndt_reality_hypotheses").select("*").eq("reality_run_id", convRes.data.id).order("rank_position", { ascending: true });
        setHypotheses(hypRes.data || []);
      }
    } catch (e) { setConvergence(null); setHypotheses([]); }
    // Load existing measurements
    try {
      var mRes = await supabase.from("case_measurements").select("*").eq("case_id", id);
      if (mRes.data && mRes.data.length > 0) {
        var populated: Record<string, Record<string, string>> = {};
        for (var i = 0; i < mRes.data.length; i++) {
          var m = mRes.data[i];
          if (!populated[m.finding_type]) populated[m.finding_type] = {};
          populated[m.finding_type][m.measurement_key] = String(m.value_imperial);
        }
        setMeasValues(populated);
        setMeasSaved(true);
      }
    } catch (e) { /* table may not exist yet */ }
    setLoading(false);
  }

  // === EVIDENCE UPLOAD ===
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    var files = e.target.files;
    if (!files || files.length === 0 || !id || !caseData) return;
    setUploading(true);
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var path = id + "/" + Date.now() + "_" + file.name;
      var uploadResult = await supabase.storage.from("ndt-evidence").upload(path, file);
      if (!uploadResult.error) {
        var pubUrl = supabase.storage.from("ndt-evidence").getPublicUrl(path).data.publicUrl;
        await supabase.from("evidence").insert({
          case_id: id, evidence_type: "image", storage_path: path,
          mime_type: file.type, filename: file.name,
          uploaded_by: caseData.created_by, capture_source: "web_upload",
          metadata_json: { public_url: pubUrl }
        });
      }
    }
    await supabase.from("inspection_cases").update({ status: "evidence_uploaded" }).eq("id", id);
    setUploading(false);
    loadCase();
  }

  // === RUN AI ANALYSIS ===
  async function runAnalysis() {
    if (!id) return;
    setAnalyzing(true);
    try {
      var resp = await fetch("/api/run-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: id })
      });
      await resp.json();
    } catch (err) { console.error("Analysis error:", err); }
    setAnalyzing(false);
    loadCase();
  }

  // === MEASUREMENT HANDLING ===
  function handleMeasChange(findingType: string, fieldKey: string, val: string) {
    var updated = Object.assign({}, measValues);
    if (!updated[findingType]) updated[findingType] = {};
    updated[findingType][fieldKey] = val;
    setMeasValues(updated);
    setMeasSaved(false);
  }

  function toggleUnits() {
    var newSys: UnitSystem = unitSystem === "imperial" ? "metric" : "imperial";
    var converted: Record<string, Record<string, string>> = {};
    var types = Object.keys(measValues);
    for (var t = 0; t < types.length; t++) {
      converted[types[t]] = {};
      var keys = Object.keys(measValues[types[t]]);
      for (var k = 0; k < keys.length; k++) {
        var v = parseFloat(measValues[types[t]][keys[k]]);
        if (isNaN(v)) { converted[types[t]][keys[k]] = measValues[types[t]][keys[k]]; }
        else if (newSys === "metric") { converted[types[t]][keys[k]] = String(inToMm(v)); }
        else { converted[types[t]][keys[k]] = String(mmToIn(v)); }
      }
    }
    setMeasValues(converted);
    setUnitSystem(newSys);
  }

  async function saveMeasurements() {
    if (!id) return;
    setSavingMeas(true);
    var types = Object.keys(measValues);
    for (var t = 0; t < types.length; t++) {
      var keys = Object.keys(measValues[types[t]]);
      for (var k = 0; k < keys.length; k++) {
        var raw = parseFloat(measValues[types[t]][keys[k]]);
        if (isNaN(raw) || raw <= 0) continue;
        var impVal = unitSystem === "imperial" ? raw : mmToIn(raw);
        var metVal = unitSystem === "metric" ? raw : inToMm(raw);
        await supabase.from("case_measurements").upsert({
          case_id: id, finding_type: types[t], measurement_key: keys[k],
          value_imperial: impVal, value_metric: metVal,
          unit_imperial: "in", unit_metric: "mm",
          measured_at: new Date().toISOString()
        }, { onConflict: "case_id,finding_type,measurement_key" });
      }
    }
    await supabase.from("inspection_cases").update({ measurement_status: "completed", unit_preference: unitSystem }).eq("id", id);
    setSavingMeas(false);
    setMeasSaved(true);
  }

  // === RUN AUTHORITY LOCK ===
  async function runAuthorityLock() {
    if (!id) return;
    setRunningAuthority(true);
    try {
      var resp = await fetch("/api/run-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: id })
      });
      await resp.json();
    } catch (err) { console.error("Authority error:", err); }
    setRunningAuthority(false);
    loadCase();
  }

  // === RUN REALITY CONVERGENCE ===
  async function runRealityConvergence() {
    if (!id) return;
    setRunningConvergence(true);
    try {
      var resp = await fetch("/api/run-convergence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: id })
      });
      await resp.json();
    } catch (err) { console.error("Convergence error:", err); }
    setRunningConvergence(false);
    loadCase();
  }

  // === HELPERS ===
  function getPassFail(findingType: string, fieldKey: string, value: number) {
    var impVal = unitSystem === "imperial" ? value : mmToIn(value);
    var limits = CODE_LIMITS[findingType + ":" + fieldKey];
    if (!limits) return null;
    for (var i = 0; i < limits.length; i++) {
      if (impVal > limits[i].limit) {
        return { status: "FAIL", detail: limits[i].code + " " + limits[i].rule + ": exceeds " + limits[i].limit + " in" };
      }
    }
    return { status: "PASS", detail: "Within code limits" };
  }

  if (loading || !caseData) return <div className="page-loading">Loading case...</div>;

  // Use label (e.g. "undercut", "slag_inclusion") not finding_type (e.g. "Discontinuity")
  var findingTypes = Array.from(new Set(findings.map(function(f) {
    return (f.label || f.finding_type || "unknown").toLowerCase().replace(/ /g, "_");
  })));

  var TABS: Array<{ key: TabName; label: string }> = [
    { key: "overview", label: "Overview" }, { key: "evidence", label: "Evidence" },
    { key: "physics", label: "Physics Model" }, { key: "findings", label: "Findings" },
    { key: "convergence", label: "Convergence" },
    { key: "rules", label: "Rules" }, { key: "decision", label: "Decision" },
    { key: "teaching", label: "Teaching" },
  ];

  return (
    <div className="page">
      <div className="case-header">
        <div className="case-header-top">
          <span className="case-number">{caseData.case_number}</span>
          <MethodBadge method={caseData.method} size="md" />
          <span className="case-status-badge">{caseData.status.replace(/_/g, " ")}</span>
        </div>
        <h1>{caseData.title}</h1>
        {caseData.final_disposition && (
          <div className="case-disposition-banner" style={{ borderColor: DISPOSITION_COLORS[caseData.final_disposition] || "#333" }}>
            <span className="disposition-label" style={{ color: DISPOSITION_COLORS[caseData.final_disposition] || "#333" }}>
              {caseData.final_disposition.replace(/_/g, " ").toUpperCase()}
            </span>
            {caseData.final_confidence != null && (
              <span className="disposition-confidence">{Math.round(caseData.final_confidence * 100)}% confidence</span>
            )}
            {caseData.authority_locked && <span className="locked-badge">LOCKED</span>}
          </div>
        )}
      </div>

      <div className="tab-bar">
        {TABS.map(function(tab) {
          return (
            <button key={tab.key} className={"tab-btn" + (activeTab === tab.key ? " tab-active" : "")} onClick={function() { setActiveTab(tab.key); }}>
              {tab.label}
              {tab.key === "evidence" && evidence.length > 0 && <span className="tab-count">{evidence.length}</span>}
              {tab.key === "findings" && findings.length > 0 && <span className="tab-count">{findings.length}</span>}
              {tab.key === "convergence" && hypotheses.length > 0 && <span className="tab-count">{hypotheses.length}</span>}
              {tab.key === "rules" && rules.length > 0 && <span className="tab-count">{rules.length}</span>}
            </button>
          );
        })}
      </div>

      <div className="tab-content">

        {/* ========== OVERVIEW ========== */}
        {activeTab === "overview" && (
          <div className="overview-grid">
            <div className="detail-section">
              <h3>Component</h3>
              <p>{caseData.component_name || "Not specified"}</p>
              {caseData.weld_id && <p>Weld: {caseData.weld_id}</p>}
              {caseData.joint_type && <p>Joint: {caseData.joint_type}</p>}
              {caseData.thickness_mm && <p>Thickness: {caseData.thickness_mm} mm</p>}
            </div>
            <div className="detail-section">
              <h3>Material &amp; Loading</h3>
              <p>{caseData.material_class.replace(/_/g, " ")}</p>
              <p>Load: {caseData.load_condition.replace(/_/g, " ")}</p>
            </div>
            <div className="detail-section">
              <h3>Code Context</h3>
              <p>{[caseData.code_family, caseData.code_edition].filter(Boolean).join(" ") || "Not specified"}</p>
              {caseData.code_section && <p>Section: {caseData.code_section}</p>}
            </div>
            <div className="detail-section">
              <h3>4D Energy Model</h3>
              <p>Energy: {caseData.energy_type}</p>
              <p>Interaction: {caseData.interaction_type}</p>
              <p>Response: {caseData.response_type}</p>
              <p>Time: {caseData.time_dimension_type}</p>
            </div>
          </div>
        )}

        {/* ========== EVIDENCE + MEASUREMENTS ========== */}
        {activeTab === "evidence" && (
          <div>
            <div className="evidence-actions">
              <label className="upload-btn">
                {uploading ? "Uploading..." : "Upload Evidence Photos"}
                <input type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ display: "none" }} disabled={uploading} />
              </label>
              <button className="analyze-btn" onClick={runAnalysis} disabled={analyzing || evidence.length === 0}>
                {analyzing ? "Analyzing..." : "Run AI Analysis"}
              </button>
              {findings.length > 0 && (
                <button className="convergence-btn" onClick={runRealityConvergence} disabled={runningConvergence}>
                  {runningConvergence ? "Converging..." : "\uD83E\uDDE0 Run Reality Convergence"}
                </button>
              )}
            </div>

            {evidence.length > 0 && (
              <div className="evidence-grid">
                {evidence.map(function(ev) {
                  var url = ev.metadata_json && ev.metadata_json.public_url ? ev.metadata_json.public_url : "";
                  return (
                    <div key={ev.id} className="evidence-card">
                      {url && <img src={url} alt={ev.filename} className="evidence-img" />}
                      <div className="evidence-info">
                        <strong>{ev.filename}</strong>
                        <span>Type: {ev.evidence_type} | Source: {ev.capture_source}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MEASUREMENT INPUT SECTION */}
            {findings.length > 0 && (
              <div className="measurements-section">
                <div className="meas-header">
                  <h3>Inspector Measurements</h3>
                  <button className={"unit-toggle " + unitSystem} onClick={toggleUnits} type="button">
                    {unitSystem === "imperial" ? "IN (Imperial)" : "MM (Metric)"}
                  </button>
                </div>

                {findingTypes.map(function(ft) {
                  var fields = MEAS_FIELDS[ft] || [{ key: "length", label: "Indication Length", stepI: 0.0625, stepM: 1, maxI: 12 }];
                  var maxConf = Math.max.apply(null, findings.filter(function(f) {
                    return (f.label || f.finding_type || "").toLowerCase().replace(/ /g, "_") === ft;
                  }).map(function(f) { return f.confidence || 0; }));

                  return (
                    <div key={ft} className="meas-finding-group">
                      <div className="meas-group-header">
                        <span className="meas-type-label">{ft.replace(/_/g, " ").toUpperCase()}</span>
                        <span className="meas-ai-conf">AI: {Math.round(maxConf * 100)}%</span>
                      </div>
                      {fields.map(function(field) {
                        var val = measValues[ft] ? measValues[ft][field.key] || "" : "";
                        var numVal = parseFloat(val);
                        var pf = !isNaN(numVal) && numVal > 0 ? getPassFail(ft, field.key, numVal) : null;
                        var limits = CODE_LIMITS[ft + ":" + field.key] || [];

                        return (
                          <div key={field.key} className="meas-field-row">
                            <label className="meas-label">{field.label}</label>
                            <div className="meas-input-group">
                              <input type="number" className="meas-input" value={val}
                                onChange={function(e) { handleMeasChange(ft, field.key, e.target.value); }}
                                step={unitSystem === "imperial" ? field.stepI : field.stepM}
                                min={0} max={unitSystem === "imperial" ? field.maxI : inToMm(field.maxI)}
                                placeholder={"0.000 " + (unitSystem === "imperial" ? "in" : "mm")} />
                              <span className="meas-unit">{unitSystem === "imperial" ? "in" : "mm"}</span>
                            </div>
                            {pf && (
                              <div className={"meas-verdict verdict-" + pf.status.toLowerCase()}>
                                <span className="verdict-icon">{pf.status === "PASS" ? "\u2713" : "\u2717"}</span>
                                <span>{pf.status} - {pf.detail}</span>
                              </div>
                            )}
                            {limits.length > 0 && (
                              <div className="code-limits-row">
                                {limits.map(function(lim, idx) {
                                  return (
                                    <span key={idx} className="code-limit-chip">
                                      {lim.code}: {unitSystem === "imperial" ? lim.limit + " in" : inToMm(lim.limit) + " mm"} ({lim.rule})
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div className="meas-actions">
                  <button className="save-meas-btn" onClick={saveMeasurements} disabled={savingMeas} type="button">
                    {savingMeas ? "Saving..." : measSaved ? "\u2713 Measurements Saved" : "Save Measurements"}
                  </button>
                  {measSaved && (
                    <button className="authority-btn" onClick={runAuthorityLock} disabled={runningAuthority} type="button">
                      {runningAuthority ? "Locking Decision..." : "\uD83D\uDD12 Run Authority Lock"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== PHYSICS MODEL (formatted) ========== */}
        {activeTab === "physics" && (
          <div>
            {physics ? (
              <div className="physics-model">
                <div className="detail-section">
                  <h3>Probable Discontinuities (Predicted Before Inspection)</h3>
                  {physics.probable_discontinuities_json && physics.probable_discontinuities_json.length > 0 ? (
                    <div className="predictions-list">
                      {physics.probable_discontinuities_json.map(function(d: any, i: number) {
                        return (
                          <div key={i} className="prediction-card">
                            <strong>{(d.type || d.label || "Unknown").replace(/_/g, " ")}</strong>
                            {d.probability && <span className="prediction-prob">{d.probability}</span>}
                            {d.typical_location && <p>Likely location: {d.typical_location.replace(/_/g, " ")}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ) : <p>No predictions generated yet.</p>}
                </div>

                {/* Formatted Method Capability Map */}
                {physics.method_capability_map_json && (
                  <div className="detail-section">
                    <h3>Method Capability Map</h3>
                    <div className="capability-grid">
                      {physics.method_capability_map_json.ferromagnetic !== undefined && (
                        <div className="capability-card">
                          <span className="cap-label">Ferromagnetic</span>
                          <span className={"cap-value cap-" + (physics.method_capability_map_json.ferromagnetic ? "yes" : "no")}>
                            {physics.method_capability_map_json.ferromagnetic ? "Yes" : "No"}
                          </span>
                        </div>
                      )}
                      {["mt_applicable", "pt_applicable", "et_applicable"].map(function(key) {
                        if (physics.method_capability_map_json[key] === undefined) return null;
                        var method = key.split("_")[0].toUpperCase();
                        return (
                          <div key={key} className="capability-card">
                            <span className="cap-label">{method} Applicable</span>
                            <span className={"cap-value cap-" + (physics.method_capability_map_json[key] ? "yes" : "no")}>
                              {physics.method_capability_map_json[key] ? "Yes" : "No"}
                            </span>
                          </div>
                        );
                      })}
                      {physics.method_capability_map_json.ut_notes && (
                        <div className="capability-note"><strong>UT:</strong> {physics.method_capability_map_json.ut_notes}</div>
                      )}
                      {physics.method_capability_map_json.rt_notes && (
                        <div className="capability-note"><strong>RT:</strong> {physics.method_capability_map_json.rt_notes}</div>
                      )}
                      {physics.method_capability_map_json.et_notes && (
                        <div className="capability-note"><strong>ET:</strong> {physics.method_capability_map_json.et_notes}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Formatted Material Properties */}
                {physics.material_properties_json && (
                  <div className="detail-section">
                    <h3>Material Properties</h3>
                    <div className="material-grid">
                      {physics.material_properties_json.material_name && (
                        <div className="mat-card"><span className="mat-label">Material</span><span className="mat-value">{physics.material_properties_json.material_name}</span></div>
                      )}
                      {physics.material_properties_json.density_kg_m3 && (
                        <div className="mat-card"><span className="mat-label">Density</span><span className="mat-value">{physics.material_properties_json.density_kg_m3} kg/m3</span></div>
                      )}
                      {physics.material_properties_json.acoustic_velocity_longitudinal_ms && (
                        <div className="mat-card"><span className="mat-label">Longitudinal Velocity</span><span className="mat-value">{physics.material_properties_json.acoustic_velocity_longitudinal_ms} m/s</span></div>
                      )}
                      {physics.material_properties_json.acoustic_velocity_shear_ms && (
                        <div className="mat-card"><span className="mat-label">Shear Velocity</span><span className="mat-value">{physics.material_properties_json.acoustic_velocity_shear_ms} m/s</span></div>
                      )}
                      {physics.material_properties_json.acoustic_impedance && (
                        <div className="mat-card"><span className="mat-label">Acoustic Impedance</span><span className="mat-value">{physics.material_properties_json.acoustic_impedance} MRayl</span></div>
                      )}
                      {physics.material_properties_json.magnetic_permeability && (
                        <div className="mat-card"><span className="mat-label">Magnetic Permeability</span><span className="mat-value">{physics.material_properties_json.magnetic_permeability}</span></div>
                      )}
                      {physics.material_properties_json.electrical_conductivity_ms_m && (
                        <div className="mat-card"><span className="mat-label">Electrical Conductivity</span><span className="mat-value">{physics.material_properties_json.electrical_conductivity_ms_m} MS/m</span></div>
                      )}
                      {physics.material_properties_json.attenuation_coefficient && (
                        <div className="mat-card"><span className="mat-label">Attenuation</span><span className="mat-value">{physics.material_properties_json.attenuation_coefficient} dB/mm</span></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="empty-state"><p>Physics model not yet generated.</p></div>}
          </div>
        )}

        {/* ========== FINDINGS + CONFLICT RESOLUTION ========== */}
        {activeTab === "findings" && (
          <div>
            {conflicts.length > 0 && (
              <div className="conflict-summary">
                <h3>Dual AI Conflict Resolution</h3>
                {conflicts.map(function(c, idx) {
                  return (
                    <div key={idx} className={"conflict-card conflict-" + c.resolution_method.toLowerCase()}>
                      <div className="conflict-header">
                        <span className="conflict-type">{(c.finding_type || "").replace(/_/g, " ")}</span>
                        <span className="conflict-method">{(c.resolution_method || "").replace(/_/g, " ")}</span>
                      </div>
                      <div className="conflict-scores">
                        <span>GPT-4o: {c.openai_confidence ? Math.round(c.openai_confidence * 100) + "%" : "N/A"}</span>
                        <span>Claude: {c.claude_confidence ? Math.round(c.claude_confidence * 100) + "%" : "N/A"}</span>
                        <span className="conflict-resolved">Resolved: {Math.round((c.resolved_confidence || 0) * 100)}%</span>
                      </div>
                      <p className="conflict-reasoning">{c.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            )}
            {findings.length === 0 ? (
              <div className="empty-state"><p>No findings yet. Upload evidence and run the AI analysis.</p></div>
            ) : (
              <div className="findings-list">
                {findings.map(function(f) {
                  return (
                    <div key={f.id} className="finding-card">
                      <div className="finding-header">
                        <span className={"finding-source finding-source-" + f.source}>{f.source.toUpperCase()}</span>
                        <span className="finding-type">{f.finding_type.replace(/_/g, " ")}</span>
                        {f.severity && <span className={"severity-badge severity-" + f.severity}>{f.severity.toUpperCase()}</span>}
                      </div>
                      <div className="finding-label">{f.label}</div>
                      {f.location_ref && <div className="finding-location">Location: {f.location_ref.replace(/_/g, " ")}</div>}
                      {f.confidence != null && <div className="finding-confidence">Confidence: {Math.round(f.confidence * 100)}%</div>}
                      {f.structured_json && f.structured_json.reasoning && (
                        <div className="finding-reasoning">{f.structured_json.reasoning}</div>
                      )}
                      {f.structured_json && f.structured_json.possible_causes && (
                        <div className="finding-causes">Possible causes: {f.structured_json.possible_causes}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========== CONVERGENCE (Reality Engine) ========== */}
        {activeTab === "convergence" && (
          <div>
            {convergence ? (
              <div className="convergence-panel">
                <div className={"convergence-status-banner conv-" + convergence.convergence_status}>
                  <span className="conv-status-label">{convergence.convergence_status.toUpperCase()}</span>
                  {convergence.dominant_reality && (
                    <span className="conv-dominant">
                      {convergence.dominant_reality.replace(/_/g, " ").toUpperCase()}
                      {" \u2014 " + (convergence.dominant_score * 100).toFixed(0) + "% confidence"}
                    </span>
                  )}
                </div>

                {/* Summary */}
                <div className="conv-summary">
                  <div className="conv-what"><h3>WHAT</h3><p>{convergence.summary_what}</p></div>
                  <div className="conv-why"><h3>WHY</h3><p>{convergence.summary_why}</p></div>
                  <div className="conv-how"><h3>HOW</h3><p>{convergence.summary_how}</p></div>
                </div>

                {/* Why Not - eliminated alternatives */}
                {convergence.summary_why_not && convergence.summary_why_not.length > 0 && (
                  <div className="conv-why-not">
                    <h3>WHY NOT (Eliminated Alternatives)</h3>
                    {convergence.summary_why_not.map(function(reason: string, idx: number) {
                      return <div key={idx} className="why-not-item">{reason}</div>;
                    })}
                  </div>
                )}

                {/* Ranked Hypotheses */}
                {hypotheses.length > 0 && (
                  <div className="conv-hypotheses">
                    <h3>Ranked Reality Hypotheses ({hypotheses.length} tested)</h3>
                    {hypotheses.map(function(hyp: any, idx: number) {
                      return (
                        <div key={idx} className={"hypothesis-card hyp-" + (hyp.rank_position === 1 ? "dominant" : hyp.plausible ? "plausible" : "eliminated")}>
                          <div className="hyp-header">
                            <span className="hyp-rank">#{hyp.rank_position}</span>
                            <span className="hyp-type">{hyp.defect_type.replace(/_/g, " ").toUpperCase()}</span>
                            <span className="hyp-score">{(hyp.total_score * 100).toFixed(0)}%</span>
                            {hyp.plausible ? (
                              <span className="hyp-badge hyp-plausible-badge">Plausible</span>
                            ) : (
                              <span className="hyp-badge hyp-eliminated-badge">Eliminated</span>
                            )}
                          </div>

                          {/* Score breakdown */}
                          <div className="hyp-scores">
                            <div className="score-bar-group">
                              <span className="score-label">Evidence</span>
                              <div className="score-bar"><div className="score-fill" style={{ width: (hyp.evidence_consistency * 100) + "%" }}></div></div>
                              <span className="score-val">{(hyp.evidence_consistency * 100).toFixed(0)}%</span>
                            </div>
                            <div className="score-bar-group">
                              <span className="score-label">Location</span>
                              <div className="score-bar"><div className="score-fill" style={{ width: (hyp.location_consistency * 100) + "%" }}></div></div>
                              <span className="score-val">{(hyp.location_consistency * 100).toFixed(0)}%</span>
                            </div>
                            <div className="score-bar-group">
                              <span className="score-label">Morphology</span>
                              <div className="score-bar"><div className="score-fill" style={{ width: (hyp.morphology_consistency * 100) + "%" }}></div></div>
                              <span className="score-val">{(hyp.morphology_consistency * 100).toFixed(0)}%</span>
                            </div>
                            <div className="score-bar-group">
                              <span className="score-label">Process</span>
                              <div className="score-bar"><div className="score-fill" style={{ width: (hyp.process_consistency * 100) + "%" }}></div></div>
                              <span className="score-val">{(hyp.process_consistency * 100).toFixed(0)}%</span>
                            </div>
                            <div className="score-bar-group">
                              <span className="score-label">Material</span>
                              <div className="score-bar"><div className="score-fill" style={{ width: (hyp.material_consistency * 100) + "%" }}></div></div>
                              <span className="score-val">{(hyp.material_consistency * 100).toFixed(0)}%</span>
                            </div>
                            <div className="score-bar-group">
                              <span className="score-label">Method</span>
                              <div className="score-bar"><div className="score-fill" style={{ width: (hyp.method_consistency * 100) + "%" }}></div></div>
                              <span className="score-val">{(hyp.method_consistency * 100).toFixed(0)}%</span>
                            </div>
                            {hyp.contradiction_penalty > 0 && (
                              <div className="score-bar-group penalty">
                                <span className="score-label">Penalty</span>
                                <div className="score-bar penalty-bar"><div className="score-fill penalty-fill" style={{ width: (hyp.contradiction_penalty * 100) + "%" }}></div></div>
                                <span className="score-val">-{(hyp.contradiction_penalty * 100).toFixed(0)}%</span>
                              </div>
                            )}
                          </div>

                          {/* Support and rejection reasons */}
                          {hyp.why_it_fits && <div className="hyp-fits"><strong>Why it fits:</strong> {hyp.why_it_fits}</div>}
                          {hyp.why_it_does_not_fully_fit && <div className="hyp-doesnt-fit"><strong>Why it doesn't fully fit:</strong> {hyp.why_it_does_not_fully_fit}</div>}

                          {hyp.probable_causes && hyp.probable_causes.length > 0 && (
                            <div className="hyp-causes">
                              <strong>Probable causes:</strong> {hyp.probable_causes.join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Escalation recommendation */}
                {convergence.recommended_next_method && (
                  <div className="conv-escalation">
                    <strong>Recommended next method:</strong> {convergence.recommended_next_method}
                    {convergence.escalation_reason && <p>{convergence.escalation_reason}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <p>Reality convergence not yet run. Click "Run Reality Convergence" on the Evidence tab after AI analysis.</p>
              </div>
            )}
          </div>
        )}

        {/* ========== RULES ========== */}
        {activeTab === "rules" && (
          <div>
            {rules.length === 0 ? (
              <div className="empty-state"><p>No rule evaluations yet.</p></div>
            ) : (
              <div className="rules-list">
                {rules.map(function(r) {
                  return (
                    <div key={r.id} className={"rule-card rule-" + (r.passed === true ? "pass" : r.passed === false ? "fail" : "na")}>
                      <div className="rule-header">
                        <span className="rule-status-icon">{r.passed === true ? "\u2713" : r.passed === false ? "\u2717" : "\u2014"}</span>
                        <span className="rule-name">{r.rule_name}</span>
                        <span className="rule-class">{r.rule_class.replace(/_/g, " ")}</span>
                      </div>
                      <div className="rule-explanation">{r.explanation}</div>
                      {r.engineering_basis_cited && <div className="rule-basis"><strong>Engineering basis:</strong> {r.engineering_basis_cited}</div>}
                      {r.output_snapshot_json && r.output_snapshot_json.evidence_chain && (
                        <div className="rule-chain"><strong>Evidence chain:</strong> {r.output_snapshot_json.evidence_chain}</div>
                      )}
                      {r.input_snapshot_json && r.input_snapshot_json.measured_value_imperial != null && (
                        <div className="rule-measurement">
                          <strong>Measured:</strong> {r.input_snapshot_json.measured_value_imperial.toFixed(4)} in
                          {r.input_snapshot_json.threshold_imperial != null && (
                            <span> | <strong>Limit:</strong> {r.input_snapshot_json.threshold_imperial.toFixed(4)} in</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========== DECISION (Authority Lock) ========== */}
        {activeTab === "decision" && (
          <div>
            {caseData.authority_locked && (
              <div className="authority-locked-banner">
                <span className="lock-icon">{"\uD83D\uDD12"}</span>
                <span>DECISION LOCKED by Inspection Authority Engine</span>
                {caseData.authority_locked_at && (
                  <span className="lock-time">{new Date(caseData.authority_locked_at).toLocaleString()}</span>
                )}
              </div>
            )}
            {caseData.truth_engine_summary ? (
              <div className="decision-panel">
                <div className="decision-what">
                  <h3>WHAT</h3>
                  <p>{caseData.truth_engine_summary}</p>
                </div>
                <div className="decision-why">
                  <h3>WHY</h3>
                  <p>{caseData.final_decision_reason || "No detailed reason available."}</p>
                </div>
                <div className="decision-how">
                  <h3>HOW</h3>
                  <p>{caseData.final_disposition === "reject"
                    ? "Repair per governing procedure and code. Re-inspect after repair using the same method and acceptance criteria. Document defect location and type."
                    : caseData.final_disposition === "review_required"
                    ? "Enter measurements in the Evidence tab, then click Run Authority Lock to finalize the disposition."
                    : "Proceed per governing procedure. Archive inspection record with evidence trail."
                  }</p>
                </div>
                {caseData.authority_evidence && (
                  <div className="authority-evidence-summary">
                    <h3>Authority Evidence</h3>
                    <div className="evidence-stats">
                      <span className="stat">Rules Evaluated: {caseData.authority_evidence.rules_evaluated}</span>
                      <span className="stat stat-pass">Passed: {caseData.authority_evidence.rules_passed}</span>
                      <span className="stat stat-fail">Failed: {caseData.authority_evidence.rules_failed}</span>
                      <span className="stat">N/A: {caseData.authority_evidence.rules_na}</span>
                      <span className="stat">Measurements: {caseData.authority_evidence.measurements_provided}</span>
                    </div>
                  </div>
                )}
                {caseData.ai_openai_summary && (
                  <div className="detail-section" style={{ marginTop: "16px" }}>
                    <h3>GPT-4o Observation Summary</h3>
                    <p>{caseData.ai_openai_summary}</p>
                  </div>
                )}
                {caseData.ai_claude_summary && (
                  <div className="detail-section" style={{ marginTop: "16px" }}>
                    <h3>Claude Reasoning Summary</h3>
                    <p>{caseData.ai_claude_summary}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <p>Decision not yet generated. Upload evidence and run the AI analysis, then enter measurements and lock the decision.</p>
              </div>
            )}
          </div>
        )}

        {/* ========== TEACHING ========== */}
        {activeTab === "teaching" && (
          <div className="empty-state"><p>Teaching intelligence coming in Phase 2.</p></div>
        )}

      </div>
    </div>
  );
}
