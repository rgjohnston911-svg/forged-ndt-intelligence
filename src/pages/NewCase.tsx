import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sbInsert, sbUpdate, callDecisionCore, generateId, ASSET_CLASS_MAP } from "../utils/supabase";

// ============================================================================
// NEW CASE — Voice-First / Paste-First Design
// One transcript input. Mic button. Superbrain figures out the rest.
// Inspectors in the field wearing gloves don't fill out forms.
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

  // Check for Web Speech API support
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
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript(prev => {
          const separator = prev.trim() ? " " : "";
          return prev + separator + final;
        });
      }
      setInterimText(interim);
    };

    recognition.onerror = function (event: any) {
      console.error("Speech error:", event.error);
      if (event.error !== "no-speech") {
        setIsListening(false);
      }
    };

    recognition.onend = function () {
      // Auto-restart if still in listening mode (handles browser timeouts)
      if (recognitionRef.current && isListening) {
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
        }
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
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(200, Math.min(scrollHeight, 500)) + "px";
    }
  }, [transcript, interimText]);

  function autoTitle(): string {
    if (title.trim()) return title.trim();
    // Pull first meaningful line from transcript
    const lines = transcript.trim().split("\n").filter(l => l.trim().length > 5);
    if (lines.length > 0) {
      const first = lines[0].trim();
      return first.length > 80 ? first.substring(0, 77) + "..." : first;
    }
    return "Field Inspection — " + new Date().toLocaleDateString();
  }

  async function handleEvaluate() {
    if (!transcript.trim()) {
      setError("Describe the inspection scenario — speak, paste, or type.");
      return;
    }
    setSubmitting(true);
    setError("");
    setStatusMsg("Creating case...");

    // Stop listening if active
    if (isListening) stopListening();

    try {
      const caseId = generateId();
      const now = new Date().toISOString();
      const caseTitle = autoTitle();

      // Determine asset class — if auto, let decision-core figure it out
      const engineAssetClass = assetHint === "auto" ? "pressure_vessel" : (ASSET_CLASS_MAP[assetHint] || "pressure_vessel");

      // Step 1: Create case with raw transcript
      await sbInsert("cases", {
        id: caseId,
        title: caseTitle,
        asset_class: assetHint === "auto" ? "" : assetHint,
        running_transcript: transcript.trim(),
        status: "open",
        created_at: now,
        updated_at: now
      });
      setStatusMsg("Case created. Running Superbrain evaluation...");

      // Step 2: Call decision-core with raw field transcript
      const dcResult = await callDecisionCore(transcript.trim(), engineAssetClass);
      const dc = dcResult.decision_core || dcResult;

      // Extract superbrain state
      const consequence = dc.consequence_reality?.consequence_level || "";
      const disposition = dc.decision_reality?.disposition || "";
      const confidence = dc.reality_confidence?.overall_confidence || 0;
      const mechanism = dc.damage_reality?.primary_damage_mechanism?.mechanism || "";
      const sufficiency = dc.decision_reality?.evidence_sufficiency || "";

      // Pull asset info from decision-core if it parsed it
      const parsedAssetName = dc.physical_reality?.asset_name || dc.physical_reality?.component || "";
      const parsedAssetClass = dc.physical_reality?.asset_class || "";
      const parsedLocation = dc.physical_reality?.location || "";

      // Step 3: Update case with superbrain state + parsed info
      await sbUpdate("cases", caseId, {
        sb_consequence: consequence,
        sb_disposition: disposition,
        sb_confidence: confidence,
        sb_mechanism: mechanism,
        sb_sufficiency: sufficiency,
        sb_engine_version: dc.engine_version || "",
        sb_last_eval: now,
        asset_name: parsedAssetName,
        asset_class: parsedAssetClass || (assetHint === "auto" ? "" : assetHint),
        location: parsedLocation,
        updated_at: now
      });
      setStatusMsg("Evaluation complete. Saving snapshot...");

      // Step 4: Store snapshot
      const snapshotId = generateId();
      await sbInsert("decision_core_snapshots", {
        id: snapshotId,
        case_id: caseId,
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

      setStatusMsg("Opening case...");
      navigate("/cases/" + caseId);

    } catch (err: any) {
      setError("Evaluation failed: " + (err.message || String(err)));
      setSubmitting(false);
      setStatusMsg("");
    }
  }

  async function handleSaveOnly() {
    if (!transcript.trim()) {
      setError("Add a description before saving.");
      return;
    }
    setSubmitting(true);
    setError("");
    if (isListening) stopListening();

    try {
      const caseId = generateId();
      const now = new Date().toISOString();

      await sbInsert("cases", {
        id: caseId,
        title: autoTitle(),
        asset_class: assetHint === "auto" ? "" : assetHint,
        running_transcript: transcript.trim(),
        status: "open",
        created_at: now,
        updated_at: now
      });

      await sbInsert("case_history", {
        id: generateId(),
        case_id: caseId,
        action: "case_created",
        details: "Case created from field transcript",
        created_at: now
      });

      navigate("/cases/" + caseId);
    } catch (err: any) {
      setError("Save failed: " + (err.message || String(err)));
      setSubmitting(false);
    }
  }

  // Display text = committed transcript + gray interim
  const displayTranscript = transcript + (interimText ? (transcript ? " " : "") + interimText : "");

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
        <button onClick={() => navigate("/cases")}
          style={{ padding: "6px 14px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
          ← Back
        </button>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>New Inspection Case</h1>
      </div>

      {/* Main card */}
      <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "28px" }}>

        {/* Voice prompt */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "15px", color: "#cbd5e1", marginBottom: "16px" }}>
            Describe what you see. Speak it, paste it, or type it — field language works.
          </div>

          {/* Mic button */}
          {speechSupported && (
            <button onClick={toggleListening} disabled={submitting}
              style={{
                width: "72px", height: "72px", borderRadius: "50%",
                backgroundColor: isListening ? "#ef4444" : "#3b82f6",
                border: isListening ? "3px solid #fca5a5" : "3px solid #60a5fa",
                cursor: submitting ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
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

        {/* Transcript input */}
        <div style={{ position: "relative", marginBottom: "20px" }}>
          <textarea
            ref={textareaRef}
            value={displayTranscript}
            onChange={e => {
              setTranscript(e.target.value);
              setInterimText("");
            }}
            placeholder={"Describe the inspection scenario in your own words...\n\nExamples:\n• \"24-inch transfer line downstream of coke drum, carbon steel, 780 to 920 degrees, cyclic operation, we're seeing hot spots under insulation near the elbow...\"\n• \"Decompression chamber, sat system, 15 years old, cracking near viewport weld, last inspection was 3 years ago...\"\n• \"Pipeline segment 14B, found wall loss at the 6 o'clock position, corrosion under coating, minimum readings 0.180 on a nominal 0.375...\""}
            style={{
              width: "100%", minHeight: "200px", padding: "16px",
              backgroundColor: "#1e293b", border: isListening ? "2px solid #ef4444" : "1px solid #334155",
              borderRadius: "10px", color: "#f8fafc", fontSize: "14px", lineHeight: "1.6",
              outline: "none", boxSizing: "border-box", resize: "vertical",
              fontFamily: "'Inter', -apple-system, sans-serif",
              transition: "border-color 0.2s"
            }}
          />
          {/* Word count */}
          <div style={{ position: "absolute", bottom: "8px", right: "12px", fontSize: "11px", color: "#475569" }}>
            {transcript.trim().split(/\s+/).filter(w => w).length} words
          </div>
        </div>

        {/* Title (optional) */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "6px" }}>
            CASE TITLE (optional — auto-generates if blank)
          </label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Auto-generated from transcript if left blank"
            style={{
              width: "100%", padding: "10px 14px", backgroundColor: "#1e293b",
              border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc",
              fontSize: "14px", outline: "none", boxSizing: "border-box"
            }} />
        </div>

        {/* Asset class hint (optional) */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "6px" }}>
            ASSET TYPE HINT (optional — Superbrain detects this automatically)
          </label>
          <select value={assetHint} onChange={e => setAssetHint(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", backgroundColor: "#1e293b",
              border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc",
              fontSize: "14px", outline: "none", boxSizing: "border-box", cursor: "pointer"
            }}>
            <option value="auto">Auto-detect from transcript</option>
            {Object.keys(ASSET_CLASS_MAP).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px 16px", backgroundColor: "#ef444422", color: "#fca5a5",
            borderRadius: "8px", marginBottom: "16px", fontSize: "13px", border: "1px solid #ef444444"
          }}>
            {error}
          </div>
        )}

        {/* Status */}
        {statusMsg && (
          <div style={{
            padding: "12px 16px", backgroundColor: "#3b82f622", color: "#93c5fd",
            borderRadius: "8px", marginBottom: "16px", fontSize: "13px", border: "1px solid #3b82f644"
          }}>
            {statusMsg}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={handleEvaluate} disabled={submitting || !transcript.trim()}
            style={{
              flex: "1", padding: "14px 24px",
              backgroundColor: submitting ? "#1e40af" : !transcript.trim() ? "#1e293b" : "#3b82f6",
              color: !transcript.trim() ? "#475569" : "#fff",
              border: "none", borderRadius: "8px",
              cursor: submitting || !transcript.trim() ? "not-allowed" : "pointer",
              fontSize: "15px", fontWeight: "600",
              opacity: submitting ? 0.7 : 1,
              transition: "all 0.2s"
            }}>
            {submitting ? statusMsg || "Processing..." : "Evaluate with Superbrain"}
          </button>
          <button onClick={handleSaveOnly} disabled={submitting || !transcript.trim()}
            style={{
              padding: "14px 20px", backgroundColor: "transparent",
              color: !transcript.trim() ? "#334155" : "#94a3b8",
              border: "1px solid #334155", borderRadius: "8px",
              cursor: submitting || !transcript.trim() ? "not-allowed" : "pointer",
              fontSize: "14px"
            }}>
            Save Only
          </button>
        </div>
      </div>

      {/* Mic pulse animation */}
      <style>{`
        @keyframes pulse-mic {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 35px rgba(239,68,68,0.6); }
        }
      `}</style>
    </div>
  );
}
