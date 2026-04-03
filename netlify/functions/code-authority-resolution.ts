/**
 * DEPLOY75 — code-authority-resolution.ts
 * FORGED NDT Intelligence OS
 * Code Authority Resolution Engine v1
 *
 * PURPOSE: Converts broad governance context into an operational
 * authority decision tree. Resolves PRIMARY vs SUPPORTING vs
 * CONDITIONAL authority for every layer, with explicit conflict
 * detection when two authorities compete for the same role.
 *
 * ARCHITECTURE POSITION:
 *   Governance Matrix Engine v1
 *     -> Code Authority Resolution Engine v1  <-- this file
 *     -> Inspection Planning / Method Routing / Output UI
 *
 * DEPLOY NOTES:
 *   - String concatenation only (no backtick template literals)
 *   - All logic inlined (no lib/ imports)
 *   - Target: netlify/functions/code-authority-resolution.ts
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

type ResolutionReasonTag =
  | "asset_direct_match"
  | "component_family_match"
  | "service_driven_overlay"
  | "inspection_context_overlay"
  | "repair_or_alteration_overlay"
  | "scheduled_program_overlay"
  | "damage_mechanism_overlay"
  | "fitness_for_service_overlay"
  | "jurisdictional_override"
  | "project_execution_override"
  | "owner_user_override"
  | "ai_fallback_inference";

type ResolutionBucketType =
  | "supporting_asset_codes"
  | "method_execution_codes"
  | "personnel_qualification_codes"
  | "damage_mechanism_rbi_codes"
  | "fitness_for_service_codes"
  | "execution_override_codes";

interface GovernanceInput {
  raw_text: string;
  asset_class: AssetClass;
  inspection_context: InspectionContext;
  jurisdiction: Jurisdiction;
  service_environment: ServiceEnvironment[];
}

interface ResolutionItem {
  authority: AuthorityRef;
  reason_tags: ResolutionReasonTag[];
  rationale: string;
  confidence: number;
}

interface ResolutionBucket {
  bucket_type: ResolutionBucketType;
  title: string;
  items: ResolutionItem[];
}

interface AuthorityConflict {
  layer: string;
  competing_authorities: AuthorityRef[];
  resolution: string;
  resolved_primary: AuthorityRef | null;
}

interface CodeAuthorityResolutionOutput {
  engine: "Code Authority Resolution Engine v1";
  parsed_input: GovernanceInput;
  confidence: number;
  primary_code_path: string;
  primary_asset_code: ResolutionItem | null;
  resolution_buckets: ResolutionBucket[];
  execution_order: {
    step: number;
    label: string;
    authorities: AuthorityRef[];
  }[];
  authority_conflicts: AuthorityConflict[];
  decision_trace: string[];
  unresolved_questions: string[];
  warnings: string[];
  ai_fallback_used: boolean;
  ai_fallback_note: string | null;
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

function uniqueReasonTags(items: ResolutionReasonTag[]): ResolutionReasonTag[] {
  var seen: Record<string, boolean> = {};
  var result: ResolutionReasonTag[] = [];
  for (var i = 0; i < items.length; i++) {
    var key = items[i];
    if (!seen[key]) {
      seen[key] = true;
      result.push(items[i]);
    }
  }
  return result;
}

function hasService(services: ServiceEnvironment[], target: ServiceEnvironment): boolean {
  for (var i = 0; i < services.length; i++) {
    if (services[i] === target) return true;
  }
  return false;
}

function addOrMergeResolutionItem(
  items: ResolutionItem[],
  authority: AuthorityRef,
  reasonTags: ResolutionReasonTag[],
  rationale: string,
  confidence: number
): ResolutionItem[] {
  for (var i = 0; i < items.length; i++) {
    if (items[i].authority === authority) {
      items[i].reason_tags = uniqueReasonTags(items[i].reason_tags.concat(reasonTags));
      if (confidence > items[i].confidence) items[i].confidence = confidence;
      if (items[i].rationale.indexOf(rationale) === -1) {
        items[i].rationale = items[i].rationale + " " + rationale;
      }
      return items;
    }
  }

  items.push({
    authority: authority,
    reason_tags: uniqueReasonTags(reasonTags),
    rationale: rationale,
    confidence: confidence
  });

  return items;
}

function sortResolutionItems(items: ResolutionItem[]): ResolutionItem[] {
  return items.sort(function (a, b) {
    return b.confidence - a.confidence;
  });
}

/* =========================================================
   PARSERS (inlined — same as governance-matrix)
   ========================================================= */

