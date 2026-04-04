if (hasWord(lt, "floor beam") || hasWord(lt, "stringer")) { stressConc = true; stressConcLocs.push("beam_connection"); }
// Prior repair = stress concentration + residual stress
if (hasWord(lt, "prior repair") || hasWord(lt, "repair") && hasWord(lt, "member")) { stressConc = true; stressConcLocs.push("prior_repair_zone"); residual = true; }
  // DOMAIN: Offshore structures — gravity + environmental loading = tensile in braces/legs, cyclic from waves
  if (assetClass === "offshore_platform" || hasWord(lt, "jacket") || hasWord(lt, "platform") && hasWord(lt, "offshore")) {
    tensile = true; // Gravity + environmental loads create tensile in braces and legs
    if (!cyclic) { cyclic = true; cyclicSrc = "wave_current_cycling"; }
    loads.push("gravity_loading"); loads.push("wave_loading");
    loadPath = "primary"; // Platform legs and braces are primary load path
  }
  // Offshore structural connections = stress concentrations
  if (hasWord(lt, "brace") || hasWord(lt, "node") || hasWord(lt, "leg") || hasWord(lt, "jacket leg")) {
    stressConc = true; stressConcLocs.push("structural_node_connection");
  }
  if (hasWord(lt, "boat landing") || hasWord(lt, "conductor") || hasWord(lt, "caisson") || hasWord(lt, "riser")) {
    stressConc = true; stressConcLocs.push("appurtenance_connection");
  }
  if (hasWord(lt, "splash zone")) { stressConc = true; stressConcLocs.push("splash_zone"); }

if (hasWord(lt, "weld toe") || hasWord(lt, "weld root")) { stressConc = true; stressConcLocs.push("weld_toe_or_root"); }
if (hasWord(lt, "nozzle") || hasWord(lt, "branch")) { stressConc = true; stressConcLocs.push("nozzle_junction"); }
@@ -233,7 +248,7 @@ function resolvePhysicalReality(transcript: string, events: string[], numVals: a
var impactEv = hasWord(lt, "impact") || hasWord(lt, "struck") || hasWord(lt, "collision") || hasWord(lt, "dropped object");
var flowEro = hasWord(lt, "erosion") || hasWord(lt, "high velocity");
var cav = hasWord(lt, "cavitat");
  var storedE = assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline" || hasWord(lt, "pressur");
  var storedE = assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline" || assetClass === "offshore_platform" || hasWord(lt, "pressur") || hasWord(lt, "production platform") || hasWord(lt, "hydrocarbon");

// TIME
var svcYears: number | null = nv.service_years || null;
@@ -497,7 +512,7 @@ function resolveConsequenceReality(physics: any, damage: any, assetClass: string
var requirements: string[] = [];

// CRITICAL: human death
  var critKw = ["decompression chamber", "hyperbaric", "dive system", "diving bell", "life support", "human occupancy", "manned", "personnel basket", "escape capsule", "breathing air"];
  var critKw = ["decompression chamber", "hyperbaric", "dive system", "diving bell", "life support", "human occupancy", "manned", "personnel basket", "escape capsule", "breathing air", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"];
for (var ci = 0; ci < critKw.length; ci++) {
if (hasWord(lt, critKw[ci])) { tier = "CRITICAL"; basis.push("PHYSICS: Human occupancy (" + critKw[ci] + ")"); humanImpact = "FATAL — human occupancy during operation"; break; }
}
@@ -544,6 +559,33 @@ function resolveConsequenceReality(physics: any, damage: any, assetClass: string
basis.push("CONSEQUENCE: Loaded train — derailment risk");
if (humanImpact === "Low") humanImpact = "Derailment fatality risk";
}
  // CONSEQUENCE ESCALATION: offshore platforms — always HIGH minimum (personnel + hydrocarbons + structural collapse)
  if (assetClass === "offshore_platform" || hasWord(lt, "offshore") || hasWord(lt, "platform") || hasWord(lt, "jacket structure")) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Offshore platform — personnel exposure, hydrocarbon systems, structural collapse risk");
    if (humanImpact === "Low") humanImpact = "Personnel fatality risk — offshore structural failure";
    envImpact = "Hydrocarbon release / environmental contamination";
  }
  // CONSEQUENCE ESCALATION: hurricane / major storm event
  if (hasWord(lt, "hurricane") || hasWord(lt, "typhoon") || hasWord(lt, "cyclone") || hasWord(lt, "category") || (hasWord(lt, "storm") && (hasWord(lt, "major") || hasWord(lt, "severe")))) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Major storm/hurricane event — structural integrity uncertain");
  }
  // CONSEQUENCE ESCALATION: visible deformation on structural asset
  if ((hasWord(lt, "out of line") || hasWord(lt, "shifted") || hasWord(lt, "distort") || hasWord(lt, "buckl") || hasWord(lt, "different feel") || hasWord(lt, "alignment")) && (assetClass === "offshore_platform" || assetClass === "bridge" || assetClass === "rail_bridge")) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Visible deformation/shift indicators on structural asset — load path may be compromised");
  }
  // CONSEQUENCE ESCALATION: production platform with hydrocarbons
  if (hasWord(lt, "production") && (hasWord(lt, "platform") || hasWord(lt, "offshore"))) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Production platform — hydrocarbon inventory");
  }
  // CONSEQUENCE ESCALATION: underwater / subsea uninspected
  if ((hasWord(lt, "underwater") || hasWord(lt, "subsea") || hasWord(lt, "below waterline") || hasWord(lt, "diver") || hasWord(lt, "splash zone") || hasWord(lt, "marine growth")) && (hasWord(lt, "unknown") || hasWord(lt, "hiding") || hasWord(lt, "uncertain") || hasWord(lt, "not sure"))) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Underwater/subsea condition uncertain — critical zones uninspected");
  }
