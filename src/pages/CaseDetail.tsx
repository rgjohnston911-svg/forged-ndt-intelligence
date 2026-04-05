import React, { useState, useEffect } from "react";
import { sbSelect, sbUpdate, sbInsert, callDecisionCore, generateId, ASSET_CLASS_MAP } from "../utils/supabase";

// ============================================================================
// CASE DETAIL PAGE — Full Superbrain view with tabs
// ============================================================================

interface CaseDetailPageProps {
  caseId: string;
  onNavigate: (page: string, params?: any) => void;
}

export default function CaseDetailPage({ caseId, onNavigate }: CaseDetailPageProps) {
  var [caseData, setCaseData] = useState<any>(null);
  var [snapshot, setSnapshot] = useState<any>(null);
  var [dc, setDc] = useState<any>(null);
  var [checklist, setChecklist] = useState<any[]>([]);
  var [history, setHistory] = useState<any[]>([]);
  var [findings, setFindings] = useState<any[]>([]);
  var [activeTab, setActiveTab] = useState("workflow");
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState("");

  // Add Finding modal state
  var [showFindingModal, setShowFindingModal] = useState(false);
  var [findingLocation, setFindingLocation] = useState("");
  var [findingMethod, setFindingMethod] = useState("VT");
  var [findingType, setFindingType] = useState("");
  var [findingSeverity, setFindingSeverity] = useState("minor");
  var [findingDimensions, setFindingDimensions] = useState("");
  var [findingNotes, setFindingNotes] = useState("");
  var [findingSubmitting, setFindingSubmitting] = useState(false);

  useEffect(function () {
    loadCase();
  }, [caseId]);

  async function loadCase() {
    try {
      setLoading(true);
      setError("");

      // Load case
      var cases = await sbSelect("cases", "id=eq." + caseId);
      if (!cases || cases.length === 0) {
        setError("Case not found.");
        setLoading(false);
        return;
      }
      setCaseData(cases[0]);

      // Load latest snapshot
      var snaps = await sbSelect(
        "decision_core_snapshots",
        "case_id=eq." + caseId + "&order=snapshot_number.desc&limit=1"
      );
      if (snaps && snaps.length > 0) {
        setSnapshot(snaps[0]);
        try {
          var parsed = typeof snaps[0].full_output === "string"
            ? JSON.parse(snaps[0].full_output)
            : snaps[0].full_output;
          setDc(parsed);
        } catch (e) {
          setDc(null);
        }
      }

      // Load checklist
      var checks = await sbSelect(
        "checklist_items",
        "case_id=eq." + caseId + "&order=item_order.asc"
      );
      setChecklist(checks || []);

      // Load history
      var hist = await sbSelect(
        "case_history",
        "case_id=eq." + caseId + "&order=created_at.desc&limit=50"
      );
      setHistory(hist || []);

      // Load findings
      var finds = await sbSelect(
        "findings",
        "case_id=eq." + caseId + "&order=created_at.desc"
      );
      setFindings(finds || []);

    } catch (err: any) {
      setError("Failed to load case: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  // ── CHECKLIST TOGGLE ──
  async function toggleChecklist(itemId: string, currentChecked: boolean) {
    try {
      await sbUpdate("checklist_items", itemId, { is_checked: !currentChecked });
      setChecklist(function (prev) {
        return prev.map(function (item) {
          if (item.id === itemId) {
            return { ...item, is_checked: !currentChecked };
          }
          return item;
        });
      });
    } catch (err: any) {
      console.error("Checklist toggle failed:", err);
    }
  }

  // ── ADD FINDING ──
  async function handleAddFinding() {
    if (!findingType.trim()) return;
    setFindingSubmitting(true);

    try {
      var now = new Date().toISOString();
      var findingId = generateId();

      // Insert finding
      await sbInsert("findings", {
        id: findingId,
        case_id: caseId,
        location: findingLocation.trim(),
        method: findingMethod,
        indication_type: findingType.trim(),
        severity: findingSeverity,
        dimensions: findingDimensions.trim(),
        notes: findingNotes.trim(),
        created_at: now
      });

      // Build finding text for transcript append
      var findingText = "\n\nFINDING [" + findingMethod + "]: " + findingType.trim();
      if (findingLocation.trim()) findingText = findingText + " at " + findingLocation.trim();
      if (findingSeverity) findingText = findingText + " — Severity: " + findingSeverity;
      if (findingDimensions.trim()) findingText = findingText + " — Dimensions: " + findingDimensions.trim();
      if (findingNotes.trim()) findingText = findingText + " — Notes: " + findingNotes.trim();

      // Append to running transcript
      var updatedTranscript = (caseData.running_transcript || "") + findingText;
      await sbUpdate("cases", caseId, {
        running_transcript: updatedTranscript,
        updated_at: now
      });

      // Re-evaluate with decision-core
      var engineAssetClass = ASSET_CLASS_MAP[caseData.asset_class] || "pressure_vessel";
      var dcResult = await callDecisionCore(updatedTranscript, engineAssetClass);
      var newDc = dcResult.decision_core || dcResult;

      // Extract new superbrain state
      var consequence = "";
      var disposition = "";
      var confidence = 0;
      var mechanism = "";
      var sufficiency = "";

      if (newDc.consequence_reality) consequence = newDc.consequence_reality.consequence_level || "";
      if (newDc.decision_reality) {
        disposition = newDc.decision_reality.disposition || "";
        sufficiency = newDc.decision_reality.evidence_sufficiency || "";
      }
      if (newDc.reality_confidence) confidence = newDc.reality_confidence.overall_confidence || 0;
      if (newDc.damage_reality && newDc.damage_reality.primary_damage_mechanism) {
        mechanism = newDc.damage_reality.primary_damage_mechanism.mechanism || "";
      }

      // Determine new snapshot number
      var prevSnapNum = snapshot ? (snapshot.snapshot_number || 1) : 0;
      var newSnapNum = prevSnapNum + 1;

      // Store new snapshot
      var newSnapshotId = generateId();
      await sbInsert("decision_core_snapshots", {
        id: newSnapshotId,
        case_id: caseId,
        snapshot_number: newSnapNum,
        transcript_at_eval: updatedTranscript,
        full_output: JSON.stringify(newDc),
        consequence_level: consequence,
        disposition: disposition,
        confidence: confidence,
        primary_mechanism: mechanism,
        evidence_sufficiency: sufficiency,
        engine_version: newDc.engine_version || "",
        created_at: now
      });

      // Update case superbrain state
      await sbUpdate("cases", caseId, {
        sb_consequence: consequence,
        sb_disposition: disposition,
        sb_confidence: confidence,
        sb_mechanism: mechanism,
        sb_sufficiency: sufficiency,
        sb_last_eval: now,
        updated_at: now
      });

      // Generate new checklist from phased_strategy
      if (newDc.inspection_reality && newDc.inspection_reality.phased_strategy) {
        var phases = newDc.inspection_reality.phased_strategy;
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
              snapshot_id: newSnapshotId,
              phase: phaseName,
              item_text: itemText,
              item_order: checkOrder,
              is_checked: false,
              created_at: now
            });
          }
        }
      }

      // History entry
      await sbInsert("case_history", {
        id: generateId(),
        case_id: caseId,
        action: "finding_added",
        details: "Finding: " + findingType.trim() + " (" + findingMethod + ") — Re-evaluated: " + consequence + " / " + disposition + " / " + Math.round(confidence * 100) + "%",
        snapshot_id: newSnapshotId,
        created_at: now
      });

      // Reset modal and reload
      setShowFindingModal(false);
      setFindingLocation("");
      setFindingMethod("VT");
      setFindingType("");
      setFindingSeverity("minor");
      setFindingDimensions("");
      setFindingNotes("");
      setFindingSubmitting(false);
      await loadCase();

    } catch (err: any) {
      setFindingSubmitting(false);
      alert("Failed to add finding: " + (err.message || String(err)));
    }
  }

  // ── HELPER FUNCTIONS ──

  function consequenceColor(c: string): string {
    if (c === "CRITICAL") return "#ef4444";
    if (c === "HIGH") return "#f97316";
    if (c === "MODERATE") return "#eab308";
    return "#22c55e";
  }

  function dispositionColor(d: string): string {
    if (d === "BLOCKED") return "#ef4444";
    if (d === "HOLD") return "#f97316";
    if (d === "CONDITIONAL_GO") return "#eab308";
    if (d === "GO") return "#22c55e";
    return "#6b7280";
  }

  function formatDate(iso: string): string {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ── STYLES ──

  var containerStyle: React.CSSProperties = {
    padding: "24px",
    maxWidth: "1100px",
    margin: "0 auto",
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#e2e8f0"
  };

  var cardStyle: React.CSSProperties = {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px"
  };

  var tabBtnStyle = function (isActive: boolean): React.CSSProperties {
    return {
      padding: "8px 20px",
      backgroundColor: isActive ? "#1e293b" : "transparent",
      color: isActive ? "#f8fafc" : "#64748b",
      border: "1px solid " + (isActive ? "#334155" : "transparent"),
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: isActive ? "600" : "400"
    };
  };

  // ── LOADING / ERROR ──

  if (loading) {
    return React.createElement("div", { style: containerStyle },
      React.createElement("div", { style: { textAlign: "center", padding: "60px", color: "#94a3b8" } }, "Loading case...")
    );
  }

  if (error || !caseData) {
    return React.createElement("div", { style: containerStyle },
      React.createElement("div", { style: { textAlign: "center", padding: "40px", color: "#ef4444" } }, error || "Case not found."),
      React.createElement("button", {
        onClick: function () { onNavigate("cases-dashboard"); },
        style: { padding: "8px 16px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }
      }, "← Dashboard")
    );
  }

  var isBlocked = caseData.sb_disposition === "BLOCKED";
  var isCritical = caseData.sb_consequence === "CRITICAL";

  // ── BUILD TABS ──

  function renderWorkflowTab() {
    // Confidence bars
    var confidenceSections: { label: string; value: number }[] = [];
    if (dc && dc.reality_confidence) {
      var rc = dc.reality_confidence;
      if (rc.physical_confidence != null) confidenceSections.push({ label: "Physical Reality", value: rc.physical_confidence });
      if (rc.damage_confidence != null) confidenceSections.push({ label: "Damage Mechanism", value: rc.damage_confidence });
      if (rc.consequence_confidence != null) confidenceSections.push({ label: "Consequence", value: rc.consequence_confidence });
      if (rc.inspection_confidence != null) confidenceSections.push({ label: "Inspection Plan", value: rc.inspection_confidence });
      if (rc.overall_confidence != null) confidenceSections.push({ label: "Overall", value: rc.overall_confidence });
    }

    // Recovery queue
    var recoveryQueue: any[] = [];
    if (dc && dc.decision_reality && dc.decision_reality.guided_recovery) {
      recoveryQueue = dc.decision_reality.guided_recovery;
    }

    // Authority
    var authority = "";
    if (dc && dc.authority_reality) {
      var ar = dc.authority_reality;
      authority = (ar.governing_code || "") + (ar.jurisdiction ? " — " + ar.jurisdiction : "");
    }

    // Group checklist by phase
    var phaseGroups: Record<string, any[]> = {};
    checklist.forEach(function (item) {
      var phase = item.phase || "General";
      if (!phaseGroups[phase]) phaseGroups[phase] = [];
      phaseGroups[phase].push(item);
    });

    return React.createElement("div", null,

      // Confidence bars
      confidenceSections.length > 0 ? React.createElement("div", { style: cardStyle },
        React.createElement("h3", { style: { fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "16px" } }, "CONFIDENCE"),
        confidenceSections.map(function (s) {
          var pct = Math.round(s.value * 100);
          var color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#eab308" : "#ef4444";
          return React.createElement("div", {
            key: s.label,
            style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }
          },
            React.createElement("div", { style: { width: "130px", fontSize: "13px", color: "#cbd5e1" } }, s.label),
            React.createElement("div", {
              style: { flex: 1, height: "10px", backgroundColor: "#1e293b", borderRadius: "5px", overflow: "hidden" }
            },
              React.createElement("div", {
                style: { width: pct + "%", height: "100%", backgroundColor: color, borderRadius: "5px", transition: "width 0.5s" }
              })
            ),
            React.createElement("div", { style: { width: "45px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: color } }, pct + "%")
          );
        })
      ) : null,

      // Authority
      authority ? React.createElement("div", { style: cardStyle },
        React.createElement("h3", { style: { fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "8px" } }, "AUTHORITY"),
        React.createElement("div", { style: { fontSize: "14px", color: "#f8fafc" } }, authority)
      ) : null,

      // Phased Strategy Checklist
      Object.keys(phaseGroups).length > 0 ? React.createElement("div", { style: cardStyle },
        React.createElement("h3", { style: { fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "16px" } }, "PHASED STRATEGY"),
        Object.keys(phaseGroups).map(function (phase) {
          return React.createElement("div", { key: phase, style: { marginBottom: "16px" } },
            React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", color: "#f97316", marginBottom: "8px", textTransform: "uppercase" } }, phase),
            phaseGroups[phase].map(function (item) {
              return React.createElement("div", {
                key: item.id,
                onClick: function () { toggleChecklist(item.id, item.is_checked); },
                style: {
                  display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 12px",
                  cursor: "pointer", borderRadius: "6px", marginBottom: "4px",
                  backgroundColor: item.is_checked ? "#22c55e11" : "transparent"
                }
              },
                React.createElement("div", {
                  style: {
                    width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0, marginTop: "1px",
                    border: item.is_checked ? "2px solid #22c55e" : "2px solid #475569",
                    backgroundColor: item.is_checked ? "#22c55e" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", color: "#fff", fontWeight: "700"
                  }
                }, item.is_checked ? "✓" : ""),
                React.createElement("div", {
                  style: {
                    fontSize: "13px", color: item.is_checked ? "#64748b" : "#e2e8f0",
                    textDecoration: item.is_checked ? "line-through" : "none"
                  }
                }, item.item_text)
              );
            })
          );
        })
      ) : null,

      // Recovery Queue
      recoveryQueue.length > 0 ? React.createElement("div", { style: cardStyle },
        React.createElement("h3", { style: { fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "12px" } }, "RECOVERY QUEUE"),
        recoveryQueue.map(function (item: any, idx: number) {
          var text = typeof item === "string" ? item : (item.action || item.description || JSON.stringify(item));
          return React.createElement("div", {
            key: idx,
            style: {
              padding: "10px 14px", backgroundColor: "#1e293b", borderRadius: "8px",
              marginBottom: "8px", fontSize: "13px", color: "#e2e8f0",
              borderLeft: "3px solid " + (idx === 0 ? "#3b82f6" : "#334155")
            }
          },
            React.createElement("span", { style: { color: "#64748b", marginRight: "8px" } }, (idx + 1) + "."),
            text
          );
        })
      ) : null
    );
  }

  function renderMethodsTab() {
    if (!dc || !dc.inspection_reality) {
      return React.createElement("div", { style: cardStyle },
        React.createElement("div", { style: { color: "#64748b" } }, "No inspection data available.")
      );
    }

    var ir = dc.inspection_reality;
    var methods = ir.method_scores || ir.ndt_methods || {};
    var methodKeys = Object.keys(methods);
    var missing = ir.missing_coverage || ir.coverage_gaps || [];

    return React.createElement("div", null,
      // Method scoring grid
      React.createElement("div", { style: cardStyle },
        React.createElement("h3", { style: { fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "16px" } }, "METHOD SCORES"),
        methodKeys.length > 0
          ? methodKeys.map(function (key) {
            var val = methods[key];
            var score = typeof val === "number" ? val : (val.score || val.relevance || 0);
            var pct = Math.round(score * 100);
            var color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#eab308" : "#64748b";
            return React.createElement("div", {
              key: key,
              style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }
            },
              React.createElement("div", { style: { width: "60px", fontSize: "13px", fontWeight: "600", color: "#f8fafc" } }, key.toUpperCase()),
              React.createElement("div", {
                style: { flex: 1, height: "10px", backgroundColor: "#1e293b", borderRadius: "5px", overflow: "hidden" }
              },
                React.createElement("div", {
                  style: { width: pct + "%", height: "100%", backgroundColor: color, borderRadius: "5px" }
                })
              ),
              React.createElement("div", { style: { width: "45px", textAlign: "right", fontSize: "13px", color: color } }, pct + "%")
            );
          })
          : React.createElement("div", { style: { color: "#64748b" } }, "No method scores available.")
      ),

      // Missing coverage
      missing.length > 0 ? React.createElement("div", { style: cardStyle },
        React.createElement("h3", { style: { fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "12px" } }, "MISSING COVERAGE"),
        missing.map(function (gap: any, idx: number) {
          var text = typeof gap === "string" ? gap : (gap.description || gap.method || JSON.stringify(gap));
          return React.createElement("div", {
            key: idx,
            style: {
              padding: "8px 14px", backgroundColor: "#ef444411", borderRadius: "6px",
              marginBottom: "6px", fontSize: "13px", color: "#fca5a5",
              borderLeft: "3px solid #ef4444"
            }
          }, text);
        })
      ) : null
    );
  }

  function renderFindingsTab() {
    return React.createElement("div", null,
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" } },
        React.createElement("h3", { style: { fontSize: "14px", color: "#94a3b8", margin: 0 } }, "FINDINGS (" + findings.length + ")"),
        React.createElement("button", {
          onClick: function () { setShowFindingModal(true); },
          style: {
            padding: "6px 16px", backgroundColor: "#3b82f6", color: "#fff",
            border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px"
          }
        }, "+ Add Finding")
      ),
      findings.length === 0
        ? React.createElement("div", { style: { ...cardStyle, color: "#64748b", textAlign: "center" } }, "No findings recorded yet.")
        : findings.map(function (f) {
          return React.createElement("div", { key: f.id, style: cardStyle },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "8px" } },
              React.createElement("div", { style: { fontWeight: "600", color: "#f8fafc" } }, f.indication_type),
              React.createElement("span", {
                style: {
                  padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600",
                  backgroundColor: f.severity === "critical" ? "#ef444422" : f.severity === "major" ? "#f9731622" : "#22c55e22",
                  color: f.severity === "critical" ? "#ef4444" : f.severity === "major" ? "#f97316" : "#22c55e"
                }
              }, f.severity)
            ),
            React.createElement("div", { style: { fontSize: "13px", color: "#94a3b8" } },
              [f.method, f.location, f.dimensions].filter(Boolean).join(" · ")
            ),
            f.notes ? React.createElement("div", { style: { fontSize: "13px", color: "#cbd5e1", marginTop: "6px" } }, f.notes) : null,
            React.createElement("div", { style: { fontSize: "11px", color: "#475569", marginTop: "6px" } }, formatDate(f.created_at))
          );
        })
    );
  }

  function renderHistoryTab() {
    return React.createElement("div", null,
      history.length === 0
        ? React.createElement("div", { style: { ...cardStyle, color: "#64748b", textAlign: "center" } }, "No history entries.")
        : history.map(function (h) {
          return React.createElement("div", {
            key: h.id,
            style: {
              padding: "12px 16px", borderLeft: "3px solid #334155",
              marginBottom: "8px", backgroundColor: "#0f172a",
              borderRadius: "0 8px 8px 0"
            }
          },
            React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", color: "#f8fafc" } },
              (h.action || "").replace(/_/g, " ").toUpperCase()
            ),
            React.createElement("div", { style: { fontSize: "13px", color: "#cbd5e1", marginTop: "4px" } }, h.details || ""),
            React.createElement("div", { style: { fontSize: "11px", color: "#475569", marginTop: "4px" } }, formatDate(h.created_at))
          );
        })
    );
  }

  function renderRawTab() {
    return React.createElement("div", { style: cardStyle },
      React.createElement("pre", {
        style: {
          fontSize: "11px", color: "#94a3b8", whiteSpace: "pre-wrap",
          wordBreak: "break-all", maxHeight: "600px", overflow: "auto",
          margin: 0
        }
      }, dc ? JSON.stringify(dc, null, 2) : "No decision-core output available.")
    );
  }

  // ── FINDING MODAL ──

  function renderFindingModal() {
    if (!showFindingModal) return null;

    var overlayStyle: React.CSSProperties = {
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    };

    var modalStyle: React.CSSProperties = {
      backgroundColor: "#0f172a", border: "1px solid #334155",
      borderRadius: "12px", padding: "28px", width: "480px",
      maxHeight: "90vh", overflow: "auto"
    };

    var inputStyle: React.CSSProperties = {
      width: "100%", padding: "8px 12px", backgroundColor: "#1e293b",
      border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc",
      fontSize: "13px", boxSizing: "border-box" as const, outline: "none"
    };

    var labelStyle: React.CSSProperties = {
      display: "block", fontSize: "12px", fontWeight: "600",
      color: "#94a3b8", marginBottom: "4px", marginTop: "14px"
    };

    return React.createElement("div", { style: overlayStyle, onClick: function () { if (!findingSubmitting) setShowFindingModal(false); } },
      React.createElement("div", { style: modalStyle, onClick: function (e: any) { e.stopPropagation(); } },
        React.createElement("h2", { style: { fontSize: "18px", color: "#f8fafc", marginTop: 0, marginBottom: "4px" } }, "Add Finding"),
        React.createElement("div", { style: { fontSize: "13px", color: "#64748b", marginBottom: "16px" } },
          "Finding will be appended to transcript and trigger re-evaluation."
        ),

        React.createElement("label", { style: labelStyle }, "Indication Type *"),
        React.createElement("input", { type: "text", value: findingType, onChange: function (e: any) { setFindingType(e.target.value); }, placeholder: "e.g. Crack, Corrosion, Porosity, Wall Loss", style: inputStyle }),

        React.createElement("label", { style: labelStyle }, "Method"),
        React.createElement("select", { value: findingMethod, onChange: function (e: any) { setFindingMethod(e.target.value); }, style: { ...inputStyle, cursor: "pointer" } },
          ["VT", "UT", "MT", "PT", "RT", "ET", "AE"].map(function (m) { return React.createElement("option", { key: m, value: m }, m); })
        ),

        React.createElement("label", { style: labelStyle }, "Location"),
        React.createElement("input", { type: "text", value: findingLocation, onChange: function (e: any) { setFindingLocation(e.target.value); }, placeholder: "e.g. Weld joint 3B, nozzle N-2", style: inputStyle }),

        React.createElement("label", { style: labelStyle }, "Severity"),
        React.createElement("select", { value: findingSeverity, onChange: function (e: any) { setFindingSeverity(e.target.value); }, style: { ...inputStyle, cursor: "pointer" } },
          ["minor", "major", "critical"].map(function (s) { return React.createElement("option", { key: s, value: s }, s); })
        ),

        React.createElement("label", { style: labelStyle }, "Dimensions"),
        React.createElement("input", { type: "text", value: findingDimensions, onChange: function (e: any) { setFindingDimensions(e.target.value); }, placeholder: "e.g. 3mm deep x 12mm long", style: inputStyle }),

        React.createElement("label", { style: labelStyle }, "Notes"),
        React.createElement("textarea", {
          value: findingNotes, onChange: function (e: any) { setFindingNotes(e.target.value); },
          placeholder: "Additional observations...",
          style: { ...inputStyle, minHeight: "60px", resize: "vertical" as const }
        }),

        React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "20px" } },
          React.createElement("button", {
            onClick: handleAddFinding, disabled: findingSubmitting || !findingType.trim(),
            style: {
              flex: 1, padding: "10px", backgroundColor: findingSubmitting ? "#1e40af" : "#3b82f6",
              color: "#fff", border: "none", borderRadius: "6px", cursor: findingSubmitting ? "not-allowed" : "pointer",
              fontSize: "13px", fontWeight: "600"
            }
          }, findingSubmitting ? "Evaluating..." : "Add Finding + Re-evaluate"),
          React.createElement("button", {
            onClick: function () { setShowFindingModal(false); }, disabled: findingSubmitting,
            style: {
              padding: "10px 16px", backgroundColor: "transparent", color: "#94a3b8",
              border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px"
            }
          }, "Cancel")
        )
      )
    );
  }

  // ── MAIN RENDER ──

  // Next action from guided_recovery
  var nextAction = "";
  if (dc && dc.decision_reality && dc.decision_reality.guided_recovery && dc.decision_reality.guided_recovery.length > 0) {
    var first = dc.decision_reality.guided_recovery[0];
    nextAction = typeof first === "string" ? first : (first.action || first.description || "");
  }

  var tabs = ["workflow", "methods", "findings", "history", "raw"];

  return React.createElement("div", { style: containerStyle },

    // Finding modal
    renderFindingModal(),

    // Back nav
    React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement("button", {
        onClick: function () { onNavigate("cases-dashboard"); },
        style: {
          padding: "6px 14px", backgroundColor: "transparent", color: "#94a3b8",
          border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px"
        }
      }, "← Dashboard")
    ),

    // Hard Lock Banner
    isBlocked ? React.createElement("div", {
      style: {
        padding: "14px 20px", borderRadius: "10px", marginBottom: "16px",
        backgroundColor: "#ef444422", border: "2px solid #ef4444",
        textAlign: "center", fontSize: "14px", fontWeight: "700", color: "#ef4444",
        animation: "pulse 2s infinite"
      }
    },
      "⛔ HARD LOCK — DISPOSITION: BLOCKED — DO NOT PROCEED WITHOUT RESOLUTION"
    ) : null,

    // Case header
    React.createElement("div", {
      style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }
    },
      React.createElement("div", null,
        React.createElement("h1", { style: { fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0, marginBottom: "4px" } },
          caseData.title || "Untitled Case"
        ),
        React.createElement("div", { style: { fontSize: "13px", color: "#64748b" } },
          [caseData.asset_name, caseData.asset_class, caseData.location].filter(Boolean).join(" · ")
        )
      ),
      React.createElement("button", {
        onClick: function () { setShowFindingModal(true); },
        style: {
          padding: "8px 18px", backgroundColor: "#3b82f6", color: "#fff",
          border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600"
        }
      }, "+ Add Finding")
    ),

    // Superbrain Status Bar
    React.createElement("div", {
      style: {
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px",
        marginBottom: "20px"
      }
    },
      // Consequence
      React.createElement("div", {
        style: {
          backgroundColor: "#0f172a", border: "1px solid #1e293b",
          borderRadius: "10px", padding: "14px", textAlign: "center"
        }
      },
        React.createElement("div", { style: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" } }, "Consequence"),
        React.createElement("div", {
          style: { fontSize: "16px", fontWeight: "700", color: consequenceColor(caseData.sb_consequence || "") }
        }, caseData.sb_consequence || "—")
      ),
      // Disposition
      React.createElement("div", {
        style: {
          backgroundColor: "#0f172a", border: "1px solid #1e293b",
          borderRadius: "10px", padding: "14px", textAlign: "center"
        }
      },
        React.createElement("div", { style: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" } }, "Disposition"),
        React.createElement("div", {
          style: { fontSize: "16px", fontWeight: "700", color: dispositionColor(caseData.sb_disposition || "") }
        }, (caseData.sb_disposition || "—").replace(/_/g, " "))
      ),
      // Confidence
      React.createElement("div", {
        style: {
          backgroundColor: "#0f172a", border: "1px solid #1e293b",
          borderRadius: "10px", padding: "14px", textAlign: "center"
        }
      },
        React.createElement("div", { style: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" } }, "Confidence"),
        React.createElement("div", {
          style: { fontSize: "16px", fontWeight: "700", color: caseData.sb_confidence >= 0.8 ? "#22c55e" : caseData.sb_confidence >= 0.6 ? "#eab308" : "#ef4444" }
        }, caseData.sb_confidence != null ? Math.round(caseData.sb_confidence * 100) + "%" : "—")
      ),
      // Mechanism
      React.createElement("div", {
        style: {
          backgroundColor: "#0f172a", border: "1px solid #1e293b",
          borderRadius: "10px", padding: "14px", textAlign: "center"
        }
      },
        React.createElement("div", { style: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" } }, "Mechanism"),
        React.createElement("div", {
          style: { fontSize: "14px", fontWeight: "600", color: "#f8fafc" }
        }, (caseData.sb_mechanism || "—").replace(/_/g, " "))
      ),
      // Sufficiency
      React.createElement("div", {
        style: {
          backgroundColor: "#0f172a", border: "1px solid #1e293b",
          borderRadius: "10px", padding: "14px", textAlign: "center"
        }
      },
        React.createElement("div", { style: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" } }, "Sufficiency"),
        React.createElement("div", {
          style: { fontSize: "14px", fontWeight: "600", color: "#f8fafc" }
        }, (caseData.sb_sufficiency || "—").replace(/_/g, " "))
      )
    ),

    // Next Action card
    nextAction ? React.createElement("div", {
      style: {
        ...cardStyle,
        borderLeft: "4px solid #3b82f6",
        backgroundColor: "#1e293b"
      }
    },
      React.createElement("div", { style: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" } }, "NEXT ACTION"),
      React.createElement("div", { style: { fontSize: "14px", color: "#f8fafc", fontWeight: "500" } }, nextAction)
    ) : null,

    // Tab bar
    React.createElement("div", {
      style: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }
    },
      tabs.map(function (tab) {
        return React.createElement("button", {
          key: tab,
          onClick: function () { setActiveTab(tab); },
          style: tabBtnStyle(activeTab === tab)
        }, tab.charAt(0).toUpperCase() + tab.slice(1));
      })
    ),

    // Tab content
    activeTab === "workflow" ? renderWorkflowTab() : null,
    activeTab === "methods" ? renderMethodsTab() : null,
    activeTab === "findings" ? renderFindingsTab() : null,
    activeTab === "history" ? renderHistoryTab() : null,
    activeTab === "raw" ? renderRawTab() : null,

    // Pulse animation (for hard lock banner)
    React.createElement("style", null,
      "@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }"
    )
  );
}
