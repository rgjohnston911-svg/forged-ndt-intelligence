// @ts-nocheck
/**
 * DEPLOY284 - cp-intelligence.ts
 * netlify/functions/cp-intelligence.ts
 *
 * CATHODIC PROTECTION INTELLIGENCE ENGINE
 *
 * Full CP authority — anode systems, impressed current, shielding,
 * coating-CP interaction, depletion modeling, retrofit logic.
 *
 * Klein Bottle: CP and coating are not separate systems. They are
 * one continuous protection surface. Coating failure creates small
 * anodes in large cathodes. CP without coating wastes current.
 * Coating without CP relies on zero defects. Together they form
 * a single barrier viewed from two sides.
 *
 * POST /api/cp-intelligence
 *
 * Actions:
 *   evaluate_cp            — full CP assessment
 *   check_anode_life       — anode depletion calculation
 *   evaluate_coating_cp    — coupled coating+CP assessment
 *   check_shielding        — CP shielding risk assessment
 *   get_retrofit_options   — CP retrofit recommendations
 *   get_cp_standards       — applicable standards
 *   get_registry           — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "cp-intelligence";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY284";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ============================================================
// CP SYSTEM TYPES
// ============================================================

var CP_SYSTEMS = {
  sacrificial_aluminum: {
    name: "Sacrificial Anode — Aluminum Alloy",
    type: "galvanic",
    anode_material: "Al-Zn-In",
    driving_voltage_mV: 250,
    capacity_Ah_kg: 2700,
    typical_current_density_mA_m2: { bare: 150, coated: 10, aged_coating: 50 },
    operating_potential_mV_AgCl: { min: -1050, protective: -950, max: -800 },
    advantages: ["Self-regulating", "No external power", "Low maintenance"],
    limitations: ["Limited current output", "Anode mass required", "Ineffective in splash zone"],
    applicable_environments: ["seawater", "brackish", "marine_sediment"],
    codes: ["DNV_RP_B401", "NACE_SP0176", "ISO_15589_2"]
  },
  sacrificial_zinc: {
    name: "Sacrificial Anode — Zinc Alloy",
    type: "galvanic",
    anode_material: "Zn-Al-Cd",
    driving_voltage_mV: 200,
    capacity_Ah_kg: 780,
    typical_current_density_mA_m2: { bare: 100, coated: 8, aged_coating: 40 },
    operating_potential_mV_AgCl: { min: -1050, protective: -950, max: -800 },
    advantages: ["Self-regulating", "Well-proven", "Reliable"],
    limitations: ["Lower capacity than aluminum", "Passivation in warm water", "Heavy"],
    applicable_environments: ["seawater", "marine_sediment"],
    codes: ["DNV_RP_B401", "NACE_SP0176"]
  },
  impressed_current: {
    name: "Impressed Current CP (ICCP)",
    type: "impressed",
    anode_material: "MMO_titanium_or_platinized",
    driving_voltage_mV: "adjustable",
    capacity_Ah_kg: "unlimited_power_dependent",
    typical_current_density_mA_m2: { bare: 200, coated: 15, aged_coating: 70 },
    operating_potential_mV_AgCl: { min: -1100, protective: -950, max: -800 },
    advantages: ["Adjustable output", "Long range", "Suitable for large structures"],
    limitations: ["Requires power supply", "Over-protection risk", "Hydrogen generation risk", "Monitoring required"],
    applicable_environments: ["seawater", "brackish", "soil"],
    codes: ["DNV_RP_B401", "NACE_SP0169", "ISO_15589_2"]
  }
};

// ============================================================
// CP PROTECTION CRITERIA
// ============================================================

var PROTECTION_CRITERIA = {
  carbon_steel_seawater: {
    material: "Carbon Steel",
    environment: "Seawater",
    protected_mV_AgCl: -800,
    fully_protected_mV_AgCl: -900,
    overprotection_limit_mV_AgCl: -1100,
    overprotection_risk: "Hydrogen embrittlement of high-strength steel, coating disbondment",
    standard: "DNV_RP_B401"
  },
  carbon_steel_anaerobic: {
    material: "Carbon Steel",
    environment: "Anaerobic (mud/sediment)",
    protected_mV_AgCl: -900,
    fully_protected_mV_AgCl: -950,
    overprotection_limit_mV_AgCl: -1100,
    overprotection_risk: "Hydrogen generation, coating disbondment",
    standard: "DNV_RP_B401"
  },
  duplex_stainless: {
    material: "Duplex Stainless Steel",
    environment: "Seawater",
    protected_mV_AgCl: -800,
    fully_protected_mV_AgCl: -900,
    overprotection_limit_mV_AgCl: -1050,
    overprotection_risk: "Hydrogen embrittlement — duplex is susceptible",
    standard: "NORSOK_M503"
  },
  high_strength_steel: {
    material: "High Strength Steel (>700 MPa)",
    environment: "Seawater",
    protected_mV_AgCl: -800,
    fully_protected_mV_AgCl: -850,
    overprotection_limit_mV_AgCl: -950,
    overprotection_risk: "CRITICAL — hydrogen embrittlement. Must not overprotect.",
    standard: "DNV_RP_B401"
  }
};

// ============================================================
// SHIELDING RISK FACTORS
// ============================================================

var SHIELDING_RISKS = [
  {
    id: "disbonded_coating",
    name: "Disbonded Coating Shielding",
    risk_level: "critical",
    description: "Disbonded coating prevents CP current from reaching the steel surface while trapping corrosive electrolyte. The coating that was supposed to protect becomes the attack vector.",
    detection: "Difficult — requires coating removal or specialized techniques",
    prevention: "Use non-shielding coating systems (e.g., FBE). Avoid tape wraps in CP zones.",
    klein_bottle_note: "This is the purest Klein bottle failure — the protection system creates the attack surface."
  },
  {
    id: "concrete_weight_coat",
    name: "Concrete Weight Coat Shielding",
    risk_level: "high",
    description: "Concrete weight coating on subsea pipelines can shield CP if the corrosion coating beneath is damaged.",
    detection: "Cannot inspect without CWC removal",
    prevention: "Ensure anti-corrosion coating integrity before CWC application"
  },
  {
    id: "marine_growth",
    name: "Marine Growth Shielding",
    risk_level: "moderate",
    description: "Heavy calcareous marine growth can partially shield CP current and mask coating defects.",
    detection: "Remove marine growth for CP survey and coating inspection",
    prevention: "Regular marine growth management program"
  },
  {
    id: "burial_shielding",
    name: "Burial / Sediment Shielding",
    risk_level: "high",
    description: "Buried sections may not receive adequate CP current, especially with high-resistivity soil.",
    detection: "CP survey with specialized buried pipe techniques",
    prevention: "Design CP system with burial current demand allowance"
  },
  {
    id: "thermal_insulation",
    name: "Thermal Insulation Shielding",
    risk_level: "high",
    description: "Subsea insulation systems can shield CP, creating CUI conditions underwater.",
    detection: "Requires insulation removal or through-insulation CP measurement",
    prevention: "Use CP-compatible insulation systems"
  },
  {
    id: "clamp_interface",
    name: "Clamp / Attachment Shielding",
    risk_level: "moderate",
    description: "Clamps and attachments create crevices that may shield CP.",
    detection: "Cannot inspect without clamp removal",
    prevention: "Seal clamp interfaces, use corrosion-resistant clamp materials"
  }
];

// ============================================================
// ANODE LIFE CALCULATION
// ============================================================

function calculateAnodeLife(anodeData) {
  var massKg = anodeData.mass_kg || 100;
  var utilizationFactor = anodeData.utilization_factor || 0.85;
  var currentDemandA = anodeData.current_demand_A || 0.5;
  var capacityAhKg = anodeData.capacity_Ah_kg || 2700;

  var usableMass = massKg * utilizationFactor;
  var totalCapacity = usableMass * capacityAhKg;
  var lifeHours = totalCapacity / currentDemandA;
  var lifeYears = lifeHours / 8760;

  var depletionRate = massKg / lifeYears;
  var remainingMass = anodeData.remaining_mass_kg || massKg;
  var remainingLife = (remainingMass * utilizationFactor * capacityAhKg) / currentDemandA / 8760;

  var status = "adequate";
  if (remainingLife < 2) status = "critical";
  else if (remainingLife < 5) status = "marginal";
  else if (remainingLife < 10) status = "monitor";

  return {
    original_mass_kg: massKg,
    remaining_mass_kg: remainingMass,
    consumption_percent: Math.round(((massKg - remainingMass) / massKg) * 100),
    design_life_years: Math.round(lifeYears * 10) / 10,
    remaining_life_years: Math.round(remainingLife * 10) / 10,
    depletion_rate_kg_yr: Math.round(depletionRate * 10) / 10,
    current_demand_A: currentDemandA,
    status: status,
    action: status === "critical" ? "IMMEDIATE anode retrofit required" :
            status === "marginal" ? "Plan anode retrofit within 2 years" :
            status === "monitor" ? "Monitor depletion at next survey" :
            "No action required"
  };
}

// ============================================================
// COATING-CP COUPLED ASSESSMENT
// ============================================================

function evaluateCoatingCPInteraction(coatingState, cpState) {
  var coating = coatingState || "intact";
  var cp = cpState || "effective";

  var INTERACTION_MATRIX = {
    "intact_effective": {
      corrosion_risk: "very_low",
      protection_state: "fully_protected",
      description: "Coating provides primary barrier. CP provides backup at any holidays. Optimal condition.",
      corrosion_rate_factor: 0.05,
      action: "Routine monitoring"
    },
    "intact_marginal": {
      corrosion_risk: "low",
      protection_state: "primarily_coating",
      description: "Coating is doing the heavy lifting. CP should be investigated but corrosion risk is low while coating holds.",
      corrosion_rate_factor: 0.1,
      action: "Investigate CP system. Plan anode survey."
    },
    "intact_ineffective": {
      corrosion_risk: "low_but_vulnerable",
      protection_state: "coating_only",
      description: "No CP backup. Any coating holiday will corrode unprotected. Single barrier — vulnerable.",
      corrosion_rate_factor: 0.15,
      action: "Restore CP. Coating is single barrier — any failure now has no backup."
    },
    "minor_degradation_effective": {
      corrosion_risk: "low",
      protection_state: "cp_protecting_holidays",
      description: "Minor coating holidays are being protected by CP. System working as designed.",
      corrosion_rate_factor: 0.1,
      action: "Monitor coating. Plan touch-up at next opportunity."
    },
    "minor_degradation_marginal": {
      corrosion_risk: "moderate",
      protection_state: "partially_protected",
      description: "Coating holidays may not be fully protected by marginal CP. Localized corrosion possible.",
      corrosion_rate_factor: 0.3,
      action: "Prioritize CP restoration and coating repair."
    },
    "minor_degradation_ineffective": {
      corrosion_risk: "high",
      protection_state: "corroding_at_holidays",
      description: "Coating holidays are actively corroding with no CP protection. Pitting likely at defects.",
      corrosion_rate_factor: 0.5,
      action: "URGENT: Restore CP or repair coating. Active corrosion at holidays."
    },
    "moderate_degradation_effective": {
      corrosion_risk: "moderate",
      protection_state: "cp_working_hard",
      description: "Significant coating loss means CP is providing primary protection. High current demand may accelerate anode depletion.",
      corrosion_rate_factor: 0.2,
      action: "Plan coating repair. Monitor anode depletion rate — CP is consuming anodes faster."
    },
    "moderate_degradation_marginal": {
      corrosion_risk: "high",
      protection_state: "insufficient_protection",
      description: "Large bare areas with marginal CP. Widespread corrosion likely. CP cannot protect this much bare steel.",
      corrosion_rate_factor: 0.6,
      action: "URGENT: Repair coating AND restore CP. Neither system adequate alone."
    },
    "moderate_degradation_ineffective": {
      corrosion_risk: "very_high",
      protection_state: "unprotected",
      description: "Both barriers have failed. Asset is corroding at close to bare steel rates.",
      corrosion_rate_factor: 0.9,
      action: "CRITICAL: Both protection systems failed. Immediate inspection and repair."
    },
    "severe_degradation_effective": {
      corrosion_risk: "high",
      protection_state: "cp_overwhelmed",
      description: "Coating essentially gone. CP is sole protection but current demand exceeds design. Rapid anode depletion.",
      corrosion_rate_factor: 0.4,
      action: "CRITICAL: Recoat. CP cannot sustain this current demand long-term."
    },
    "severe_degradation_marginal": {
      corrosion_risk: "very_high",
      protection_state: "minimal_protection",
      description: "Coating failed and CP marginal. Near-complete loss of both barriers.",
      corrosion_rate_factor: 0.85,
      action: "CRITICAL: Emergency repair of both systems."
    },
    "severe_degradation_ineffective": {
      corrosion_risk: "extreme",
      protection_state: "fully_unprotected",
      description: "Total protection failure. Bare steel in seawater. Maximum corrosion rate.",
      corrosion_rate_factor: 1.0,
      action: "EMERGENCY: Asset is unprotected. Immediate engineering assessment required."
    },
    "failed_effective": {
      corrosion_risk: "high",
      protection_state: "cp_only",
      description: "No coating. CP is sole barrier. Extremely high current demand. Anodes will deplete rapidly.",
      corrosion_rate_factor: 0.35,
      action: "CRITICAL: Recoat as soon as possible. CP will deplete within 2-5 years at this demand."
    },
    "failed_marginal": {
      corrosion_risk: "very_high",
      protection_state: "barely_protected",
      description: "No coating and marginal CP. Asset in accelerated degradation.",
      corrosion_rate_factor: 0.9,
      action: "EMERGENCY: Both systems failed. Immediate intervention."
    },
    "failed_ineffective": {
      corrosion_risk: "extreme",
      protection_state: "no_protection",
      description: "Complete protection system failure. Maximum corrosion rate. Structural assessment urgently needed.",
      corrosion_rate_factor: 1.0,
      action: "EMERGENCY: No protection. Assess structural integrity immediately."
    }
  };

  var key = coating + "_" + cp;
  var result = INTERACTION_MATRIX[key];

  if (!result) {
    return {
      coating_state: coating,
      cp_state: cp,
      error: "Unknown combination. Coating states: intact, minor_degradation, moderate_degradation, severe_degradation, failed. CP states: effective, marginal, ineffective."
    };
  }

  result.coating_state = coating;
  result.cp_state = cp;
  result.klein_bottle_note = "Coating and CP are one protection surface. This assessment evaluates them as a coupled system, not independently.";

  return result;
}

// ============================================================
// FULL CP ASSESSMENT
// ============================================================

function evaluateCP(input) {
  var cpSystem = input.cp_system || "sacrificial_aluminum";
  var potential = input.potential_mV_AgCl || null;
  var material = input.material || "carbon_steel_seawater";
  var coatingState = input.coating_condition || "intact";
  var zone = input.zone || "submerged";
  var anodeData = input.anode_data || null;
  var shieldingFactors = input.shielding_factors || [];

  var results = {
    cp_system_type: cpSystem,
    zone: zone,
    material: material
  };

  // Potential assessment
  if (potential !== null) {
    var criteria = PROTECTION_CRITERIA[material] || PROTECTION_CRITERIA.carbon_steel_seawater;
    var potentialStatus = "unknown";
    var potentialNotes = [];

    if (potential <= criteria.overprotection_limit_mV_AgCl) {
      potentialStatus = "overprotected";
      potentialNotes.push("OVERPROTECTION RISK: " + criteria.overprotection_risk);
    } else if (potential <= criteria.fully_protected_mV_AgCl) {
      potentialStatus = "fully_protected";
    } else if (potential <= criteria.protected_mV_AgCl) {
      potentialStatus = "protected";
    } else {
      potentialStatus = "underprotected";
      potentialNotes.push("Below protection threshold. Active corrosion likely.");
    }

    results.potential = {
      measured_mV_AgCl: potential,
      status: potentialStatus,
      criteria: criteria,
      notes: potentialNotes
    };
  }

  // Anode life
  if (anodeData) {
    results.anode_assessment = calculateAnodeLife(anodeData);
  }

  // Coating-CP interaction
  var cpEffectiveness = "effective";
  if (results.potential) {
    if (results.potential.status === "underprotected") cpEffectiveness = "ineffective";
    else if (results.potential.status === "overprotected") cpEffectiveness = "effective";
  }
  results.coating_cp_interaction = evaluateCoatingCPInteraction(coatingState, cpEffectiveness);

  // Shielding assessment
  if (shieldingFactors.length > 0) {
    var shieldingResults = [];
    for (var i = 0; i < shieldingFactors.length; i++) {
      for (var j = 0; j < SHIELDING_RISKS.length; j++) {
        if (SHIELDING_RISKS[j].id === shieldingFactors[i]) {
          shieldingResults.push(SHIELDING_RISKS[j]);
          break;
        }
      }
    }
    results.shielding_assessment = {
      factors_present: shieldingFactors,
      risks: shieldingResults,
      overall_shielding_risk: shieldingResults.length > 0 && shieldingResults[0].risk_level === "critical" ? "critical" : (shieldingResults.length > 1 ? "high" : "moderate")
    };
  }

  // Zone-specific CP notes
  if (zone === "splash") {
    results.zone_note = "CP is minimally effective in splash zone due to intermittent immersion. Coating is primary protection. Do not rely on CP in this zone.";
    results.cp_zone_effectiveness = "minimal";
  } else if (zone === "buried") {
    results.zone_note = "CP effectiveness in buried zone depends on soil resistivity and coating condition. Shielding risk is elevated.";
    results.cp_zone_effectiveness = "variable";
  } else if (zone === "submerged") {
    results.zone_note = "CP most effective in continuously submerged zone. Ensure adequate current density for bare area.";
    results.cp_zone_effectiveness = "optimal";
  } else if (zone === "mudline") {
    results.zone_note = "Mudline zone has variable CP effectiveness. Anaerobic conditions require more negative potential for protection.";
    results.cp_zone_effectiveness = "variable";
  }

  // Overall CP status
  var overallStatus = "adequate";
  if (results.potential && results.potential.status === "underprotected") overallStatus = "inadequate";
  if (results.anode_assessment && results.anode_assessment.status === "critical") overallStatus = "critical";
  if (results.coating_cp_interaction && results.coating_cp_interaction.corrosion_risk === "extreme") overallStatus = "failed";
  if (results.shielding_assessment && results.shielding_assessment.overall_shielding_risk === "critical") overallStatus = "compromised";

  results.overall_status = overallStatus;

  return results;
}

// ============================================================
// RETROFIT OPTIONS
// ============================================================

function getRetrofitOptions(currentSystem, issue) {
  var options = [];

  if (issue === "anode_depletion" || issue === "insufficient_current") {
    options.push({
      option: "Retrofit sacrificial anodes",
      description: "Install additional clamp-on or bolt-on anodes",
      cost_level: "moderate",
      effectiveness: 0.85,
      installation: "Diver or ROV installable",
      design_life: "10-15 years depending on current demand"
    });
    options.push({
      option: "Convert to ICCP",
      description: "Install impressed current system for adjustable protection",
      cost_level: "high",
      effectiveness: 0.95,
      installation: "Major installation project",
      design_life: "20+ years with maintenance"
    });
  }

  if (issue === "shielding" || issue === "disbonded_coating") {
    options.push({
      option: "Remove and recoat with non-shielding system",
      description: "Strip disbonded coating, apply FBE or compatible non-shielding system",
      cost_level: "high",
      effectiveness: 0.95,
      installation: "Requires surface preparation subsea or in dry dock",
      design_life: "15-25 years"
    });
    options.push({
      option: "Install localized anodes at shielded areas",
      description: "Place small anodes directly at shielded locations",
      cost_level: "moderate",
      effectiveness: 0.6,
      installation: "Diver installable",
      design_life: "5-10 years"
    });
  }

  if (issue === "overprotection") {
    options.push({
      option: "Install current limiting diodes",
      description: "Reduce CP current to prevent overprotection",
      cost_level: "low",
      effectiveness: 0.8,
      installation: "Simple modification",
      design_life: "Equipment life"
    });
    options.push({
      option: "Adjust ICCP output",
      description: "Reduce transformer-rectifier output voltage",
      cost_level: "low",
      effectiveness: 0.95,
      installation: "Operational adjustment",
      design_life: "Ongoing"
    });
  }

  if (options.length === 0) {
    options.push({
      option: "Engineering assessment required",
      description: "Issue requires detailed CP engineering review to determine appropriate retrofit",
      cost_level: "variable",
      effectiveness: "tbd",
      installation: "tbd",
      design_life: "tbd"
    });
  }

  return {
    current_system: currentSystem,
    issue: issue,
    retrofit_options: options
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
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          deploy: DEPLOY,
          mode: "deterministic",
          purpose: "Cathodic Protection Intelligence — CP systems, anode life, coating-CP interaction, shielding, retrofit",
          principle: "CP and coating are one protection surface. This engine evaluates them as a coupled system.",
          cp_system_types: Object.keys(CP_SYSTEMS).length,
          protection_criteria: Object.keys(PROTECTION_CRITERIA).length,
          shielding_risk_types: SHIELDING_RISKS.length,
          actions: [
            "evaluate_cp — full CP assessment",
            "check_anode_life — anode depletion calculation",
            "evaluate_coating_cp — coupled coating+CP assessment",
            "check_shielding — CP shielding risk assessment",
            "get_retrofit_options — CP retrofit recommendations",
            "get_cp_standards — applicable CP standards",
            "get_registry — engine metadata"
          ]
        })
      };
    }

    if (action === "evaluate_cp") {
      var cpResult = evaluateCP(body);
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("cp_assessments").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          cp_system: body.cp_system || "unknown",
          zone: body.zone || "submerged",
          overall_status: cpResult.overall_status,
          result_json: cpResult
        });
      } catch (dbErr) { /* non-fatal */ }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: cpResult }, null, 2) };
    }

    if (action === "check_anode_life") {
      if (!body.anode_data) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "anode_data required" }) };
      var anodeResult = calculateAnodeLife(body.anode_data);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: anodeResult }, null, 2) };
    }

    if (action === "evaluate_coating_cp") {
      var ccResult = evaluateCoatingCPInteraction(body.coating_condition || "intact", body.cp_state || "effective");
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: ccResult }, null, 2) };
    }

    if (action === "check_shielding") {
      var factors = body.shielding_factors || [];
      var shieldResults = [];
      for (var i = 0; i < factors.length; i++) {
        for (var j = 0; j < SHIELDING_RISKS.length; j++) {
          if (SHIELDING_RISKS[j].id === factors[i]) {
            shieldResults.push(SHIELDING_RISKS[j]);
            break;
          }
        }
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, shielding_risks: shieldResults, all_risk_types: SHIELDING_RISKS }, null, 2) };
    }

    if (action === "get_retrofit_options") {
      var retrofit = getRetrofitOptions(body.current_system || "sacrificial_aluminum", body.issue || "anode_depletion");
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: retrofit }, null, 2) };
    }

    if (action === "get_cp_standards") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, cp_systems: CP_SYSTEMS, protection_criteria: PROTECTION_CRITERIA }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