function detectAssetClass(rawText: string): AssetClass {
  var t = lower(rawText);

  if (includesAny(t, ["pressure vessel", "separator", "reactor", "column", "tower", "drum"])) return "pressure_vessel";
  if (includesAny(t, ["process piping", "piping", "pipe circuit", "process piping"])) return "process_piping";
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
  if (includesAny(t, ["high temperature", "hot service"])) out.push("high_temperature");
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
   AI FALLBACK STUB FOR UNKNOWN ASSETS
   ========================================================= */

interface AIFallbackResult {
  used: boolean;
  note: string | null;
  suggested_primary: ResolutionItem | null;
}

function runAIFallbackStub(input: GovernanceInput): AIFallbackResult {
  if (input.asset_class !== "unknown_asset") {
    return { used: false, note: null, suggested_primary: null };
  }

  var t = lower(input.raw_text);

  if (input.jurisdiction === "us_aviation" || includesAny(t, ["aircraft", "airplane", "aviation", "747", "737", "a320", "fuselage", "wing", "empennage", "landing gear"])) {
    return {
      used: true,
      note: "Asset not in deterministic registry. AI fallback inferred aviation governance: FAA 14 CFR Part 43 / AC 43.13. Confidence capped at 72%.",
      suggested_primary: {
        authority: "FAA 14 CFR Part 43",
        reason_tags: ["ai_fallback_inference", "jurisdictional_override"],
        rationale: "Aviation asset governance inferred from input language. FAA airworthiness and maintenance regulations are the likely primary authority. This resolution was generated by AI fallback — verify with subject matter expert.",
        confidence: 72
      }
    };
  }

  if (input.jurisdiction === "us_nuclear" || includesAny(t, ["nuclear", "reactor vessel", "containment", "nrc"])) {
    return {
      used: true,
      note: "Asset not in deterministic registry. AI fallback inferred nuclear governance: NRC oversight. Confidence capped at 72%.",
      suggested_primary: {
        authority: "NRC Nuclear Oversight",
        reason_tags: ["ai_fallback_inference", "jurisdictional_override"],
        rationale: "Nuclear asset governance inferred from input language. NRC regulatory framework is the likely primary authority. Verify with subject matter expert.",
        confidence: 72
      }
    };
  }

  if (input.jurisdiction === "us_railroad" || includesAny(t, ["railroad", "rail car", "locomotive", "rail bridge", "rail tank"])) {
    return {
      used: true,
      note: "Asset not in deterministic registry. AI fallback inferred railroad governance: FRA. Confidence capped at 72%.",
      suggested_primary: {
        authority: "FRA Railroad Safety",
        reason_tags: ["ai_fallback_inference", "jurisdictional_override"],
        rationale: "Railroad asset governance inferred from input language. FRA safety framework is the likely primary authority. Verify with subject matter expert.",
        confidence: 72
      }
    };
  }

  return {
    used: true,
    note: "Asset class not recognized by deterministic rule base or jurisdiction inference. Primary code authority could not be resolved. Recommend providing more specific asset description or manually selecting asset class.",
    suggested_primary: null
  };
}

/* =========================================================
   PRIMARY ASSET CODE RESOLUTION
   ========================================================= */

function resolvePrimaryAssetCode(input: GovernanceInput, fallback: AIFallbackResult): ResolutionItem | null {
  var asset = input.asset_class;
  var ctx = input.inspection_context;

  if (asset === "pressure_vessel") {
    return { authority: "API 510", reason_tags: ["asset_direct_match"], rationale: "Pressure vessels in refinery/chemical in-service inspection programs are primarily routed to API 510.", confidence: 96 };
  }

  if (asset === "process_piping") {
    return { authority: "API 570", reason_tags: ["asset_direct_match"], rationale: "Process piping in refinery/chemical in-service inspection programs is primarily routed to API 570.", confidence: 96 };
  }

  if (asset === "storage_tank") {
    return { authority: "API 653", reason_tags: ["asset_direct_match"], rationale: "Aboveground storage tank inspection and integrity planning is primarily routed to API 653.", confidence: 96 };
  }

  if (asset === "heat_exchanger" || asset === "boiler" || asset === "heater") {
    return { authority: "API 510", reason_tags: ["component_family_match"], rationale: "These components are usually treated within pressure-containing fixed-equipment programs and commonly routed through API 510.", confidence: 90 };
  }

  if (asset === "refinery_process_facility" || asset === "chemical_process_facility") {
    return { authority: "Owner/User Program", reason_tags: ["owner_user_override", "component_family_match"], rationale: "Facility-level request must be decomposed into component families before final code selection; owner/user program controls the facility-level wrapper until decomposed into API 510/570/653.", confidence: 82 };
  }

  if (asset === "pipeline") {
    return { authority: "PHMSA Pipeline Safety", reason_tags: ["asset_direct_match", "jurisdictional_override"], rationale: "Pipeline inspection and integrity governance is primarily routed through PHMSA-regulated pipeline safety frameworks.", confidence: 94 };
  }

  if (asset === "offshore_fixed_platform") {
    return { authority: "API RP 2A", reason_tags: ["asset_direct_match"], rationale: "Fixed offshore structural inspection is primarily routed through API RP 2A, with BSEE as primary regulator and USCG retaining OCS framework authority.", confidence: 90 };
  }

  if (asset === "offshore_floating_facility") {
    return { authority: "USCG OCS / Marine Oversight", reason_tags: ["jurisdictional_override"], rationale: "Floating offshore facilities require split governance: USCG for marine/vessel systems, BSEE for safety/operational systems. Route first through marine oversight before subsystem resolution.", confidence: 86 };
  }

  if (asset === "offshore_renewable_facility") {
    return { authority: "BOEM Renewable Energy Oversight", reason_tags: ["jurisdictional_override"], rationale: "Offshore renewable energy facilities are primarily governed by BOEM for leasing, siting, and environmental review, with BSEE responsible for technical standards and enforcement.", confidence: 84 };
  }

  if (asset === "bridge_civil_structure") {
    return { authority: "FHWA Bridge Inspection Manual", reason_tags: ["jurisdictional_override"], rationale: "Bridge inspection logic routes through bridge program oversight and owner-agency frameworks.", confidence: 90 };
  }

  if (asset === "structural_steel") {
    return { authority: "AWS D1.1", reason_tags: ["asset_direct_match"], rationale: "Structural steel inspection commonly routes to AWS D1.1 when welded steel condition or fabrication is central.", confidence: 88 };
  }

  if (ctx === "new_build_fabrication") {
    return { authority: "Project ITP", reason_tags: ["project_execution_override"], rationale: "New-build execution is often controlled first by project ITP and code-required hold points.", confidence: 76 };
  }

  /* --- AI fallback primary --- */
  if (fallback.used && fallback.suggested_primary) {
    return fallback.suggested_primary;
  }

  return null;
}

/* =========================================================
   SUPPORTING ASSET CODE RESOLUTION
   ========================================================= */

function resolveSupportingAssetCodes(input: GovernanceInput): ResolutionItem[] {
  var items: ResolutionItem[] = [];
  var asset = input.asset_class;
  var ctx = input.inspection_context;

  if (asset === "pressure_vessel") {
    items = addOrMergeResolutionItem(items, "ASME Section VIII", ["component_family_match"], "Pressure vessel design/construction lineage remains relevant for in-service interpretation.", 85);
    items = addOrMergeResolutionItem(items, "NBIC / NB-23", ["jurisdictional_override"], "Jurisdictional pressure equipment or repair contexts may trigger NBIC involvement.", 70);
  }

  if (asset === "process_piping") {
    items = addOrMergeResolutionItem(items, "ASME B31.3", ["component_family_match"], "Process piping design/construction lineage remains relevant in inspection and repair interpretation.", 86);
  }

  if (asset === "storage_tank") {
    items = addOrMergeResolutionItem(items, "Owner/User Program", ["owner_user_override"], "Tank program execution commonly depends on owner/user scope definition and history.", 78);
  }

  if (asset === "refinery_process_facility" || asset === "chemical_process_facility") {
    items = addOrMergeResolutionItem(items, "API 510", ["component_family_match"], "Facility scope usually contains pressure-containing fixed equipment governed under API 510.", 88);
    items = addOrMergeResolutionItem(items, "API 570", ["component_family_match"], "Facility scope usually contains process piping governed under API 570.", 88);
    items = addOrMergeResolutionItem(items, "API 653", ["component_family_match"], "Facility scope may include tanks governed under API 653.", 82);
    items = addOrMergeResolutionItem(items, "ASME Section VIII", ["component_family_match"], "Pressure-equipment supporting design basis may still matter.", 78);
    items = addOrMergeResolutionItem(items, "ASME B31.3", ["component_family_match"], "Process piping supporting design basis may still matter.", 78);
  }

  if (asset === "offshore_fixed_platform") {
    items = addOrMergeResolutionItem(items, "BSEE 30 CFR Part 250", ["jurisdictional_override"], "BSEE regulatory framework overlays structural standards for offshore fixed platforms.", 86);
    items = addOrMergeResolutionItem(items, "USCG OCS / Marine Oversight", ["jurisdictional_override"], "USCG retains OCS framework authority for fixed platforms alongside BSEE.", 80);
  }

  if (asset === "offshore_floating_facility") {
    items = addOrMergeResolutionItem(items, "BSEE 30 CFR Part 250", ["jurisdictional_override"], "BSEE governs offshore safety and operational aspects for floating facilities.", 82);
  }

  if (asset === "offshore_renewable_facility") {
    items = addOrMergeResolutionItem(items, "BSEE Technical Compliance", ["jurisdictional_override"], "BSEE provides technical standards and enforcement for offshore renewable facilities.", 84);
  }

  if (asset === "bridge_civil_structure") {
    items = addOrMergeResolutionItem(items, "NBIS 23 CFR 650", ["jurisdictional_override"], "Bridge inspection programs are governed by federal bridge inspection program requirements.", 88);
    items = addOrMergeResolutionItem(items, "AASHTO LRFD Bridge Design", ["component_family_match"], "Design basis may inform engineering interpretation in damage/repair contexts.", 74);
  }

  if (asset === "structural_steel") {
    items = addOrMergeResolutionItem(items, "Engineer of Record", ["project_execution_override"], "Structural steel repair and interpretation may require engineer-of-record control.", 76);
  }

  if (ctx === "repair_alteration") {
    items = addOrMergeResolutionItem(items, "ASME Section IX", ["repair_or_alteration_overlay"], "Repair/alteration activities may activate welding qualification requirements.", 84);
  }

  return sortResolutionItems(items);
}

/* =========================================================
   METHOD EXECUTION AUTHORITY
   ========================================================= */

function resolveMethodExecutionCodes(input: GovernanceInput): ResolutionItem[] {
  var items: ResolutionItem[] = [];
  var asset = input.asset_class;
  var ctx = input.inspection_context;

  if (
    asset === "pressure_vessel" ||
    asset === "process_piping" ||
    asset === "storage_tank" ||
    asset === "heat_exchanger" ||
    asset === "boiler" ||
    asset === "heater" ||
    asset === "refinery_process_facility" ||
    asset === "chemical_process_facility" ||
    asset === "offshore_fixed_platform" ||
    asset === "offshore_floating_facility" ||
    asset === "offshore_renewable_facility"
  ) {
    items = addOrMergeResolutionItem(items, "ASME Section V", ["component_family_match"], "NDT method execution for pressure-boundary and industrial applications is commonly routed through ASME Section V.", 92);
  }

  items = addOrMergeResolutionItem(items, "Plant Procedure", ["owner_user_override"], "Actual execution often depends on site-approved procedures, work instructions, and project controls.", 90);

  if (ctx === "new_build_fabrication" || ctx === "repair_alteration") {
    items = addOrMergeResolutionItem(items, "Project ITP", ["project_execution_override"], "Project ITP or repair package may control method timing, hold points, and documentation sequence.", 82);
  }

  if (asset === "bridge_civil_structure" || asset === "structural_steel") {
    items = addOrMergeResolutionItem(items, "Engineer of Record", ["project_execution_override"], "Civil/structural inspection execution may depend on engineer-of-record and owner-agency procedures.", 80);
  }

  return sortResolutionItems(items);
}

/* =========================================================
   PERSONNEL QUALIFICATION AUTHORITY
   ========================================================= */

function resolvePersonnelQualificationCodes(input: GovernanceInput): ResolutionItem[] {
  var items: ResolutionItem[] = [];

  items = addOrMergeResolutionItem(items, "ASNT SNT-TC-1A", ["asset_direct_match"], "Employer-based NDT qualification is commonly structured around SNT-TC-1A.", 90);
  items = addOrMergeResolutionItem(items, "ANSI/ASNT CP-189", ["asset_direct_match"], "Some employers, contracts, or programs use CP-189 qualification requirements.", 88);

  if (input.inspection_context === "repair_alteration" || input.inspection_context === "new_build_fabrication") {
    items = addOrMergeResolutionItem(items, "ASME Section IX", ["repair_or_alteration_overlay"], "Welding-related qualification requirements may activate for repairs or alterations.", 80);
  }

  if (input.jurisdiction === "us_aviation") {
    items = addOrMergeResolutionItem(items, "FAA 14 CFR Part 43", ["jurisdictional_override"], "Aviation NDT personnel qualification is controlled under FAA regulatory framework.", 88);
  }

  return sortResolutionItems(items);
}

/* =========================================================
   DAMAGE MECHANISM / RBI AUTHORITY
   ========================================================= */

function resolveDamageMechanismRbiCodes(input: GovernanceInput): ResolutionItem[] {
  var items: ResolutionItem[] = [];
  var asset = input.asset_class;

  if (
    asset === "pressure_vessel" ||
    asset === "process_piping" ||
    asset === "storage_tank" ||
    asset === "heat_exchanger" ||
    asset === "boiler" ||
    asset === "heater" ||
    asset === "refinery_process_facility" ||
    asset === "chemical_process_facility"
  ) {
    items = addOrMergeResolutionItem(items, "API 571", ["damage_mechanism_overlay"], "Refinery and chemical equipment degradation screening should reference fixed-equipment damage mechanisms.", 90);
    items = addOrMergeResolutionItem(items, "API 580", ["scheduled_program_overlay"], "Risk-based inspection program structure is commonly governed through API 580 concepts.", 86);
    items = addOrMergeResolutionItem(items, "API 581", ["scheduled_program_overlay"], "Quantitative/semi-quantitative RBI support may reference API 581 methods.", 82);
  }

  if (asset === "offshore_fixed_platform" || asset === "offshore_floating_facility" || asset === "offshore_renewable_facility") {
    items = addOrMergeResolutionItem(items, "API RP 2A", ["damage_mechanism_overlay"], "Offshore structural degradation and assessment logic may reference offshore structural platform standards.", 82);
  }

  if (hasService(input.service_environment, "high_temperature")) {
    items = addOrMergeResolutionItem(items, "API 571", ["service_driven_overlay"], "High-temperature service strengthens the need for damage mechanism-based screening.", 92);
  }

  if (hasService(input.service_environment, "sour_service")) {
    items = addOrMergeResolutionItem(items, "API 571", ["service_driven_overlay"], "Sour service strengthens the need for fixed-equipment damage mechanism review.", 92);
  }

  if (hasService(input.service_environment, "hydrogen_service")) {
    items = addOrMergeResolutionItem(items, "API 571", ["service_driven_overlay"], "Hydrogen service strengthens the need for mechanism-based screening and escalation logic.", 92);
  }

  if (hasService(input.service_environment, "insulated_service")) {
    items = addOrMergeResolutionItem(items, "API 571", ["service_driven_overlay"], "Insulated service strengthens the need for degradation logic such as CUI screening.", 90);
  }

  return sortResolutionItems(items);
}

/* =========================================================
   FITNESS-FOR-SERVICE AUTHORITY
   ========================================================= */

function resolveFitnessForServiceCodes(input: GovernanceInput): ResolutionItem[] {
  var items: ResolutionItem[] = [];
  var asset = input.asset_class;
  var ctx = input.inspection_context;

  if (
    asset === "pressure_vessel" ||
    asset === "process_piping" ||
    asset === "storage_tank" ||
    asset === "heat_exchanger" ||
    asset === "boiler" ||
    asset === "heater" ||
    asset === "refinery_process_facility" ||
    asset === "chemical_process_facility"
  ) {
    items = addOrMergeResolutionItem(items, "API 579-1/ASME FFS-1", ["fitness_for_service_overlay"], "When damage is found and engineering assessment beyond routine inspection is required, FFS logic may activate.", 88);
  }

  if (ctx === "condition_driven" || ctx === "event_driven") {
    items = addOrMergeResolutionItem(items, "API 579-1/ASME FFS-1", ["fitness_for_service_overlay"], "Condition/event-driven findings may trigger engineering assessment if continued service is in question.", 84);
  }

  if (asset === "bridge_civil_structure" || asset === "structural_steel" || asset === "offshore_fixed_platform" || asset === "offshore_renewable_facility") {
    items = addOrMergeResolutionItem(items, "Engineer of Record", ["jurisdictional_override"], "Engineering evaluation authority may shift to engineer-of-record when damage significance must be assessed.", 84);
  }

  return sortResolutionItems(items);
}

/* =========================================================
   EXECUTION OVERRIDE AUTHORITY
   ========================================================= */

function resolveExecutionOverrideCodes(input: GovernanceInput): ResolutionItem[] {
  var items: ResolutionItem[] = [];

  items = addOrMergeResolutionItem(items, "Owner/User Program", ["owner_user_override"], "Owner/user programs often control actual inspection scope split, interval basis, and execution logic.", 92);
  items = addOrMergeResolutionItem(items, "Plant Procedure", ["owner_user_override"], "Plant-approved procedures often govern practical execution, reporting, and acceptance workflow.", 90);

  if (input.inspection_context === "new_build_fabrication" || input.inspection_context === "repair_alteration") {
    items = addOrMergeResolutionItem(items, "Project ITP", ["project_execution_override"], "Project or repair package controls may override generic routing for execution sequence and hold points.", 86);
  }

  if (input.asset_class === "bridge_civil_structure" || input.asset_class === "structural_steel") {
    items = addOrMergeResolutionItem(items, "Engineer of Record", ["project_execution_override"], "Structural/civil interpretation and execution may require explicit engineer-of-record control.", 88);
  }

  if (input.asset_class === "pressure_vessel" || input.asset_class === "boiler") {
    items = addOrMergeResolutionItem(items, "Jurisdictional Authority", ["jurisdictional_override"], "Pressure equipment may be subject to jurisdictional inspection or repair requirements.", 78);
    items = addOrMergeResolutionItem(items, "NBIC / NB-23", ["jurisdictional_override"], "NBIC may apply where jurisdictional pressure-retaining item repair or inspection rules are in force.", 76);
  }

  return sortResolutionItems(items);
}

/* =========================================================
   CONFLICT DETECTION ENGINE
   ---------------------------------------------------------
   Scans resolution results for cases where two or more
   authorities compete for the same governance role.
   ========================================================= */

function detectAuthorityConflicts(
  input: GovernanceInput,
  primary: ResolutionItem | null,
  buckets: ResolutionBucket[]
): AuthorityConflict[] {
  var conflicts: AuthorityConflict[] = [];

  /* --- Offshore fixed: BSEE vs USCG --- */
  if (input.asset_class === "offshore_fixed_platform") {
    conflicts.push({
      layer: "legal_regulatory",
      competing_authorities: ["BSEE 30 CFR Part 250", "USCG OCS / Marine Oversight"],
      resolution: "BSEE is the primary regulatory authority for offshore fixed platforms on the U.S. OCS. USCG retains authority within the OCS framework for certain safety, environmental, and marine functions. Both apply but BSEE leads.",
      resolved_primary: "BSEE 30 CFR Part 250"
    });
  }

  /* --- Offshore floating: USCG vs BSEE split --- */
  if (input.asset_class === "offshore_floating_facility") {
    conflicts.push({
      layer: "legal_regulatory",
      competing_authorities: ["USCG OCS / Marine Oversight", "BSEE 30 CFR Part 250"],
      resolution: "Floating facilities have split authority: USCG governs marine/vessel systems, BSEE governs safety/operational systems. Authority depends on which system is being inspected.",
      resolved_primary: null
    });
  }

  /* --- Offshore renewable: BOEM vs BSEE --- */
  if (input.asset_class === "offshore_renewable_facility") {
    conflicts.push({
      layer: "legal_regulatory",
      competing_authorities: ["BOEM Renewable Energy Oversight", "BSEE Technical Compliance"],
      resolution: "BOEM is primary for leasing, siting, and environmental review. BSEE is responsible for technical standards, safety compliance, and enforcement. Both apply in different capacities.",
      resolved_primary: "BOEM Renewable Energy Oversight"
    });
  }

  /* --- Facility-level: API 510 vs 570 vs 653 --- */
  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    conflicts.push({
      layer: "primary_asset_code",
      competing_authorities: ["API 510", "API 570", "API 653"],
      resolution: "Facility-level scope cannot be governed by a single asset code. Must decompose into component families: pressure equipment (API 510), piping (API 570), tanks (API 653). Owner/User Program acts as the controlling wrapper until decomposition occurs.",
      resolved_primary: "Owner/User Program"
    });
  }

  /* --- Pressure vessel: API 510 vs NBIC/NB-23 --- */
  if (input.asset_class === "pressure_vessel" || input.asset_class === "boiler") {
    conflicts.push({
      layer: "asset_code_vs_jurisdictional",
      competing_authorities: ["API 510", "NBIC / NB-23"],
      resolution: "API 510 is typically the in-service inspection code. NBIC may apply as a jurisdictional override when the asset is under state or local jurisdictional authority. In jurisdictional conflict, the jurisdiction typically prevails for repair/alteration.",
      resolved_primary: "API 510"
    });
  }

  /* --- Personnel: SNT-TC-1A vs CP-189 --- */
  conflicts.push({
    layer: "personnel_qualification",
    competing_authorities: ["ASNT SNT-TC-1A", "ANSI/ASNT CP-189"],
    resolution: "SNT-TC-1A is the more common employer-based qualification framework. CP-189 may be required by specific contracts, codes, or employer programs. The applicable standard depends on the employer written practice and contract requirements.",
    resolved_primary: "ASNT SNT-TC-1A"
  });

  /* --- Bridge: FHWA vs AASHTO vs owner agency --- */
  if (input.asset_class === "bridge_civil_structure") {
    conflicts.push({
      layer: "asset_code",
      competing_authorities: ["FHWA Bridge Inspection Manual", "AASHTO LRFD Bridge Design", "NBIS 23 CFR 650"],
      resolution: "NBIS provides the federal mandate. FHWA provides implementation guidance. AASHTO provides the engineering design basis. The owner agency controls execution. All three layers coexist rather than compete.",
      resolved_primary: "NBIS 23 CFR 650"
    });
  }

  return conflicts;
}

