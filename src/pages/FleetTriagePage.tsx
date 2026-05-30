// @ts-nocheck
// ============================================================================
// FleetTriagePage.tsx  -  FORGED 4D NDT  -  DEPLOY405
//
// Multi-asset triage. Paste several scenarios (separated by a line of ===),
// run them sequentially through the SAME pipeline the single-asset page uses
// (parse-incident -> resolve-asset -> reality-lock -> decision-core -> SA
// orchestrate), then rank them with the deterministic fleet-triage engine into
// a single defensible ORDER OF ACTION (e.g. several platforms in a storm path).
//
// Self-contained: does NOT touch the single-asset flow. Unattended (no question
// or evidence pauses). Per-asset extraction is fully defensive - a failed call
// degrades that asset gracefully rather than breaking the batch.
// ============================================================================
import { useState } from "react";
import { supabase } from "../lib/supabase";

var API_BASE = "/api";

async function callAPI(endpoint, body) {
  var headers = { "Content-Type": "application/json" };
  try {
    var sess = await supabase.auth.getSession();
    var token = (sess && sess.data && sess.data.session && sess.data.session.access_token) ? sess.data.session.access_token : "";
    if (token) { headers["Authorization"] = "Bearer " + token; }
  } catch (e) { /* unauthenticated -> proceed */ }
  var res = await fetch(API_BASE + "/" + endpoint, { method: "POST", headers: headers, body: JSON.stringify(body) });
  if (!res.ok) { var t = await res.text(); throw new Error(endpoint + " (" + res.status + "): " + t); }
  return res.json();
}

// Split a paste into individual scenarios on a delimiter line of === or ---.
function splitScenarios(text) {
  if (!text) { return []; }
  var parts = text.split(/\n\s*[=\-]{3,}\s*\n/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = (parts[i] || "").trim();
    if (p.length > 0) { out.push(p); }
  }
  return out;
}

function deriveName(scenario, idx) {
  var m = scenario.match(/(?:asset|platform|unit|line|equipment)\s*[:\-]\s*([^\n]+)/i);
  if (m && m[1]) { return m[1].trim().slice(0, 70); }
  var firstLine = (scenario.split("\n")[0] || "").trim();
  if (firstLine.length > 0) { return firstLine.slice(0, 70); }
  return "Asset " + (idx + 1);
}

function detectStorm(scenario) {
  var lt = scenario.toLowerCase();
  return /hurricane|typhoon|cyclone|tropical storm|storm path|in the path of|storm surge|named storm|category \d/.test(lt);
}

// Run the headless pipeline for one scenario; return a defensive summary.
async function runOne(scenario, stormGlobal) {
  var summary = {
    name: "", consequence_tier: "UNKNOWN", disposition: null,
    governing_failure_mode: null, governing_severity: null,
    future_state: null, support_failure_governs: false, support_cascade: false,
    org_failure_score: 0, confidence_band: null, storm_exposure: false,
    _error: null
  };
  try {
    var parseRes = await callAPI("parse-incident", { transcript: scenario });
    var parsed = (parseRes && (parseRes.parsed || parseRes)) || {};
    var assetRes = await callAPI("resolve-asset", { raw_text: scenario });
    var asset = (assetRes && (assetRes.resolved || assetRes)) || {};
    var rlResult = null;
    try {
      var rlRes = await callAPI("reality-lock", { transcript: scenario, parsed_asset_class: asset.asset_class || "unknown", parsed_asset_confidence: asset.confidence || 0 });
      rlResult = (rlRes && (rlRes.reality_lock || rlRes)) || null;
      if (rlResult && rlResult.asset_conflict && rlResult.asset_override) {
        asset = { asset_class: rlResult.asset_override, asset_type: rlResult.asset_override, confidence: asset.confidence || 0.5 };
      }
    } catch (e) { /* reality-lock optional */ }

    var coreRes = await callAPI("decision-core", {
      parsed: parsed, asset: asset, confirmed_flags: {}, transcript: scenario,
      reality_lock: rlResult, evidence_provenance: null, authority_lock: null, sa_responses: []
    });
    var dc = (coreRes && (coreRes.decision_core || coreRes)) || {};
    var con = dc.consequence_reality || {};
    var dec = dc.decision_reality || {};
    var conf = dc.reality_confidence || {};
    summary.consequence_tier = con.consequence_tier || "UNKNOWN";
    summary.disposition = dec.disposition || null;
    summary.governing_failure_mode = con.failure_mode || null;
    summary.support_failure_governs = !!con.support_failure_governs;
    summary.support_cascade = !!con.support_cascade;
    summary.confidence_band = conf.band || null;

    // SA orchestrate (future-state + organizational) - best effort.
    try {
      if (coreRes && coreRes.decisionPackage) {
        var ves = (coreRes.decision_core && coreRes.decision_core.validated_evidence_set) ? coreRes.decision_core.validated_evidence_set : null;
        var saRes = await callAPI("situational-awareness-orchestrate", {
          decisionPackage: coreRes.decisionPackage, validatedEvidenceSet: ves,
          signals: { transcript: scenario }, referenceIso: new Date().toISOString()
        });
        var sap = (saRes && saRes.situationalAwarenessPackage) || {};
        if (sap.futureState) {
          summary.future_state = {
            verdict: sap.futureState.verdict || null,
            dominant_driver_label: (sap.futureState.dominant_driver && sap.futureState.dominant_driver.label) ? sap.futureState.dominant_driver.label : null
          };
        }
        if (sap.organizationalFailures && typeof sap.organizationalFailures.organizational_failure_score === "number") {
          summary.org_failure_score = sap.organizationalFailures.organizational_failure_score;
        }
      }
    } catch (e) { /* SA optional */ }
  } catch (e) {
    summary._error = (e && e.message) ? e.message : String(e);
  }
  summary.storm_exposure = stormGlobal || detectStorm(scenario);
  return summary;
}

