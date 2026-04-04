# DEPLOY106 — decision-core.ts patches
# Two targeted fixes. Apply in GitHub web editor (Ctrl+F to locate, paste replacement).
# STRING CONCATENATION ONLY — no backticks introduced.

---

## PATCH 1 of 2 — Mechanism Certainty Cap (H2S sour-service scenarios)

### WHY
When H2S is present, SSC and HIC are physically possible but unverified.
The fatigue score still reaches "confirmed" (>= 0.75) via cyclic/stress-conc boosts.
Fix: after scoring, cap fatigue at "probable" when competing hydrogen mechanisms
are unresolved. Preserves the candidate set instead of collapsing to a single label.

### FIND this exact block (around line 310 in resolveDamageReality):

  validated.sort(function(a, b) { return b.reality_score - a.reality_score; });
  var primary = validated.length > 0 ? validated[0] : null;

### REPLACE WITH:

  validated.sort(function(a, b) { return b.reality_score - a.reality_score; });

  // MECHANISM UNCERTAINTY PRESERVATION
  // H2S present + SSC/HIC unresolved = fatigue cannot be "confirmed"
  // Dominant candidate set, not a single confirmed root cause
  if (physics.chemical.h2s_present) {
    var hydrogenUnresolved = false;
    for (var hci = 0; hci < validated.length; hci++) {
      var hcm = validated[hci];
      if ((hcm.id === "ssc_sulfide" || hcm.id === "hic") && hcm.reality_state !== "confirmed") {
        hydrogenUnresolved = true;
        break;
      }
    }
    if (hydrogenUnresolved) {
      for (var hcf = 0; hcf < validated.length; hcf++) {
        if (validated[hcf].id === "fatigue_mechanical" && validated[hcf].reality_state === "confirmed") {
          validated[hcf].reality_state = "probable";
          if (validated[hcf].reality_score > 0.74) { validated[hcf].reality_score = 0.74; }
          validated[hcf].evidence_against.push(
            "H2S present with unresolved SSC/HIC — mechanism set not collapsed to single dominant until hydrogen susceptibility assessment complete"
          );
        }
      }
      validated.sort(function(a, b) { return b.reality_score - a.reality_score; });
    }
  }

  var primary = validated.length > 0 ? validated[0] : null;

---

## PATCH 2 of 2 — Authority Stack Expansion (PVHO crack cases)

### WHY
Two bugs in current code:
  a) PVHO secondary authorities omit ASME FFS-1 / API 579 (crack evaluation basis)
  b) The FFS gap-check explicitly SKIPS PVHO: "matched.pri.indexOf("PVHO") === -1"
     meaning FFS is never surfaced for the most critical asset class in the system.
Fix: add FFS-1 to PVHO secondaries, remove the PVHO exclusion, surface authority
layering as an explicit gap note when a crack indication is present.