/* =========================================================
   RESOLUTION BUCKET BUILDER
   ========================================================= */

function buildResolutionBucket(
  bucketType: ResolutionBucketType,
  title: string,
  items: ResolutionItem[]
): ResolutionBucket {
  return { bucket_type: bucketType, title: title, items: sortResolutionItems(items) };
}

/* =========================================================
   PRIMARY CODE PATH
   ========================================================= */

function buildPrimaryCodePath(primary: ResolutionItem | null, input: GovernanceInput): string {
  if (!primary) {
    return "Primary code path unresolved; more asset/component detail required.";
  }

  if (primary.authority === "Owner/User Program" && (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility")) {
    return "Facility-level scope -> decompose into asset families -> API 510 / 570 / 653 as applicable -> ASME Section V for method execution -> ASNT qualification -> API 571 / 580 / 581 overlays -> API 579 if escalation required.";
  }

  if (primary.authority === "API 510") {
    return "API 510 primary -> ASME Section VIII supporting -> ASME Section V method execution -> ASNT qualification -> API 571 / 580 / 581 overlays -> API 579 if degradation escalates.";
  }

  if (primary.authority === "API 570") {
    return "API 570 primary -> ASME B31.3 supporting -> ASME Section V method execution -> ASNT qualification -> API 571 / 580 / 581 overlays -> API 579 if degradation escalates.";
  }

  if (primary.authority === "API 653") {
    return "API 653 primary -> ASME Section V / approved tank methods -> ASNT qualification -> API 580 / 581 overlays -> API 579 if escalation needed.";
  }

  if (primary.authority === "API RP 2A") {
    return "API RP 2A primary -> BSEE + USCG OCS regulatory oversight -> approved NDT execution procedures -> ASNT qualification -> owner/operator integrity execution.";
  }

  if (primary.authority === "PHMSA Pipeline Safety") {
    return "PHMSA regulatory path -> operator integrity framework -> approved method execution -> qualification / operator requirements -> integrity escalation logic.";
  }

  if (primary.authority === "FHWA Bridge Inspection Manual") {
    return "Bridge oversight path -> owner/agency inspection framework -> project/agency method control -> engineer-of-record escalation as needed.";
  }

  if (primary.authority === "BOEM Renewable Energy Oversight") {
    return "BOEM primary (leasing/siting) + BSEE (technical/enforcement) -> facility structural framework -> NDT execution standard -> personnel qualification -> operator execution.";
  }

  if (primary.authority === "USCG OCS / Marine Oversight") {
    return "USCG marine oversight + BSEE safety/operations -> split by system type -> approved NDT execution -> personnel qualification -> owner/operator execution.";
  }

  if (primary.authority === "FAA 14 CFR Part 43") {
    return "FAA airworthiness framework -> approved maintenance/inspection procedures -> FAA A&P / IA qualification -> operator maintenance program execution.";
  }

  if (primary.authority === "NRC Nuclear Oversight") {
    return "NRC regulatory framework -> ASME Section XI ISI requirements -> approved NDT execution -> personnel qualification -> licensee program execution.";
  }

  if (primary.authority === "FRA Railroad Safety") {
    return "FRA regulatory framework -> railroad inspection requirements -> approved NDT execution -> qualification requirements -> operator program execution.";
  }

  return primary.authority + " primary -> supporting codes and execution controls resolved by context.";
}

/* =========================================================
   EXECUTION ORDER
   ========================================================= */

function buildExecutionOrder(
  primary: ResolutionItem | null,
  buckets: ResolutionBucket[]
): { step: number; label: string; authorities: AuthorityRef[] }[] {
  function authoritiesFromBucket(type: ResolutionBucketType): AuthorityRef[] {
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].bucket_type === type) {
        return uniqueAuthorities(
          buckets[i].items.map(function (item) { return item.authority; })
        );
      }
    }
    return [];
  }

  var step1: AuthorityRef[] = primary ? [primary.authority] : [];

  return [
    { step: 1, label: "Resolve primary asset code", authorities: step1 },
    { step: 2, label: "Load supporting asset code family", authorities: authoritiesFromBucket("supporting_asset_codes") },
    { step: 3, label: "Load NDT execution authority", authorities: authoritiesFromBucket("method_execution_codes") },
    { step: 4, label: "Load personnel qualification requirements", authorities: authoritiesFromBucket("personnel_qualification_codes") },
    { step: 5, label: "Load damage mechanism / RBI overlays", authorities: authoritiesFromBucket("damage_mechanism_rbi_codes") },
    { step: 6, label: "Load FFS escalation path", authorities: authoritiesFromBucket("fitness_for_service_codes") },
    { step: 7, label: "Apply owner/user / project / jurisdiction overrides", authorities: authoritiesFromBucket("execution_override_codes") }
  ];
}

