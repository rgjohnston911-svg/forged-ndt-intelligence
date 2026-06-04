// @ts-nocheck
/**
 * DEPLOY300 - refinery-code-authority-router.ts
 * netlify/functions/refinery-code-authority-router.ts
 *
 * REFINERY CODE AUTHORITY ROUTER
 *
 * Maps refinery asset class + active damage mechanisms to the
 * required chain of code authorities. Knows the hierarchy:
 * construction code → in-service inspection code → damage
 * mechanism reference → fitness-for-service → material-specific
 * standards → owner/user program.
 *
 * 20 code authorities with trigger conditions, precedence ranking,
 * required actions, and mechanism-specific routing. Outputs a
 * precedence-ranked code basis chain for every assessment.
 *
 * POST /api/refinery-code-authority-router
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "refinery-code-authority-router";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY300";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// CODE AUTHORITY DATABASE
// ============================================================

var CODE_AUTHORITIES = {
  asme_viii: { name: "ASME Section VIII — Pressure Vessel Construction", category: "construction", jurisdiction: "USA/International", scope: "Design, fabrication, and initial inspection of pressure vessels", applies_to_assets: ["pressure_vessel", "reactor", "column", "drum", "heat_exchanger"], precedence: 30, notes: "Construction code — defines original design basis. Referenced for acceptance criteria and repair procedures." },
  asme_b31_3: { name: "ASME B31.3 — Process Piping", category: "construction", jurisdiction: "USA/International", scope: "Design, fabrication, and initial inspection of process piping", applies_to_assets: ["process_piping", "flare_system", "relief_system"], precedence: 30, notes: "Construction code for process piping. Defines materials, design, fabrication, and examination requirements." },
  asme_b31_1: { name: "ASME B31.1 — Power Piping", category: "construction", jurisdiction: "USA/International", scope: "Boiler external piping, power plant piping", applies_to_assets: ["boiler_piping", "power_piping"], precedence: 30, notes: "Applies to boiler external piping and power plant systems." },
  api_510: { name: "API 510 — Pressure Vessel Inspection Code", category: "in_service", jurisdiction: "USA/International", scope: "In-service inspection, repair, alteration, and rerating of pressure vessels", applies_to_assets: ["pressure_vessel", "reactor", "column", "drum", "heat_exchanger"], precedence: 10, required_actions: ["Establish inspection intervals per API 510 Section 7", "Determine remaining life and next inspection date", "Evaluate fitness for continued service"], notes: "Primary in-service inspection code for pressure vessels. Inspector must hold API 510 certification." },
  api_570: { name: "API 570 — Piping Inspection Code", category: "in_service", jurisdiction: "USA/International", scope: "In-service inspection, repair, alteration, and rerating of process piping systems", applies_to_assets: ["process_piping", "flare_system", "relief_system"], precedence: 10, required_actions: ["Classify piping circuits by service class", "Set inspection intervals per API 570 Section 7", "Calculate remaining life at corrosion rate"], notes: "Primary in-service inspection code for piping. Inspector must hold API 570 certification." },
  api_653: { name: "API 653 — Tank Inspection, Repair, Alteration, and Reconstruction", category: "in_service", jurisdiction: "USA/International", scope: "In-service inspection and repair of atmospheric and low-pressure storage tanks", applies_to_assets: ["storage_tank", "containment"], precedence: 10, required_actions: ["External inspection per API 653 Section 6", "Internal inspection per API 653 Section 6", "Floor scan per API 653 Annex B", "Settlement survey"], notes: "Primary in-service code for aboveground storage tanks. Inspector must hold API 653 certification." },
  api_579: { name: "API 579-1/ASME FFS-1 — Fitness-For-Service", category: "fitness_for_service", jurisdiction: "USA/International", scope: "Engineering assessment of equipment with flaws, damage, or degradation to determine fitness for continued service", applies_to_assets: ["pressure_vessel", "process_piping", "storage_tank", "heat_exchanger", "reactor", "column", "drum", "boiler", "fired_heater"], precedence: 5, required_actions: ["Determine applicable FFS assessment level (1, 2, or 3)", "Gather required flaw/damage characterization data", "Perform assessment per applicable Part", "Document remaining life and operating limits"], trigger_mechanisms: ["htha", "creep", "fatigue", "chloride_scc", "ssc", "hic", "erosion_corrosion", "general_corrosion", "pitting_corrosion", "sulfidation", "amine_scc", "caustic_scc"], notes: "Triggered when damage exceeds code acceptance limits or when remaining life calculation is needed. Level 1 = screening, Level 2 = detailed, Level 3 = advanced (FEA)." },
  api_571: { name: "API 571 — Damage Mechanisms Affecting Fixed Equipment", category: "mechanism_reference", jurisdiction: "USA/International", scope: "Reference standard for damage mechanism identification, description, and inspection guidance", applies_to_assets: ["all_fixed_equipment"], precedence: 25, notes: "Not an inspection code — it is the authoritative reference for understanding damage mechanisms. Every mechanism assessment should reference API 571." },
  api_580: { name: "API 580 — Risk-Based Inspection", category: "risk_methodology", jurisdiction: "USA/International", scope: "Risk-based inspection methodology framework", applies_to_assets: ["all_fixed_equipment"], precedence: 35, notes: "Framework for implementing RBI programs. Defines probability of failure and consequence of failure assessment methodology." },
  api_581: { name: "API 581 — Risk-Based Inspection Methodology", category: "risk_methodology", jurisdiction: "USA/International", scope: "Quantitative and semi-quantitative RBI methodology with thinning, cracking, and external damage modules", applies_to_assets: ["all_fixed_equipment"], precedence: 36, notes: "Detailed RBI calculation methodology. Provides damage factor calculations for thinning, SCC, HTHA, external damage, and other mechanisms." },
  api_941: { name: "API 941 — Steels for Hydrogen Service at Elevated Temperatures", category: "material_specific", jurisdiction: "USA/International", scope: "Nelson curves and material selection for hydrogen service to prevent HTHA", applies_to_assets: ["pressure_vessel", "reactor", "process_piping", "heat_exchanger"], precedence: 15, trigger_mechanisms: ["htha"], required_actions: ["Plot operating conditions on Nelson curves", "Verify material is appropriate for hydrogen service", "If above or near curves: perform HTHA inspection per API RP 584", "Document hydrogen partial pressure and temperature history"], notes: "Critical for hydrotreaters, hydrocrackers, reformers. C-0.5Mo steel removed from some Nelson curves due to unreliable performance." },
  api_945: { name: "API 945 — Avoiding Environmental Cracking in Amine Units / Caustic Service", category: "material_specific", jurisdiction: "USA/International", scope: "Material selection, fabrication, and PWHT requirements for amine and caustic service", applies_to_assets: ["pressure_vessel", "process_piping", "heat_exchanger", "column"], precedence: 20, trigger_mechanisms: ["amine_scc", "caustic_scc"], required_actions: ["Verify PWHT status of all welds in amine/caustic service", "Check material compliance with API 945 requirements", "Inspect welds for environmental cracking"], notes: "PWHT is mandatory for carbon steel welds in amine and caustic service per API 945." },
  api_939_c: { name: "API 939-C — Guidelines for Avoiding Sulfidation Corrosion Failures", category: "material_specific", jurisdiction: "USA/International", scope: "Material selection and inspection guidance for sulfidation service", applies_to_assets: ["process_piping", "pressure_vessel", "fired_heater", "heat_exchanger"], precedence: 22, trigger_mechanisms: ["sulfidation"], required_actions: ["Verify material silicon content via PMI", "Confirm modified McConomy curve applicability", "Establish corrosion rate trending"], notes: "Silicon content in carbon steel significantly affects sulfidation resistance. PMI verification is essential." },
  nace_mr0175: { name: "NACE MR0175/ISO 15156 — Materials for Sour Service", category: "material_specific", jurisdiction: "International", scope: "Material requirements for equipment in sour (H2S) service to prevent SSC, HIC, SOHIC", applies_to_assets: ["all_sour_service_equipment"], precedence: 15, trigger_mechanisms: ["ssc", "hic"], required_actions: ["Verify material compliance with NACE MR0175", "Check hardness does not exceed 22 HRC / 248 HV", "Verify PWHT status", "Confirm weld procedure NACE compliance"], notes: "Mandatory for sour service. Non-compliant materials must be replaced or assessed per API 579." },
  asme_v: { name: "ASME Section V — Nondestructive Examination", category: "nde_reference", jurisdiction: "USA/International", scope: "NDE method execution requirements and acceptance criteria", applies_to_assets: ["all_equipment_requiring_nde"], precedence: 40, notes: "Reference for NDE method procedures. Defines how UT, RT, MT, PT, PAUT, TOFD, etc. must be performed." },
  api_574: { name: "API 574 — Inspection Practices for Piping System Components", category: "inspection_practice", jurisdiction: "USA/International", scope: "Recommended inspection practices for piping components — valves, fittings, flanges, bolting", applies_to_assets: ["process_piping", "valves", "fittings"], precedence: 42, notes: "Supplement to API 570. Provides specific guidance for piping component inspection." },
  api_572: { name: "API 572 — Inspection Practices for Pressure Vessels", category: "inspection_practice", jurisdiction: "USA/International", scope: "Recommended inspection practices for pressure vessel components", applies_to_assets: ["pressure_vessel", "reactor", "column", "drum", "heat_exchanger"], precedence: 42, notes: "Supplement to API 510. Provides specific guidance for vessel component inspection." },
  nbic: { name: "NBIC — National Board Inspection Code", category: "jurisdictional", jurisdiction: "USA", scope: "Installation, inspection, and repair of boilers and pressure vessels per jurisdictional requirements", applies_to_assets: ["boiler", "pressure_vessel"], precedence: 8, notes: "Jurisdictional authority in many US states. R-stamp repairs require NBIC compliance." },
  api_530: { name: "API 530 — Fired Heater Tube Calculation", category: "design_specific", jurisdiction: "USA/International", scope: "Remaining life calculation for fired heater tubes under creep and stress rupture conditions", applies_to_assets: ["fired_heater"], precedence: 18, trigger_mechanisms: ["creep", "stress_rupture", "oxidation", "sulfidation", "carburization"], required_actions: ["Calculate minimum required wall thickness at operating conditions", "Determine remaining life using Larson-Miller parameter", "Assess creep damage accumulation"], notes: "Primary code for fired heater tube assessment. Integrates with API 579 for damage evaluation." },
  owner_user_program: { name: "Owner/User Mechanical Integrity Program", category: "site_specific", jurisdiction: "Site-specific", scope: "Site-specific inspection program, procedures, and acceptance criteria within regulatory framework", applies_to_assets: ["all_equipment"], precedence: 1, notes: "The owner/user program is the top-level governance. All code requirements flow through the site MI program. OSHA PSM 29 CFR 1910.119 requires mechanical integrity programs for covered processes." }
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function resolveCodeChain(input) {
  var assetClass = input.asset_class || "pressure_vessel";
  var activeMechanisms = input.active_mechanisms || [];
  var findingsPresent = input.findings_present || false;
  var severity = input.severity || "medium";
  var chain = [];
  var ffsRequired = false;
  var primaryAuthority = null;

  // Step 1: Owner/User program is always first (lowest precedence number = highest authority)
  chain.push({ authority_key: "owner_user_program", authority_name: CODE_AUTHORITIES.owner_user_program.name, trigger_reason: "Always applies — site MI program governs all inspections", precedence: 1, category: "site_specific" });

  // Step 2: In-service inspection code based on asset class
  var assetLower = assetClass.toLowerCase();
  if (assetLower === "pressure_vessel" || assetLower === "reactor" || assetLower === "column" || assetLower === "drum" || assetLower === "heat_exchanger") {
    chain.push({ authority_key: "api_510", authority_name: CODE_AUTHORITIES.api_510.name, trigger_reason: "In-service inspection code for " + assetClass, precedence: 10, category: "in_service", required_actions: CODE_AUTHORITIES.api_510.required_actions });
    chain.push({ authority_key: "asme_viii", authority_name: CODE_AUTHORITIES.asme_viii.name, trigger_reason: "Construction basis for " + assetClass, precedence: 30, category: "construction" });
    primaryAuthority = "api_510";
  }
  if (assetLower === "process_piping" || assetLower === "flare_system" || assetLower === "relief_system") {
    chain.push({ authority_key: "api_570", authority_name: CODE_AUTHORITIES.api_570.name, trigger_reason: "In-service inspection code for " + assetClass, precedence: 10, category: "in_service", required_actions: CODE_AUTHORITIES.api_570.required_actions });
    chain.push({ authority_key: "asme_b31_3", authority_name: CODE_AUTHORITIES.asme_b31_3.name, trigger_reason: "Construction basis for " + assetClass, precedence: 30, category: "construction" });
    primaryAuthority = "api_570";
  }
  if (assetLower === "storage_tank" || assetLower === "containment") {
    chain.push({ authority_key: "api_653", authority_name: CODE_AUTHORITIES.api_653.name, trigger_reason: "In-service inspection code for " + assetClass, precedence: 10, category: "in_service", required_actions: CODE_AUTHORITIES.api_653.required_actions });
    primaryAuthority = "api_653";
  }
  if (assetLower === "boiler" || assetLower === "boiler_piping") {
    chain.push({ authority_key: "nbic", authority_name: CODE_AUTHORITIES.nbic.name, trigger_reason: "Jurisdictional inspection code for boiler/pressure vessel", precedence: 8, category: "jurisdictional" });
    primaryAuthority = "nbic";
  }
  if (assetLower === "fired_heater") {
    chain.push({ authority_key: "api_530", authority_name: CODE_AUTHORITIES.api_530.name, trigger_reason: "Fired heater tube design and remaining life basis", precedence: 18, category: "design_specific", required_actions: CODE_AUTHORITIES.api_530.required_actions });
    chain.push({ authority_key: "api_510", authority_name: CODE_AUTHORITIES.api_510.name, trigger_reason: "In-service inspection for fired heater pressure parts", precedence: 10, category: "in_service" });
    primaryAuthority = "api_530";
  }

  // Step 3: Mechanism-triggered code authorities
  for (var i = 0; i < activeMechanisms.length; i++) {
    var mech = activeMechanisms[i];

    // API 571 always when mechanisms are active
    if (i === 0) {
      chain.push({ authority_key: "api_571", authority_name: CODE_AUTHORITIES.api_571.name, trigger_reason: "Damage mechanism reference — " + activeMechanisms.length + " active mechanisms identified", precedence: 25, category: "mechanism_reference" });
    }

    // HTHA → API 941
    if (mech === "htha") {
      chain.push({ authority_key: "api_941", authority_name: CODE_AUTHORITIES.api_941.name, trigger_reason: "HTHA mechanism active — Nelson curve screening required", precedence: 15, category: "material_specific", required_actions: CODE_AUTHORITIES.api_941.required_actions });
      ffsRequired = true;
    }

    // SSC/HIC → NACE MR0175
    if (mech === "ssc" || mech === "hic") {
      chain.push({ authority_key: "nace_mr0175", authority_name: CODE_AUTHORITIES.nace_mr0175.name, trigger_reason: mech.toUpperCase() + " mechanism active — material compliance verification required", precedence: 15, category: "material_specific", required_actions: CODE_AUTHORITIES.nace_mr0175.required_actions });
    }

    // Amine/Caustic SCC → API 945
    if (mech === "amine_scc" || mech === "caustic_scc") {
      chain.push({ authority_key: "api_945", authority_name: CODE_AUTHORITIES.api_945.name, trigger_reason: mech + " mechanism active — PWHT and material verification per API 945", precedence: 20, category: "material_specific", required_actions: CODE_AUTHORITIES.api_945.required_actions });
    }

    // Sulfidation → API 939-C
    if (mech === "sulfidation") {
      chain.push({ authority_key: "api_939_c", authority_name: CODE_AUTHORITIES.api_939_c.name, trigger_reason: "Sulfidation active — PMI and McConomy curve assessment per API 939-C", precedence: 22, category: "material_specific", required_actions: CODE_AUTHORITIES.api_939_c.required_actions });
    }

    // Creep/stress rupture in fired heater → API 530
    if ((mech === "creep" || mech === "stress_rupture") && assetLower === "fired_heater") {
      // Already added above if fired heater
    }

    // FFS triggers
    if (mech === "htha" || mech === "creep" || mech === "fatigue" || mech === "chloride_scc" || mech === "ssc" || mech === "hic" || mech === "amine_scc" || mech === "caustic_scc") {
      ffsRequired = true;
    }
  }

  // Step 4: FFS if triggered by mechanisms or findings
  if (ffsRequired || (findingsPresent && (severity === "high" || severity === "critical"))) {
    chain.push({ authority_key: "api_579", authority_name: CODE_AUTHORITIES.api_579.name, trigger_reason: ffsRequired ? "Damage mechanism requires fitness-for-service evaluation" : "Finding severity requires FFS screening", precedence: 5, category: "fitness_for_service", required_actions: CODE_AUTHORITIES.api_579.required_actions });
  }

  // Step 5: NDE reference
  chain.push({ authority_key: "asme_v", authority_name: CODE_AUTHORITIES.asme_v.name, trigger_reason: "NDE method execution reference for all inspection activities", precedence: 40, category: "nde_reference" });

  // Deduplicate and sort by precedence
  var seen = {};
  var deduped = [];
  for (var d = 0; d < chain.length; d++) {
    if (!seen[chain[d].authority_key]) {
      seen[chain[d].authority_key] = true;
      deduped.push(chain[d]);
    }
  }
  deduped.sort(function(a, b) { return a.precedence - b.precedence; });

  return {
    asset_class: assetClass,
    active_mechanisms: activeMechanisms,
    code_chain: deduped,
    code_count: deduped.length,
    primary_authority: primaryAuthority,
    ffs_required: ffsRequired,
    ffs_trigger: ffsRequired ? "Damage mechanism or finding severity triggers API 579 fitness-for-service evaluation" : null,
    governance_note: "Code authority flows: Owner/User Program → Jurisdictional (NBIC) → In-Service (API 510/570/653) → FFS (API 579) → Mechanism-Specific (API 941/945/939-C/NACE) → Construction Basis (ASME VIII/B31.3) → NDE Reference (ASME V). Higher precedence codes override lower ones on acceptance criteria.",
    assumptions_for_mesh: {
      code_basis_established: deduped.length > 2,
      ffs_required: ffsRequired,
      primary_authority: primaryAuthority
    }
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
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Refinery Code Authority Router — maps asset class + mechanisms to precedence-ranked code authority chain", code_authorities: Object.keys(CODE_AUTHORITIES).length, actions: ["resolve_code_chain", "get_code_database", "get_registry"] }) }; }
    if (action === "resolve_code_chain") {
      var chainResult = resolveCodeChain(body);
      try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("refinery_code_authority_results").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_class: body.asset_class || null, active_mechanisms: body.active_mechanisms || [], code_chain: chainResult.code_chain, ffs_required: chainResult.ffs_required, primary_authority: chainResult.primary_authority, result_json: chainResult }); } catch (e) {}
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: chainResult }, null, 2) };
    }
    if (action === "get_code_database") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, authorities: CODE_AUTHORITIES }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
