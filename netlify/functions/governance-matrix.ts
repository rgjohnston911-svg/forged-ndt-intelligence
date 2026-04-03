/**
 * DEPLOY74 — governance-matrix.ts
 * FORGED NDT Intelligence OS
 * Governance Matrix Engine v1
 *
 * PURPOSE: Resolves the full governance authority stack for any
 * inspection scenario — legal/regulatory, asset code, method execution,
 * personnel qualification, RBI/damage, FFS, and owner/user layers.
 *
 * ARCHITECTURE POSITION:
 *   Intake / Master Router
 *     -> Governance Matrix Engine v1  <-- this file
 *     -> Code Authority Resolution Engine v1
 *     -> Inspection Planning / Output UI
 *
 * DEPLOY NOTES:
 *   - String concatenation only (no backtick template literals)
 *   - All logic inlined (no lib/ imports)
 *   - Target: netlify/functions/governance-matrix.ts
 */

import { Handler } from "@netlify/functions";

/* =========================================================
   TYPE DEFINITIONS
   ========================================================= */

type Jurisdiction =
  | "us_general"
  | "us_refinery_chemical"
  | "us_pipeline"
  | "us_offshore_fixed"
  | "us_offshore_floating"
  | "us_offshore_renewable"
  | "us_power"
  | "us_civil_bridge"
  | "us_marine"
  | "us_nuclear"
  | "us_aviation"
  | "us_railroad"
  | "unknown";

type AssetClass =
  | "pressure_vessel"
  | "process_piping"
  | "storage_tank"
  | "heat_exchanger"
  | "boiler"
  | "heater"
  | "refinery_process_facility"
  | "chemical_process_facility"
  | "pipeline"
  | "offshore_fixed_platform"
  | "offshore_floating_facility"
  | "offshore_renewable_facility"
  | "bridge_civil_structure"
  | "structural_steel"
  | "marine_vessel"
  | "power_generation_equipment"
  | "relief_device"
  | "unknown_asset";

type InspectionContext =
  | "scheduled_programmatic"
  | "new_build_fabrication"
  | "event_driven"
  | "condition_driven"
  | "repair_alteration"
  | "turnaround_shutdown"
  | "unknown_context";

type ServiceEnvironment =
  | "general_hydrocarbon"
  | "sour_service"
  | "hydrogen_service"
  | "high_temperature"
  | "chloride_service"
  | "caustic_service"
  | "marine_exposure"
  | "cyclic_service"
  | "insulated_service"
  | "water_service"
  | "steam_service"
  | "unknown_service";

type GovernanceCategory =
  | "legal_regulatory"
  | "asset_code"
  | "method_execution"
  | "personnel_qualification"
  | "damage_mechanism_rbi"
  | "fitness_for_service"
  | "owner_user_execution";

type AuthorityRef =
  | "OSHA PSM 29 CFR 1910.119"
  | "EPA RMP 40 CFR Part 68"
  | "PHMSA Pipeline Safety"
  | "BSEE 30 CFR Part 250"
  | "USCG OCS / Marine Oversight"
  | "BOEM Renewable Energy Oversight"
  | "BSEE Technical Compliance"
  | "NBIS 23 CFR 650"
  | "FHWA Bridge Inspection Manual"
  | "AASHTO LRFD Bridge Design"
  | "API 510"
  | "API 570"
  | "API 653"
  | "API 571"
  | "API 579-1/ASME FFS-1"
  | "API 580"
  | "API 581"
  | "API RP 2A"
  | "ASME Section V"
  | "ASME Section VIII"
  | "ASME Section IX"
  | "ASME B31.3"
  | "NBIC / NB-23"
  | "AWS D1.1"
  | "ASNT SNT-TC-1A"
  | "ANSI/ASNT CP-189"
  | "FAA 14 CFR Part 43"
  | "FAA AC 43.13"
  | "NRC Nuclear Oversight"
  | "FRA Railroad Safety"
  | "Owner/User Program"
  | "Plant Procedure"
  | "Project ITP"
  | "Engineer of Record"
  | "Jurisdictional Authority"
  | "AI Fallback Resolution";

interface GovernanceInput {
  raw_text: string;
  asset_class: AssetClass;
  inspection_context: InspectionContext;
  jurisdiction: Jurisdiction;
  service_environment: ServiceEnvironment[];
}

interface GovernanceBucket {
  category: GovernanceCategory;
  authorities: AuthorityRef[];
  rationale: string;
}