/* =========================================================
   DECISION TRACE / WARNINGS / QUESTIONS / CONFIDENCE
   ========================================================= */

function buildDecisionTrace(input: GovernanceInput, primary: ResolutionItem | null, fallback: AIFallbackResult): string[] {
  var out: string[] = [];

  out.push("Asset class detected as " + input.asset_class + ".");
  out.push("Inspection context detected as " + input.inspection_context + ".");
  out.push("Jurisdiction resolved as " + input.jurisdiction + ".");

  if (primary) {
    out.push("Primary asset code resolved to " + primary.authority + ".");
    out.push("Primary resolution rationale: " + primary.rationale);
  } else {
    out.push("Primary asset code could not be resolved with high confidence.");
  }

  if (fallback.used) {
    out.push("AI FALLBACK ACTIVATED: " + (fallback.note || "Unknown asset class triggered fallback resolution."));
  }

  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    out.push("Facility-level requests require component decomposition before final code-family lock.");
  }

  if (input.inspection_context === "repair_alteration") {
    out.push("Repair/alteration context activates welding qualification and project/package control overlays.");
  }

  if (input.asset_class === "offshore_fixed_platform") {
    out.push("Offshore fixed platform: BSEE is primary regulator; USCG retains OCS framework authority.");
  }

  if (input.asset_class === "offshore_floating_facility") {
    out.push("Floating facility: USCG and BSEE have split authority by system type and facility classification.");
  }

  if (input.asset_class === "offshore_renewable_facility") {
    out.push("Offshore renewable: BOEM primary for leasing/siting; BSEE for technical/enforcement.");
  }

  if (
    hasService(input.service_environment, "sour_service") ||
    hasService(input.service_environment, "hydrogen_service") ||
    hasService(input.service_environment, "high_temperature") ||
    hasService(input.service_environment, "insulated_service")
  ) {
    out.push("Service environment activates stronger damage mechanism and escalation overlays.");
  }

  return out;
}

