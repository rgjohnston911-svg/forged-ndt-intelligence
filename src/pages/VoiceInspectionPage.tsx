// DEPLOY102 — VoiceInspectionPage.tsx ENGINEERING INTEGRATION
// 4 SURGICAL PATCHES — GitHub Web Editor Safe
// STRING CONCATENATION ONLY — NO TEMPLATE LITERALS
// Apply patches in order: PATCH 1 → PATCH 2 → PATCH 3 → PATCH 4
// ================================================================
// HOW TO APPLY IN GITHUB WEB EDITOR:
// 1. Open src/pages/VoiceInspectionPage.tsx
// 2. Use Ctrl+H (find/replace) for each patch
// 3. Copy FIND TEXT exactly, paste NEW TEXT exactly
// 4. Commit after all 4 patches applied
// ================================================================


// ================================================================
// PATCH 1 — ADD INTERFACE + STATE VARS
// Find this exact line (around line 488):
// ================================================================

// FIND:
// var [decisionCore, setDecisionCore] = useState<any>(null);

// REPLACE WITH:
// ================================================================

var [decisionCore, setDecisionCore] = useState<any>(null);
var [engineeringResult, setEngineeringResult] = useState<any>(null);
var [engineeringLoading, setEngineeringLoading] = useState(false);
var [engineeringError, setEngineeringError] = useState<string | null>(null);
var [showExpertMode, setShowExpertMode] = useState(false);

// ================================================================
// END PATCH 1
// ================================================================


// ================================================================
// PATCH 2 — ADD ENGINEERING CALL AFTER DECISION CORE RESOLVES
// Find this exact line (around line 662):
// ================================================================

// FIND:
// setDecisionCore(coreResult);

// REPLACE WITH:
// ================================================================

setDecisionCore(coreResult);
if (coreResult) {
  callEngineeringCore(coreResult, transcript || "");
}

// ================================================================
// END PATCH 2
// ================================================================


// ================================================================
// PATCH 3 — ADD callEngineeringCore FUNCTION
// Find this exact string (the line just before the return statement
// of the component — look for the closing of the last function
// before return):
// ================================================================

// FIND (look for this near end of function body, before return()):
// var parsedRef = useRef<any>(null);

// REPLACE WITH:
// ================================================================

var parsedRef = useRef<any>(null);

const callEngineeringCore = async (decResult: any, narrativeText: string) => {
  setEngineeringLoading(true);
  setEngineeringError(null);
  var engInput: Record<string, any> = {
    caseId: "ENG-" + Date.now(),
    assetClass: decResult.asset_class || decResult.assetClass || "unknown",
    consequenceTier: decResult.consequence_reality || decResult.consequence || "MODERATE",
    ndtVerdict: decResult.disposition || "INDETERMINATE",
    ndtConfidence: decResult.reality_confidence || 0.5,
    primaryMechanism: decResult.primary_mechanism || "",
    governingStandard: decResult.authority_reality || "",
    incidentNarrative: narrativeText,
    isCyclicService: false,
    materialClass: ""
  };
  var narr = narrativeText.toLowerCase();
  if (narr.includes("stainless") || narr.includes("316") || narr.includes("304")) {
    engInput.materialClass = "austenitic_ss";
  } else if (narr.includes("duplex") || narr.includes("2205")) {
    engInput.materialClass = "duplex_ss";
  } else if (narr.includes("carbon steel") || narr.includes("a36") || narr.includes("grade b")) {
    engInput.materialClass = "carbon_steel";
  } else if (narr.includes("low alloy") || narr.includes("p91") || narr.includes("a516")) {
    engInput.materialClass = "low_alloy";
  }
  engInput.isCyclicService = narr.includes("cyclic") || narr.includes("fatigue") ||
    narr.includes("vibrat") || narr.includes("pulsing");
  if (narr.includes("crack")) engInput.flawType = "crack";
  else if (narr.includes("corrosion") || narr.includes("thinning")) engInput.flawType = "corrosion";
  else if (narr.includes("pitting") || narr.includes("pit")) engInput.flawType = "pitting";
  else if (narr.includes("dent") || narr.includes("deform")) engInput.flawType = "dent";
  if (narr.includes("h2s") || narr.includes("sour")) engInput.h2sPartialPressureMPa = 0.001;
  if (narr.includes("chloride") || narr.includes("seawater") || narr.includes("salt")) engInput.chloridePPM = 1000;
  if (narr.includes("high temp") || narr.includes("elevated temp") || narr.includes("creep")) engInput.operatingTempC = 400;
  if (narr.includes("offshore") || narr.includes("platform") || narr.includes("subsea")) engInput.cofBoost = true;
  if (narr.includes("pvho") || narr.includes("chamber") || narr.includes("decompression")) engInput.cofBoost = true;
  try {
    var engRes = await fetch("/.netlify/functions/engineering-core", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(engInput)
    });
    if (!engRes.ok) {
      throw new Error("Engineering core status " + engRes.status);
    }
    var engData = await engRes.json();
    setEngineeringResult(engData);
  } catch (engErr: any) {
    setEngineeringError("Engineering layer: " + (engErr.message || String(engErr)));
  } finally {
    setEngineeringLoading(false);
  }
};