interface GovernanceMatrixOutput {
  engine: "Governance Matrix Engine v1";
  parsed_input: GovernanceInput;
  confidence: number;
  primary_governance_path: string;
  governance_buckets: GovernanceBucket[];
  applicable_authorities_flat: AuthorityRef[];
  missing_governance_variables: string[];
  warnings: string[];
  ai_fallback_used: boolean;
  ai_fallback_note: string | null;
  ui_sections: {
    legal_regulatory: AuthorityRef[];
    asset_code: AuthorityRef[];
    method_execution: AuthorityRef[];
    personnel_qualification: AuthorityRef[];
    damage_mechanism_rbi: AuthorityRef[];
    fitness_for_service: AuthorityRef[];
    owner_user_execution: AuthorityRef[];
  };
}

/* =========================================================
   HELPERS
   ========================================================= */

function lower(text: string): string {
  return (text || "").toLowerCase().trim();
}

function includesAny(text: string, values: string[]): boolean {
  for (var i = 0; i < values.length; i++) {
    if (text.indexOf(values[i]) !== -1) return true;
  }
  return false;
}

function uniqueAuthorities(items: AuthorityRef[]): AuthorityRef[] {
  var seen: Record<string, boolean> = {};
  var result: AuthorityRef[] = [];
  for (var i = 0; i < items.length; i++) {
    var key = items[i];
    if (!seen[key]) {
      seen[key] = true;
      result.push(items[i]);
    }
  }
  return result;
}

function uniqueStrings(items: string[]): string[] {
  var seen: Record<string, boolean> = {};
  var result: string[] = [];
  for (var i = 0; i < items.length; i++) {
    var key = items[i];
    if (!seen[key]) {
      seen[key] = true;
      result.push(key);
    }
  }
  return result;
}

/* =========================================================
   PARSERS
   ========================================================= */

function detectAssetClass(rawText: string): AssetClass {
  var t = lower(rawText);

  if (includesAny(t, ["pressure vessel", "separator", "reactor", "column", "tower", "drum"])) return "pressure_vessel";
  if (includesAny(t, ["process piping", "piping", "pipe circuit", "line"])) return "process_piping";
  if (includesAny(t, ["storage tank", "tank farm", "tank"])) return "storage_tank";
  if (includesAny(t, ["heat exchanger", "exchanger", "bundle"])) return "heat_exchanger";
  if (includesAny(t, ["boiler"])) return "boiler";
  if (includesAny(t, ["fired heater", "heater"])) return "heater";
  if (includesAny(t, ["refinery", "refinery process facility"])) return "refinery_process_facility";
  if (includesAny(t, ["chemical plant", "chemical processing", "process facility"])) return "chemical_process_facility";
  if (includesAny(t, ["pipeline", "gas line", "transmission line"])) return "pipeline";
  if (includesAny(t, ["offshore platform", "fixed platform"])) return "offshore_fixed_platform";
  if (includesAny(t, ["floating facility", "modu", "spar", "semi-submersible", "semisubmersible", "tension leg platform", "tlp"])) return "offshore_floating_facility";
  if (includesAny(t, ["offshore wind", "wind farm", "offshore renewable", "wave energy", "tidal energy", "offshore solar"])) return "offshore_renewable_facility";
  if (includesAny(t, ["bridge", "overpass", "pier", "bridge support"])) return "bridge_civil_structure";
  if (includesAny(t, ["structural steel", "pipe rack", "steel support"])) return "structural_steel";
  if (includesAny(t, ["ship", "cargo ship", "marine vessel"])) return "marine_vessel";
  if (includesAny(t, ["turbine", "power generation", "power plant"])) return "power_generation_equipment";
  if (includesAny(t, ["relief device", "psv", "prv", "safety valve"])) return "relief_device";

  return "unknown_asset";
}

function detectInspectionContext(rawText: string): InspectionContext {
  var t = lower(rawText);

  if (includesAny(t, ["annual inspection", "scheduled inspection", "routine inspection", "periodic inspection", "due for inspection", "inspection interval", "rbi"])) return "scheduled_programmatic";
  if (includesAny(t, ["new build", "fabrication", "construction", "hold point", "fit-up", "itp", "pre-service", "turnover"])) return "new_build_fabrication";
  if (includesAny(t, ["impact", "hurricane", "storm", "collision", "truck hit", "earthquake", "blast", "fire event"])) return "event_driven";
  if (includesAny(t, ["crack found", "corrosion found", "wall loss", "leak", "thinning", "deformation", "anomaly"])) return "condition_driven";
  if (includesAny(t, ["repair", "alteration", "rerate"])) return "repair_alteration";
  if (includesAny(t, ["turnaround", "shutdown"])) return "turnaround_shutdown";

  return "unknown_context";
}