function bandColor(band) {
  if (band === "IMMEDIATE") { return "#dc2626"; }
  if (band === "PRIORITY") { return "#ea580c"; }
  if (band === "ELEVATED") { return "#ca8a04"; }
  return "#16a34a";
}

export default function FleetTriagePage() {
  var [input, setInput] = useState("");
  var [stormGlobal, setStormGlobal] = useState(false);
  var [running, setRunning] = useState(false);
  var [progress, setProgress] = useState([]);
  var [result, setResult] = useState(null);
  var [error, setError] = useState(null);

  async function run() {
    setError(null); setResult(null);
    var scenarios = splitScenarios(input);
    if (scenarios.length === 0) { setError("Paste at least one scenario. Separate multiple scenarios with a line of ==="); return; }
    setRunning(true);
    var prog = [];
    for (var i = 0; i < scenarios.length; i++) { prog.push({ name: deriveName(scenarios[i], i), status: "pending" }); }
    setProgress(prog.slice());
    var summaries = [];
    for (var j = 0; j < scenarios.length; j++) {
      prog[j].status = "running"; setProgress(prog.slice());
      var sum = await runOne(scenarios[j], stormGlobal);
      sum.name = deriveName(scenarios[j], j);
      summaries.push(sum);
      prog[j].status = sum._error ? "error" : "done";
      prog[j].detail = sum._error ? sum._error : (sum.consequence_tier + " / " + (sum.disposition || "?"));
      setProgress(prog.slice());
    }
    try {
      var rankRes = await callAPI("fleet-triage", { assets: summaries });
      setResult(rankRes);
    } catch (e) {
      setError("Ranking failed: " + ((e && e.message) ? e.message : String(e)));
    }
    setRunning(false);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Fleet Triage</h1>
      <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 16 }}>
        Rank multiple assets into one order of action. Paste several scenarios, separated by a line of <code>===</code>.
        Each runs through the full analysis pipeline, then they are ranked by an auditable urgency score
        (consequence, disposition, governing risk, forward exposure, support cascade, organizational risk, confidence, storm exposure).
      </div>

      <textarea
        value={input}
        onChange={function (e) { setInput(e.target.value); }}
        placeholder={"Platform A: ...scenario...\n===\nPlatform B: ...scenario...\n===\nPlatform C: ...scenario..."}
        style={{ width: "100%", height: 220, fontFamily: "monospace", fontSize: 12, padding: 12, background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 8 }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={stormGlobal} onChange={function (e) { setStormGlobal(e.target.checked); }} />
          All assets are in an imminent storm / hurricane path
        </label>
        <button onClick={run} disabled={running}
          style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700, color: "#fff", background: running ? "#6b7280" : "#238636", border: "none", borderRadius: 6, cursor: running ? "not-allowed" : "pointer" }}>
          {running ? "Running..." : "Run Fleet Triage"}
        </button>
      </div>

      {error && <div style={{ background: "#3d1418", border: "1px solid #f85149", borderRadius: 6, padding: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {progress.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {progress.map(function (p, i) {
            var c = p.status === "done" ? "#16a34a" : p.status === "error" ? "#f85149" : p.status === "running" ? "#d29922" : "#8b949e";
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid #21262d" }}>
                <span>{p.name}</span>
                <span style={{ color: c }}>{p.status}{p.detail ? " — " + p.detail : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {result && result.fleet_summary && (
        <div>
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#8b949e", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Order of action</div>
            <div style={{ fontSize: 14 }}>{result.fleet_summary.narrative}</div>
          </div>
          {result.ranked.map(function (a, i) {
            var col = bandColor(a.urgency_band);
            return (
              <div key={i} style={{ border: "1px solid #30363d", borderLeft: "5px solid " + col, borderRadius: 8, padding: 14, marginBottom: 10, background: "#0d1117" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>#{a.urgency_rank}. {a.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: col }}>{a.urgency_band} — {a.urgency_score}/100</div>
                </div>
                <div style={{ fontSize: 12, color: "#8b949e", margin: "4px 0" }}>
                  {String(a.consequence_tier).toUpperCase()}{a.disposition ? " · " + String(a.disposition).replace(/_/g, " ") : ""}{a.governing_failure_mode ? " · governing: " + a.governing_failure_mode : ""}
                </div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>{a.recommended_action}</div>
                <div style={{ fontSize: 11, color: "#8b949e" }}>
                  {(a.drivers || []).map(function (d) { return d.axis + " +" + d.points; }).join("  ·  ")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
