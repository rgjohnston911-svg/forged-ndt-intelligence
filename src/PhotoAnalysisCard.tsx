// PHOTO ANALYSIS CARD v1.4
// File: src/PhotoAnalysisCard.tsx
// v1.4: Universal asset-agnostic display - shows asset identification,
//       geometric integrity (any asset), material degradation, critical interface zone
//       Works for offshore, refinery, piping, tanks, structural, concrete, etc.

import React, { useState, useRef } from "react";

interface PhotoAnalysisCardProps {
  contextTranscript?: string;
  assetType?: string;
  serviceEnvironment?: string;
  onAddendumReady?: (addendum: string) => void;
}

function PhotoAnalysisCard(props: PhotoAnalysisCardProps) {
  var [imageData, setImageData] = useState<string | null>(null);
  var [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  var [analyzing, setAnalyzing] = useState(false);
  var [analysis, setAnalysis] = useState<any>(null);
  var [error, setError] = useState<string | null>(null);
  var [appended, setAppended] = useState(false);
  var [resizing, setResizing] = useState(false);
  var fileInputRef = useRef<HTMLInputElement>(null);

  var handleFileSelect = function(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError("Image too large (max 20 MB before resize)");
      return;
    }

    setResizing(true);
    setError(null);
    setAnalysis(null);
    setAppended(false);

    var reader = new FileReader();
    reader.onload = function(loadEvent) {
      var originalDataUrl = loadEvent.target && loadEvent.target.result as string;
      if (!originalDataUrl) {
        setResizing(false);
        setError("Failed to read image");
        return;
      }

      // Resize via canvas - always export as JPEG at 0.85 quality
      var img = new Image();
      img.onload = function() {
        var maxDim = 1024;
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var newWidth = Math.round(img.width * scale);
        var newHeight = Math.round(img.height * scale);

        var canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        var ctx = canvas.getContext("2d");

        if (!ctx) {
          // Fallback: use original
          setImageData(originalDataUrl);
          setImageMimeType("image/jpeg");
          setResizing(false);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        var resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setImageData(resizedDataUrl);
        setImageMimeType("image/jpeg");
        setResizing(false);
      };
      img.onerror = function() {
        setResizing(false);
        setError("Failed to load image for resize");
      };
      img.src = originalDataUrl;
    };
    reader.onerror = function() {
      setResizing(false);
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  var handleAnalyze = async function() {
    if (!imageData) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      var response = await fetch("/.netlify/functions/photo-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageData,
          image_mime_type: imageMimeType,
          context_transcript: props.contextTranscript || "",
          asset_type: props.assetType || "",
          service_environment: props.serviceEnvironment || ""
        })
      });

      var result = await response.json();
      if (result.ok && result.analysis) {
        setAnalysis(result);
      } else {
        setError(result.error || "Analysis failed");
      }
    } catch (err: any) {
      setError("Network error: " + (err.message || String(err)));
    } finally {
      setAnalyzing(false);
    }
  };

  var handleAppend = function() {
    if (analysis && analysis.transcript_addendum && props.onAddendumReady) {
      props.onAddendumReady(analysis.transcript_addendum);
      setAppended(true);
    }
  };

  var handleClear = function() {
    setImageData(null);
    setAnalysis(null);
    setError(null);
    setAppended(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Helper: is geometric integrity normal/good?
  var isGeometryNormal = function(gi: string) {
    if (!gi) return true;
    var upper = gi.toUpperCase();
    return upper.indexOf("PLUMB") === 0 || upper.indexOf("LEVEL") === 0;
  };

  var qualityColor = analysis && analysis.image_quality === "ASSESSABLE" ? "#10b981"
    : analysis && analysis.image_quality === "MARGINAL" ? "#f59e0b"
    : "#ef4444";

  var confColor = analysis && analysis.confidence === "HIGH" ? "#10b981"
    : analysis && analysis.confidence === "MODERATE" ? "#f59e0b"
    : "#ef4444";

  var hasCriticalFindings = analysis && analysis.critical_findings && analysis.critical_findings.length > 0;
  var borderColor = hasCriticalFindings ? "#ef4444"
    : analysis ? qualityColor
    : "#3b82f6";

  return React.createElement("div", {
    style: { background: "#1a1a2e", border: "1px solid " + borderColor, borderRadius: "12px", padding: "20px", marginBottom: "16px", fontFamily: "'Inter', sans-serif" }
  },
    // Header
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "22px" } }, "\u{1F4F8}"),
        React.createElement("span", { style: { color: "#3b82f6", fontSize: "14px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" as const } }, "PHOTO ANALYSIS \u2014 GPT-4o VISION")
      ),
      React.createElement("span", { style: { color: "#64748b", fontSize: "11px", fontFamily: "monospace" } }, "ENGINE: photo-analysis v1.4")
    ),

    // Upload area
    !imageData && !resizing && React.createElement("div", null,
      React.createElement("input", {
        ref: fileInputRef,
        type: "file",
        accept: "image/jpeg,image/png,image/webp",
        onChange: handleFileSelect,
        style: { display: "none" }
      }),
      React.createElement("div", {
        onClick: function() { if (fileInputRef.current) fileInputRef.current.click(); },
        style: {
          padding: "32px 16px",
          background: "rgba(59, 130, 246, 0.05)",
          border: "2px dashed rgba(59, 130, 246, 0.3)",
          borderRadius: "8px",
          textAlign: "center" as const,
          cursor: "pointer"
        }
      },
        React.createElement("div", { style: { fontSize: "32px", marginBottom: "8px" } }, "\u{1F4C2}"),
        React.createElement("div", { style: { color: "#3b82f6", fontSize: "14px", fontWeight: "600", marginBottom: "4px" } }, "Upload Inspection Photo"),
        React.createElement("div", { style: { color: "#64748b", fontSize: "11px" } }, "JPEG, PNG, or WebP \u2014 auto-resized to 1024px")
      )
    ),

    // Resizing state
    resizing && React.createElement("div", {
      style: {
        padding: "32px 16px",
        background: "rgba(59, 130, 246, 0.05)",
        border: "2px dashed rgba(59, 130, 246, 0.3)",
        borderRadius: "8px",
        textAlign: "center" as const
      }
    },
      React.createElement("div", { style: { fontSize: "32px", marginBottom: "8px" } }, "\u23F3"),
      React.createElement("div", { style: { color: "#3b82f6", fontSize: "14px", fontWeight: "600" } }, "Resizing image...")
    ),

    // Image preview + analyze button
    imageData && !analysis && !resizing && React.createElement("div", null,
      React.createElement("img", {
        src: imageData,
        alt: "Inspection",
        style: { width: "100%", maxHeight: "300px", objectFit: "contain" as const, borderRadius: "8px", marginBottom: "12px", background: "rgba(30, 41, 59, 0.5)" }
      }),
      React.createElement("div", { style: { display: "flex", gap: "8px" } },
        React.createElement("button", {
          onClick: handleAnalyze,
          disabled: analyzing,
          style: {
            flex: 2,
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: "700",
            color: "#fff",
            background: analyzing ? "#475569" : "#3b82f6",
            border: "none",
            borderRadius: "6px",
            cursor: analyzing ? "not-allowed" : "pointer"
          }
        }, analyzing ? "\u23F3 Analyzing with GPT-4o..." : "\u{1F50D} Analyze Photo"),
        React.createElement("button", {
          onClick: handleClear,
          disabled: analyzing,
          style: {
            flex: 1,
            padding: "12px 16px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#94a3b8",
            background: "transparent",
            border: "1px solid #475569",
            borderRadius: "6px",
            cursor: analyzing ? "not-allowed" : "pointer"
          }
        }, "Clear")
      )
    ),

    // Analysis result
    analysis && React.createElement("div", null,
      React.createElement("img", {
        src: imageData || "",
        alt: "Inspection",
        style: { width: "100%", maxHeight: "200px", objectFit: "contain" as const, borderRadius: "8px", marginBottom: "12px", background: "rgba(30, 41, 59, 0.5)" }
      }),

      // Asset identification (NEW v1.4)
      analysis.analysis && analysis.analysis.asset_identification && React.createElement("div", { style: { padding: "10px 14px", background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "8px", marginBottom: "12px" } },
        React.createElement("div", { style: { color: "#3b82f6", fontSize: "10px", fontWeight: "700", textTransform: "uppercase" as const, marginBottom: "4px" } }, "\u{1F4D1} ASSET IDENTIFIED"),
        React.createElement("div", { style: { color: "#cbd5e1", fontSize: "13px", fontWeight: "600" } }, analysis.analysis.asset_identification),
        analysis.analysis.expected_geometry && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginTop: "2px" } }, "Expected geometry: " + analysis.analysis.expected_geometry)
      ),

      // Critical findings banner (top-priority)
      hasCriticalFindings && React.createElement("div", { style: { padding: "12px 14px", background: "rgba(239, 68, 68, 0.1)", border: "2px solid #ef4444", borderRadius: "8px", marginBottom: "12px" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" } },
          React.createElement("span", { style: { fontSize: "16px" } }, "\u{1F6A8}"),
          React.createElement("span", { style: { color: "#ef4444", fontSize: "12px", fontWeight: "800", textTransform: "uppercase" as const, letterSpacing: "0.05em" } }, "CRITICAL FINDINGS")
        ),
        analysis.critical_findings.map(function(f: string, i: number) {
          return React.createElement("div", { key: "cf-" + i, style: { color: "#fca5a5", fontSize: "12px", padding: "3px 0", lineHeight: "1.5" } }, "\u26A0\uFE0F " + f);
        })
      ),

      // Quality + Confidence + Condition badges
      React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" as const } },
        React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "4px", background: qualityColor + "20", color: qualityColor, border: "1px solid " + qualityColor + "40" } }, "QUALITY: " + analysis.image_quality),
        React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "4px", background: confColor + "20", color: confColor, border: "1px solid " + confColor + "40" } }, "CONFIDENCE: " + analysis.confidence),
        analysis.analysis && analysis.analysis.overall_condition && React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "4px", background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.3)" } }, "CONDITION: " + analysis.analysis.overall_condition),
        analysis.tokens_used > 0 && React.createElement("span", { style: { fontSize: "11px", padding: "4px 10px", borderRadius: "4px", background: "rgba(100, 116, 139, 0.15)", color: "#64748b", fontFamily: "monospace" } }, analysis.tokens_used + " tokens")
      ),

      // Geometric integrity (UNIVERSAL v1.4 - shows for ANY asset when not plumb/level)
      analysis.analysis && analysis.analysis.geometric_integrity && !isGeometryNormal(analysis.analysis.geometric_integrity) && React.createElement("div", { style: { padding: "10px 12px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px", marginBottom: "12px" } },
        React.createElement("div", { style: { color: "#f59e0b", fontSize: "10px", fontWeight: "700", textTransform: "uppercase" as const, marginBottom: "4px" } }, "\u{1F4D0} GEOMETRIC INTEGRITY"),
        React.createElement("div", { style: { color: "#fbbf24", fontSize: "12px", lineHeight: "1.5" } }, analysis.analysis.geometric_integrity),
        analysis.analysis.geometric_reference_used && React.createElement("div", { style: { color: "#94a3b8", fontSize: "10px", marginTop: "4px", fontStyle: "italic" as const } }, "Reference used: " + analysis.analysis.geometric_reference_used)
      ),

      // Visible damage
      analysis.analysis && analysis.analysis.visible_damage && analysis.analysis.visible_damage.length > 0 && React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "6px" } }, "VISIBLE DAMAGE"),
        analysis.analysis.visible_damage.map(function(d: string, i: number) {
          return React.createElement("div", { key: "d-" + i, style: { padding: "6px 10px", marginBottom: "3px", background: "rgba(239, 68, 68, 0.06)", borderLeft: "3px solid #ef4444", borderRadius: "4px", color: "#fca5a5", fontSize: "12px" } }, "\u2022 " + d);
        })
      ),

      // Material degradation (UNIVERSAL v1.4 - replaces corrosion-specific)
      analysis.analysis && analysis.analysis.material_degradation_severity && analysis.analysis.material_degradation_severity !== "NONE" && React.createElement("div", { style: { padding: "10px 12px", background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "8px", marginBottom: "12px" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" as const } },
          React.createElement("span", { style: { color: "#f59e0b", fontSize: "10px", fontWeight: "700", textTransform: "uppercase" as const } }, "MATERIAL DEGRADATION:"),
          React.createElement("span", { style: { color: "#fbbf24", fontSize: "12px", fontWeight: "700" } }, analysis.analysis.material_degradation_severity),
          analysis.analysis.material_degradation_pattern && analysis.analysis.material_degradation_pattern !== "none" && React.createElement("span", { style: { color: "#94a3b8", fontSize: "10px", fontStyle: "italic" as const } }, "(" + analysis.analysis.material_degradation_pattern + ")")
        ),
        analysis.analysis.material_degradation_locations && analysis.analysis.material_degradation_locations.length > 0 && React.createElement("div", { style: { color: "#fbbf24", fontSize: "11px", lineHeight: "1.5" } },
          "Locations: " + analysis.analysis.material_degradation_locations.join(", ")
        )
      ),

      // Critical interface zone (UNIVERSAL v1.4 - replaces splash_zone)
      analysis.analysis && analysis.analysis.critical_interface_zone && analysis.analysis.critical_interface_condition && React.createElement("div", { style: { padding: "10px 12px", background: "rgba(168, 85, 247, 0.06)", border: "1px solid rgba(168, 85, 247, 0.2)", borderRadius: "8px", marginBottom: "12px" } },
        React.createElement("div", { style: { color: "#a855f7", fontSize: "10px", fontWeight: "700", textTransform: "uppercase" as const, marginBottom: "4px" } }, "\u{1F3AF} CRITICAL INTERFACE: " + analysis.analysis.critical_interface_zone),
        React.createElement("div", { style: { color: "#cbd5e1", fontSize: "12px", lineHeight: "1.5" } }, analysis.analysis.critical_interface_condition)
      ),

      // Morphology + Extent
      (analysis.analysis && (analysis.analysis.morphology || analysis.analysis.extent)) && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" } },
        analysis.analysis.morphology && React.createElement("div", { style: { padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
          React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "3px" } }, "MORPHOLOGY"),
          React.createElement("div", { style: { color: "#cbd5e1", fontSize: "12px" } }, analysis.analysis.morphology)
        ),
        analysis.analysis.extent && React.createElement("div", { style: { padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
          React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "3px" } }, "EXTENT"),
          React.createElement("div", { style: { color: "#cbd5e1", fontSize: "12px" } }, analysis.analysis.extent)
        )
      ),

      // Additional details (collapsible)
      analysis.analysis && (analysis.analysis.deformation_observed || analysis.analysis.process_indicators || analysis.analysis.welds_connections || analysis.analysis.appurtenances) && React.createElement("details", { style: { marginBottom: "12px" } },
        React.createElement("summary", { style: { color: "#64748b", fontSize: "12px", cursor: "pointer", userSelect: "none" as const } }, "Detailed Observations"),
        React.createElement("div", { style: { marginTop: "8px", padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
          analysis.analysis.deformation_observed && analysis.analysis.deformation_observed !== "NONE" && React.createElement("div", { style: { fontSize: "11px", color: "#94a3b8", marginBottom: "6px" } },
            React.createElement("strong", null, "Deformation: "), analysis.analysis.deformation_observed
          ),
          analysis.analysis.process_indicators && analysis.analysis.process_indicators !== "NONE" && React.createElement("div", { style: { fontSize: "11px", color: "#94a3b8", marginBottom: "6px" } },
            React.createElement("strong", null, "Process indicators: "), analysis.analysis.process_indicators
          ),
          analysis.analysis.welds_connections && React.createElement("div", { style: { fontSize: "11px", color: "#94a3b8", marginBottom: "6px" } },
            React.createElement("strong", null, "Welds/Connections: "), analysis.analysis.welds_connections
          ),
          analysis.analysis.appurtenances && React.createElement("div", { style: { fontSize: "11px", color: "#94a3b8", marginBottom: "6px" } },
            React.createElement("strong", null, "Appurtenances: "), analysis.analysis.appurtenances
          ),
          analysis.analysis.geometric_features && analysis.analysis.geometric_features.length > 0 && React.createElement("div", { style: { fontSize: "11px", color: "#94a3b8" } },
            React.createElement("strong", null, "Features: "), analysis.analysis.geometric_features.join(", ")
          )
        )
      ),

      // Additional inspection needed
      analysis.analysis && analysis.analysis.additional_inspection_needed && analysis.analysis.additional_inspection_needed.length > 0 && React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "6px" } }, "RECOMMENDED FOLLOW-UP NDE"),
        analysis.analysis.additional_inspection_needed.map(function(m: string, i: number) {
          return React.createElement("span", { key: "m-" + i, style: { display: "inline-block", fontSize: "11px", padding: "3px 10px", margin: "2px 4px 2px 0", borderRadius: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", fontWeight: "600" } }, m);
        })
      ),

      // Transcript addendum
      analysis.transcript_addendum && React.createElement("div", { style: { padding: "12px", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", marginBottom: "12px" } },
        React.createElement("div", { style: { color: "#10b981", fontSize: "10px", fontWeight: "700", textTransform: "uppercase" as const, marginBottom: "6px" } }, "TRANSCRIPT ADDENDUM"),
        React.createElement("div", { style: { color: "#cbd5e1", fontSize: "12px", lineHeight: "1.5", marginBottom: "8px", fontStyle: "italic" as const } }, "\"" + analysis.transcript_addendum + "\""),
        props.onAddendumReady && React.createElement("button", {
          onClick: handleAppend,
          disabled: appended,
          style: {
            width: "100%",
            padding: "10px",
            fontSize: "12px",
            fontWeight: "700",
            color: "#fff",
            background: appended ? "#475569" : "#10b981",
            border: "none",
            borderRadius: "6px",
            cursor: appended ? "default" : "pointer"
          }
        }, appended ? "\u2705 Appended to Transcript" : "\u2795 Append to Transcript")
      ),

      React.createElement("button", {
        onClick: handleClear,
        style: {
          width: "100%",
          padding: "8px",
          fontSize: "12px",
          fontWeight: "600",
          color: "#94a3b8",
          background: "transparent",
          border: "1px solid #475569",
          borderRadius: "6px",
          cursor: "pointer"
        }
      }, "Upload Different Photo")
    ),

    // Error state
    error && React.createElement("div", { style: { marginTop: "12px", padding: "10px 14px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "6px" } },
      React.createElement("div", { style: { color: "#fca5a5", fontSize: "12px" } }, "\u26A0\uFE0F " + error)
    )
  );
}

export default PhotoAnalysisCard;
