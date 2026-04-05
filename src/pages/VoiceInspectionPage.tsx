# DEPLOY123 — VoiceInspectionPage.tsx v16.0
## Evidence Provenance UI Wiring

### WHAT THIS DOES
- Calls evidence-provenance function in pipeline (after parse/asset, before decision-core)
- Passes provenance results to decision-core
- Adds Evidence Provenance card to UI (trust band, evidence items, measurement gaps)
- Updates step tracker to show provenance step
- Provenance data included in PDF export

---

### PATCH 1: Update file header
**FIND:**
```
// DEPLOY113 — VoiceInspectionPage.tsx v15.0
// v15.0: Superbrain Synthesis — Five Magic Features rendered
```
**REPLACE WITH:**
```
// DEPLOY123 — VoiceInspectionPage.tsx v16.0
// v16.0: Evidence Provenance wired into pipeline + UI
// Calls evidence-provenance before decision-core, passes results through pipeline.
// Evidence Provenance card shows trust band, evidence items, measurement reality gaps.
// DEPLOY113 — VoiceInspectionPage.tsx v15.0
// v15.0: Superbrain Synthesis — Five Magic Features rendered
```

---

### PATCH 2: Add provenance state variables
**FIND (in the state declarations, after the superbrain state block):**
```
  var [grammarBridgeResult, setGrammarBridgeResult] = useState<any>(null);
```
**REPLACE WITH:**
```
  var [grammarBridgeResult, setGrammarBridgeResult] = useState<any>(null);

  // EVIDENCE PROVENANCE STATE — v16.0
  var [provenanceResult, setProvenanceResult] = useState<any>(null);
  var [provenanceLoading, setProvenanceLoading] = useState(false);
```

---

### PATCH 3: Reset provenance state on new analysis
**FIND (in handleGenerate, the reset block):**
```
    setSuperbrainResult(null); setSuperbrainError(null);
    setGrammarBridgeResult(null);
```
**REPLACE WITH:**
```
    setSuperbrainResult(null); setSuperbrainError(null);
    setGrammarBridgeResult(null);
    setProvenanceResult(null); setProvenanceLoading(false);
```

---

### PATCH 4: Add provenance step to step tracker
**FIND (initialSteps array in handleGenerate):**
```
    var initialSteps: StepState[] = [
      { label: "AI Incident Parser (GPT-4o)", status: "pending" },
      { label: "Resolve Asset + Domain Gate", status: "pending" },
      { label: "Physics-First Decision Core (6 states)", status: "pending" },
      { label: "Superbrain Synthesis (Five Magic Features)", status: "pending" },
    ];
```
**REPLACE WITH:**
```
    var initialSteps: StepState[] = [
      { label: "AI Incident Parser (GPT-4o)", status: "pending" },
      { label: "Resolve Asset + Domain Gate", status: "pending" },
      { label: "Evidence Provenance (trust classification)", status: "pending" },
      { label: "Physics-First Decision Core (6 states)", status: "pending" },
      { label: "Superbrain Synthesis (Five Magic Features)", status: "pending" },
    ];
```

**NOTE:** This shifts step indices. Steps 2,3 become 3,4. Update ALL `updateStep(2, ...)` to `updateStep(3, ...)` and all `updateStep(3, ...)` to `updateStep(4, ...)` in the rest of the file.

Specifically in handleGenerate:
- The `for (var ei = 2;` loop → change to `for (var ei = 3;`
- The `for (var wi = 2;` loop (questions path) → change to `for (var wi = 3;`

And in continuePipeline:
- `updateStep(2, ...)` (decision-core running/done/error) → `updateStep(3, ...)`
- `updateStep(3, ...)` (superbrain running/done/error) → `updateStep(4, ...)`

---

### PATCH 5: Call evidence-provenance in continuePipeline
**FIND (in continuePipeline, at the start of the try block):**
```
    try {
      s = updateStep(2, { status: "running", detail: "6 Klein bottle states..." }, s); setSteps(s.slice());
      var coreResult: any = null;
```