function detectJurisdiction(rawText: string, assetClass: AssetClass): Jurisdiction {
  var t = lower(rawText);

  if (assetClass === "refinery_process_facility" || assetClass === "chemical_process_facility" || assetClass === "pressure_vessel" || assetClass === "process_piping" || assetClass === "storage_tank" || assetClass === "heat_exchanger" || assetClass === "boiler" || assetClass === "heater" || assetClass === "relief_device") return "us_refinery_chemical";
  if (assetClass === "pipeline") return "us_pipeline";
  if (assetClass === "offshore_fixed_platform") return "us_offshore_fixed";
  if (assetClass === "offshore_floating_facility") return "us_offshore_floating";
  if (assetClass === "offshore_renewable_facility") return "us_offshore_renewable";
  if (assetClass === "bridge_civil_structure") return "us_civil_bridge";
  if (assetClass === "marine_vessel") return "us_marine";
  if (assetClass === "power_generation_equipment") return "us_power";

  if (includesAny(t, ["offshore renewable", "offshore wind", "wind farm"])) return "us_offshore_renewable";
  if (includesAny(t, ["offshore"])) return "us_offshore_fixed";
  if (includesAny(t, ["pipeline"])) return "us_pipeline";
  if (includesAny(t, ["bridge", "overpass"])) return "us_civil_bridge";
  if (includesAny(t, ["nuclear"])) return "us_nuclear";
  if (includesAny(t, ["aircraft", "airplane", "aviation", "747", "737", "a320", "fuselage"])) return "us_aviation";
  if (includesAny(t, ["railroad", "rail car", "locomotive", "rail bridge"])) return "us_railroad";

  return "us_general";
}

function detectServiceEnvironment(rawText: string): ServiceEnvironment[] {
  var t = lower(rawText);
  var out: ServiceEnvironment[] = [];

  if (includesAny(t, ["sour", "h2s"])) out.push("sour_service");
  if (includesAny(t, ["hydrogen"])) out.push("hydrogen_service");
  if (includesAny(t, ["high temperature", "heater", "hot service"])) out.push("high_temperature");
  if (includesAny(t, ["chloride"])) out.push("chloride_service");
  if (includesAny(t, ["caustic"])) out.push("caustic_service");
  if (includesAny(t, ["offshore", "marine", "salt", "splash zone"])) out.push("marine_exposure");
  if (includesAny(t, ["cyclic", "startup", "shutdown"])) out.push("cyclic_service");
  if (includesAny(t, ["insulated", "insulation", "cui"])) out.push("insulated_service");
  if (includesAny(t, ["water"])) out.push("water_service");
  if (includesAny(t, ["steam"])) out.push("steam_service");

  if (out.length === 0) out.push("unknown_service");
  return out;
}

/* =========================================================
   GOVERNANCE RESOLUTION RULES
   ========================================================= */

