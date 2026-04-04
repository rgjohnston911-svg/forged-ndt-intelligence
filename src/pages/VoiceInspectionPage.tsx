// DEPLOY102 — ENGINEERING INTELLIGENCE UI ADDITIONS
// Add to: src/pages/VoiceInspectionPage.tsx (v13.0)
// Integrates Engineering Core output into the dual-verdict display
// STRING CONCATENATION ONLY — NO TEMPLATE LITERALS
// ================================================================
//
// INTEGRATION STEPS:
//
// STEP 1: Add EngineeringResult state type (Section A below)
// STEP 2: Add engineeringResult state variable (Section B)
// STEP 3: Add callEngineeringCore() function (Section C)
// STEP 4: Call callEngineeringCore() after decision-core resolves (Section D)
// STEP 5: Add Engineering UI Cards in JSX (Section E)
//
// ================================================================

// ================================================================
// SECTION A: TYPE — Add near top of file with other interfaces
// ================================================================

/*
interface EngineeringResult {
  caseId: string;
  engineeringSignificance: string;
  dominantFailureMode: string;
  failureModeConfidencePct: number;
  safetyMarginPct: number | null;
  remainingLifeSummary: string;
  riskRanking: string;
  engineeringVerdict: string;
  engineeringRestrictions: string[];
  engineeringOverrideFlag: boolean;
  overrideReason: string;
  ffsLevel: string;
  primaryAuthority: string;
  inspectionIntervalMonths: number;
  recommendedNDTMethod: string;
  evidenceIntegrityScore: number;
  evidenceIntegrityLabel: string;
  assumptionFlags: string[];
  domainViolations: string[];
  auditTrail: string[];
  simpleNarrative: string;
  expertNarrative: string;
  e2: {
    primaryMode: string;
    primaryConfidence: number;
    secondaryMode: string | null;
    environmentSeverity: string;
    recommendations: string;
  };
  e3: {
    kr: number | null;
    lr: number;
    fadSafetyMarginPct: number | null;
    fadStatus: string;
    assessmentLevel: number;
    hardGate: boolean;
    kI: number | null;
    kIC: number;
  };
  e5: {
    calendarMonthsLow: number | null;
    calendarMonthsBest: number | null;
    criticalFlawSizeMM: number | null;
    minerDamageFraction: number | null;
    hardGate: boolean;
    hardGateReason: string;
  };
  e6: {
    pofCategory: number;
    cofCategory: number;
    riskScore: number;
    riskLevel: string;
    inspectionIntervalMonths: number;
    actionPriority: string;
  };
  arbitration: {
    engineeringOverrideFlag: boolean;
    overrideReason: string;
    finalDisposition: string;
    finalSignificance: string;
    restrictions: string[];
    disagreementSummary: string;
    requiresEngineeringSignoff: boolean;
  };
}
*/

// ================================================================
// SECTION B: STATE — Add inside component with other useState calls
// ================================================================

/*
  const [engineeringResult, setEngineeringResult] = useState<EngineeringResult | null>(null);
  const [engineeringLoading, setEngineeringLoading] = useState(false);
  const [engineeringError, setEngineeringError] = useState<string | null>(null);
  const [showExpertMode, setShowExpertMode] = useState(false);
*/

// ================================================================
// SECTION C: FUNCTION — Add inside component after existing functions
// ================================================================