**REPLACE WITH (remember step 2 is now provenance, step 3 is decision-core):**
```
    try {
      // STEP 3 (was 2): EVIDENCE PROVENANCE — v16.0
      s = updateStep(2, { status: "running", detail: "classifying evidence trust..." }, s); setSteps(s.slice());
      var provenanceData: any = null;
      try {
        setProvenanceLoading(true);
        var provRes = await callAPI("evidence-provenance", {
          transcript: inputText,
          numeric_values: parsedResult ? parsedResult.numeric_values || {} : {},
          methods: [],  // methods extracted from transcript by the function itself
          findings: []  // findings extracted from transcript by the function itself
        });
        if (provRes && provRes.ok) {
          provenanceData = provRes;
          setProvenanceResult(provRes);
          var trustLabel = (provRes.provenance_summary ? provRes.provenance_summary.trust_band : "?");
          var evidenceCount = (provRes.evidence ? provRes.evidence.length : 0);
          s = updateStep(2, { status: "done", detail: trustLabel + " trust | " + evidenceCount + " items" }, s);
        } else {
          s = updateStep(2, { status: "done", detail: "no provenance data" }, s);
        }
      } catch (provErr: any) {
        s = updateStep(2, { status: "error", detail: provErr.message }, s);
        errs.push("evidence-provenance: " + provErr.message);
      }
      setProvenanceLoading(false);
      setSteps(s.slice());

      // STEP 4 (was 3): DECISION CORE
      s = updateStep(3, { status: "running", detail: "6 Klein bottle states..." }, s); setSteps(s.slice());
      var coreResult: any = null;
```

---

### PATCH 6: Pass provenance to decision-core call
**FIND (the decision-core API call in continuePipeline):**
```
        var coreRes = await callAPI("decision-core", {
          parsed: parsedResult,
          asset: assetResult,
          confirmed_flags: confirmedFlags,
          transcript: inputText,
          reality_lock: realityLock
        });
```
**REPLACE WITH:**
```
        var coreRes = await callAPI("decision-core", {
          parsed: parsedResult,
          asset: assetResult,
          confirmed_flags: confirmedFlags,
          transcript: inputText,
          reality_lock: realityLock,
          evidence_provenance: provenanceData
        });
```

---

### PATCH 7: Add Evidence Provenance UI card
**INSERT this block AFTER the "REVIEWER BRIEF" card and BEFORE the "LIVE PHYSICS STATE" card:**