function legalRegulatoryAuthorities(input: GovernanceInput): AuthorityRef[] {
  var out: AuthorityRef[] = [];

  /* --- Refinery / Chemical / Fixed Equipment --- */
  if (
    input.jurisdiction === "us_refinery_chemical" ||
    input.asset_class === "refinery_process_facility" ||
    input.asset_class === "chemical_process_facility" ||
    input.asset_class === "pressure_vessel" ||
    input.asset_class === "process_piping" ||
    input.asset_class === "storage_tank" ||
    input.asset_class === "heat_exchanger" ||
    input.asset_class === "boiler" ||
    input.asset_class === "heater" ||
    input.asset_class === "relief_device"
  ) {
    out.push("OSHA PSM 29 CFR 1910.119");
    out.push("EPA RMP 40 CFR Part 68");
  }

  /* --- Pipeline --- */
  if (input.jurisdiction === "us_pipeline" || input.asset_class === "pipeline") {
    out.push("PHMSA Pipeline Safety");
  }

  /* --- Offshore Fixed Platform --- */
  /* BSEE is primary; USCG retains OCS framework authority */
  if (input.jurisdiction === "us_offshore_fixed" || input.asset_class === "offshore_fixed_platform") {
    out.push("BSEE 30 CFR Part 250");
    out.push("USCG OCS / Marine Oversight");
  }

  /* --- Offshore Floating / MODU --- */
  /* USCG + BSEE split by system and facility type */
  if (input.jurisdiction === "us_offshore_floating" || input.asset_class === "offshore_floating_facility") {
    out.push("USCG OCS / Marine Oversight");
    out.push("BSEE 30 CFR Part 250");
  }

  /* --- Offshore Renewable --- */
  /* BOEM primary for leasing/siting; BSEE for technical/enforcement */
  if (input.jurisdiction === "us_offshore_renewable" || input.asset_class === "offshore_renewable_facility") {
    out.push("BOEM Renewable Energy Oversight");
    out.push("BSEE Technical Compliance");
  }

  /* --- Bridge / Civil --- */
  if (input.jurisdiction === "us_civil_bridge" || input.asset_class === "bridge_civil_structure") {
    out.push("NBIS 23 CFR 650");
    out.push("FHWA Bridge Inspection Manual");
  }

  /* --- Aviation (future-ready) --- */
  if (input.jurisdiction === "us_aviation") {
    out.push("FAA 14 CFR Part 43");
  }

  /* --- Nuclear (future-ready) --- */
  if (input.jurisdiction === "us_nuclear") {
    out.push("NRC Nuclear Oversight");
  }

  /* --- Railroad (future-ready) --- */
  if (input.jurisdiction === "us_railroad") {
    out.push("FRA Railroad Safety");
  }

  return uniqueAuthorities(out);
}

function assetCodeAuthorities(input: GovernanceInput): AuthorityRef[] {
  var out: AuthorityRef[] = [];

  if (input.asset_class === "pressure_vessel" || input.asset_class === "heat_exchanger" || input.asset_class === "boiler" || input.asset_class === "heater") {
    out.push("API 510");
    out.push("ASME Section VIII");
  }

  if (input.asset_class === "process_piping") {
    out.push("API 570");
    out.push("ASME B31.3");
  }

  if (input.asset_class === "storage_tank") {
    out.push("API 653");
  }

  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    out.push("API 510");
    out.push("API 570");
    out.push("API 653");
    out.push("ASME Section VIII");
    out.push("ASME B31.3");
  }

  if (input.asset_class === "pipeline") {
    out.push("PHMSA Pipeline Safety");
  }

  if (input.asset_class === "offshore_fixed_platform") {
    out.push("API RP 2A");
  }

  if (input.asset_class === "offshore_floating_facility") {
    out.push("USCG OCS / Marine Oversight");
    out.push("BSEE 30 CFR Part 250");
  }

  if (input.asset_class === "offshore_renewable_facility") {
    out.push("BOEM Renewable Energy Oversight");
    out.push("BSEE Technical Compliance");
  }

  if (input.asset_class === "bridge_civil_structure") {
    out.push("AASHTO LRFD Bridge Design");
    out.push("FHWA Bridge Inspection Manual");
    out.push("NBIS 23 CFR 650");
  }

  if (input.asset_class === "structural_steel") {
    out.push("AWS D1.1");
  }

  if (input.asset_class === "relief_device") {
    out.push("Owner/User Program");
    out.push("Plant Procedure");
  }

  if (input.inspection_context === "repair_alteration" || input.inspection_context === "new_build_fabrication") {
    out.push("ASME Section IX");
  }

  return uniqueAuthorities(out);
}

function methodExecutionAuthorities(input: GovernanceInput): AuthorityRef[] {
  var out: AuthorityRef[] = [];

  if (
    input.asset_class === "pressure_vessel" ||
    input.asset_class === "process_piping" ||
    input.asset_class === "storage_tank" ||
    input.asset_class === "heat_exchanger" ||
    input.asset_class === "boiler" ||
    input.asset_class === "heater" ||
    input.asset_class === "refinery_process_facility" ||
    input.asset_class === "chemical_process_facility" ||
    input.asset_class === "offshore_fixed_platform" ||
    input.asset_class === "offshore_floating_facility" ||
    input.asset_class === "offshore_renewable_facility"
  ) {
    out.push("ASME Section V");
  }

  if (input.asset_class === "bridge_civil_structure" || input.asset_class === "structural_steel") {
    out.push("Project ITP");
    out.push("Engineer of Record");
  }

  out.push("Plant Procedure");

  return uniqueAuthorities(out);
}

