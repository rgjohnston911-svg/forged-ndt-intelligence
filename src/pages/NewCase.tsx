import React, { useState } from "react";
import { sbInsert, sbUpdate, callDecisionCore, generateId, ASSET_CLASS_MAP } from "../utils/supabase";

// ============================================================================
// CREATE CASE PAGE — Form + "Create & Evaluate with Superbrain" button
// ============================================================================

interface CreateCasePageProps {
  onNavigate: (page: string, params?: any) => void;
}

export default function CreateCasePage({ onNavigate }: CreateCasePageProps) {
  var [title, setTitle] = useState("");
  var [assetName, setAssetName] = useState("");
  var [assetClass, setAssetClass] = useState("Pressure Vessel");
  var [location, setLocation] = useState("");
  var [description, setDescription] = useState("");
  var [events, setEvents] = useState("");
  var [measurements, setMeasurements] = useState("");
  var [submitting, setSubmitting] = useState(false);
  var [statusMsg, setStatusMsg] = useState("");
  var [error, setError] = useState("");

  var assetClassOptions = Object.keys(ASSET_CLASS_MAP);

  function buildTranscript(): string {
    var parts: string[] = [];
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
      var caseId = generateId();
      var now = new Date().toISOString();
      var transcript = buildTranscript();

      var caseRow = {
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
      };

      await sbInsert("cases", caseRow);

      // History entry
      await sbInsert("case_history", {
        id: generateId(),
        case_id: caseId,
        action: "case_created",
        details: "Case created: " + title.trim(),
        created_at: now
      });

      setStatusMsg("Case created.");
      onNavigate("case-detail", { caseId: caseId });
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
      var caseId = generateId();
      var now = new Date().toISOString();
      var transcript = buildTranscript();
      var engineAssetClass = ASSET_CLASS_MAP[assetClass] || "pressure_vessel";

      // Parse events list
      var eventsList: string[] = [];
      if (events.trim()) {
        eventsList = events.split(",").map(function (e) { return e.trim(); }).filter(function (e) { return e.length > 0; });
      }

      // Step 1: Create case
      var caseRow = {
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
      };
      await sbInsert("cases", caseRow);
      setStatusMsg("Case created. Running Superbrain evaluation...");

      // Step 2: Call decision-core
      var dcResult = await callDecisionCore(transcript, engineAssetClass, eventsList);
      var dc = dcResult.decision_core || dcResult;

      // Extract superbrain state from decision-core response
      var consequence = "";
      var disposition = "";
      var confidence = 0;
      var mechanism = "";
      var sufficiency = "";

      if (dc.consequence_reality) {
        consequence = dc.consequence_reality.consequence_level || "";
      }
      if (dc.decision_reality) {
        disposition = dc.decision_reality.disposition || "";
        sufficiency = dc.decision_reality.evidence_sufficiency || "";
      }
      if (dc.reality_confidence) {
        confidence = dc.reality_confidence.overall_confidence || 0;
      }
      if (dc.damage_reality && dc.damage_reality.primary_damage_mechanism) {
        mechanism = dc.damage_reality.primary_damage_mechanism.mechanism || "";
      }

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

      // Step 4: Store decision-core snapshot
      var snapshotId = generateId();
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
      if (dc.inspection_reality && dc.inspection_reality.phased_strategy) {
        var phases = dc.inspection_reality.phased_strategy;
        var checkOrder = 0;
        for (var pi = 0; pi < phases.length; pi++) {
          var phase = phases[pi];
          var phaseName = phase.phase || ("Phase " + (pi + 1));
          var items = phase.actions || phase.steps || [];
          for (var ai = 0; ai < items.length; ai++) {
            checkOrder++;
            var itemText = typeof items[ai] === "string" ? items[ai] : (items[ai].action || items[ai].description || JSON.stringify(items[ai]));
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

      // Step 6: History entry
      await sbInsert("case_history", {
        id: generateId(),
        case_id: caseId,
        action: "superbrain_evaluation",
        details: "Initial evaluation — " + consequence + " / " + disposition + " / " + Math.round(confidence * 100) + "% confidence",
        snapshot_id: snapshotId,
        created_at: now
      });

      setStatusMsg("Complete. Opening case...");
      onNavigate("case-detail", { caseId: caseId });

    } catch (err: any) {
      setError("Evaluation failed: " + (err.message || String(err)));
      setSubmitting(false);
      setStatusMsg("");
    }
  }

  // ── RENDER ──

  var containerStyle: React.CSSProperties = {
    padding: "24px",
    maxWidth: "720px",
    margin: "0 auto",
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#e2e8f0"
  };

  var fieldStyle: React.CSSProperties = {
    marginBottom: "20px"
  };

  var labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: "6px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px"
  };

  var inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const
  };

  var textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: "100px",
    resize: "vertical" as const
  };

  return React.createElement("div", { style: containerStyle },

    // Header
    React.createElement("div", {
      style: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }
    },
      React.createElement("button", {
        onClick: function () { onNavigate("cases-dashboard"); },
        style: {
          padding: "6px 14px", backgroundColor: "transparent", color: "#94a3b8",
          border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px"
        }
      }, "← Back"),
      React.createElement("h1", {
        style: { fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0 }
      }, "Create New Case")
    ),

    // Form card
    React.createElement("div", {
      style: {
        backgroundColor: "#0f172a", border: "1px solid #1e293b",
        borderRadius: "12px", padding: "28px"
      }
    },

      // Title
      React.createElement("div", { style: fieldStyle },
        React.createElement("label", { style: labelStyle }, "Case Title *"),
        React.createElement("input", {
          type: "text", value: title,
          onChange: function (e: any) { setTitle(e.target.value); },
          placeholder: "e.g. Decompression Chamber Annual Inspection",
          style: inputStyle
        })
      ),

      // Asset Name
      React.createElement("div", { style: fieldStyle },
        React.createElement("label", { style: labelStyle }, "Asset Name *"),
        React.createElement("input", {
          type: "text", value: assetName,
          onChange: function (e: any) { setAssetName(e.target.value); },
          placeholder: "e.g. DDC-101, Pipeline Segment 14B",
          style: inputStyle
        })
      ),

      // Asset Class
      React.createElement("div", { style: fieldStyle },
        React.createElement("label", { style: labelStyle }, "Asset Class"),
        React.createElement("select", {
          value: assetClass,
          onChange: function (e: any) { setAssetClass(e.target.value); },
          style: { ...inputStyle, cursor: "pointer" }
        },
          assetClassOptions.map(function (opt) {
            return React.createElement("option", { key: opt, value: opt }, opt);
          })
        )
      ),

      // Location
      React.createElement("div", { style: fieldStyle },
        React.createElement("label", { style: labelStyle }, "Location"),
        React.createElement("input", {
          type: "text", value: location,
          onChange: function (e: any) { setLocation(e.target.value); },
          placeholder: "e.g. Gulf of Mexico Block 214, Plant Unit 3",
          style: inputStyle
        })
      ),

      // Description
      React.createElement("div", { style: fieldStyle },
        React.createElement("label", { style: labelStyle }, "Description / Situation"),
        React.createElement("textarea", {
          value: description,
          onChange: function (e: any) { setDescription(e.target.value); },
          placeholder: "Describe the inspection scenario, concerns, observations...",
          style: textareaStyle
        })
      ),

      // Events
      React.createElement("div", { style: fieldStyle },
        React.createElement("label", { style: labelStyle }, "Events / History"),
        React.createElement("textarea", {
          value: events,
          onChange: function (e: any) { setEvents(e.target.value); },
          placeholder: "Fire exposure, hurricane, chemical spill, impact damage, years in service...",
          style: { ...textareaStyle, minHeight: "70px" }
        })
      ),

      // Measurements
      React.createElement("div", { style: fieldStyle },
        React.createElement("label", { style: labelStyle }, "Measurements / Data"),
        React.createElement("textarea", {
          value: measurements,
          onChange: function (e: any) { setMeasurements(e.target.value); },
          placeholder: "Wall thickness readings, temperatures, pressures, dimensions...",
          style: { ...textareaStyle, minHeight: "70px" }
        })
      ),

      // Error
      error ? React.createElement("div", {
        style: {
          padding: "12px 16px", backgroundColor: "#ef444422", color: "#fca5a5",
          borderRadius: "8px", marginBottom: "16px", fontSize: "13px",
          border: "1px solid #ef444444"
        }
      }, error) : null,

      // Status
      statusMsg ? React.createElement("div", {
        style: {
          padding: "12px 16px", backgroundColor: "#3b82f622", color: "#93c5fd",
          borderRadius: "8px", marginBottom: "16px", fontSize: "13px",
          border: "1px solid #3b82f644"
        }
      }, statusMsg) : null,

      // Action buttons
      React.createElement("div", {
        style: { display: "flex", gap: "12px", marginTop: "8px" }
      },
        React.createElement("button", {
          onClick: handleCreateAndEvaluate,
          disabled: submitting,
          style: {
            flex: "1",
            padding: "12px 24px",
            backgroundColor: submitting ? "#1e40af" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: submitting ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "600",
            opacity: submitting ? 0.7 : 1
          }
        }, submitting ? "Processing..." : "Create Case + Evaluate with Superbrain"),
        React.createElement("button", {
          onClick: handleCreateOnly,
          disabled: submitting,
          style: {
            padding: "12px 20px",
            backgroundColor: "transparent",
            color: "#94a3b8",
            border: "1px solid #334155",
            borderRadius: "8px",
            cursor: submitting ? "not-allowed" : "pointer",
            fontSize: "14px",
            opacity: submitting ? 0.7 : 1
          }
        }, "Save Only")
      )
    )
  );
}