/*
  const callEngineeringCore = async (
    decisionResult: any,
    parsedEvents: any[],
    narrativeText: string
  ) => {
    setEngineeringLoading(true);
    setEngineeringError(null);

    // Build engineering input from decision-core result + parsed events + narrative
    const engineeringInput: Record<string, any> = {
      caseId: decisionResult.caseId || ("CASE-" + Date.now()),
      assetClass: decisionResult.assetClass || extractAssetClass(parsedEvents),
      assetSubtype: decisionResult.assetSubtype || "",
      componentType: extractComponentType(parsedEvents, narrativeText),
      consequenceTier: decisionResult.consequence || "MODERATE",
      ndtVerdict: decisionResult.disposition || "INDETERMINATE",
      ndtConfidence: decisionResult.confidence || 0.5,
      primaryMechanism: decisionResult.primaryMechanism || "",
      governingStandard: decisionResult.governingStandard || "",
      incidentNarrative: narrativeText,
      isCyclicService: detectCyclicService(parsedEvents, narrativeText),
      materialClass: extractMaterialClass(parsedEvents, narrativeText)
    };

    // Extract quantitative data from parsed events
    for (const evt of parsedEvents) {
      if (evt.type === "pressure" && evt.valueMPa) engineeringInput.operatingPressureMPa = evt.valueMPa;
      if (evt.type === "temperature" && evt.valueC) engineeringInput.operatingTempC = evt.valueC;
      if (evt.type === "wall_thickness" && evt.valueMM) engineeringInput.wallThicknessMM = evt.valueMM;
      if (evt.type === "outside_diameter" && evt.valueMM) engineeringInput.outsideDiameterMM = evt.valueMM;
      if (evt.type === "flaw_depth" && evt.valueMM) engineeringInput.flawDepthMM = evt.valueMM;
      if (evt.type === "flaw_length" && evt.valueMM) engineeringInput.flawLengthMM = evt.valueMM;
      if (evt.type === "flaw_type" && evt.value) engineeringInput.flawType = evt.value;
      if (evt.type === "service_years" && evt.value) engineeringInput.serviceYears = evt.value;
      if (evt.type === "stress_range" && evt.valueMPa) engineeringInput.stressRangeMPa = evt.valueMPa;
      if (evt.type === "h2s" && evt.valueMPa) engineeringInput.h2sPartialPressureMPa = evt.valueMPa;
      if (evt.type === "chloride" && evt.valuePPM) engineeringInput.chloridePPM = evt.valuePPM;
    }

    // Narrative extraction for quick chemistry/material clues
    const narr = narrativeText.toLowerCase();
    if (!engineeringInput.materialClass) {
      if (narr.includes("stainless") || narr.includes("316") || narr.includes("304")) engineeringInput.materialClass = "austenitic_ss";
      else if (narr.includes("duplex") || narr.includes("2205")) engineeringInput.materialClass = "duplex_ss";
      else if (narr.includes("carbon steel") || narr.includes("a36") || narr.includes("grade b")) engineeringInput.materialClass = "carbon_steel";
      else if (narr.includes("low alloy") || narr.includes("p91") || narr.includes("a516")) engineeringInput.materialClass = "low_alloy";
    }
    if (!engineeringInput.isCyclicService) {
      engineeringInput.isCyclicService = narr.includes("cyclic") || narr.includes("fatigue") ||
        narr.includes("vibration") || narr.includes("fluctuat") || narr.includes("pulsing");
    }
    if (!engineeringInput.flawType) {
      if (narr.includes("crack")) engineeringInput.flawType = "crack";
      else if (narr.includes("corrosion") || narr.includes("thinning")) engineeringInput.flawType = "corrosion";
      else if (narr.includes("pitting") || narr.includes("pit")) engineeringInput.flawType = "pitting";
      else if (narr.includes("dent") || narr.includes("deform")) engineeringInput.flawType = "dent";
    }

    try {
      const response = await fetch("/.netlify/functions/engineering-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(engineeringInput)
      });

      if (!response.ok) {
        throw new Error("Engineering core returned " + response.status);
      }

      const data: EngineeringResult = await response.json();
      setEngineeringResult(data);
    } catch (err: any) {
      setEngineeringError("Engineering assessment unavailable: " + (err.message || String(err)));
    } finally {
      setEngineeringLoading(false);
    }
  };

  // Helper: extract asset class from parsed events
  const extractAssetClass = (events: any[]): string => {
    for (const e of events) {
      if (e.type === "asset_class" && e.value) return e.value;
    }
    return "unknown";
  };

  // Helper: extract component type from events/narrative
  const extractComponentType = (events: any[], narrative: string): string => {
    for (const e of events) {
      if (e.type === "component_type" && e.value) return e.value;
    }
    const n = narrative.toLowerCase();
    if (n.includes("weld toe")) return "weld_toe";
    if (n.includes("weld root")) return "weld_root";
    if (n.includes("nozzle")) return "nozzle";
    return "unknown";
  };

  // Helper: detect cyclic service from events/narrative
  const detectCyclicService = (events: any[], narrative: string): boolean => {
    for (const e of events) {
      if (e.type === "cyclic_service") return true;
    }
    const n = narrative.toLowerCase();
    return n.includes("cyclic") || n.includes("fatigue") || n.includes("vibrat") || n.includes("pulsing");
  };

  // Helper: extract material class
  const extractMaterialClass = (events: any[], narrative: string): string | undefined => {
    for (const e of events) {
      if (e.type === "material_class" && e.value) return e.value;
    }
    return undefined;
  };
*/