function personnelQualificationAuthorities(input: GovernanceInput): AuthorityRef[] {
  var out: AuthorityRef[] = [];

  out.push("ASNT SNT-TC-1A");
  out.push("ANSI/ASNT CP-189");

  if (input.inspection_context === "new_build_fabrication" || input.inspection_context === "repair_alteration") {
    out.push("ASME Section IX");
  }

  /* Aviation personnel qualification is FAA-controlled */
  if (input.jurisdiction === "us_aviation") {
    out.push("FAA 14 CFR Part 43");
  }

  return uniqueAuthorities(out);
}

function damageMechanismRbiAuthorities(input: GovernanceInput): AuthorityRef[] {
  var out: AuthorityRef[] = [];

  if (
    input.asset_class === "pressure_vessel" ||
    input.asset_class === "process_piping" ||
    input.asset_class === "storage_tank" ||
    input.asset_class === "heat_exchanger" ||
    input.asset_class === "boiler" ||
    input.asset_class === "heater" ||
    input.asset_class === "refinery_process_facility" ||
    input.asset_class === "chemical_process_facility"
  ) {
    out.push("API 571");
    out.push("API 580");
    out.push("API 581");
  }

  if (input.asset_class === "offshore_fixed_platform" || input.asset_class === "offshore_floating_facility" || input.asset_class === "offshore_renewable_facility") {
    out.push("API RP 2A");
  }

  return uniqueAuthorities(out);
}

function fitnessForServiceAuthorities(input: GovernanceInput): AuthorityRef[] {
  var out: AuthorityRef[] = [];

  if (
    input.asset_class === "pressure_vessel" ||
    input.asset_class === "process_piping" ||
    input.asset_class === "storage_tank" ||
    input.asset_class === "heat_exchanger" ||
    input.asset_class === "boiler" ||
    input.asset_class === "heater" ||
    input.asset_class === "refinery_process_facility" ||
    input.asset_class === "chemical_process_facility"
  ) {
    out.push("API 579-1/ASME FFS-1");
  }

  if (input.asset_class === "bridge_civil_structure" || input.asset_class === "offshore_fixed_platform" || input.asset_class === "offshore_renewable_facility") {
    out.push("Engineer of Record");
  }

  return uniqueAuthorities(out);
}

function ownerUserExecutionAuthorities(input: GovernanceInput): AuthorityRef[] {
  var out: AuthorityRef[] = [];

  out.push("Owner/User Program");
  out.push("Plant Procedure");

  if (input.inspection_context === "new_build_fabrication" || input.inspection_context === "repair_alteration") {
    out.push("Project ITP");
  }

  if (input.asset_class === "bridge_civil_structure" || input.asset_class === "structural_steel") {
    out.push("Engineer of Record");
  }

  if (input.asset_class === "boiler" || input.asset_class === "pressure_vessel") {
    out.push("Jurisdictional Authority");
    out.push("NBIC / NB-23");
  }

  return uniqueAuthorities(out);
}

/* =========================================================
   RATIONALES
   ========================================================= */

function rationaleForCategory(category: GovernanceCategory, input: GovernanceInput): string {
  if (category === "legal_regulatory") {
    if (input.asset_class === "offshore_fixed_platform") {
      return "Offshore fixed platforms on the U.S. OCS are primarily governed by BSEE, with USCG retaining authority within the OCS framework for certain safety and environmental functions.";
    }
    if (input.asset_class === "offshore_floating_facility") {
      return "Floating offshore facilities and MODUs require split oversight: USCG governs marine/vessel systems while BSEE governs safety and operational systems, with responsibilities split by system and facility type.";
    }
    if (input.asset_class === "offshore_renewable_facility") {
      return "Offshore renewable energy facilities are primarily governed by BOEM for leasing, siting, and environmental review, with BSEE responsible for technical standards, safety compliance, and enforcement.";
    }
    return "This layer identifies the likely legal or regulatory drivers that require integrity management, inspection, oversight, or periodic review for the asset and jurisdiction.";
  }
  if (category === "asset_code") {
    return "This layer identifies the primary asset-specific code family that typically governs in-service inspection planning, acceptance, intervals, and scope.";
  }
  if (category === "method_execution") {
    return "This layer identifies the standards that typically govern how NDT methods are executed, documented, or controlled in procedure-based work.";
  }
  if (category === "personnel_qualification") {
    return "This layer identifies the personnel qualification and certification framework likely controlling who may perform or supervise the NDT work.";
  }
  if (category === "damage_mechanism_rbi") {
    return "This layer identifies the references that support degradation mechanism review, risk-based inspection planning, and interval prioritization.";
  }
  if (category === "fitness_for_service") {
    return "This layer identifies the likely escalation references when degradation is found and engineering assessment beyond routine inspection is required.";
  }
  return "This layer identifies owner-user, plant, project, or jurisdictional controls that govern how the work is actually executed in practice.";
}