```
        {/* EVIDENCE PROVENANCE — v16.0 */}
        {provenanceResult && provenanceResult.provenance_summary && (
          <Card title="Evidence Provenance" icon={"\uD83D\uDD17"} accent="#0d9488" collapsible={true} defaultCollapsed={false} status={provenanceResult.provenance_summary.trust_band + " trust"}>
            {/* Trust Summary Banner */}
            <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: provenanceResult.provenance_summary.trust_band === "HIGH" ? "#f0fdf4" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#fffbeb" : "#fef2f2", border: "1px solid " + (provenanceResult.provenance_summary.trust_band === "HIGH" ? "#bbf7d0" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#fde68a" : "#fecaca") }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: provenanceResult.provenance_summary.trust_band === "HIGH" ? "#16a34a" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#ca8a04" : "#dc2626" }}>
                  Evidence Trust: {provenanceResult.provenance_summary.trust_band}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                  {provenanceResult.provenance_summary.total_evidence_items} items classified | Dominant: {provenanceResult.provenance_summary.dominant_source} | Measured: {Math.round(provenanceResult.provenance_summary.measured_fraction * 100)}%
                </div>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: provenanceResult.provenance_summary.trust_band === "HIGH" ? "#16a34a" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#ca8a04" : "#dc2626" }}>
                {Math.round(provenanceResult.provenance_summary.average_trust_weight * 100)}%
              </div>
            </div>

            {/* Provenance Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "12px" }}>
              {(function() {
                var counts = provenanceResult.provenance_summary.counts || {};
                var items = [
                  { key: "MEASURED", color: "#16a34a", icon: "\uD83D\uDCCF" },
                  { key: "OBSERVED", color: "#2563eb", icon: "\uD83D\uDC41\uFE0F" },
                  { key: "REPORTED", color: "#ca8a04", icon: "\uD83D\uDCDD" },
                  { key: "INFERRED", color: "#9333ea", icon: "\uD83E\uDD14" }
                ];
                return items.map(function(item, idx) {
                  return React.createElement("div", { key: idx, style: { textAlign: "center", padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", border: "1px solid #e5e7eb" } },
                    React.createElement("div", { style: { fontSize: "10px", color: "#6b7280", textTransform: "uppercase" } }, item.icon + " " + item.key),
                    React.createElement("div", { style: { fontSize: "18px", fontWeight: 700, color: item.color } }, String(counts[item.key] || 0))
                  );
                });
              })()}
            </div>

            {/* Evidence Items Table */}
            {provenanceResult.evidence && provenanceResult.evidence.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Evidence Items</div>
                {provenanceResult.evidence.map(function(ev: any, ei: number) {
                  var provColor = ev.provenance === "MEASURED" ? "#16a34a" : ev.provenance === "OBSERVED" ? "#2563eb" : ev.provenance === "REPORTED" ? "#ca8a04" : ev.provenance === "INFERRED" ? "#9333ea" : "#dc2626";
                  var bgColor = ev.provenance === "MEASURED" ? "#f0fdf4" : ev.provenance === "OBSERVED" ? "#eff6ff" : ev.provenance === "REPORTED" ? "#fffbeb" : ev.provenance === "INFERRED" ? "#faf5ff" : "#fef2f2";
                  return (
                    <div key={ei} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", marginBottom: "3px", backgroundColor: bgColor, borderRadius: "4px", borderLeft: "3px solid " + provColor }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: provColor, backgroundColor: provColor + "18", padding: "2px 6px", borderRadius: "3px", minWidth: "70px", textAlign: "center" }}>{ev.provenance}</span>
                      <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{(ev.claim || "").replace(/_/g, " ")}</span>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>trust: {Math.round((ev.provenance_weight || 0) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Measurement Reality */}
            {provenanceResult.measurement_reality && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Measurement Reality</div>
                <div style={{ padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", backgroundColor: provenanceResult.measurement_reality.overall_adequacy === "ADEQUATE" ? "#f0fdf4" : provenanceResult.measurement_reality.overall_adequacy === "PARTIAL" ? "#fffbeb" : "#fef2f2", borderLeft: "3px solid " + (provenanceResult.measurement_reality.overall_adequacy === "ADEQUATE" ? "#16a34a" : provenanceResult.measurement_reality.overall_adequacy === "PARTIAL" ? "#ca8a04" : "#dc2626") }}>
                  <span style={{ fontWeight: 700, fontSize: "13px", color: provenanceResult.measurement_reality.overall_adequacy === "ADEQUATE" ? "#16a34a" : provenanceResult.measurement_reality.overall_adequacy === "PARTIAL" ? "#ca8a04" : "#dc2626" }}>
                    Method Adequacy: {provenanceResult.measurement_reality.overall_adequacy}
                  </span>
                </div>
                {provenanceResult.measurement_reality.unanswered_gaps && provenanceResult.measurement_reality.unanswered_gaps.length > 0 && (
                  <div>
                    {provenanceResult.measurement_reality.unanswered_gaps.map(function(gap: any, gi: number) {
                      var gapColor = gap.severity === "critical" ? "#dc2626" : "#ca8a04";
                      var gapBg = gap.severity === "critical" ? "#fef2f2" : "#fffbeb";
                      return (
                        <div key={gi} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: gapBg, borderRadius: "4px", borderLeft: "3px solid " + gapColor, color: "#374151" }}>
                          <strong style={{ color: gapColor }}>{gap.severity === "critical" ? "\uD83D\uDED1" : "\u26A0\uFE0F"} {gap.question}</strong>
                          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{gap.message}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Recommendation */}
            {provenanceResult.provenance_summary.recommendation && (
              <div style={{ marginTop: "10px", padding: "8px 12px", backgroundColor: "#fffbeb", borderRadius: "6px", borderLeft: "3px solid #ca8a04", fontSize: "12px", color: "#92400e" }}>
                {"\u26A0\uFE0F"} {provenanceResult.provenance_summary.recommendation}
              </div>
            )}
          </Card>
        )}
```

---