// ================================================================
// SECTION D: CALL SITE — In existing analysis function, after decision-core resolves
// Find where you call /.netlify/functions/decision-core and add after it:
// ================================================================

/*
  // ADD THIS BLOCK after decisionResult is set, inside your existing analysis function:

  // ---- DUAL-CORE: Engineering Intelligence Layer ----
  // Runs independently after NDT Physics Core resolves
  // Produces Engineering verdict for override flag comparison

  if (decisionResult) {
    await callEngineeringCore(decisionResult, parsedEvents, transcriptText);
  }
*/

// ================================================================
// SECTION E: JSX — Engineering Intelligence Cards
// Add in the results section, after existing disposition/confidence cards
// ================================================================

/*
  {engineeringLoading && (
    <div className="engineering-loading-card">
      <div className="loading-spinner-sm" />
      <span>Engineering Intelligence Layer analyzing...</span>
      <span className="loading-sub">7 engines | FAD | Paris Law | API 579 | RBI</span>
    </div>
  )}

  {engineeringError && (
    <div className="card card-warning">
      <div className="card-label">ENGINEERING LAYER</div>
      <div className="card-value-sm">{engineeringError}</div>
    </div>
  )}

  {engineeringResult && (
    <>
      {/* ============================================================
          ENGINEERING OVERRIDE FLAG — MOST IMPORTANT OUTPUT
          Displayed at top of engineering section when NDT != Engineering
          ============================================================ */}
      {engineeringResult.engineeringOverrideFlag && (
        <div className="override-flag-banner">
          <div className="override-flag-header">
            <span className="override-flag-icon">⚠</span>
            <span className="override-flag-title">ENGINEERING OVERRIDE ACTIVE</span>
          </div>
          <div className="override-flag-body">
            {engineeringResult.overrideReason}
          </div>
          {engineeringResult.arbitration.disagreementSummary && (
            <div className="override-flag-detail">
              {engineeringResult.arbitration.disagreementSummary}
            </div>
          )}
          <div className="override-flag-footer">
            Engineering sign-off required before return to service
          </div>
        </div>
      )}

      {/* ============================================================
          DUAL VERDICT COMPARISON CARD
          Side-by-side: NDT verdict vs Engineering verdict
          ============================================================ */}
      <div className="card card-dual-verdict">
        <div className="card-label">DUAL-CORE VERDICT</div>
        <div className="dual-verdict-grid">
          <div className="verdict-col verdict-ndt">
            <div className="verdict-col-label">NDT INSPECTOR</div>
            <div className={"verdict-col-value verdict-" + (decisionResult?.disposition || "unknown").toLowerCase().replace(/_/g, "-")}>
              {decisionResult?.disposition || "—"}
            </div>
            <div className="verdict-col-sub">{decisionResult?.governingStandard || "—"}</div>
          </div>
          <div className="verdict-divider">vs</div>
          <div className="verdict-col verdict-engineering">
            <div className="verdict-col-label">ENGINEER</div>
            <div className={"verdict-col-value verdict-sig-" + (engineeringResult.engineeringSignificance || "unknown").toLowerCase()}>
              {engineeringResult.engineeringVerdict.replace(/_/g, " ")}
            </div>
            <div className="verdict-col-sub">{engineeringResult.primaryAuthority}</div>
          </div>
        </div>
        {engineeringResult.engineeringOverrideFlag && (
          <div className="dual-verdict-override-note">
            Verdicts disagree — Engineering governs
          </div>
        )}
      </div>

      {/* ============================================================
          STRUCTURAL SAFETY MARGIN (FAD)
          ============================================================ */}
      <div className={"card " + (
        engineeringResult.safetyMarginPct === null ? "card-unknown" :
        engineeringResult.safetyMarginPct < 10 ? "card-critical" :
        engineeringResult.safetyMarginPct < 30 ? "card-high" :
        engineeringResult.safetyMarginPct < 60 ? "card-moderate" : "card-low"
      )}>
        <div className="card-label">STRUCTURAL SAFETY MARGIN</div>
        <div className="card-value">
          {engineeringResult.safetyMarginPct !== null
            ? engineeringResult.safetyMarginPct + "% from failure boundary"
            : "Cannot calculate — flaw dimensions required"}
        </div>
        <div className="card-sub">{engineeringResult.e3.fadStatus.replace(/_/g, " ")}</div>
        {engineeringResult.e3.kr !== null && (
          <div className="card-detail">
            {"K_r = " + engineeringResult.e3.kr.toFixed(3) + " | L_r = " + engineeringResult.e3.lr.toFixed(3) + " | FFS " + engineeringResult.ffsLevel}
          </div>
        )}
        {engineeringResult.e3.hardGate && (
          <div className="card-gate-flag">HARD GATE — Level 3 review required</div>
        )}
      </div>

      {/* ============================================================
          FAILURE MODE + CONFIDENCE
          ============================================================ */}
      <div className={"card " + (engineeringResult.e2.secondaryMode ? "card-multi-mode" : "card-mode")}>
        <div className="card-label">FAILURE MODE (ENGINEERING ASSESSMENT)</div>
        <div className="card-value">
          {engineeringResult.dominantFailureMode.replace(/_/g, " ")}
        </div>
        <div className="card-sub">
          {"Confidence: " + engineeringResult.failureModeConfidencePct + "% | Environment: " + engineeringResult.e2.environmentSeverity}
        </div>
        {engineeringResult.e2.secondaryMode && (
          <div className="card-secondary-mode">
            {"Secondary: " + engineeringResult.e2.secondaryMode.replace(/_/g, " ")}
          </div>
        )}
        <div className="card-detail">
          {"Recommended method: " + engineeringResult.recommendedNDTMethod.replace(/_/g, "/")}
        </div>
      </div>

      {/* ============================================================
          REMAINING LIFE ESTIMATE
          ============================================================ */}
      <div className={"card " + (
        engineeringResult.e5.calendarMonthsLow === 0 ? "card-critical" :
        engineeringResult.e5.calendarMonthsLow !== null && engineeringResult.e5.calendarMonthsLow < 12 ? "card-critical" :
        engineeringResult.e5.calendarMonthsLow !== null && engineeringResult.e5.calendarMonthsLow < 24 ? "card-high" :
        engineeringResult.e5.calendarMonthsLow !== null && engineeringResult.e5.calendarMonthsLow < 48 ? "card-moderate" : "card-low"
      )}>
        <div className="card-label">REMAINING LIFE ESTIMATE</div>
        <div className="card-value">{engineeringResult.remainingLifeSummary}</div>
        {engineeringResult.e5.minerDamageFraction !== null && (
          <div className="card-sub">
            {"Cumulative fatigue damage: " + (engineeringResult.e5.minerDamageFraction * 100).toFixed(0) + "% of design life"}
          </div>
        )}
        {engineeringResult.e5.criticalFlawSizeMM !== null && (
          <div className="card-detail">
            {"Critical flaw size (a_c): " + engineeringResult.e5.criticalFlawSizeMM.toFixed(1) + "mm"}
          </div>
        )}
        {engineeringResult.e5.hardGate && (
          <div className="card-gate-flag">{"GATE: " + engineeringResult.e5.hardGateReason}</div>
        )}
      </div>

      {/* ============================================================
          RISK RANKING (API 580/581)
          ============================================================ */}
      <div className={"card card-risk-" + engineeringResult.riskRanking.toLowerCase()}>
        <div className="card-label">RISK RANKING (API 580/581 RBI)</div>
        <div className="card-value">{engineeringResult.riskRanking}</div>
        <div className="card-sub">
          {"PoF: " + engineeringResult.e6.pofCategory + "/5 × CoF: " + engineeringResult.e6.cofCategory + "/5 = Score " + engineeringResult.e6.riskScore + "/25"}
        </div>
        <div className="card-detail">
          {"Next inspection: " + (engineeringResult.inspectionIntervalMonths === 0 ? "IMMEDIATE" : engineeringResult.inspectionIntervalMonths + " months")}
        </div>
        <div className="card-detail">{engineeringResult.e6.actionPriority.replace(/_/g, " ")}</div>
      </div>

      {/* ============================================================
          ENGINEERING RESTRICTIONS
          ============================================================ */}
      {engineeringResult.engineeringRestrictions.length > 0 && (
        <div className={"card " + (engineeringResult.engineeringRestrictions.length > 2 ? "card-critical" : "card-moderate")}>
          <div className="card-label">ENGINEERING RESTRICTIONS</div>
          {engineeringResult.engineeringRestrictions.map((r, i) => (
            <div key={i} className="restriction-item">{"• " + r}</div>
          ))}
        </div>
      )}

      {/* ============================================================
          SIMPLE NARRATIVE
          ============================================================ */}
      <div className="card card-narrative">
        <div className="card-label">ENGINEERING ASSESSMENT SUMMARY</div>
        <div className="card-narrative-text">{engineeringResult.simpleNarrative}</div>
      </div>

      {/* ============================================================
          EXPERT MODE TOGGLE — Shows full engine detail
          ============================================================ */}
      <div className="expert-toggle-row">
        <button
          className={"btn-expert-toggle " + (showExpertMode ? "active" : "")}
          onClick={() => setShowExpertMode(!showExpertMode)}
        >
          {showExpertMode ? "Hide Expert Detail" : "Show Expert Detail (Physics / FAD / Audit)"}
        </button>
      </div>

      {showExpertMode && (
        <div className="expert-mode-section">

          {/* Evidence Integrity */}
          <div className="card card-audit">
            <div className="card-label">EVIDENCE INTEGRITY</div>
            <div className="card-value-sm">
              {engineeringResult.evidenceIntegrityScore + "% measured | " + engineeringResult.evidenceIntegrityLabel.replace(/_/g, " ")}
            </div>
          </div>

          {/* Domain Violations */}
          {engineeringResult.domainViolations.length > 0 && (
            <div className="card card-domain-violation">
              <div className="card-label">DOMAIN VIOLATIONS</div>
              {engineeringResult.domainViolations.map((v, i) => (
                <div key={i} className="violation-item">{"⚠ " + v}</div>
              ))}
            </div>
          )}

          {/* Assumption Register */}
          <div className="card card-assumptions">
            <div className="card-label">{"ASSUMPTION REGISTER (" + engineeringResult.assumptionFlags.length + " total)"}</div>
            <div className="assumptions-list">
              {engineeringResult.assumptionFlags.map((a, i) => (
                <div key={i} className="assumption-item">{"[" + (i + 1) + "] " + a}</div>
              ))}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="card card-audit-trail">
            <div className="card-label">ENGINE AUDIT TRAIL</div>
            {engineeringResult.auditTrail.map((line, i) => (
              <div key={i} className="audit-line">{line}</div>
            ))}
          </div>

          {/* Expert Narrative */}
          <div className="card card-expert-narrative">
            <div className="card-label">FULL EXPERT NARRATIVE</div>
            <div className="card-narrative-text expert">{engineeringResult.expertNarrative}</div>
          </div>
        </div>
      )}
    </>
  )}
