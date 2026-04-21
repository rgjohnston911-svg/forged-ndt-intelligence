/**
 * DEPLOY209 — NewCase.tsx
 * Unifies new-case creation on the `inspection_cases` table.
 *
 * Before DEPLOY209 the form inserted into a legacy `cases` table while
 * CaseDetail + Dashboard + every netlify function read from `inspection_cases`,
 * which left every newly-created case stuck on "Loading case...".
 *
 * Now this page calls /.netlify/functions/create-case which writes to
 * `inspection_cases` with all required NOT NULL / CHECK columns filled in.
 *
 * CONSTRAINTS: var only, no template literals, @ts-nocheck friendly.
 */
// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

var NDT_METHODS = ["VT", "PT", "MT", "UT", "RT", "ET"];

var ASSET_CLASS_OPTIONS = [
  "Pressure Vessel", "Piping", "Pipeline", "Tank", "Heat Exchanger",
  "Boiler", "Storage Sphere", "Offshore Structure", "Saturation Diving System", "Bridge"
];

var ASSET_CLASS_TO_ENGINE = {
  "Pressure Vessel": "pressure_vessel",
  "Piping": "piping",
  "Pipeline": "piping",
  "Tank": "tank",
  "Heat Exchanger": "pressure_vessel",
  "Boiler": "pressure_vessel",
  "Storage Sphere": "pressure_vessel",
  "Offshore Structure": "offshore_platform",
  "Saturation Diving System": "pressure_vessel",
  "Bridge": "bridge"
};