// ================================================================
// END PATCH 3
// ================================================================


// ================================================================
// PATCH 4 — ADD ENGINEERING CARDS TO JSX
// Find this exact comment string in the JSX (near end of results):
// ================================================================

// FIND:
// {/* DECISION TRACE (audit) */}

// REPLACE WITH:
// ================================================================

{engineeringLoading && (
  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: "rgba(68,170,255,0.05)", border: "1px solid rgba(68,170,255,0.2)", borderRadius: "8px", margin: "8px 0" }}>
    <div style={{ width: "18px", height: "18px", border: "2px solid rgba(68,170,255,0.2)", borderTopColor: "#44aaff", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
    <div>
      <div style={{ fontSize: "13px", color: "#44aaff" }}>Engineering Intelligence Layer analyzing...</div>
      <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>7 engines | FAD | Paris Law | API 579 | RBI</div>
    </div>
  </div>
)}

{engineeringError && (
  <div style={{ padding: "10px 14px", background: "rgba(255,150,0,0.08)", border: "1px solid rgba(255,150,0,0.3)", borderRadius: "6px", fontSize: "12px", color: "#ffaa44", margin: "8px 0" }}>
    {"Engineering layer: " + engineeringError}
  </div>
)}

{engineeringResult && (
  <div style={{ marginTop: "4px" }}>

    {engineeringResult.engineeringOverrideFlag && (
      <div style={{ background: "#1a0000", border: "2px solid #ff3333", borderRadius: "8px", padding: "14px 16px", margin: "10px 0", boxShadow: "0 0 12px rgba(255,51,51,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ fontSize: "18px" }}>{"⚠"}</span>
          <span style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.08em", color: "#ff4444", textTransform: "uppercase" as const }}>{"ENGINEERING OVERRIDE ACTIVE"}</span>
        </div>
        <div style={{ fontSize: "12px", color: "#ffaaaa", lineHeight: 1.5, marginBottom: "6px" }}>
          {engineeringResult.overrideReason}
        </div>
        {engineeringResult.arbitration && engineeringResult.arbitration.disagreementSummary && (
          <div style={{ fontSize: "11px", color: "#ff8888", borderTop: "1px solid #440000", paddingTop: "8px", fontStyle: "italic" }}>
            {engineeringResult.arbitration.disagreementSummary}
          </div>
        )}
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#ffcccc", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
          {"Engineering sign-off required before return to service"}
        </div>
      </div>
    )}

    <div style={{ background: "#0f1a2a", border: "1px solid #1e3a5a", borderRadius: "8px", padding: "14px", margin: "8px 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#4488aa", textTransform: "uppercase" as const, marginBottom: "10px" }}>{"DUAL-CORE VERDICT"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 1fr", alignItems: "center", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" as const, marginBottom: "4px" }}>{"NDT INSPECTOR"}</div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#4488ff" }}>{(decisionCore && (decisionCore.disposition || decisionCore.reality_confidence)) ? (decisionCore.disposition || "HOLD") : "—"}</div>
          <div style={{ fontSize: "11px", color: "#557" }}>{decisionCore ? (decisionCore.authority_reality || "—") : "—"}</div>
        </div>
        <div style={{ textAlign: "center" as const, color: "#444", fontSize: "12px", fontWeight: 600 }}>{"vs"}</div>
        <div>
          <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" as const, marginBottom: "4px" }}>{"ENGINEER"}</div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: engineeringResult.engineeringSignificance === "CRITICAL" ? "#ff4444" : engineeringResult.engineeringSignificance === "HIGH" ? "#ff8c00" : engineeringResult.engineeringSignificance === "MODERATE" ? "#ffd700" : "#44ff88" }}>
            {(engineeringResult.engineeringVerdict || "").replace(/_/g, " ")}
          </div>
          <div style={{ fontSize: "11px", color: "#557" }}>{engineeringResult.primaryAuthority || "—"}</div>
        </div>
      </div>
      {engineeringResult.engineeringOverrideFlag && (
        <div style={{ textAlign: "center" as const, marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #330000", fontSize: "11px", color: "#ff6666", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
          {"Verdicts disagree — Engineering governs"}
        </div>
      )}
    </div>

    <div style={{ background: "#0f1a0f", border: "1px solid " + (engineeringResult.safetyMarginPct === null ? "#333" : engineeringResult.safetyMarginPct < 10 ? "#ff3333" : engineeringResult.safetyMarginPct < 30 ? "#ff8c00" : engineeringResult.safetyMarginPct < 60 ? "#ffd700" : "#44bb44"), borderRadius: "8px", padding: "14px", margin: "8px 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#44aa44", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"STRUCTURAL SAFETY MARGIN (FAD)"}</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: engineeringResult.safetyMarginPct === null ? "#888" : engineeringResult.safetyMarginPct < 10 ? "#ff4444" : engineeringResult.safetyMarginPct < 30 ? "#ff8c00" : engineeringResult.safetyMarginPct < 60 ? "#ffd700" : "#44ff88" }}>
        {engineeringResult.safetyMarginPct !== null ? (engineeringResult.safetyMarginPct + "% from failure boundary") : "Flaw dimensions required for FAD"}
      </div>
      <div style={{ fontSize: "11px", color: "#557", marginTop: "4px" }}>{(engineeringResult.e3 && engineeringResult.e3.fadStatus || "").replace(/_/g, " ")}</div>
      {engineeringResult.e3 && engineeringResult.e3.kr !== null && (
        <div style={{ fontSize: "11px", color: "#668", marginTop: "4px", fontFamily: "monospace" }}>
          {"K_r=" + (engineeringResult.e3.kr || 0).toFixed(3) + " | L_r=" + (engineeringResult.e3.lr || 0).toFixed(3) + " | " + (engineeringResult.ffsLevel || "")}
        </div>
      )}
      {engineeringResult.e3 && engineeringResult.e3.hardGate && (
        <div style={{ marginTop: "8px", background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.4)", borderRadius: "4px", padding: "5px 8px", fontSize: "11px", color: "#ff8888", fontWeight: 600 }}>
          {"HARD GATE — Level 3 Engineering Review Required"}
        </div>
      )}
    </div>

    <div style={{ background: "#1a100a", border: "1px solid #3a2010", borderRadius: "8px", padding: "14px", margin: "8px 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#cc8844", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"FAILURE MODE"}</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#ffaa55" }}>
        {(engineeringResult.dominantFailureMode || "").replace(/_/g, " ")}
      </div>
      <div style={{ fontSize: "11px", color: "#887766", marginTop: "4px" }}>
        {"Confidence: " + (engineeringResult.failureModeConfidencePct || 0) + "% | Env severity: " + (engineeringResult.e2 && engineeringResult.e2.environmentSeverity || "—")}
      </div>
      {engineeringResult.e2 && engineeringResult.e2.secondaryMode && (
        <div style={{ fontSize: "11px", color: "#aa7744", marginTop: "4px" }}>
          {"Secondary: " + engineeringResult.e2.secondaryMode.replace(/_/g, " ")}
        </div>
      )}
      <div style={{ fontSize: "11px", color: "#668", marginTop: "4px" }}>
        {"Recommended NDT: " + (engineeringResult.recommendedNDTMethod || "").replace(/_/g, "/")}
      </div>
    </div>

    <div style={{ background: "#0a0a1a", border: "1px solid " + (engineeringResult.e5 && engineeringResult.e5.calendarMonthsLow !== null && engineeringResult.e5.calendarMonthsLow < 12 ? "#ff3333" : engineeringResult.e5 && engineeringResult.e5.calendarMonthsLow !== null && engineeringResult.e5.calendarMonthsLow < 24 ? "#ff8c00" : "#2244aa"), borderRadius: "8px", padding: "14px", margin: "8px 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#4466cc", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"REMAINING LIFE ESTIMATE"}</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: engineeringResult.e5 && engineeringResult.e5.calendarMonthsLow !== null && engineeringResult.e5.calendarMonthsLow < 12 ? "#ff4444" : "#6688ff" }}>
        {engineeringResult.remainingLifeSummary || "Insufficient data for life estimate"}
      </div>
      {engineeringResult.e5 && engineeringResult.e5.minerDamageFraction !== null && (
        <div style={{ fontSize: "11px", color: "#557", marginTop: "4px" }}>
          {"Cumulative fatigue damage: " + ((engineeringResult.e5.minerDamageFraction || 0) * 100).toFixed(0) + "% of design life (Miner's Rule)"}
        </div>
      )}
      {engineeringResult.e5 && engineeringResult.e5.criticalFlawSizeMM !== null && (
        <div style={{ fontSize: "11px", color: "#668", marginTop: "4px", fontFamily: "monospace" }}>
          {"Critical flaw size a_c: " + (engineeringResult.e5.criticalFlawSizeMM || 0).toFixed(1) + "mm"}
        </div>
      )}
      {engineeringResult.e5 && engineeringResult.e5.hardGate && (
        <div style={{ marginTop: "8px", background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.4)", borderRadius: "4px", padding: "5px 8px", fontSize: "11px", color: "#ff8888", fontWeight: 600 }}>
          {"GATE: " + (engineeringResult.e5.hardGateReason || "Life below safe threshold")}
        </div>
      )}
    </div>

    <div style={{ background: "#0d0a00", border: "1px solid " + (engineeringResult.riskRanking === "CRITICAL" ? "#ff3333" : engineeringResult.riskRanking === "HIGH" ? "#ff8c00" : engineeringResult.riskRanking === "MEDIUM" ? "#ffd700" : "#44aa44"), borderRadius: "8px", padding: "14px", margin: "8px 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#aaaa44", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"RISK RANKING (API 580/581 RBI)"}</div>
      <div style={{ fontSize: "16px", fontWeight: 800, color: engineeringResult.riskRanking === "CRITICAL" ? "#ff4444" : engineeringResult.riskRanking === "HIGH" ? "#ff8c00" : engineeringResult.riskRanking === "MEDIUM" ? "#ffd700" : "#44ff88" }}>
        {engineeringResult.riskRanking}
      </div>
      {engineeringResult.e6 && (
        <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
          {"PoF: " + engineeringResult.e6.pofCategory + "/5 x CoF: " + engineeringResult.e6.cofCategory + "/5 = " + engineeringResult.e6.riskScore + "/25"}
        </div>
      )}
      <div style={{ fontSize: "11px", color: "#778", marginTop: "4px" }}>
        {"Next inspection: " + (engineeringResult.inspectionIntervalMonths === 0 ? "IMMEDIATE" : engineeringResult.inspectionIntervalMonths + " months")}
      </div>
    </div>

    {engineeringResult.engineeringRestrictions && engineeringResult.engineeringRestrictions.length > 0 && (
      <div style={{ background: "#1a0d00", border: "1px solid #553300", borderRadius: "8px", padding: "14px", margin: "8px 0" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#cc6600", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"ENGINEERING RESTRICTIONS"}</div>
        {engineeringResult.engineeringRestrictions.map(function(r: string, i: number) {
          return <div key={i} style={{ fontSize: "12px", color: "#ffaa66", padding: "3px 0" }}>{"• " + r}</div>;
        })}
      </div>
    )}

    <div style={{ background: "#111", border: "1px solid #333", borderRadius: "8px", padding: "14px", margin: "8px 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#666", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"ENGINEERING SUMMARY"}</div>
      <div style={{ fontSize: "12px", color: "#aaa", lineHeight: 1.6 }}>
        {engineeringResult.simpleNarrative}
      </div>
    </div>

    <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
      <button
        onClick={function() { setShowExpertMode(!showExpertMode); }}
        style={{ background: "transparent", border: "1px solid " + (showExpertMode ? "#44aaff" : "#555"), color: showExpertMode ? "#44aaff" : "#888", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
      >
        {showExpertMode ? "Hide Expert Detail" : "Show Expert Detail (FAD / Audit Trail / Assumptions)"}
      </button>
    </div>

    {showExpertMode && (
      <div style={{ borderTop: "1px solid #222", paddingTop: "10px" }}>
        <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "12px", margin: "6px 0" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#555", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"EVIDENCE INTEGRITY"}</div>
          <div style={{ fontSize: "12px", color: "#777" }}>
            {(engineeringResult.evidenceIntegrityScore || 0) + "% of critical inputs measured | " + (engineeringResult.evidenceIntegrityLabel || "").replace(/_/g, " ")}
          </div>
        </div>
        {engineeringResult.domainViolations && engineeringResult.domainViolations.length > 0 && (
          <div style={{ background: "#1a0000", border: "1px solid #550000", borderRadius: "8px", padding: "12px", margin: "6px 0" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#aa3333", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"DOMAIN VIOLATIONS"}</div>
            {engineeringResult.domainViolations.map(function(v: string, i: number) {
              return <div key={i} style={{ fontSize: "11px", color: "#ff8888", padding: "3px 0", lineHeight: 1.4 }}>{"⚠ " + v}</div>;
            })}
          </div>
        )}
        <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "12px", margin: "6px 0" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#555", textTransform: "uppercase" as const, marginBottom: "6px" }}>
            {"ASSUMPTION REGISTER (" + ((engineeringResult.assumptionFlags && engineeringResult.assumptionFlags.length) || 0) + " items)"}
          </div>
          {engineeringResult.assumptionFlags && engineeringResult.assumptionFlags.map(function(a: string, i: number) {
            return <div key={i} style={{ fontSize: "11px", color: "#666", padding: "2px 0", lineHeight: 1.4 }}>{"[" + (i + 1) + "] " + a}</div>;
          })}
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "12px", margin: "6px 0" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#555", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"ENGINE AUDIT TRAIL"}</div>
          {engineeringResult.auditTrail && engineeringResult.auditTrail.map(function(line: string, i: number) {
            return <div key={i} style={{ fontSize: "10px", color: "#555", fontFamily: "monospace", padding: "2px 0", borderBottom: "1px solid #181818" }}>{line}</div>;
          })}
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "12px", margin: "6px 0" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#555", textTransform: "uppercase" as const, marginBottom: "6px" }}>{"FULL EXPERT NARRATIVE"}</div>
          <div style={{ fontSize: "11px", color: "#666", fontFamily: "monospace", lineHeight: 1.6 }}>
            {engineeringResult.expertNarrative}
          </div>
        </div>
      </div>
    )}

  </div>
)}

{/* DECISION TRACE (audit) */}