/* =========================================================
   CONFIDENCE / WARNINGS / MISSING VARIABLES
   ========================================================= */

function buildConfidence(input: GovernanceInput, aiFallbackUsed: boolean): number {
  var score = 55;

  if (input.asset_class !== "unknown_asset") score += 15;
  if (input.inspection_context !== "unknown_context") score += 10;
  if (input.jurisdiction !== "unknown") score += 10;
  if (input.service_environment.length > 0 && input.service_environment[0] !== "unknown_service") score += 5;

  /* AI fallback caps confidence lower */
  if (aiFallbackUsed) {
    if (score > 75) score = 75;
  } else {
    if (score > 95) score = 95;
  }

  return score;
}

function buildPrimaryGovernancePath(input: GovernanceInput): string {
  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    return "OSHA/EPA legal driver -> API asset code family -> ASME method execution -> ASNT personnel qualification -> API RBI/FFS overlays -> owner/user execution";
  }

  if (input.asset_class === "pipeline") {
    return "PHMSA legal driver -> pipeline integrity framework -> method execution procedure -> personnel qualification -> operator integrity program";
  }

  if (input.asset_class === "offshore_fixed_platform") {
    return "BSEE primary + USCG OCS framework -> API RP 2A structural framework -> NDT execution standard -> personnel qualification -> owner/operator integrity execution";
  }

  if (input.asset_class === "offshore_floating_facility") {
    return "USCG marine oversight + BSEE safety/operations -> split by system type -> NDT execution standard -> personnel qualification -> owner/operator execution";
  }

  if (input.asset_class === "offshore_renewable_facility") {
    return "BOEM primary (leasing/siting/environmental) + BSEE (technical/enforcement) -> facility-specific structural framework -> NDT execution standard -> personnel qualification -> operator execution";
  }

  if (input.asset_class === "bridge_civil_structure") {
    return "NBIS/FHWA oversight -> bridge inspection framework -> project/agency method control -> personnel qualification / program requirements -> engineer-of-record execution";
  }

  if (input.jurisdiction === "us_aviation") {
    return "FAA legal driver -> airworthiness directives -> approved NDT procedures -> FAA A&P / IA qualification -> operator maintenance program";
  }

  if (input.jurisdiction === "us_nuclear") {
    return "NRC regulatory driver -> ASME Section XI ISI requirements -> approved NDT execution -> personnel qualification -> licensee program execution";
  }

  if (input.jurisdiction === "us_railroad") {
    return "FRA regulatory driver -> railroad inspection framework -> approved NDT execution -> qualification requirements -> operator program execution";
  }

  return "Regulatory / oversight driver -> asset code family -> method execution standard -> personnel qualification -> owner/user execution";
}

function buildMissingVariables(input: GovernanceInput): string[] {
  var out: string[] = [];

  if (input.asset_class === "unknown_asset") out.push("Exact asset class not confirmed");
  if (input.inspection_context === "unknown_context") out.push("Inspection context not confirmed");
  if (input.jurisdiction === "unknown") out.push("Jurisdiction not confirmed");
  if (input.service_environment.length === 1 && input.service_environment[0] === "unknown_service") {
    out.push("Service environment not confirmed");
  }

  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    out.push("Exact component grouping not confirmed: API 510 / 570 / 653 split may be needed");
  }

  if (input.asset_class === "offshore_fixed_platform" || input.asset_class === "offshore_floating_facility") {
    out.push("Facility type split not confirmed: fixed vs floating responsibilities may differ");
  }

  if (input.asset_class === "offshore_renewable_facility") {
    out.push("Specific renewable asset subtype not confirmed: wind turbine foundation, subsea cable, transition piece, tower, nacelle, etc.");
  }

  return uniqueStrings(out);
}