export default function NewCase() {
  var navigate = useNavigate();
  var [title, setTitle] = useState("");
  var [method, setMethod] = useState("VT");
  var [assetName, setAssetName] = useState("");
  var [assetClass, setAssetClass] = useState("Pressure Vessel");
  var [location, setLocation] = useState("");
  var [description, setDescription] = useState("");
  var [events, setEvents] = useState("");
  var [measurements, setMeasurements] = useState("");
  var [submitting, setSubmitting] = useState(false);
  var [statusMsg, setStatusMsg] = useState("");
  var [error, setError] = useState("");

  function buildTranscript() {
    var parts = [];
    parts.push("ASSET: " + assetName + " (" + assetClass + ")");
    if (location) parts.push("LOCATION: " + location);
    if (description) parts.push("DESCRIPTION: " + description);
    if (events) parts.push("EVENTS / HISTORY: " + events);
    if (measurements) parts.push("MEASUREMENTS / DATA: " + measurements);
    return parts.join("\n");
  }

  async function createCase(runEvaluate) {
    if (!title.trim() || !assetName.trim()) {
      setError("Title and Asset Name are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    setStatusMsg("Creating case...");

    try {
      // Get the current session token so create-case can auth the caller.
      var sessRes = await supabase.auth.getSession();
      var token = (sessRes.data && sessRes.data.session && sessRes.data.session.access_token) || "";
      if (!token) {
        setError("You must be signed in to create a case.");
        setSubmitting(false);
        setStatusMsg("");
        return;
      }

      var engineAssetClass = ASSET_CLASS_TO_ENGINE[assetClass] || "pressure_vessel";
      var transcript = buildTranscript();

      // Call create-case netlify function -- writes to inspection_cases.
      var createResp = await fetch("/api/create-case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          method: method,
          component: assetName.trim(),
          inspectionContext: null,
          materialClass: "",
          materialFamily: "",
          surfaceType: null,
          serviceEnvironment: null,
          lifecycleStage: null,
          industrySector: null,
          assetType: assetClass
        })
      });

      var createJson = await createResp.json();
      if (!createResp.ok || !createJson.caseId) {
        throw new Error((createJson && createJson.error) ? createJson.error : ("create-case failed: " + createResp.status));
      }

      var caseId = createJson.caseId;

      // Patch the case with the user-entered title + context fields.
      // Only write columns we know exist across the schema.
      var patch = { title: title.trim() };
      // Some schemas have running_transcript; write if present -- ignore failure.
      try {
        var patchRes = await supabase
          .from("inspection_cases")
          .update({ title: title.trim(), running_transcript: transcript })
          .eq("id", caseId);
        if (patchRes.error) {
          // Fall back to just the title if running_transcript column doesn't exist.
          await supabase.from("inspection_cases").update(patch).eq("id", caseId);
        }
      } catch (patchErr) {
        await supabase.from("inspection_cases").update(patch).eq("id", caseId);
      }

      setStatusMsg("Case created.");

      if (runEvaluate) {
        setStatusMsg("Running initial analysis...");
        try {
          await fetch("/api/run-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ case_id: caseId })
          });
        } catch (evalErr) {
          // Non-fatal -- user can retry from CaseDetail.
          console.error("run-analysis failed:", evalErr);
        }
      }

      setStatusMsg("Opening case...");
      navigate("/cases/" + caseId);
    } catch (err) {
      setError("Failed to create case: " + (err.message || String(err)));
      setSubmitting(false);
      setStatusMsg("");
    }
  }

  function handleCreateOnly() { createCase(false); }
  function handleCreateAndEvaluate() { createCase(true); }

  var inputStyle = {
    width: "100%", padding: "10px 14px", backgroundColor: "#1e293b",
    border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc",
    fontSize: "14px", outline: "none", boxSizing: "border-box"
  };

  var labelStyle = {
    display: "block", fontSize: "13px", fontWeight: "600", color: "#94a3b8",
    marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px"
  };

  return (
    <div style={{ padding: "24px", maxWidth: "720px", margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <button
          onClick={function() { navigate("/cases"); }}
          style={{ padding: "6px 14px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
        >&larr; Back</button>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>Create New Case</h1>
      </div>

      <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "28px" }}>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Case Title *</label>
          <input type="text" value={title} onChange={function(e) { setTitle(e.target.value); }}
            placeholder="e.g. Decompression Chamber Annual Inspection" style={inputStyle} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          <div>
            <label style={labelStyle}>NDT Method *</label>
            <select value={method} onChange={function(e) { setMethod(e.target.value); }} style={Object.assign({}, inputStyle, { cursor: "pointer" })}>
              {NDT_METHODS.map(function(m) { return <option key={m} value={m}>{m}</option>; })}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Asset Class</label>
            <select value={assetClass} onChange={function(e) { setAssetClass(e.target.value); }} style={Object.assign({}, inputStyle, { cursor: "pointer" })}>
              {ASSET_CLASS_OPTIONS.map(function(opt) { return <option key={opt} value={opt}>{opt}</option>; })}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Asset Name / Component *</label>
          <input type="text" value={assetName} onChange={function(e) { setAssetName(e.target.value); }}
            placeholder="e.g. DDC-101, Pipeline Segment 14B" style={inputStyle} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Location</label>
          <input type="text" value={location} onChange={function(e) { setLocation(e.target.value); }}
            placeholder="e.g. Gulf of Mexico Block 214, Plant Unit 3" style={inputStyle} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Description / Situation</label>
          <textarea value={description} onChange={function(e) { setDescription(e.target.value); }}
            placeholder="Describe the inspection scenario, concerns, observations..."
            style={Object.assign({}, inputStyle, { minHeight: "100px", resize: "vertical" })} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Events / History</label>
          <textarea value={events} onChange={function(e) { setEvents(e.target.value); }}
            placeholder="Fire exposure, hurricane, chemical spill, impact damage, years in service..."
            style={Object.assign({}, inputStyle, { minHeight: "70px", resize: "vertical" })} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Measurements / Data</label>
          <textarea value={measurements} onChange={function(e) { setMeasurements(e.target.value); }}
            placeholder="Wall thickness readings, temperatures, pressures, dimensions..."
            style={Object.assign({}, inputStyle, { minHeight: "70px", resize: "vertical" })} />
        </div>

        {error && (
          <div style={{ padding: "12px 16px", backgroundColor: "#ef444422", color: "#fca5a5", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", border: "1px solid #ef444444" }}>
            {error}
          </div>
        )}

        {statusMsg && (
          <div style={{ padding: "12px 16px", backgroundColor: "#3b82f622", color: "#93c5fd", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", border: "1px solid #3b82f644" }}>
            {statusMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={handleCreateAndEvaluate} disabled={submitting}
            style={{
              flex: "1", padding: "12px 24px", backgroundColor: submitting ? "#1e40af" : "#3b82f6",
              color: "#fff", border: "none", borderRadius: "8px", cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "14px", fontWeight: "600", opacity: submitting ? 0.7 : 1
            }}
          >{submitting ? "Processing..." : "Create Case + Run Analysis"}</button>
          <button
            onClick={handleCreateOnly} disabled={submitting}
            style={{
              padding: "12px 20px", backgroundColor: "transparent", color: "#94a3b8",
              border: "1px solid #334155", borderRadius: "8px", cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "14px", opacity: submitting ? 0.7 : 1
            }}
          >Save Only</button>
        </div>
      </div>
    </div>
  );
}