### FIND this exact entry in AUTHORITY_MAP (around line 340):

  { kw: ["decompression chamber", "hyperbaric", "dive system", "diving bell", "human occupancy", "pvho", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"],
    ac: ["pressure_vessel"], pri: "ASME PVHO-1", sec: ["ASME Section VIII", "API 510", "ASME Section V"],
    cond: [{ code: "ADCI Standards", cond: "diving ops" }, { code: "IMCA D 024", cond: "international diving" }],
    dw: "DESIGN: PRESSURIZED SYSTEM — current state may not represent design intent" },

### REPLACE WITH:

  { kw: ["decompression chamber", "hyperbaric", "dive system", "diving bell", "human occupancy", "pvho", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"],
    ac: ["pressure_vessel"], pri: "ASME PVHO-1",
    sec: ["ASME FFS-1 / API 579 (crack fitness-for-service)", "ASME Section VIII (construction basis)", "API 510 (inspection)", "ASME Section V (NDE procedures)"],
    cond: [{ code: "ADCI Standards", cond: "diving ops" }, { code: "IMCA D 024", cond: "international diving" }, { code: "Owner/operator qualification + manufacturer repair requirements", cond: "repair or modification" }],
    dw: "DESIGN: PRESSURIZED SYSTEM — current state may not represent design intent" },


### FIND this exact FFS gap-check block in resolveAuthorityReality (around line 380):

  // Check FFS need — but NOT for PVHO-1 (has own integrity framework)
  // API 579 is relevant for refinery/process equipment, not for human-occupancy chambers
  if ((physics.stress.cyclic_loading || physics.chemical.corrosive_environment) && consequence.consequence_tier !== "LOW" && matched.pri.indexOf("PVHO") === -1) {
    var hasFFS = false;
    for (var si = 0; si < matched.sec.length; si++) { if (matched.sec[si].indexOf("579") !== -1) hasFFS = true; }
    if (!hasFFS) gaps.push("Fitness-for-service (API 579) recommended but not in chain");
  }

### REPLACE WITH:

  // FFS gap check — ALL asset classes including PVHO
  // PVHO-1 governs occupancy/pressure boundary; ASME FFS-1 governs crack disposition — both required
  var hasCrackIndication = hasWord(lt, "crack") || hasWord(lt, "indication") || hasWord(lt, "flaw") || hasWord(lt, "linear");
  if ((physics.stress.cyclic_loading || physics.chemical.corrosive_environment) && consequence.consequence_tier !== "LOW") {
    var hasFFS = false;
    for (var si = 0; si < matched.sec.length; si++) {
      if (matched.sec[si].indexOf("579") !== -1 || matched.sec[si].indexOf("FFS") !== -1) { hasFFS = true; }
    }
    if (!hasFFS) {
      gaps.push("Fitness-for-service assessment (ASME FFS-1 / API 579) recommended but not in authority chain");
    }
  }
  // PVHO crack cases: surface authority layering explicitly
  if (matched.pri.indexOf("PVHO") !== -1 && hasCrackIndication) {
    gaps.push(
      "Authority layering required: PVHO-1 (occupancy/construction standard) + ASME FFS-1 (crack evaluation basis) + NDE procedure basis + owner/operator requirements. Single-code resolution is insufficient for in-service crack disposition on a PVHO."
    );
  }


### FIND the alignment string for PVHO CRITICAL cases (a few lines below the above):

  if (consequence.consequence_tier === "CRITICAL" && matched.pri.indexOf("PVHO") !== -1) {
    alignment = "CONSISTENT — PVHO-1 requires multi-method NDE for pressure boundary welds, aligning with physics requirement for CRITICAL consequence";
  }

### REPLACE WITH:

  if (consequence.consequence_tier === "CRITICAL" && matched.pri.indexOf("PVHO") !== -1) {
    if (hasCrackIndication) {
      alignment = "DUAL AUTHORITY REQUIRED: PVHO-1 governs occupancy/pressure boundary requirements. ASME FFS-1 / API 579 governs crack fitness-for-service evaluation. Both required for in-service crack disposition — PVHO-1 alone does not provide a crack acceptance basis.";
    } else {
      alignment = "CONSISTENT — PVHO-1 requires multi-method NDE for pressure boundary welds, aligning with physics requirement for CRITICAL consequence";
    }
  }

---

## WHAT THESE PATCHES PRODUCE (Scenario 1 — decomp chamber, H2S, propagating crack)

BEFORE:
  Primary: Mechanical Fatigue (confirmed, score: 0.85)
  Authority: ASME PVHO-1 | secondaries: [ASME Section VIII, API 510, ASME Section V]

AFTER:
  Primary: Mechanical Fatigue (probable, score: 0.74)
    + evidence_against: "H2S present with unresolved SSC/HIC — mechanism set not collapsed..."
  Authority: ASME PVHO-1
    secondaries: [ASME FFS-1 / API 579 (crack fitness-for-service), ASME Section VIII, API 510, ASME Section V]
    gaps: [
      "Authority layering required: PVHO-1 (occupancy/construction) + ASME FFS-1 (crack evaluation) + ...",
    ]
    alignment: "DUAL AUTHORITY REQUIRED: PVHO-1 governs occupancy/pressure boundary..."

GPT eval target: mechanism_reasoning 8.0 -> 8.5+, authority_mapping 7.0 -> 8.5+

---

## NEXT FILE NEEDED

voice-incident-plan.ts (or wherever the AI narrative is generated)
That is where "Legacy plan generated for cargo ship" originates.
Paste the full file in the next session message.