function buildWarnings(input: GovernanceInput, aiFallbackUsed: boolean): string[] {
  var out: string[] = [];

  out.push("This engine is a governance resolution layer and does not replace certified engineering judgment, owner/user procedures, or jurisdiction-specific requirements.");
  out.push("Applicable authorities may vary by contract, state or local jurisdiction, operator program, and exact asset subtype.");

  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    out.push("Refinery and chemical facility governance is usually a layered model: legal driver, asset code, method code, qualification standard, and owner/user execution.");
  }

  if (input.asset_class === "bridge_civil_structure") {
    out.push("Bridge authority and required actions may vary by owner agency, state DOT, emergency response protocol, and engineer-of-record requirements.");
  }

  if (input.asset_class === "offshore_fixed_platform") {
    out.push("Offshore fixed platforms: BSEE is primary regulatory authority; USCG retains OCS framework authority for certain safety, environmental, and marine functions.");
  }

  if (input.asset_class === "offshore_floating_facility") {
    out.push("Floating facilities / MODUs: regulatory responsibilities are split between USCG and BSEE by system type and facility classification.");
  }

  if (input.asset_class === "offshore_renewable_facility") {
    out.push("Offshore renewables: BOEM governs leasing, siting, and environmental review; BSEE governs technical standards and enforcement. Regulatory framework is still evolving.");
  }

  if (aiFallbackUsed) {
    out.push("WARNING: Asset class was not recognized by the deterministic rule base. Governance was resolved via AI inference. Verify with subject matter expert before relying on this output.");
  }

  return out;
}

/* =========================================================
   AI FALLBACK STUB
   ---------------------------------------------------------
   When asset_class resolves to unknown_asset, this stub
   returns a structured fallback response. In production,
   wire this to a dual-AI call that infers governance from
   the raw text and returns structured JSON.
   ========================================================= */

interface AIFallbackResult {
  used: boolean;
  note: string | null;
  suggested_legal: AuthorityRef[];
  suggested_asset_code: AuthorityRef[];
  suggested_method: AuthorityRef[];
  suggested_personnel: AuthorityRef[];
}

function runAIFallbackStub(input: GovernanceInput): AIFallbackResult {
  if (input.asset_class !== "unknown_asset") {
    return {
      used: false,
      note: null,
      suggested_legal: [],
      suggested_asset_code: [],
      suggested_method: [],
      suggested_personnel: []
    };
  }

  /* --- Jurisdiction-based inference for unknown assets --- */
  var t = lower(input.raw_text);

  if (input.jurisdiction === "us_aviation" || includesAny(t, ["aircraft", "airplane", "aviation", "747", "737", "a320", "fuselage", "wing", "empennage", "landing gear"])) {
    return {
      used: true,
      note: "Asset not in deterministic registry. AI fallback inferred aviation/aerospace governance based on input language. Governance resolved via jurisdiction inference: FAA 14 CFR Part 43 / AC 43.13 framework. Confidence capped at 75%. Log to governance_ai_resolutions for review and potential promotion to deterministic rule base.",
      suggested_legal: ["FAA 14 CFR Part 43"],
      suggested_asset_code: ["FAA AC 43.13"],
      suggested_method: ["Plant Procedure"],
      suggested_personnel: ["FAA 14 CFR Part 43"]
    };
  }

  if (input.jurisdiction === "us_nuclear" || includesAny(t, ["nuclear", "reactor vessel", "containment", "nrc"])) {
    return {
      used: true,
      note: "Asset not in deterministic registry. AI fallback inferred nuclear governance based on input language. Confidence capped at 75%. Verify with subject matter expert.",
      suggested_legal: ["NRC Nuclear Oversight"],
      suggested_asset_code: ["Owner/User Program"],
      suggested_method: ["Plant Procedure"],
      suggested_personnel: ["ASNT SNT-TC-1A", "ANSI/ASNT CP-189"]
    };
  }

  if (input.jurisdiction === "us_railroad" || includesAny(t, ["railroad", "rail car", "locomotive", "rail bridge", "rail tank"])) {
    return {
      used: true,
      note: "Asset not in deterministic registry. AI fallback inferred railroad governance based on input language. Confidence capped at 75%. Verify with subject matter expert.",
      suggested_legal: ["FRA Railroad Safety"],
      suggested_asset_code: ["Owner/User Program"],
      suggested_method: ["Plant Procedure"],
      suggested_personnel: ["ASNT SNT-TC-1A", "ANSI/ASNT CP-189"]
    };
  }

  /* --- True unknown: no jurisdiction hint either --- */
  return {
    used: true,
    note: "Asset class not recognized by deterministic rule base or jurisdiction-based inference. Governance could not be resolved with confidence. Recommend: (1) provide more specific asset description, (2) manually select asset class, or (3) log this input for future rule base expansion.",
    suggested_legal: [],
    suggested_asset_code: ["Owner/User Program"],
    suggested_method: ["Plant Procedure"],
    suggested_personnel: ["ASNT SNT-TC-1A"]
  };
}