*/

// ================================================================
// SECTION F: CSS — Add to your stylesheet
// ================================================================

/*
.override-flag-banner {
  background: #2d0000;
  border: 2px solid #ff3333;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { border-color: #ff3333; box-shadow: 0 0 0 0 rgba(255,51,51,0); }
  50% { border-color: #ff6666; box-shadow: 0 0 0 6px rgba(255,51,51,0.2); }
}

.override-flag-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.override-flag-icon {
  font-size: 20px;
  color: #ff3333;
}

.override-flag-title {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #ff4444;
  text-transform: uppercase;
}

.override-flag-body {
  color: #ffaaaa;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.override-flag-detail {
  color: #ff8888;
  font-size: 12px;
  border-top: 1px solid #550000;
  padding-top: 8px;
  margin-top: 4px;
  font-style: italic;
}

.override-flag-footer {
  margin-top: 10px;
  color: #ffcccc;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dual-verdict-grid {
  display: grid;
  grid-template-columns: 1fr 40px 1fr;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.verdict-divider {
  text-align: center;
  color: #666;
  font-weight: 600;
  font-size: 13px;
}

.verdict-col-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #888;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.verdict-col-value {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.verdict-col-sub {
  font-size: 11px;
  color: #aaa;
  margin-top: 4px;
}

.verdict-sig-critical { color: #ff4444; }
.verdict-sig-high { color: #ff8c00; }
.verdict-sig-moderate { color: #ffd700; }
.verdict-sig-low { color: #44ff88; }

.dual-verdict-override-note {
  text-align: center;
  color: #ff8888;
  font-size: 11px;
  font-weight: 600;
  padding-top: 8px;
  border-top: 1px solid #330000;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.card-gate-flag {
  margin-top: 8px;
  background: rgba(255, 50, 50, 0.15);
  border: 1px solid rgba(255, 50, 50, 0.4);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 11px;
  color: #ff8888;
  font-weight: 600;
}

.card-risk-critical { border-left: 3px solid #ff3333; }
.card-risk-high { border-left: 3px solid #ff8c00; }
.card-risk-medium { border-left: 3px solid #ffd700; }
.card-risk-low { border-left: 3px solid #44ff88; }

.restriction-item {
  padding: 4px 0;
  font-size: 13px;
  color: #ffccaa;
}

.expert-toggle-row {
  display: flex;
  justify-content: center;
  margin: 16px 0 8px 0;
}

.btn-expert-toggle {
  background: transparent;
  border: 1px solid #555;
  color: #aaa;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-expert-toggle:hover,
.btn-expert-toggle.active {
  border-color: #44aaff;
  color: #44aaff;
  background: rgba(68, 170, 255, 0.08);
}

.violation-item {
  color: #ffaaaa;
  font-size: 12px;
  padding: 4px 0;
  line-height: 1.4;
}

.assumption-item {
  color: #aaa;
  font-size: 11px;
  padding: 2px 0;
  line-height: 1.4;
}

.audit-line {
  color: #888;
  font-size: 11px;
  font-family: monospace;
  padding: 2px 0;
  border-bottom: 1px solid #222;
}

.card-narrative-text {
  color: #ccc;
  font-size: 13px;
  line-height: 1.6;
}

.card-narrative-text.expert {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.engineering-loading-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(68, 170, 255, 0.05);
  border: 1px solid rgba(68, 170, 255, 0.2);
  border-radius: 8px;
  margin: 8px 0;
}

.loading-spinner-sm {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(68, 170, 255, 0.2);
  border-top-color: #44aaff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-sub {
  font-size: 11px;
  color: #666;
  margin-left: 4px;
}

.expert-mode-section {
  border-top: 1px solid #333;
  padding-top: 12px;
}
*/

// ================================================================
// END DEPLOY102
// Total additions: ~380 lines
// Add to VoiceInspectionPage.tsx v12.0 (DEPLOY100) to produce v13.0
// ================================================================