function buildUnresolvedQuestions(input: GovernanceInput, primary: ResolutionItem | null): string[] {
  var out: string[] = [];

  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    out.push("Should the facility scope be decomposed into pressure vessels, piping, tanks, exchangers, and structural items before final code lock?");
  }

  if (input.asset_class === "unknown_asset") out.push("What is the exact asset type?");
  if (input.inspection_context === "unknown_context") out.push("Is this scheduled work, new build, repair/alteration, event-driven, or condition-driven?");
  if (input.jurisdiction === "unknown") out.push("What jurisdiction or regulatory environment applies?");
  if (input.service_environment.length === 1 && input.service_environment[0] === "unknown_service") out.push("What service environment applies to the asset?");

  if (primary && primary.authority === "Owner/User Program") {
    out.push("Which component family is actually in scope first: API 510, API 570, or API 653?");
  }

  if (input.asset_class === "offshore_floating_facility") {
    out.push("Is the scope structural, marine systems, production systems, or mixed?");
  }

  if (input.asset_class === "offshore_renewable_facility") {
    out.push("What specific renewable asset subtype is in scope: wind turbine foundation, subsea cable, transition piece, tower, nacelle?");
  }

  if (input.asset_class === "bridge_civil_structure") {
    out.push("What owner agency or bridge inspection program controls this asset?");
  }

  return out;
}

