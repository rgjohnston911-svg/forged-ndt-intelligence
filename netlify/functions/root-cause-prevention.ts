// @ts-nocheck
/**
 * DEPLOY281 - root-cause-prevention.ts
 * netlify/functions/root-cause-prevention.ts
 *
 * ROOT CAUSE PREVENTION AUTHORITY
 *
 * Every failure has a cause. Every cause has a prevention.
 * This engine inverts the causal chain: given a damage mechanism,
 * environment, material, and failure mode, it produces specific
 * prevention actions that eliminate the root cause — not just
 * repair the symptom.
 *
 * Klein Bottle principle: prevention is not a separate phase.
 * It is the same surface as diagnosis, viewed from the other side.
 *
 * POST /api/root-cause-prevention
 *
 * Actions:
 *   generate_prevention       — full prevention plan from assessment
 *   get_prevention_taxonomy   — all prevention categories
 *   match_fleet_exposure      — find other assets with same risk profile
 *   calculate_prevention_roi  — cost of prevention vs cost of failure
 *   validate_prevention       — check if a prevention action addresses root cause
 *   get_registry              — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
 
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
 
var ENGINE_ID = "root-cause-prevention";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY281";
 
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
 
// ============================================================
// PREVENTION TAXONOMY
// ============================================================
// Six categories of prevention, ordered by effectiveness.
// Design-out is the most effective (eliminates the cause).
// Monitoring is the least (only catches it early).
// ============================================================
 
var PREVENTION_CATEGORIES = [
  {
    id: "design_out",
    name: "Design Out",
    effectiveness: 1.0,
    description: "Eliminate the failure mode through design change. The mechanism cannot physically occur.",
    cost_profile: "high_upfront_zero_recurring",
    examples: ["Eliminate crevice geometry", "Remove dissimilar metal joint", "Redesign dead leg", "Change weld detail to reduce stress concentration"],
    applicability: "New builds, major modifications, replacement projects"
  },
  {
    id: "material_selection",
    name: "Material Selection",
    effectiveness: 0.90,
    description: "Choose a material that is inherently resistant to the identified mechanism in this environment.",
    cost_profile: "moderate_upfront_zero_recurring",
    examples: ["Upgrade to CRA for sour service", "Use duplex stainless for chloride SCC resistance", "Specify impact-tested material for low temperature"],
    applicability: "Replacements, new builds, repair material selection"
  },
  {
    id: "protection_specification",
    name: "Protection Specification",
    effectiveness: 0.80,
    description: "Specify the correct protective system for the actual service environment.",
    cost_profile: "moderate_upfront_low_recurring",
    examples: ["Specify immersion-grade coating for submerged service", "Design CP system for actual current demand", "Specify thermal insulation to prevent CUI"],
    applicability: "New coating applications, CP design, insulation specification"
  },
  {
    id: "operating_envelope",
    name: "Operating Envelope Control",
    effectiveness: 0.75,
    description: "Set and enforce operating limits that prevent the mechanism's prerequisites from being met.",
    cost_profile: "low_upfront_moderate_recurring",
    examples: ["Limit temperature below creep threshold", "Control flow velocity to prevent erosion", "Maintain pH above SCC threshold", "Limit pressure cycling amplitude"],
    applicability: "All operating assets, process control changes"
  },
  {
    id: "inspection_strategy",
    name: "Inspection Strategy",
    effectiveness: 0.60,
    description: "Detect the mechanism early enough to intervene before failure. Does not prevent occurrence but prevents consequence.",
    cost_profile: "low_upfront_moderate_recurring",
    examples: ["Add UT monitoring points at predicted thinning locations", "Implement online corrosion monitoring", "Add vibration monitoring at fatigue-critical locations"],
    applicability: "All assets, particularly where prevention is impractical"
  },
  {
    id: "maintenance_practice",
    name: "Maintenance Practice",
    effectiveness: 0.55,
    description: "Maintain protective systems so they continue to function as designed.",
    cost_profile: "low_upfront_moderate_recurring",
    examples: ["Schedule CP anode replacement before depletion", "Implement coating touch-up program", "Clear drainage to prevent water accumulation"],
    applicability: "All assets with protective systems"
  }
];
 
// ============================================================
// MECHANISM → PREVENTION MATRIX
// ============================================================
// For every damage mechanism, the specific prevention actions
// that eliminate or mitigate its prerequisites.
// This is the INVERSE of the mechanism-causality-engine's
// prerequisite database.
// ============================================================
 
var MECHANISM_PREVENTION = {
  general_corrosion: {
    mechanism: "General Corrosion",
    prerequisites: ["corrosive environment", "susceptible material", "inadequate protection"],
    prevention: {
      design_out: [
        { action: "Eliminate trapped water / dead legs", eliminates: "corrosive environment", effectiveness: 0.9 },
        { action: "Ensure adequate drainage at all low points", eliminates: "corrosive environment", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Upgrade to corrosion-resistant alloy for the service", eliminates: "susceptible material", effectiveness: 0.95 },
        { action: "Specify minimum corrosion allowance in design", mitigates: "wall loss rate", effectiveness: 0.7 }
      ],
      protection_specification: [
        { action: "Specify coating system rated for actual service environment per ISO 12944", eliminates: "inadequate protection", effectiveness: 0.85 },
        { action: "Design CP system with adequate current density for the environment", eliminates: "inadequate protection", effectiveness: 0.80 }
      ],
      operating_envelope: [
        { action: "Maintain chemical inhibitor injection rates", mitigates: "corrosive environment", effectiveness: 0.7 },
        { action: "Control oxygen ingress in closed systems", mitigates: "corrosive environment", effectiveness: 0.75 }
      ],
      inspection_strategy: [
        { action: "Install fixed UT monitoring at predicted thinning locations", detects: "wall loss progression", effectiveness: 0.8 },
        { action: "Implement corrosion coupon program", detects: "corrosion rate", effectiveness: 0.7 }
      ],
      maintenance_practice: [
        { action: "Schedule coating surveys and touch-up before breakdown", maintains: "protective barrier", effectiveness: 0.7 },
        { action: "Monitor and replace CP anodes before depletion", maintains: "cathodic protection", effectiveness: 0.75 }
      ]
    }
  },
  pitting: {
    mechanism: "Pitting Corrosion",
    prerequisites: ["chloride or oxidizing environment", "passive film breakdown", "stagnant conditions"],
    prevention: {
      design_out: [
        { action: "Eliminate stagnant zones and dead legs", eliminates: "stagnant conditions", effectiveness: 0.85 },
        { action: "Ensure continuous flow past all surfaces", eliminates: "stagnant conditions", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Select alloy with PREN > 40 for severe chloride service", eliminates: "passive film breakdown", effectiveness: 0.95 },
        { action: "Use super duplex or nickel alloy for high-chloride high-temperature service", eliminates: "susceptible material", effectiveness: 0.95 }
      ],
      protection_specification: [
        { action: "Apply holiday-free lining for internal pitting prevention", eliminates: "passive film breakdown", effectiveness: 0.85 }
      ],
      operating_envelope: [
        { action: "Maintain chloride concentration below material threshold", mitigates: "chloride environment", effectiveness: 0.8 },
        { action: "Control temperature below critical pitting temperature", mitigates: "pitting initiation", effectiveness: 0.85 }
      ],
      inspection_strategy: [
        { action: "Implement close-grid UT scanning at pitting-susceptible locations", detects: "pit depth progression", effectiveness: 0.75 },
        { action: "Use phased array UT for pit sizing accuracy", detects: "pit morphology", effectiveness: 0.8 }
      ],
      maintenance_practice: [
        { action: "Flush stagnant lines on schedule", maintains: "flow conditions", effectiveness: 0.6 }
      ]
    }
  },
  scc: {
    mechanism: "Stress Corrosion Cracking",
    prerequisites: ["tensile stress", "susceptible material", "specific environment"],
    prevention: {
      design_out: [
        { action: "Reduce residual stress through PWHT", eliminates: "tensile stress", effectiveness: 0.85 },
        { action: "Redesign to reduce applied stress below threshold", eliminates: "tensile stress", effectiveness: 0.9 },
        { action: "Shot peen to introduce compressive surface stress", eliminates: "tensile stress at surface", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Select SCC-resistant alloy for the specific environment", eliminates: "susceptible material", effectiveness: 0.95 },
        { action: "Control hardness below HRC 22 for sour service (NACE MR0175)", eliminates: "susceptible material", effectiveness: 0.90 }
      ],
      protection_specification: [
        { action: "Apply stress-corrosion barrier coating on susceptible surfaces", mitigates: "environment contact", effectiveness: 0.7 }
      ],
      operating_envelope: [
        { action: "Maintain temperature below SCC threshold for the material-environment combination", mitigates: "specific environment", effectiveness: 0.85 },
        { action: "Control pH and chloride within safe operating window", mitigates: "specific environment", effectiveness: 0.8 }
      ],
      inspection_strategy: [
        { action: "Implement TOFD or phased array UT at SCC-susceptible locations (welds, bends, nozzles)", detects: "crack initiation", effectiveness: 0.8 },
        { action: "Schedule MPI/DPI at PWHT-exempt connections", detects: "surface-breaking cracks", effectiveness: 0.75 }
      ],
      maintenance_practice: [
        { action: "Maintain process chemistry within safe SCC envelope", maintains: "safe environment", effectiveness: 0.7 }
      ]
    }
  },
  fatigue: {
    mechanism: "Mechanical Fatigue",
    prerequisites: ["cyclic loading", "stress concentration", "sufficient cycles"],
    prevention: {
      design_out: [
        { action: "Redesign connection detail to reduce SCF", eliminates: "stress concentration", effectiveness: 0.9 },
        { action: "Increase section thickness at fatigue-critical locations", mitigates: "stress range", effectiveness: 0.8 },
        { action: "Use full-penetration welds instead of fillet welds at critical joints", eliminates: "stress concentration", effectiveness: 0.85 },
        { action: "Add stiffeners or gussets to reduce vibration amplitude", mitigates: "cyclic loading", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Specify higher fatigue class weld detail per BS 7608 / DNV-RP-C203", mitigates: "fatigue capacity", effectiveness: 0.85 },
        { action: "Use forged connections instead of fabricated at critical nodes", eliminates: "weld fatigue", effectiveness: 0.9 }
      ],
      protection_specification: [
        { action: "Specify cathodic protection in seawater to restore fatigue life to in-air values (for non-sour service)", mitigates: "environmental fatigue penalty", effectiveness: 0.75 }
      ],
      operating_envelope: [
        { action: "Limit vibration amplitude through operational controls", mitigates: "cyclic loading", effectiveness: 0.7 },
        { action: "Install VIV suppression devices (strakes, fairings)", eliminates: "vortex-induced vibration", effectiveness: 0.85 }
      ],
      inspection_strategy: [
        { action: "Implement FMD (flooded member detection) for subsea tubulars", detects: "through-wall fatigue crack", effectiveness: 0.8 },
        { action: "Install strain gauges at fatigue-critical locations for continuous monitoring", detects: "actual stress ranges", effectiveness: 0.85 }
      ],
      maintenance_practice: [
        { action: "Maintain VIV suppression devices", maintains: "vibration control", effectiveness: 0.7 }
      ]
    }
  },
  corrosion_fatigue: {
    mechanism: "Corrosion Fatigue",
    prerequisites: ["cyclic loading", "corrosive environment", "combined effect exceeds either alone"],
    prevention: {
      design_out: [
        { action: "Reduce stress range at corrosion-exposed locations", mitigates: "combined loading + environment", effectiveness: 0.8 },
        { action: "Isolate fatigue-critical details from corrosive environment", eliminates: "environment at stress point", effectiveness: 0.9 }
      ],
      material_selection: [
        { action: "Select alloy with corrosion-fatigue resistance for the environment", eliminates: "susceptible material", effectiveness: 0.85 }
      ],
      protection_specification: [
        { action: "Ensure continuous coating + CP at fatigue-critical weld toes", eliminates: "corrosion at fatigue site", effectiveness: 0.85 },
        { action: "Apply weld toe grinding + coating at critical joints", mitigates: "both SCF and corrosion", effectiveness: 0.9 }
      ],
      operating_envelope: [
        { action: "Reduce cyclic loading frequency where possible", mitigates: "fatigue damage accumulation", effectiveness: 0.6 }
      ],
      inspection_strategy: [
        { action: "Combined UT + corrosion mapping at fatigue-critical locations", detects: "crack + wall loss interaction", effectiveness: 0.8 }
      ],
      maintenance_practice: [
        { action: "Priority maintenance of coating and CP at fatigue-critical locations", maintains: "corrosion protection at highest-risk points", effectiveness: 0.8 }
      ]
    }
  },
  CUI: {
    mechanism: "Corrosion Under Insulation",
    prerequisites: ["insulation present", "moisture ingress", "temperature cycling in CUI range"],
    prevention: {
      design_out: [
        { action: "Eliminate insulation where not required for process or personnel protection", eliminates: "insulation present", effectiveness: 1.0 },
        { action: "Use sealed insulation system with vapor barriers and proper termination details", eliminates: "moisture ingress", effectiveness: 0.85 },
        { action: "Design insulation supports to prevent water traps", eliminates: "moisture accumulation", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Use CRA or aluminum at CUI-susceptible locations under insulation", eliminates: "susceptible material", effectiveness: 0.9 },
        { action: "Use closed-cell insulation material (e.g. cellular glass) that does not absorb moisture", mitigates: "moisture retention", effectiveness: 0.8 }
      ],
      protection_specification: [
        { action: "Specify TSA (thermal spray aluminum) or high-temperature coating under insulation", eliminates: "bare steel exposure", effectiveness: 0.9 },
        { action: "Apply CUI-rated coating system per NACE SP0198", eliminates: "corrosion under insulation", effectiveness: 0.85 }
      ],
      operating_envelope: [
        { action: "Monitor for insulation damage and cladding breaches", detects: "moisture ingress path", effectiveness: 0.6 }
      ],
      inspection_strategy: [
        { action: "Implement risk-based CUI inspection program per API 583", detects: "CUI before significant wall loss", effectiveness: 0.75 },
        { action: "Use pulsed eddy current or profile radiography for through-insulation screening", detects: "wall loss without insulation removal", effectiveness: 0.7 }
      ],
      maintenance_practice: [
        { action: "Repair cladding and sealant damage promptly", maintains: "moisture barrier", effectiveness: 0.7 },
        { action: "Replace wet insulation — do not re-install", eliminates: "moisture source", effectiveness: 0.8 }
      ]
    }
  },
  erosion_corrosion: {
    mechanism: "Erosion-Corrosion",
    prerequisites: ["high flow velocity", "corrosive fluid", "susceptible material at flow disturbance"],
    prevention: {
      design_out: [
        { action: "Increase pipe diameter to reduce flow velocity below erosional velocity", eliminates: "high flow velocity", effectiveness: 0.9 },
        { action: "Use long-radius bends instead of elbows", mitigates: "flow disturbance", effectiveness: 0.8 },
        { action: "Eliminate abrupt changes in flow direction or diameter", mitigates: "turbulence", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Use erosion-resistant alloy or clad at high-velocity locations", eliminates: "susceptible material", effectiveness: 0.9 },
        { action: "Install sacrificial wear pieces at tees and bends", mitigates: "wall loss at critical points", effectiveness: 0.75 }
      ],
      protection_specification: [
        { action: "Apply erosion-resistant internal lining at flow disturbances", mitigates: "erosion at critical points", effectiveness: 0.8 }
      ],
      operating_envelope: [
        { action: "Limit flow velocity below API RP 14E erosional velocity", eliminates: "erosive flow regime", effectiveness: 0.85 },
        { action: "Control sand production rate", mitigates: "erosion severity", effectiveness: 0.8 },
        { action: "Maintain chemical inhibitor injection", mitigates: "corrosion component", effectiveness: 0.7 }
      ],
      inspection_strategy: [
        { action: "Install non-intrusive UT sensors at downstream of bends and restrictions", detects: "wall loss progression", effectiveness: 0.8 },
        { action: "Implement sand monitoring (acoustic or probe)", detects: "erosion driver", effectiveness: 0.75 }
      ],
      maintenance_practice: [
        { action: "Replace sacrificial wear pieces on schedule", maintains: "erosion protection", effectiveness: 0.7 }
      ]
    }
  },
  hydrogen_damage: {
    mechanism: "Hydrogen Damage (HIC/SOHIC/HE)",
    prerequisites: ["hydrogen source", "susceptible material", "trapping sites"],
    prevention: {
      design_out: [
        { action: "Specify PWHT to relieve residual stress at welds", eliminates: "trapping sites (residual stress)", effectiveness: 0.85 },
        { action: "Minimize weld hardness through procedure qualification", eliminates: "hard zones as trapping sites", effectiveness: 0.85 }
      ],
      material_selection: [
        { action: "Specify HIC-tested plate per NACE TM0284", eliminates: "susceptible material", effectiveness: 0.9 },
        { action: "Use low-sulfur, calcium-treated steel with controlled inclusion morphology", eliminates: "trapping sites (inclusions)", effectiveness: 0.9 },
        { action: "Specify maximum hardness 248 HV per NACE MR0175", eliminates: "susceptible microstructure", effectiveness: 0.85 }
      ],
      protection_specification: [
        { action: "Apply hydrogen-barrier lining on process-wetted surfaces", mitigates: "hydrogen absorption", effectiveness: 0.75 }
      ],
      operating_envelope: [
        { action: "Maintain H2S partial pressure within material qualification limits", mitigates: "hydrogen charging rate", effectiveness: 0.8 },
        { action: "Control pH above critical threshold for the material", mitigates: "hydrogen generation", effectiveness: 0.8 }
      ],
      inspection_strategy: [
        { action: "Implement TOFD + PAUT for hydrogen damage detection at welds", detects: "HIC/SOHIC stepwise cracking", effectiveness: 0.8 },
        { action: "Use wet fluorescent MPI for surface-breaking hydrogen cracks", detects: "surface HE cracking", effectiveness: 0.75 }
      ],
      maintenance_practice: [
        { action: "Maintain process chemistry monitoring for H2S and pH", maintains: "safe hydrogen charging conditions", effectiveness: 0.7 }
      ]
    }
  },
  creep: {
    mechanism: "Creep",
    prerequisites: ["high temperature", "sustained stress", "time at temperature"],
    prevention: {
      design_out: [
        { action: "Reduce design stress at high-temperature locations", mitigates: "sustained stress", effectiveness: 0.8 },
        { action: "Add thermal barriers or heat shields to reduce metal temperature", mitigates: "temperature", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Specify creep-resistant alloy (Cr-Mo, Cr-Mo-V, stainless) for the temperature range", eliminates: "susceptible material", effectiveness: 0.9 },
        { action: "Verify actual vs assumed creep properties from material certificate", eliminates: "property uncertainty", effectiveness: 0.7 }
      ],
      operating_envelope: [
        { action: "Limit operating temperature below creep threshold for the material", eliminates: "creep regime", effectiveness: 0.95 },
        { action: "Monitor and limit temperature excursions", mitigates: "accelerated creep from overtemperature", effectiveness: 0.8 }
      ],
      inspection_strategy: [
        { action: "Implement replica metallography at creep-critical locations", detects: "creep void formation", effectiveness: 0.8 },
        { action: "Monitor dimensional changes (diameter, sag) as creep indicators", detects: "macro creep deformation", effectiveness: 0.7 }
      ],
      maintenance_practice: [
        { action: "Track cumulative time at temperature for remaining life assessment", maintains: "creep life awareness", effectiveness: 0.7 }
      ]
    }
  },
  MIC: {
    mechanism: "Microbiologically Influenced Corrosion",
    prerequisites: ["microbial activity", "nutrient source", "stagnant or low-flow conditions"],
    prevention: {
      design_out: [
        { action: "Eliminate dead legs and stagnant zones where biofilms form", eliminates: "stagnant conditions", effectiveness: 0.85 },
        { action: "Design for drainability — no trapped water", eliminates: "nutrient source", effectiveness: 0.8 }
      ],
      material_selection: [
        { action: "Use copper-nickel alloys for seawater systems (inherent biocidal properties)", eliminates: "microbial colonization", effectiveness: 0.85 }
      ],
      protection_specification: [
        { action: "Apply biocide-containing coating system for MIC-susceptible surfaces", mitigates: "biofilm formation", effectiveness: 0.7 }
      ],
      operating_envelope: [
        { action: "Implement biocide treatment program", eliminates: "microbial activity", effectiveness: 0.8 },
        { action: "Maintain flow velocity above minimum to prevent biofilm attachment", mitigates: "stagnant conditions", effectiveness: 0.75 }
      ],
      inspection_strategy: [
        { action: "Implement microbiological monitoring (culture or molecular testing)", detects: "microbial activity", effectiveness: 0.75 },
        { action: "UT monitoring at MIC-susceptible locations (6 and 3 o'clock positions)", detects: "under-deposit pitting", effectiveness: 0.7 }
      ],
      maintenance_practice: [
        { action: "Regular pigging and flushing of susceptible lines", maintains: "clean internal surfaces", effectiveness: 0.7 },
        { action: "Maintain biocide injection system", maintains: "microbial control", effectiveness: 0.75 }
      ]
    }
  }
};
 
// ============================================================
// FLEET EXPOSURE MATCHING
// ============================================================
 
var EXPOSURE_FACTORS = [
  "material_grade",
  "service_environment",
  "operating_temperature_range",
  "coating_system",
  "cp_design",
  "weld_detail",
  "insulation_type",
  "flow_regime",
  "age_bracket",
  "mechanism_susceptibility"
];
 
function matchExposureFactors(assetProfile, fleetAssets) {
  var matches = [];
  for (var i = 0; i < fleetAssets.length; i++) {
    var asset = fleetAssets[i];
    var matchScore = 0;
    var matchedFactors = [];
    for (var f = 0; f < EXPOSURE_FACTORS.length; f++) {
      var factor = EXPOSURE_FACTORS[f];
      if (assetProfile[factor] && asset[factor] && assetProfile[factor] === asset[factor]) {
        matchScore++;
        matchedFactors.push(factor);
      }
    }
    if (matchScore >= 3) {
      matches.push({
        asset_id: asset.asset_id || asset.id,
        match_score: matchScore,
        match_percentage: Math.round((matchScore / EXPOSURE_FACTORS.length) * 100),
        matched_factors: matchedFactors,
        at_risk: matchScore >= 6
      });
    }
  }
  // Sort by match score descending
  matches.sort(function(a, b) { return b.match_score - a.match_score; });
  return matches;
}
 
// ============================================================
// PREVENTION ROI CALCULATOR
// ============================================================
 
function calculatePreventionROI(preventionAction, failureCost, fleetSize, assetLife) {
  var preventionCost = preventionAction.estimated_cost || 0;
  var effectiveness = preventionAction.effectiveness || 0.5;
  var totalPreventionCost = preventionCost * fleetSize;
  var expectedFailureCost = failureCost * fleetSize * (1 - effectiveness);
  var avoidedCost = (failureCost * fleetSize) - expectedFailureCost;
  var netBenefit = avoidedCost - totalPreventionCost;
  var roi = totalPreventionCost > 0 ? Math.round((netBenefit / totalPreventionCost) * 100) : 0;
  var paybackYears = avoidedCost > 0 ? Math.round((totalPreventionCost / (avoidedCost / assetLife)) * 10) / 10 : 999;
 
  return {
    prevention_cost_per_asset: preventionCost,
    total_prevention_cost: totalPreventionCost,
    failure_cost_per_event: failureCost,
    expected_avoided_cost: Math.round(avoidedCost),
    net_benefit: Math.round(netBenefit),
    roi_percentage: roi,
    payback_years: paybackYears,
    fleet_size: fleetSize,
    effectiveness: effectiveness,
    recommendation: roi > 200 ? "STRONGLY RECOMMENDED — prevention pays for itself many times over" :
                    roi > 50 ? "RECOMMENDED — clear positive return on prevention investment" :
                    roi > 0 ? "MARGINAL — positive return but consider alternatives" :
                    "NOT COST-JUSTIFIED at current estimates — monitor and reassess"
  };
}
 
// ============================================================
// PREVENTION PLAN GENERATOR
// ============================================================
 
function generatePreventionPlan(assessment) {
  var mechanisms = assessment.mechanisms || [];
  var environment = assessment.environment || {};
  var material = assessment.material || {};
  var findings = assessment.findings || {};
 
  var plan = {
    mechanisms_addressed: [],
    prevention_actions: [],
    priority_actions: [],
    fleet_implications: [],
    specification_changes: [],
    knowledge_gaps: []
  };
 
  for (var i = 0; i < mechanisms.length; i++) {
    var mechKey = mechanisms[i];
    var mechPrevention = MECHANISM_PREVENTION[mechKey];
 
    if (!mechPrevention) {
      plan.knowledge_gaps.push({
        mechanism: mechKey,
        gap: "No prevention taxonomy defined for this mechanism. Manual engineering review required."
      });
      continue;
    }
 
    var mechPlan = {
      mechanism: mechPrevention.mechanism,
      mechanism_key: mechKey,
      prerequisites: mechPrevention.prerequisites,
      prevention_by_category: {}
    };
 
    // Walk through each prevention category
    for (var c = 0; c < PREVENTION_CATEGORIES.length; c++) {
      var cat = PREVENTION_CATEGORIES[c];
      var catActions = mechPrevention.prevention[cat.id];
      if (catActions && catActions.length > 0) {
        var applicableActions = [];
        for (var a = 0; a < catActions.length; a++) {
          var action = catActions[a];
          applicableActions.push({
            action: action.action,
            eliminates: action.eliminates || null,
            mitigates: action.mitigates || null,
            detects: action.detects || null,
            maintains: action.maintains || null,
            effectiveness: action.effectiveness,
            category: cat.id,
            category_name: cat.name,
            category_effectiveness: cat.effectiveness
          });
 
          // Add to flat list for prioritization
          plan.prevention_actions.push({
            mechanism: mechKey,
            mechanism_name: mechPrevention.mechanism,
            category: cat.id,
            category_name: cat.name,
            action: action.action,
            effectiveness: action.effectiveness,
            eliminates_prerequisite: action.eliminates || null,
            priority_score: Math.round(action.effectiveness * cat.effectiveness * 100) / 100
          });
        }
        mechPlan.prevention_by_category[cat.id] = applicableActions;
      }
    }
 
    plan.mechanisms_addressed.push(mechPlan);
  }
 
  // Sort all actions by priority score
  plan.prevention_actions.sort(function(a, b) { return b.priority_score - a.priority_score; });
 
  // Top 5 are priority actions
  for (var p = 0; p < Math.min(5, plan.prevention_actions.length); p++) {
    plan.priority_actions.push(plan.prevention_actions[p]);
  }
 
  // Generate specification change recommendations
  for (var s = 0; s < plan.prevention_actions.length; s++) {
    var pa = plan.prevention_actions[s];
    if (pa.category === "design_out" || pa.category === "material_selection" || pa.category === "protection_specification") {
      plan.specification_changes.push({
        mechanism: pa.mechanism_name,
        category: pa.category_name,
        change: pa.action,
        applies_to: "All future assets in same service with same mechanism exposure",
        effectiveness: pa.effectiveness
      });
    }
  }
 
  // Fleet implications
  if (mechanisms.length > 0) {
    plan.fleet_implications.push({
      finding: "Any asset in the fleet with the same material, environment, and service conditions is susceptible to the same mechanism(s).",
      action: "Run fleet exposure matching to identify at-risk assets.",
      mechanisms: mechanisms
    });
  }
 
  // Klein bottle connection
  plan.klein_bottle_note = "Prevention is not a separate output. It is the inverse of the assessment itself. Every prerequisite identified by the mechanism-causality engine is simultaneously a prevention target. Every prevention action changes the risk profile of every related asset in the fleet.";
 
  return plan;
}
 
function validatePrevention(preventionAction, mechanism, rootCause) {
  var mechPrevention = MECHANISM_PREVENTION[mechanism];
  if (!mechPrevention) {
    return {
      valid: false,
      reason: "Unknown mechanism: " + mechanism,
      addresses_root_cause: false
    };
  }
 
  // Check if the prevention action addresses a prerequisite
  var addressesPrerequisite = false;
  var prerequisiteAddressed = null;
  var categories = Object.keys(mechPrevention.prevention);
 
  for (var c = 0; c < categories.length; c++) {
    var actions = mechPrevention.prevention[categories[c]];
    for (var a = 0; a < actions.length; a++) {
      if (actions[a].eliminates && rootCause && actions[a].eliminates.indexOf(rootCause) >= 0) {
        addressesPrerequisite = true;
        prerequisiteAddressed = actions[a].eliminates;
      }
    }
  }
 
  var isTreatment = !addressesPrerequisite;
 
  return {
    valid: true,
    mechanism: mechPrevention.mechanism,
    addresses_root_cause: addressesPrerequisite,
    prerequisite_addressed: prerequisiteAddressed,
    is_symptom_treatment: isTreatment,
    warning: isTreatment ? "This action treats the symptom but does not eliminate the root cause. The mechanism will recur unless the underlying prerequisite is removed." : null,
    recommendation: addressesPrerequisite ? "This action directly addresses a mechanism prerequisite. It will prevent recurrence if fully implemented." : "Consider adding a design-out or material selection action that eliminates the root cause prerequisite."
  };
}
 
// ============================================================
// HANDLER
// ============================================================
 
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
 
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
 
    if (action === "get_registry") {
      var mechKeys = Object.keys(MECHANISM_PREVENTION);
      var totalActions = 0;
      for (var mk = 0; mk < mechKeys.length; mk++) {
        var cats = Object.keys(MECHANISM_PREVENTION[mechKeys[mk]].prevention);
        for (var ci = 0; ci < cats.length; ci++) {
          totalActions += MECHANISM_PREVENTION[mechKeys[mk]].prevention[cats[ci]].length;
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          deploy: DEPLOY,
          mode: "deterministic",
          purpose: "Root Cause Prevention Authority — inverts every failure into prevention actions that eliminate recurrence",
          principle: "Prevention is the inverse of diagnosis. Every mechanism prerequisite is a prevention target.",
          mechanisms_covered: mechKeys.length,
          prevention_categories: PREVENTION_CATEGORIES.length,
          total_prevention_actions: totalActions,
          exposure_factors: EXPOSURE_FACTORS.length,
          actions: [
            "generate_prevention — full prevention plan from assessment findings",
            "get_prevention_taxonomy — all prevention categories and effectiveness ratings",
            "match_fleet_exposure — find other assets with same risk profile",
            "calculate_prevention_roi — cost of prevention vs cost of failure",
            "validate_prevention — check if a prevention action addresses root cause",
            "get_registry — engine metadata"
          ]
        })
      };
    }
 
    if (action === "generate_prevention") {
      var assessment = body.assessment;
      if (!assessment || !assessment.mechanisms) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "assessment with mechanisms array required" }) };
      }
 
      var preventionPlan = generatePreventionPlan(assessment);
 
      // Persist (non-fatal)
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("prevention_records").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          mechanisms: assessment.mechanisms,
          priority_actions_count: preventionPlan.priority_actions.length,
          total_actions_count: preventionPlan.prevention_actions.length,
          specification_changes_count: preventionPlan.specification_changes.length,
          result_json: preventionPlan
        });
      } catch (dbErr) { /* non-fatal */ }
 
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          prevention_plan: preventionPlan
        }, null, 2)
      };
    }
 
    if (action === "get_prevention_taxonomy") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          categories: PREVENTION_CATEGORIES,
          mechanisms: Object.keys(MECHANISM_PREVENTION),
          principle: "Prevention categories are ordered by effectiveness. Design-out eliminates the cause entirely. Monitoring only catches it early."
        }, null, 2)
      };
    }
 
    if (action === "match_fleet_exposure") {
      var assetProfile = body.asset_profile;
      var fleetAssets = body.fleet_assets;
      if (!assetProfile || !fleetAssets) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "asset_profile and fleet_assets required" }) };
      }
      var exposureMatches = matchExposureFactors(assetProfile, fleetAssets);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          asset_profile: assetProfile,
          fleet_matches: exposureMatches,
          at_risk_count: exposureMatches.filter(function(m) { return m.at_risk; }).length,
          total_matches: exposureMatches.length
        }, null, 2)
      };
    }
 
    if (action === "calculate_prevention_roi") {
      var prevAction = body.prevention_action;
      var failureCost = body.failure_cost || 100000;
      var fleetSize = body.fleet_size || 1;
      var assetLife = body.asset_life_years || 25;
      if (!prevAction) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "prevention_action required" }) };
      }
      var roi = calculatePreventionROI(prevAction, failureCost, fleetSize, assetLife);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          roi_analysis: roi
        }, null, 2)
      };
    }
 
    if (action === "validate_prevention") {
      var valAction = body.prevention_action;
      var mechanism = body.mechanism;
      var rootCause = body.root_cause;
      if (!mechanism) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "mechanism required" }) };
      }
      var validation = validatePrevention(valAction, mechanism, rootCause);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          validation: validation
        }, null, 2)
      };
    }
 
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
 
