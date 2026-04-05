import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sbInsert, sbUpdate, callDecisionCore, generateId, ASSET_CLASS_MAP } from "../utils/supabase";

// ============================================================================
// NEW CASE — Voice-First / Paste-First Design
// Schema-matched to actual cases table (all NOT NULL columns populated)
// ============================================================================

export default function NewCase() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [assetHint, setAssetHint] = useState("auto");
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speechSupported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  function startListening() {
    if (!speechSupported) return;
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = function (event: any) {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setTranscript(prev => prev.trim() ? prev + " " + final : final);
      }
      setInterimText(interim);
    };

    recognition.onerror = function (event: any) {
      if (event.error !== "no-speech") setIsListening(false);
    };

    recognition.onend = function () {
      if (recognitionRef.current) {
        try { recognition.start(); } catch (e) { setIsListening(false); }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setInterimText("");
  }

  function stopListening() {
    setIsListening(false);
    setInterimText("");
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  function toggleListening() {
    if (isListening) stopListening(); else startListening();
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.max(200, Math.min(textareaRef.current.scrollHeight, 500)) + "px";
    }
  }, [transcript, interimText]);

  function autoTitle(): string {
    if (title.trim()) return title.trim();
    const lines = transcript.trim().split("\n").filter(l => l.trim().length > 5);
    if (lines.length > 0) {
      const first = lines[0].trim();
      return first.length > 80 ? first.substring(0, 77) + "..." : first;
    }
    return "Field Inspection — " + new Date().toLocaleDateString();
  }

  function generateCaseId(): string {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const r = String(Math.floor(Math.random() * 9000) + 1000);
    return "CASE-" + y + m + d + "-" + r;
  }

  async function handleEvaluate() {
    if (!transcript.trim()) {
      setError("Describe the inspection scenario — speak, paste, or type.");
      return;
    }
    setSubmitting(true);
    setError("");
    setStatusMsg("Creating case...");
    if (isListening) stopListening();

    try {
      const id = generateId();
      const caseId = generateCaseId();
      const now = new Date().toISOString();
      const caseTitle = autoTitle();
      const assetType = assetHint === "auto" ? "General" : assetHint;
      const engineAssetClass = assetHint === "auto" ? "pressure_vessel" : (ASSET_CLASS_MAP[assetHint] || "pressure_vessel");

      // Step 1: Create case — all NOT NULL fields populated
      await sbInsert("cases", {
        id: id,
        case_id: caseId,
        case_name: caseTitle,
        title: caseTitle,
        inspector_name: "Field Inspector",
        organization: "",
        asset_type: assetType,
        asset_class: assetHint === "auto" ? "" : assetHint,
        location: "Field",
        applicable_standard: "API 570",
        initial_narrative: transcript.trim(),
        running_transcript: transcript.trim(),
        input_mode: "typed",
        priority: "normal",
        status: "open",
        stage: "initial",
        finding_count: 0,
        rejectable_count: 0,
        report_count: 0,
        created_at: now,
        updated_at: now
      });
      setStatusMsg("Case created. Running Superbrain evaluation...");

      // Step 2: Call decision-core
      const dcResult = await callDecisionCore(transcript.trim(), engineAssetClass);
      const dc = dcResult.decision_core || dcResult;

      // Extract superbrain state
      const consequence = dc.consequence_reality?.consequence_level || "";
      const disposition = dc.decision_reality?.disposition || "";
      const confidence = dc.reality_confidence?.overall_confidence || 0;
      const mechanism = dc.damage_reality?.primary_damage_mechanism?.mechanism || "";
      const sufficiency = dc.decision_reality?.evidence_sufficiency || "";
      const hardLocks = dc.decision_reality?.hard_lock_count || dc.decision_reality?.hard_locks?.length || 0;

      // Next action from guided_recovery
      let nextAction = "";
      if (dc.decision_reality?.guided_recovery?.length > 0) {
        const first = dc.decision_reality.guided_recovery[0];
        nextAction = typeof first === "string" ? first : (first.action || first.description || "");
      }

      // Confidence band
      let band = "LOW";
      if (confidence >= 0.8) band = "HIGH";
      else if (confidence >= 0.6) band = "GUARDED";

      // Parsed asset info from decision-core
      const parsedAssetName = dc.physical_reality?.asset_name || dc.physical_reality?.component || "";
      const parsedLocation = dc.physical_reality?.location || "";

      // Step 3: Update case with superbrain state — BOTH column sets
      await sbUpdate("cases", id, {
        // Original schema superbrain columns
        consequence_tier: consequence,
        superbrain_disposition: disposition,
        confidence_band: band,
        confidence_overall: confidence,
        primary_mechanism: mechanism,
        sufficiency_verdict: sufficiency,
        hard_lock_count: hardLocks,
        next_action: nextAction,
        highest_severity: consequence,
        // sb_* columns
        sb_consequence: consequence,
        sb_disposition: disposition,
        sb_confidence: confidence,
        sb_mechanism: mechanism,
        sb_sufficiency: sufficiency,
        sb_engine_version: dc.engine_version || "",
        sb_last_eval: now,
        // Parsed info
        asset_name: parsedAssetName,
        location: parsedLocation || "Field",
        updated_at: now
      });
      setStatusMsg("Evaluation complete. Saving snapshot...");

      // Step 4: Store snapshot
      const snapshotId = generateId();
      await sbInsert("decision_core_snapshots", {
        id: snapshotId,
        case_id: id,
        snapshot_number: 1,
        transcript_at_eval: transcript.trim(),
        full_output: JSON.stringify(dc),
        consequence_level: consequence,
        disposition: disposition,
        confidence: confidence,
        primary_mechanism: mechanism,
        evidence_sufficiency: sufficiency,
        engine_version: dc.engine_version || "",
        created_at: now
      });

      // Update latest_snapshot_id on case
      await sbUpdate("cases", id, { latest_snapshot_id: snapshotId });

      // Step 5: Generate checklist
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
              case_id: id,
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
        case_id: id,
        action: "superbrain_evaluation",
        details: "Initial evaluation — " + consequence + " / " + disposition + " / " + Math.round(confidence * 100) + "% confidence",
        snapshot_id: snapshotId,
        created_at: now
      });

      navigate("/cases/" + id);

    } catch (err: any) {
      setError("Evaluation failed: " + (err.message || String(err)));
      setSubmitting(false);
      setStatusMsg("");
    }
  }

  async function handleSaveOnly() {
    if (!transcript.trim()) { setError("Add a description before saving."); return; }
    setSubmitting(true);
    setError("");
    if (isListening) stopListening();

    try {
      const id = generateId();
      const now = new Date().toISOString();
      const caseTitle = autoTitle();

      await sbInsert("cases", {
        id: id,
        case_id: generateCaseId(),
        case_name: caseTitle,
        title: caseTitle,
        inspector_name: "Field Inspector",
        organization: "",
        asset_type: assetHint === "auto" ? "General" : assetHint,
        asset_class: assetHint === "auto" ? "" : assetHint,
        location: "Field",
        applicable_standard: "API 570",
        initial_narrative: transcript.trim(),
        running_transcript: transcript.trim(),
        input_mode: "typed",
        priority: "normal",
        status: "open",
        stage: "initial",
        finding_count: 0,
        rejectable_count: 0,
        report_count: 0,
        created_at: now,
        updated_at: now
      });

      await sbInsert("case_history", {
        id: generateId(),
        case_id: id,
        action: "case_created",
        details: "Case created from field transcript",
        created_at: now
      });

      navigate("/cases/" + id);
    } catch (err: any) {
      setError("Save failed: " + (err.message || String(err)));
      setSubmitting(false);
    }
  }

  const displayTranscript = transcript + (interimText ? (transcript ? " " : "") + interimText : "");

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
        <button onClick={() => navigate("/cases")}
          style={{ padding: "6px 14px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
          ← Back
        </button>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>New Inspection Case</h1>
      </div>

      <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "28px" }}>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "15px", color: "#cbd5e1", marginBottom: "16px" }}>
            Describe what you see. Speak it, paste it, or type it — field language works.
          </div>

          {speechSupported && (
            <button onClick={toggleListening} disabled={submitting}
              style={{
                width: "72px", height: "72px", borderRadius: "50%",
                backgroundColor: isListening ? "#ef4444" : "#3b82f6",
                border: isListening ? "3px solid #fca5a5" : "3px solid #60a5fa",
                cursor: submitting ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                boxShadow: isListening ? "0 0 20px rgba(239,68,68,0.4)" : "0 0 12px rgba(59,130,246,0.3)",
                animation: isListening ? "pulse-mic 1.5s infinite" : "none"
              }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
          <div style={{ fontSize: "12px", color: isListening ? "#fca5a5" : "#64748b", marginTop: "8px", height: "18px" }}>
            {isListening ? "Listening... tap to stop" : speechSupported ? "Tap to speak" : "Voice not available — type or paste below"}
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: "20px" }}>
          <textarea ref={textareaRef} value={displayTranscript}
            onChange={e => { setTranscript(e.target.value); setInterimText(""); }}
            placeholder={"Describe the inspection scenario in your own words...\n\nExamples:\n• \"24-inch transfer line downstream of coke drum, carbon steel, 780 to 920 degrees, cyclic operation, we're seeing hot spots under insulation near the elbow...\"\n• \"Decompression chamber, sat system, 15 years old, cracking near viewport weld...\"\n• \"Pipeline segment 14B, found wall loss at the 6 o'clock position, minimum readings 0.180 on a nominal 0.375...\""}
            style={{
              width: "100%", minHeight: "200px", padding: "16px",
              backgroundColor: "#1e293b", border: isListening ? "2px solid #ef4444" : "1px solid #334155",
              borderRadius: "10px", color: "#f8fafc", fontSize: "14px", lineHeight: "1.6",
              outline: "none", boxSizing: "border-box", resize: "vertical",
              fontFamily: "'Inter', -apple-system, sans-serif"
            }} />
          <div style={{ position: "absolute", bottom: "8px", right: "12px", fontSize: "11px", color: "#475569" }}>
            {transcript.trim().split(/\s+/).filter(w => w).length} words
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "6px" }}>
            CASE TITLE (optional — auto-generates if blank)
          </label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Auto-generated from transcript if left blank"
            style={{ width: "100%", padding: "10px 14px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "6px" }}>
            ASSET TYPE HINT (optional — Superbrain detects this automatically)
          </label>
          <select value={assetHint} onChange={e => setAssetHint(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontSize: "14px", outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
            <option value="auto">Auto-detect from transcript</option>
            {Object.keys(ASSET_CLASS_MAP).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
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

        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={handleEvaluate} disabled={submitting || !transcript.trim()}
            style={{
              flex: "1", padding: "14px 24px",
              backgroundColor: submitting ? "#1e40af" : !transcript.trim() ? "#1e293b" : "#3b82f6",
              color: !transcript.trim() ? "#475569" : "#fff",
              border: "none", borderRadius: "8px",
              cursor: submitting || !transcript.trim() ? "not-allowed" : "pointer",
              fontSize: "15px", fontWeight: "600", opacity: submitting ? 0.7 : 1
            }}>
            {submitting ? statusMsg || "Processing..." : "Evaluate with Superbrain"}
          </button>
          <button onClick={handleSaveOnly} disabled={submitting || !transcript.trim()}
            style={{
              padding: "14px 20px", backgroundColor: "transparent",
              color: !transcript.trim() ? "#334155" : "#94a3b8",
              border: "1px solid #334155", borderRadius: "8px",
              cursor: submitting || !transcript.trim() ? "not-allowed" : "pointer", fontSize: "14px"
            }}>
            Save Only
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse-mic { 0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 35px rgba(239,68,68,0.6); } }`}</style>
    </div>
  );
}