function buildWarnings(input: GovernanceInput, fallback: AIFallbackResult): string[] {
  var out: string[] = [];

  out.push("This engine resolves likely code authority paths and does not replace owner/user procedures, jurisdiction-specific requirements, or certified engineering judgment.");
  out.push("Primary asset code resolution may still require component-level decomposition when the request is facility-wide.");

  if (input.asset_class === "refinery_process_facility" || input.asset_class === "chemical_process_facility") {
    out.push("Refinery/chemical governance usually requires splitting facility scope across multiple code families.");
  }

  if (input.asset_class === "offshore_floating_facility") {
    out.push("Floating offshore facilities may require split authority paths rather than one unified code family.");
  }

  if (input.asset_class === "offshore_renewable_facility") {
    out.push("Offshore renewable regulatory framework is still evolving. BOEM and BSEE roles may shift as new rules are finalized.");
  }

  if (fallback.used) {
    out.push("WARNING: Asset class was not recognized by deterministic rule base. Resolution used AI fallback inference. Verify output with subject matter expert.");
  }

  return out;
}

function buildConfidence(input: GovernanceInput, primary: ResolutionItem | null, fallback: AIFallbackResult): number {
  var score = 60;

  if (input.asset_class !== "unknown_asset") score += 12;
  if (input.inspection_context !== "unknown_context") score += 8;
  if (input.jurisdiction !== "unknown") score += 8;
  if (input.service_environment.length > 0 && input.service_environment[0] !== "unknown_service") score += 4;
  if (primary) score += 6;

  if (fallback.used) {
    if (score > 75) score = 75;
  } else {
    if (score > 96) score = 96;
  }

  return score;
}