if (basis.length === 0) basis.push("Standard asset — default MEDIUM");

// ROUTINE INSPECTION CONSERVATISM
@@ -787,7 +829,7 @@ function runPhysicsComputations(physics: any, numVals: any, assetClass: string,
// Codes validate physics — physics does not validate codes.
// ============================================================================
var AUTHORITY_MAP = [
  { kw: ["decompression chamber", "hyperbaric", "dive system", "diving bell", "human occupancy", "pvho"],
  { kw: ["decompression chamber", "hyperbaric", "dive system", "diving bell", "human occupancy", "pvho", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"],
ac: ["pressure_vessel"], pri: "ASME PVHO-1", sec: ["ASME Section VIII", "API 510", "ASME Section V"],
cond: [{ code: "ADCI Standards", cond: "diving ops" }, { code: "IMCA D 024", cond: "international diving" }],
dw: "DESIGN: PRESSURIZED SYSTEM — current state may not represent design intent" },
@@ -804,8 +846,8 @@ var AUTHORITY_MAP = [
{ kw: ["pipeline", "export corridor", "trunkline", "flowline", "riser"],
ac: ["pipeline"], pri: "ASME B31.4/B31.8 + 49 CFR 192/195", sec: ["API 1160", "ASME B31G"],
cond: [{ code: "DNV-ST-F101", cond: "submarine pipeline" }], dw: null },
  { kw: ["bridge", "overpass", "girder", "pier", "abutment"],
    ac: ["bridge"], pri: "AASHTO MBE + AWS D1.5", sec: ["AASHTO LRFD", "FHWA NBIS"], cond: [], dw: null },
  { kw: ["bridge", "overpass", "girder", "pier", "abutment", "railroad bridge", "rail bridge", "truss bridge", "through-truss"],
    ac: ["bridge", "rail_bridge"], pri: "AASHTO MBE + AWS D1.5", sec: ["AASHTO LRFD", "FHWA NBIS"], cond: [], dw: null },
{ kw: ["offshore", "platform", "jacket", "subsea", "fpso", "topside"],
ac: ["offshore_platform"], pri: "API RP 2A", sec: ["API 579-1", "NACE SP0176"],
cond: [{ code: "DNV-OS-C101", cond: "classification" }, { code: "BSEE", cond: "US federal waters" }], dw: null },
@@ -816,16 +858,18 @@ var AUTHORITY_MAP = [
function resolveAuthorityReality(assetClass: string, transcript: string, consequence: any, physics: any) {
var lt = transcript.toLowerCase();
var matched: any = null;
  for (var ri = 0; ri < AUTHORITY_MAP.length; ri++) {
    var r = AUTHORITY_MAP[ri];
    for (var ki = 0; ki < r.kw.length; ki++) { if (hasWord(lt, r.kw[ki])) { matched = r; break; } }
  // PRIORITY 1: Match by asset class FIRST — strongest signal
  for (var ai = 0; ai < AUTHORITY_MAP.length; ai++) {
    for (var asi = 0; asi < AUTHORITY_MAP[ai].ac.length; asi++) {
      if (assetClass === AUTHORITY_MAP[ai].ac[asi]) { matched = AUTHORITY_MAP[ai]; break; }
    }
if (matched) break;
}
  // PRIORITY 2: If no asset class match, try keyword match
if (!matched) {
    for (var ai = 0; ai < AUTHORITY_MAP.length; ai++) {
      for (var asi = 0; asi < AUTHORITY_MAP[ai].ac.length; asi++) {
        if (assetClass === AUTHORITY_MAP[ai].ac[asi]) { matched = AUTHORITY_MAP[ai]; break; }
      }
    for (var ri = 0; ri < AUTHORITY_MAP.length; ri++) {
      var r = AUTHORITY_MAP[ri];
      for (var ki = 0; ki < r.kw.length; ki++) { if (hasWord(lt, r.kw[ki])) { matched = r; break; } }
if (matched) break;
}
}
@@ -1431,9 +1475,20 @@ function resolveDecisionReality(physics: any, damage: any, consequence: any, aut
disposBasis = "Precedence chain escalated — engineering review required";
trace.push("DISPOSITION: engineering_review_required");
} else if (consequence.consequence_tier === "HIGH" || consequence.consequence_tier === "CRITICAL") {
    disposition = "conditional_go";
    disposBasis = "All gates passed but " + consequence.consequence_tier + " consequence requires monitoring";
    trace.push("DISPOSITION: conditional_go with monitoring");
    // Check truth quality — DEGRADED or UNRELIABLE truth on HIGH/CRITICAL blocks conditional_go
    if (inspection.constraint_analysis && (inspection.constraint_analysis.truth_quality === "UNRELIABLE" || inspection.constraint_analysis.truth_quality === "DEGRADED")) {
      disposition = "hold_for_review";
      disposBasis = consequence.consequence_tier + " consequence with " + inspection.constraint_analysis.truth_quality + " truth quality (" + inspection.constraint_analysis.constraint_score + "/100). Inspection results may not represent actual condition. Additional characterization required before disposition.";
      trace.push("DISPOSITION: hold_for_review — truth quality " + inspection.constraint_analysis.truth_quality + " on " + consequence.consequence_tier + " asset");
    } else if (consequence.degradation_certainty === "UNVERIFIED" || consequence.degradation_certainty === "SUSPECTED") {
      disposition = "hold_for_review";
      disposBasis = consequence.consequence_tier + " consequence with " + (consequence.degradation_certainty || "UNVERIFIED") + " degradation state. Condition must be verified before return to service.";
      trace.push("DISPOSITION: hold_for_review — degradation " + consequence.degradation_certainty + " on " + consequence.consequence_tier + " asset");
    } else {
      disposition = "conditional_go";
      disposBasis = "All gates passed but " + consequence.consequence_tier + " consequence requires monitoring";
      trace.push("DISPOSITION: conditional_go with monitoring");
    }
} else {
disposition = "go";
disposBasis = "All gates passed, evidence sufficient, methods adequate";
