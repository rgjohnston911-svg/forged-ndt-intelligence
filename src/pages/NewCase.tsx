import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sbInsert, sbUpdate, callDecisionCore, generateId, ASSET_CLASS_MAP } from "../utils/supabase";

export default function NewCase() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetClass, setAssetClass] = useState("Pressure Vessel");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  const assetClassOptions = Object.keys(ASSET_CLASS_MAP);

  function buildTranscript(): string {
    const parts: string[] = [];
    parts.push("ASSET: " + assetName + " (" + assetClass + ")");
    if (location) parts.push("LOCATION: " + location);
    if (description) parts.push("DESCRIPTION: " + description);
    if (events) parts.push("EVENTS / HISTORY: " + events);
    if (measurements) parts.push("MEASUREMENTS / DATA: " + measurements);
    return parts.join("\n");
  }

  async function handleCreateOnly() {
    if (!title.trim() || !assetName.trim()) {
      setError("Title and Asset Name are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    setStatusMsg("Creating case...");

    try {
      const caseId = generateId();
      const now = new Date().toISOString();
      const transcript = buildTranscript();

      await sbInsert("cases", {
        id: caseId,
        title: title.trim(),
        asset_name: assetName.trim(),
        asset_class: assetClass,
        location: location.trim(),
        description: description.trim(),
        running_transcript: transcript,
        status: "open",
        created_at: now,
        updated_at: now
      });

      await sbInsert("case_history", {
        id: generateId(),
        case_id: caseId,
        action: "case_created",
        details: "Case created: " + title.trim(),
        created_at: now
      });

      navigate("/cases/" + caseId);
    } catch (err: any) {
      setError("Failed to create case: " + (err.message || String(err)));
      setSubmitting(false);
      setStatusMsg("");
    }
  }

  async function handleCreateAndEvaluate() {
    if (!title.trim() || !assetName.trim()) {
      setError("Title and Asset Name are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    setStatusMsg("Creating case...");

    try {
      const caseId = generateId();
      const now = new Date().toISOString();
      const transcript = buildTranscript();
      const engineAssetClass = ASSET_CLASS_MAP[assetClass] || "pressure_vessel";

      let eventsList: string[] = [];
      if (events.trim()) {
        eventsList = events.split(",").map(e => e.trim()).filter(e => e.length > 0);
      }

      // Step 1: Create case
      await sbInsert("cases", {
        id: caseId,
        title: title.trim(),
        asset_name: assetName.trim(),
        asset_class: assetClass,
        location: location.trim(),
        description: description.trim(),
        running_transcript: transcript,
        status: "open",
        created_at: now,
        updated_at: now
      });
      setStatusMsg("Case created. Running Superbrain evaluation...");

      // Step 2: Call decision-core
      const dcResult = await callDecisionCore(transcript, engineAssetClass, eventsList);
      const dc = dcResult.decision_core || dcResult;

      // Extract superbrain state
      const consequence = dc.consequence_reality?.consequence_level || "";
      const disposition = dc.decision_reality?.disposition || "";
      const confidence = dc.reality_confidence?.overall_confidence || 0;
      const mechanism = dc.damage_reality?.primary_damage_mechanism?.mechanism || "";
      const sufficiency = dc.decision_reality?.evidence_sufficiency || "";

      // Step 3: Update case with superbrain state
      await sbUpdate("cases", caseId, {
        sb_consequence: consequence,
        sb_disposition: disposition,
        sb_confidence: confidence,
        sb_mechanism: mechanism,
        sb_sufficiency: sufficiency,
        sb_engine_version: dc.engine_version || "",
        sb_last_eval: now,
        updated_at: now
      });
      setStatusMsg("Superbrain evaluation stored. Saving snapshot...");

      // Step 4: Store snapshot
      const snapshotId = generateId();
      await sbInsert("decision_core_snapshots", {
        id: snapshotId,
        case_id: caseId,
        snapshot_number: 1,
        transcript_at_eval: transcript,
        full_output: JSON.stringify(dc),
        consequence_level: consequence,
        disposition: disposition,
        confidence: confidence,
        primary_mechanism: mechanism,
        evidence_sufficiency: sufficiency,
        engine_version: dc.engine_version || "",
        created_at: now
      });

      // Step 5: Generate checklist from phased_strategy
      if (dc.inspection_reality?.phased_strategy) {
        const phases = dc.inspection_reality.phased_strategy;
        let checkOrder = 0;
        for (let pi = 0; pi < phases.length; pi++) {
          const phase = phases[pi];
          const phaseName = phase.phase || ("Phase " + (pi + 1));
          const items = phase.actions || phase.steps || [];
          for (let ai = 0; ai < items.length; ai++) {
            checkOrder++;
            const itemText = typeof items[ai] === "string" ? items[ai] : (items[ai].action || items[ai].description || JSON.stringify(items[ai]));
            await sbInsert("checklist_items", {
              id: generateId(),
              case_id: caseId,
              snapshot_id: snapshotId,
              phase: phaseName,
              item_text: itemText,
              item_order: checkOrder,
              is_checked: false,
              created_at: now
            });
          }
        }
      }

      // Step 6: History
      await sbInsert("case_history", {
        id: generateId(),
        case_id: caseId,
        action: "superbrain_evaluation",
        details: "Initial evaluation — " + consequence + " / " + disposition + " / " + Math.round(confidence * 100) + "% confidence",
        snapshot_id: snapshotId,
        created_at: now
      });

      setStatusMsg("Complete. Opening case...");
      navigate("/cases/" + caseId);

    } catch (err: any) {
      setError("Evaluation failed: " + (err.message || String(err)));
      setSubmitting(false);
      setStatusMsg("");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", backgroundColor: "#1e293b",
    border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc",
    fontSize: "14px", outline: "none", boxSizing: "border-box"
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "13px", fontWeight: "600", color: "#94a3b8",
    marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px"
  };

  return (
    <div style={{ padding: "24px", maxWidth: "720px", margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <button
          onClick={() => navigate("/cases")}
          style={{ padding: "6px 14px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
        >← Back</button>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>Create New Case</h1>
      </div>

      {/* Form */}
      <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "28px" }}>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Case Title *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Decompression Chamber Annual Inspection" style={inputStyle} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Asset Name *</label>
          <input type="text" value={assetName} onChange={e => setAssetName(e.target.value)}
            placeholder="e.g. DDC-101, Pipeline Segment 14B" style={inputStyle} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Asset Class</label>
          <select value={assetClass} onChange={e => setAssetClass(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            {assetClassOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Location</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Gulf of Mexico Block 214, Plant Unit 3" style={inputStyle} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Description / Situation</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe the inspection scenario, concerns, observations..."
            style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Events / History</label>
          <textarea value={events} onChange={e => setEvents(e.target.value)}
            placeholder="Fire exposure, hurricane, chemical spill, impact damage, years in service..."
            style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Measurements / Data</label>
          <textarea value={measurements} onChange={e => setMeasurements(e.target.value)}
            placeholder="Wall thickness readings, temperatures, pressures, dimensions..."
            style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 16px", backgroundColor: "#ef444422", color: "#fca5a5", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", border: "1px solid #ef444444" }}>
            {error}
          </div>
        )}

        {/* Status */}
        {statusMsg && (
          <div style={{ padding: "12px 16px", backgroundColor: "#3b82f622", color: "#93c5fd", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", border: "1px solid #3b82f644" }}>
            {statusMsg}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={handleCreateAndEvaluate} disabled={submitting}
            style={{
              flex: "1", padding: "12px 24px", backgroundColor: submitting ? "#1e40af" : "#3b82f6",
              color: "#fff", border: "none", borderRadius: "8px", cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "14px", fontWeight: "600", opacity: submitting ? 0.7 : 1
            }}
          >{submitting ? "Processing..." : "Create Case + Evaluate with Superbrain"}</button>
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