/* =========================================================
   MAIN ENGINE
   ========================================================= */

function runCodeAuthorityResolutionEngine(input: GovernanceInput): CodeAuthorityResolutionOutput {
  var fallback = runAIFallbackStub(input);
  var primary = resolvePrimaryAssetCode(input, fallback);

  var supporting = resolveSupportingAssetCodes(input);
  var methodExec = resolveMethodExecutionCodes(input);
  var personnel = resolvePersonnelQualificationCodes(input);
  var dmg = resolveDamageMechanismRbiCodes(input);
  var ffs = resolveFitnessForServiceCodes(input);
  var execOverrides = resolveExecutionOverrideCodes(input);

  var buckets: ResolutionBucket[] = [
    buildResolutionBucket("supporting_asset_codes", "Supporting Asset Codes", supporting),
    buildResolutionBucket("method_execution_codes", "Method Execution Authority", methodExec),
    buildResolutionBucket("personnel_qualification_codes", "Personnel Qualification Authority", personnel),
    buildResolutionBucket("damage_mechanism_rbi_codes", "Damage Mechanism / RBI Authority", dmg),
    buildResolutionBucket("fitness_for_service_codes", "Fitness-for-Service Escalation", ffs),
    buildResolutionBucket("execution_override_codes", "Execution Overrides", execOverrides)
  ];

  var authorityConflicts = detectAuthorityConflicts(input, primary, buckets);

  return {
    engine: "Code Authority Resolution Engine v1",
    parsed_input: input,
    confidence: buildConfidence(input, primary, fallback),
    primary_code_path: buildPrimaryCodePath(primary, input),
    primary_asset_code: primary,
    resolution_buckets: buckets,
    execution_order: buildExecutionOrder(primary, buckets),
    authority_conflicts: authorityConflicts,
    decision_trace: buildDecisionTrace(input, primary, fallback),
    unresolved_questions: buildUnresolvedQuestions(input, primary),
    warnings: buildWarnings(input, fallback),
    ai_fallback_used: fallback.used,
    ai_fallback_note: fallback.note
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

    var result = runCodeAuthorityResolutionEngine(input);

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
      body: JSON.stringify({ error: "Code Authority Resolution Engine failed", detail: errMsg })
    };
  }
};

export { handler };
