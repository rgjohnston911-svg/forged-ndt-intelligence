# DEPLOY122 — decision-core.ts v2.5
## Evidence Provenance Integration

### WHAT THIS DOES
- Accepts `evidence_provenance` from VoiceInspectionPage pipeline
- Uses provenance trust weights to adjust mechanism scores in State 2
- Adds provenance data to final JSON output
- Provenance-weighted confidence penalty when evidence base is weak

---

### PATCH 1: Update file header comment
**FIND:**
```
// DEPLOY121 — decision-core.ts v2.4.1
```
**REPLACE WITH:**
```
// DEPLOY122 — decision-core.ts v2.5
// v2.5: Evidence Provenance Integration
// DEPLOY122: Accepts evidence_provenance from pipeline. Uses provenance trust weights
//   in damage mechanism scoring (State 2). Provenance trust band feeds into
//   contradiction detector as confidence penalty when evidence base is weak.
//   Provenance data included in output JSON for UI rendering.
// DEPLOY121 — decision-core.ts v2.4.1
```

---

### PATCH 2: Accept provenance input in main handler
**FIND (in main handler, around line ~1540):**
```
    var confirmedFlags = body.confirmed_flags || null;
    var transcript = body.transcript || parsed.raw_text || "";
```
**REPLACE WITH:**
```
    var confirmedFlags = body.confirmed_flags || null;
    var evidenceProvenance = body.evidence_provenance || null;
    var transcript = body.transcript || parsed.raw_text || "";
```

---

### PATCH 3: Pass provenance to resolveDamageReality
**FIND (in main handler, after physics resolution):**
```
    var physics = resolvePhysicalReality(transcript, events, numVals, confirmedFlags, assetClass);
    var damage = resolveDamageReality(physics, confirmedFlags, transcript);
```
**REPLACE WITH:**
```
    var physics = resolvePhysicalReality(transcript, events, numVals, confirmedFlags, assetClass);
    var damage = resolveDamageReality(physics, confirmedFlags, transcript, evidenceProvenance);
```

---

### PATCH 4: Update resolveDamageReality signature and add provenance scoring
**FIND (function signature):**
```
function resolveDamageReality(physics: any, flags: any, transcript: string) {
```
**REPLACE WITH:**
```
function resolveDamageReality(physics: any, flags: any, transcript: string, provenance?: any) {
```

**FIND (inside resolveDamageReality, after the DEPLOY115 EVIDENCE HIERARCHY section — right before the sort, after the Active Negation Suppression block):**

Look for this block:
```
    if (score > 1) score = 1;
    if (score < 0) score = 0;
    var state = score >= 0.75 ? "confirmed" : score >= 0.55 ? "probable" : score >= 0.35 ? "possible" : "unverified";
```
**INSERT BEFORE that block (right after the deformNegated penalty block):**
```
    // ============================================================================
    // DEPLOY122: EVIDENCE PROVENANCE TRUST WEIGHTING
    // When provenance data is available, adjust mechanism score based on whether
    // the supporting evidence is MEASURED (high trust) vs INFERRED (low trust).
    // This is additive to existing evidence hierarchy — provenance provides
    // systematic trust grading across ALL evidence, not just wall-loss vs crack.
    // ============================================================================
    if (provenance && provenance.evidence && provenance.evidence.length > 0) {
      var mechKeywords = md.name.toLowerCase().split(/[\s\/()]+/);
      var relevantProvenance: any[] = [];
      for (var pei = 0; pei < provenance.evidence.length; pei++) {
        var pe = provenance.evidence[pei];
        var peClaimLower = (pe.claim || "").toLowerCase();
        for (var mki = 0; mki < mechKeywords.length; mki++) {
          if (mechKeywords[mki].length > 3 && peClaimLower.indexOf(mechKeywords[mki]) !== -1) {
            relevantProvenance.push(pe);
            break;
          }
        }
      }
      if (relevantProvenance.length > 0) {
        var avgProvenanceWeight = 0;
        for (var rpi = 0; rpi < relevantProvenance.length; rpi++) {
          avgProvenanceWeight += relevantProvenance[rpi].provenance_weight || 0.25;
        }
        avgProvenanceWeight = avgProvenanceWeight / relevantProvenance.length;
        // MEASURED evidence (weight 1.0) gets +0.08 bonus
        // OBSERVED (0.85) gets +0.04
        // REPORTED (0.6) gets 0
        // INFERRED (0.45) gets -0.05
        // UNVERIFIED (0.25) gets -0.10
        var provenanceAdjust = (avgProvenanceWeight - 0.6) * 0.25;
        score += provenanceAdjust;
        if (provenanceAdjust > 0.01) {
          evFor.push("provenance: supporting evidence is " + relevantProvenance[0].provenance + " (trust weight " + roundN(avgProvenanceWeight, 2) + ")");
        } else if (provenanceAdjust < -0.01) {
          evAg.push("provenance: supporting evidence is " + relevantProvenance[0].provenance + " (trust weight " + roundN(avgProvenanceWeight, 2) + ") — lower confidence");
        }
      }
    }

```

---

### PATCH 5: Add provenance penalty to contradiction detector
**FIND (at the end of detectContradictions, before the return):**
```
  if (penalty > 0.4) penalty = 0.4;
  return { flags: flags, penalty: roundN(penalty, 2) };
```
**REPLACE WITH:**
```
  // DEPLOY122: PROVENANCE TRUST PENALTY
  // If the overall evidence base is weak (mostly inferred/unverified),
  // add a confidence penalty.
  if (provenance && provenance.provenance_summary) {
    var trustBand = provenance.provenance_summary.trust_band;
    if (trustBand === "VERY_LOW") {
      flags.push("WARNING: Evidence base is primarily unverified/inferred (trust band: VERY_LOW). Disposition should not rely on current evidence quality.");
      penalty += 0.10;
    } else if (trustBand === "LOW") {
      flags.push("WARNING: Evidence trust band is LOW — most claims are reported or inferred, not measured. Additional measured data recommended.");
      penalty += 0.05;
    }
  }

  if (penalty > 0.4) penalty = 0.4;
  return { flags: flags, penalty: roundN(penalty, 2) };
```

Also update the detectContradictions function signature:
**FIND:**
```
function detectContradictions(physics: any, damage: any, consequence: any, authority: any, inspection: any, transcript?: string) {
```
**REPLACE WITH:**
```
function detectContradictions(physics: any, damage: any, consequence: any, authority: any, inspection: any, transcript?: string, provenance?: any) {
```

And update the call site in the handler:
**FIND:**
```
    var contradictions = detectContradictions(physics, damage, consequence, authority, inspection, transcript);
```
**REPLACE WITH:**
```
    var contradictions = detectContradictions(physics, damage, consequence, authority, inspection, transcript, evidenceProvenance);
```

---

### PATCH 6: Add provenance data to output JSON
**FIND (in the final response JSON, after `inspection_reality` block, before `physics_computations`):**
```
          physics_computations: computations,
```
**REPLACE WITH:**
```
          evidence_provenance: evidenceProvenance ? {
            evidence: evidenceProvenance.evidence || [],
            provenance_summary: evidenceProvenance.provenance_summary || null,
            measurement_reality: evidenceProvenance.measurement_reality || null
          } : null,
          physics_computations: computations,
```

---

### PATCH 7: Update engine_version in output
**FIND:**
```
          engine_version: "physics-first-decision-core-v2.3.1",
```
**REPLACE WITH:**
```
          engine_version: "physics-first-decision-core-v2.5",
```

---

That's 7 patches total. All are surgical — no structural changes to existing logic.