### PATCH 8: Update PDF export to include provenance
**FIND (in generateInspectionReport, after the Reviewer Brief section and before Reality Confidence):**
```
  // Reality Confidence
  html += "<div class='section'>";
```
**INSERT BEFORE:**
```
  // Evidence Provenance
  if (data.superbrainResult && data.superbrainResult.provenance_summary) {
    var prov = data.superbrainResult;
    html += "<div class='section'>";
    html += "<div class='section-title'>Evidence Provenance</div>";
    html += "<div class='info-row'><span class='info-label'>Trust Band</span><span class='info-value'>" + esc(prov.provenance_summary.trust_band) + " (" + Math.round(prov.provenance_summary.average_trust_weight * 100) + "%)</span></div>";
    html += "<div class='info-row'><span class='info-label'>Dominant Source</span><span class='info-value'>" + esc(prov.provenance_summary.dominant_source) + "</span></div>";
    html += "<div class='info-row'><span class='info-label'>Measured Fraction</span><span class='info-value'>" + Math.round(prov.provenance_summary.measured_fraction * 100) + "%</span></div>";
    html += "<div class='info-row'><span class='info-label'>Total Items</span><span class='info-value'>" + (prov.provenance_summary.total_evidence_items || 0) + "</span></div>";
    if (prov.measurement_reality) {
      html += "<div class='info-row'><span class='info-label'>Method Adequacy</span><span class='info-value'>" + esc(prov.measurement_reality.overall_adequacy) + "</span></div>";
      if (prov.measurement_reality.unanswered_gaps) {
        for (var ugi = 0; ugi < prov.measurement_reality.unanswered_gaps.length; ugi++) {
          html += "<div class='gap-item'>" + esc(prov.measurement_reality.unanswered_gaps[ugi].message) + "</div>";
        }
      }
    }
    if (prov.provenance_summary.recommendation) {
      html += "<div style='margin-top:8px;font-size:11px;color:#92400e;padding:6px 10px;background:#fffbeb;border-radius:4px;'>" + esc(prov.provenance_summary.recommendation) + "</div>";
    }
    html += "</div>";
  }

```

**NOTE:** For the PDF export, we need to pass provenanceResult through. Update the generateInspectionReport call:

**FIND:**
```
              <button onClick={function() { generateInspectionReport({ transcript: transcript, parsed: parsed, asset: asset, decisionCore: dc, aiNarrative: aiNarrative, superbrainResult: superbrainResult }); }}
```
**REPLACE WITH:**
```
              <button onClick={function() { generateInspectionReport({ transcript: transcript, parsed: parsed, asset: asset, decisionCore: dc, aiNarrative: aiNarrative, superbrainResult: superbrainResult, provenanceResult: provenanceResult }); }}
```

And update the function signature:
**FIND:**
```
function generateInspectionReport(data: {
  transcript: string;
  parsed: any;
  asset: any;
  decisionCore: any;
  aiNarrative: string | null;
  superbrainResult: any;
}) {
```
**REPLACE WITH:**
```
function generateInspectionReport(data: {
  transcript: string;
  parsed: any;
  asset: any;
  decisionCore: any;
  aiNarrative: string | null;
  superbrainResult: any;
  provenanceResult?: any;
}) {
```

Then in the PDF, the provenance section should reference `data.provenanceResult` not `data.superbrainResult`:
**The PDF provenance section should be:**
```
  if (data.provenanceResult && data.provenanceResult.provenance_summary) {
    var prov = data.provenanceResult;
```

---

### PATCH 9: Update engine version in PDF footer
**FIND:**
```
  html += "<br/>Engine: decision-core v2.3.1 + Superbrain v1.1 | Klein Bottle Architecture | " + (dc.klein_bottle_states || 6) + " states";
```
**REPLACE WITH:**
```
  html += "<br/>Engine: decision-core v2.5 + Superbrain v1.1 + Provenance v1.0 | Klein Bottle Architecture | " + (dc.klein_bottle_states || 6) + " states";
```

Also update the header:
**FIND:**
```
  html += "<div class='subtitle'>Engine: decision-core v2.3.1 + Superbrain Synthesis v1.1 | Elapsed: " + (dc.elapsed_ms || "?") + "ms</div>";
```
**REPLACE WITH:**
```
  html += "<div class='subtitle'>Engine: decision-core v2.5 + Superbrain v1.1 + Provenance v1.0 | Elapsed: " + (dc.elapsed_ms || "?") + "ms</div>";
```

---

## DEPLOY ORDER
1. DEPLOY122: decision-core.ts v2.5 — backend must go first
2. DEPLOY123: VoiceInspectionPage.tsx v16.0 — frontend depends on backend

## GIT WORKFLOW
```bash
cd "/c/Users/rjohn/OneDrive/Desktop/NDT Platform"
# Ctrl+F "git pull" before every commit
git pull
# Edit decision-core.ts with patches above
# Commit: "DEPLOY122: decision-core v2.5 — Evidence Provenance integration"
# Wait for deploy
# Then edit VoiceInspectionPage.tsx with patches above
# Commit: "DEPLOY123: VoiceInspectionPage v16.0 — Evidence Provenance UI"
```

## REGRESSION IMPACT
- Decision-core scoring will shift slightly due to provenance weighting
- If no provenance data is passed (backward compatible), behavior is identical to v2.4.1
- Regression suite should still pass — provenance is additive only
- Recommend running regression after DEPLOY122 to confirm pass rate holds