/* =========================================================
   MAIN ENGINE
   ========================================================= */

function runGovernanceMatrixEngine(input: GovernanceInput): GovernanceMatrixOutput {
  /* --- Check AI fallback first --- */
  var fallback = runAIFallbackStub(input);

  var legal = legalRegulatoryAuthorities(input);
  var assetCode = assetCodeAuthorities(input);
  var methodExec = methodExecutionAuthorities(input);
  var personnel = personnelQualificationAuthorities(input);
  var damageRbi = damageMechanismRbiAuthorities(input);
  var ffs = fitnessForServiceAuthorities(input);
  var ownerExec = ownerUserExecutionAuthorities(input);

  /* --- Merge AI fallback suggestions if used --- */
  if (fallback.used) {
    for (var fi = 0; fi < fallback.suggested_legal.length; fi++) {
      legal.push(fallback.suggested_legal[fi]);
    }
    for (var ai = 0; ai < fallback.suggested_asset_code.length; ai++) {
      assetCode.push(fallback.suggested_asset_code[ai]);
    }
    for (var mi = 0; mi < fallback.suggested_method.length; mi++) {
      methodExec.push(fallback.suggested_method[mi]);
    }
    for (var pi = 0; pi < fallback.suggested_personnel.length; pi++) {
      personnel.push(fallback.suggested_personnel[pi]);
    }
    legal = uniqueAuthorities(legal);
    assetCode = uniqueAuthorities(assetCode);
    methodExec = uniqueAuthorities(methodExec);
    personnel = uniqueAuthorities(personnel);
  }

  var buckets: GovernanceBucket[] = [
    { category: "legal_regulatory", authorities: legal, rationale: rationaleForCategory("legal_regulatory", input) },
    { category: "asset_code", authorities: assetCode, rationale: rationaleForCategory("asset_code", input) },
    { category: "method_execution", authorities: methodExec, rationale: rationaleForCategory("method_execution", input) },
    { category: "personnel_qualification", authorities: personnel, rationale: rationaleForCategory("personnel_qualification", input) },
    { category: "damage_mechanism_rbi", authorities: damageRbi, rationale: rationaleForCategory("damage_mechanism_rbi", input) },
    { category: "fitness_for_service", authorities: ffs, rationale: rationaleForCategory("fitness_for_service", input) },
    { category: "owner_user_execution", authorities: ownerExec, rationale: rationaleForCategory("owner_user_execution", input) }
  ];

  var flat = uniqueAuthorities(
    legal
      .concat(assetCode)
      .concat(methodExec)
      .concat(personnel)
      .concat(damageRbi)
      .concat(ffs)
      .concat(ownerExec)
  );

  return {
    engine: "Governance Matrix Engine v1",
    parsed_input: input,
    confidence: buildConfidence(input, fallback.used),
    primary_governance_path: buildPrimaryGovernancePath(input),
    governance_buckets: buckets,
    applicable_authorities_flat: flat,
    missing_governance_variables: buildMissingVariables(input),
    warnings: buildWarnings(input, fallback.used),
    ai_fallback_used: fallback.used,
    ai_fallback_note: fallback.note,
    ui_sections: {
      legal_regulatory: legal,
      asset_code: assetCode,
      method_execution: methodExec,
      personnel_qualification: personnel,
      damage_mechanism_rbi: damageRbi,
      fitness_for_service: ffs,
      owner_user_execution: ownerExec
    }
  };
}

/* =========================================================
   NETLIFY FUNCTION HANDLER
   ========================================================= */

var handler: Handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var rawText = body.raw_text || body.transcript || "";

    var assetClass: AssetClass = body.asset_class || detectAssetClass(rawText);
    var inspectionContext: InspectionContext = body.inspection_context || detectInspectionContext(rawText);
    var jurisdiction: Jurisdiction = body.jurisdiction || detectJurisdiction(rawText, assetClass);
    var serviceEnv: ServiceEnvironment[] = body.service_environment || detectServiceEnvironment(rawText);

    var input: GovernanceInput = {
      raw_text: rawText,
      asset_class: assetClass,
      inspection_context: inspectionContext,
      jurisdiction: jurisdiction,
      service_environment: serviceEnv
    };

    var result = runGovernanceMatrixEngine(input);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };
  } catch (err) {
    var errMsg = (err && typeof err === "object" && "message" in err) ? (err as any).message : "Unknown error";
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Governance Matrix Engine failed", detail: errMsg })
    };
  }
};

export { handler };
