/**
 * GLOBAL AUTHORITY ENGINE v2.0.0
 * FORGED 4D NDT Intelligence OS
 *
 * Prevents the platform from applying the wrong code, standard, or regulatory
 * authority when inspections occur across different countries, offshore regions,
 * class societies, owner-user programs, or company specifications.
 *
 * Modules:
 *   1. Jurisdiction Resolver — detects asset location and maps to regulatory domain
 *   2. Global Authority Matrix — which codes govern in which jurisdictions
 *   3. Standard Equivalency Table — crosswalk between US and foreign standards
 *   4. Authority Hard Locks — prevents wrong-code application
 *   5. Live Authority Verification Agent — AI-3 hook for real-time code search
 *   6. Audit Trace — full decision provenance for every authority resolution
 *   7. Inspector Messages — human-readable explanations for field personnel
 *
 * Engine: global-authority-engine
 * Version: 2.0.0
 * Input: POST { asset_type, jurisdiction, component_type, service_environment, ... }
 * Output: { authority_resolution, crosswalk, unit_system, inspector_message, audit_trace }
 */

import { Handler } from "@netlify/functions";

// ============================================================
// JURISDICTION RESOLVER — maps location strings to regulatory domains
// ============================================================
interface JurisdictionEntry {
  codes: string[];
  region: string;
  note: string;
  regulatory_body: string;
  class_society?: string[];
  unit_system: "Metric" | "Imperial" | "Mixed";
}

const JURISDICTION_REGISTRY: Record<string, JurisdictionEntry> = {
  canada: {
    codes: ["CSA Z662", "CSA B51", "CSA W59", "CSA Z245.1"],
    region: "Canada",
    note: "Canadian Standards Association primary; API supplemental only if adopted by owner",
    regulatory_body: "TSSA / ABSA / provincial authorities",
    unit_system: "Metric"
  },
  alberta: {
    codes: ["CSA Z662", "ABSA", "CSA B51"],
    region: "Canada/Alberta",
    note: "Alberta Boilers Safety Association + CSA standards govern",
    regulatory_body: "ABSA",
    unit_system: "Metric"
  },
  germany: {
    codes: ["PED 2014/68/EU", "EN 13445", "AD 2000 Merkblätter", "BetrSichV"],
    region: "EU/Germany",
    note: "Pressure Equipment Directive + EN harmonized standards; TÜV oversight",
    regulatory_body: "TÜV / ZÜS / BAM",
    class_society: ["DNV", "Lloyd's", "Bureau Veritas"],
    unit_system: "Metric"
  },
  eu: {
    codes: ["PED 2014/68/EU", "EN 13445", "EN 12952", "EN 13480"],
    region: "European Union",
    note: "PED + EN harmonized standards govern; ASME not primary; CE marking required",
    regulatory_body: "Notified Bodies (NB) per member state",
    class_society: ["DNV", "Lloyd's", "Bureau Veritas", "TÜV"],
    unit_system: "Metric"
  },
  uk: {
    codes: ["BS EN 1090", "BS 7910", "PER 1999", "PSSR 2000"],
    region: "United Kingdom",
    note: "BS EN Eurocodes + Pressure Equipment Regulations post-Brexit; UKCA marking",
    regulatory_body: "HSE / Competent Authority",
    class_society: ["Lloyd's Register", "DNV"],
    unit_system: "Metric"
  },
  australia: {
    codes: ["AS/NZS 3788", "AS 4458", "AS 2885", "AS 1210"],
    region: "Australia/New Zealand",
    note: "Australian/NZ Standards govern; state WorkSafe authorities",
    regulatory_body: "WorkSafe / state regulators",
    class_society: ["Lloyd's", "DNV", "Bureau Veritas"],
    unit_system: "Metric"
  },
  norway: {
    codes: ["NORSOK M-001", "NORSOK M-501", "DNV-OS-F101", "DNV-ST-F101"],
    region: "Norway",
    note: "NORSOK standards + DNV rules govern offshore; PSA regulatory oversight",
    regulatory_body: "Petroleumstilsynet (PSA)",
    class_society: ["DNV"],
    unit_system: "Metric"
  },
  brazil: {
    codes: ["NR-13", "ABNT NBR 15749", "ABNT NBR 14842"],
    region: "Brazil",
    note: "NR-13 regulatory + ABNT national standards; ANP for oil & gas",
    regulatory_body: "MTE / ANP / INMETRO",
    class_society: ["DNV", "Bureau Veritas", "ABS"],
    unit_system: "Metric"
  },
  japan: {
    codes: ["JIS B 8265", "JIS B 8266", "METI High Pressure Gas Safety Act"],
    region: "Japan",
    note: "JIS standards + METI regulations; KHK certification required",
    regulatory_body: "METI / KHK",
    class_society: ["ClassNK", "DNV"],
    unit_system: "Metric"
  },
  singapore: {
    codes: ["SS CP 79", "WSH Act", "SS 531"],
    region: "Singapore",
    note: "Singapore Standards + Workplace Safety & Health regulations",
    regulatory_body: "MOM / WSH Council",
    class_society: ["ABS", "Lloyd's", "DNV", "Bureau Veritas"],
    unit_system: "Metric"
  },
  middle_east: {
    codes: ["ARAMCO Standards", "ADNOC Standards", "QP Standards"],
    region: "Middle East",
    note: "Owner/national standards often adopt API with modifications; verify per owner spec",
    regulatory_body: "Owner engineering authority",
    class_society: ["ABS", "Lloyd's", "DNV"],
    unit_system: "Mixed"
  },
  korea: {
    codes: ["KGS FP 111", "KOSHA", "KS B 6750"],
    region: "South Korea",
    note: "Korean Gas Safety + occupational safety standards; KGS certification",
    regulatory_body: "KGS / KOSHA / MOTIE",
    class_society: ["Korean Register", "DNV"],
    unit_system: "Metric"
  },
  india: {
    codes: ["IS 2825", "IBR 1950", "OISD Standards", "IS 803"],
    region: "India",
    note: "Indian Boiler Regulations + OISD for petroleum; state-level boiler inspectorates",
    regulatory_body: "DIPP / State Boiler Directorate / OISD",
    class_society: ["Indian Register of Shipping", "DNV", "Lloyd's"],
    unit_system: "Metric"
  },
  china: {
    codes: ["GB 150", "GB/T 20801", "TSG 21"],
    region: "China",
    note: "GB national standards govern; SAMR/TSG regulatory; no foreign code primary",
    regulatory_body: "SAMR / Provincial MSA",
    class_society: ["CCS", "DNV", "Lloyd's"],
    unit_system: "Metric"
  },
  offshore_international: {
    codes: ["MODU Code", "SOLAS", "ISM Code"],
    region: "International Waters",
    note: "Flag state + classification society rules govern; IMO conventions apply",
    regulatory_body: "Flag State / IMO",
    class_society: ["ABS", "DNV", "Lloyd's", "Bureau Veritas", "ClassNK"],
    unit_system: "Metric"
  }
};

// US-equivalent jurisdictions — these do NOT trigger mismatch
const US_JURISDICTION_PATTERN = /^(us|usa|united_states|domestic|refinery|petrochemical|chemical_plant|offshore_gulf_of_mexico|gulf_of_mexico|offshore_us|alaska|hawaii|continental_us)$/;

// ============================================================
// GLOBAL AUTHORITY MATRIX — which US codes apply where
// ============================================================
interface CrosswalkEntry {
  equivalent: string;
  equivalence_type: "FULL" | "PARTIAL" | "NONE";
  differences: string[];
  usage_rule: "PRIMARY" | "CSA_PRIMARY" | "SUPPLEMENTAL_ONLY" | "NOT_PRIMARY" | "PROHIBITED";
  critical_note?: string;
}

const CROSSWALK_MATRIX: Record<string, Record<string, CrosswalkEntry>> = {
  "API 570": {
    canada: { equivalent: "CSA Z662 / CSA B51", equivalence_type: "PARTIAL", differences: ["Pipeline vs process piping scope differences", "CSA governs nationally via CRN system", "Provincial adoption requirements apply", "API 570 supplemental only if owner-adopted"], usage_rule: "CSA_PRIMARY" },
    norway: { equivalent: "NORSOK M-001 / DNV-RP-G101", equivalence_type: "PARTIAL", differences: ["Risk-based inspection interval methodology differs", "Qualification requirements per NORSOK differ", "Owner/operator integrity programs dominate", "Acceptance criteria may vary from API 570 Table 7"], usage_rule: "SUPPLEMENTAL_ONLY" },
    eu: { equivalent: "EN 13480 (in-service)", equivalence_type: "PARTIAL", differences: ["PED compliance required for new and repaired", "Harmonized standards structure differs", "Not directly interchangeable with API 570", "Notified Body involvement required"], usage_rule: "NOT_PRIMARY" },
    uk: { equivalent: "BS EN 13480 / PER 1999 / SAFed guidelines", equivalence_type: "PARTIAL", differences: ["Pressure Equipment Regulations 1999 govern", "Written scheme of examination required", "Competent Person (not just inspector) oversight", "AWS not recognized for structural welding"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["Australian in-service inspection standard governs", "Different risk-based interval methodology", "State-level WorkSafe registration required"], usage_rule: "NOT_PRIMARY" },
    japan: { equivalent: "JIS B 8270 / METI guidelines", equivalence_type: "PARTIAL", differences: ["METI High Pressure Gas Safety Act prevails", "JIS inspection procedures differ", "Mandatory periodic government inspection"], usage_rule: "NOT_PRIMARY" }
  },
  "API 510": {
    canada: { equivalent: "CSA B51", equivalence_type: "PARTIAL", differences: ["CSA B51 covers boilers and pressure vessels", "Provincial jurisdiction applies", "CRN (Canadian Registration Number) required", "Repair to original code of construction or CSA B51"], usage_rule: "CSA_PRIMARY" },
    norway: { equivalent: "NORSOK + EN 13445", equivalence_type: "PARTIAL", differences: ["EN 13445 for design/fabrication", "NORSOK for offshore integrity management", "DNV rules may apply for subsea", "PSA regulatory oversight required"], usage_rule: "NOT_PRIMARY" },
    eu: { equivalent: "EN 13445 + PED 2014/68/EU", equivalence_type: "PARTIAL", differences: ["PED 2014/68/EU mandatory for pressure equipment", "EN 13445 for unfired pressure vessels", "CE marking required", "Notified Body involvement", "Different material specifications (EN vs ASTM)"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS 1210 + AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["AS 1210 for design of pressure vessels", "AS/NZS 3788 for in-service inspection", "State/territory WorkSafe requirements", "Design registration required"], usage_rule: "NOT_PRIMARY" },
    germany: { equivalent: "AD 2000 Merkblätter / EN 13445 + BetrSichV", equivalence_type: "PARTIAL", differences: ["AD 2000 historically used (being replaced by EN)", "TÜV involvement required", "German pressure vessel regulation (BetrSichV)", "Prüfbuch (inspection book) mandatory"], usage_rule: "NOT_PRIMARY" }
  },
  "ASME BPVC Section VIII": {
    eu: { equivalent: "EN 13445", equivalence_type: "PARTIAL", differences: ["Different design methodology (DBA vs DBF)", "PED Essential Safety Requirements apply", "Material specifications differ (EN vs ASTM)", "Fabrication tolerances differ", "Weld joint coefficients differ"], usage_rule: "NOT_PRIMARY" },
    germany: { equivalent: "AD 2000 Merkblätter / EN 13445", equivalence_type: "PARTIAL", differences: ["AD 2000 historically used (being replaced by EN)", "TÜV involvement required", "German pressure vessel regulation (BetrSichV)", "Different safety factors and allowable stress basis"], usage_rule: "NOT_PRIMARY" },
    japan: { equivalent: "JIS B 8265 / JIS B 8266", equivalence_type: "PARTIAL", differences: ["METI High Pressure Gas Safety Act governs", "Different design allowable stress basis", "Material equivalence not direct", "KHK certification required"], usage_rule: "NOT_PRIMARY" },
    china: { equivalent: "GB 150", equivalence_type: "PARTIAL", differences: ["GB 150 is mandatory national standard", "Different safety factors", "SAMR certification required", "Chinese material grades (no ASTM equivalent guaranteed)", "Chinese language documentation required"], usage_rule: "NOT_PRIMARY", critical_note: "ASME stamp NOT accepted as compliance proof in China" },
    india: { equivalent: "IS 2825 / IBR 1950", equivalence_type: "PARTIAL", differences: ["IBR 1950 for boilers (mandatory)", "IS 2825 for unfired PV", "State boiler inspectorate approval required", "Local third-party inspection agencies"], usage_rule: "NOT_PRIMARY" }
  },
  "ASME Section VIII": {
    eu: { equivalent: "EN 13445", equivalence_type: "PARTIAL", differences: ["Different design methodology (DBA vs DBF)", "PED Essential Safety Requirements apply", "Material specifications differ (EN vs ASTM)", "Fabrication tolerances differ"], usage_rule: "NOT_PRIMARY" },
    germany: { equivalent: "AD 2000 Merkblätter / EN 13445", equivalence_type: "PARTIAL", differences: ["AD 2000 historically used (being replaced by EN)", "TÜV involvement required", "German pressure vessel regulation (BetrSichV)"], usage_rule: "NOT_PRIMARY" },
    japan: { equivalent: "JIS B 8265 / JIS B 8266", equivalence_type: "PARTIAL", differences: ["METI High Pressure Gas Safety Act governs", "Different design allowable stress basis", "Material equivalence not direct"], usage_rule: "NOT_PRIMARY" }
  },
  "AWS D1.1": {
    uk: { equivalent: "BS EN 1090 / EN ISO 15614 / EN ISO 9606", equivalence_type: "PARTIAL", differences: ["EN ISO 15614 for procedure qualification (replaces AWS PQR)", "EN ISO 9606 for welder qualification (replaces AWS WPQ)", "Execution class system (EXC1-4) replaces AWS weld categories", "CE/UKCA marking for structural steel required"], usage_rule: "NOT_PRIMARY" },
    eu: { equivalent: "EN 1090 / EN ISO 15614 / EN ISO 3834", equivalence_type: "PARTIAL", differences: ["EN 1090 for structural steel execution", "EN ISO 3834 for quality requirements", "Different acceptance criteria structure", "Factory Production Control (FPC) required"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS/NZS 1554", equivalence_type: "PARTIAL", differences: ["AS/NZS 1554 for structural steel welding", "Different category system (SP vs GP)", "Australian welder qualification per AS/NZS ISO 9606"], usage_rule: "NOT_PRIMARY" }
  },
  "AWS D1.5": {
    uk: { equivalent: "BS EN 1090-2 / EN 1993-2 / BS 7608", equivalence_type: "PARTIAL", differences: ["EN 1090-2 for bridge execution class EXC3/EXC4", "EN 1993-2 for steel bridge design", "BS 7608 for fatigue assessment of welded joints", "No direct AWS D1.5 equivalent — Eurocode system replaces", "Different fatigue detail categories"], usage_rule: "NOT_PRIMARY" },
    eu: { equivalent: "EN 1090-2 / EN 1993-2", equivalence_type: "PARTIAL", differences: ["EN 1090-2 execution standard for bridges", "EN 1993-2 design of steel bridges", "Execution class EXC3/EXC4 required for bridges", "Different fatigue classification system", "CE marking mandatory"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS 5100 / AS/NZS 1554.4", equivalence_type: "PARTIAL", differences: ["AS 5100 Bridge Design standard", "AS/NZS 1554.4 for structural steel welding (bridges)", "Different fatigue detail categories"], usage_rule: "NOT_PRIMARY" }
  },
  "API 1104": {
    australia: { equivalent: "AS 2885", equivalence_type: "PARTIAL", differences: ["AS 2885 for pipeline systems (comprehensive)", "Different ECA approach for pipeline defect assessment", "Australian pipeline licensing requirements", "State-level pipeline safety regulations"], usage_rule: "NOT_PRIMARY" },
    canada: { equivalent: "CSA Z662", equivalence_type: "PARTIAL", differences: ["CSA Z662 comprehensive pipeline code", "Includes welding + inspection + integrity management", "NEB/CER regulatory oversight", "Annex K for ECA procedures"], usage_rule: "CSA_PRIMARY" },
    norway: { equivalent: "DNV-ST-F101 / NORSOK M-001", equivalence_type: "PARTIAL", differences: ["DNV-ST-F101 for submarine pipelines", "NORSOK for topsides piping", "Different defect acceptance criteria (ECA-based)", "PSA oversight for Norwegian Continental Shelf"], usage_rule: "NOT_PRIMARY" }
  },
  "API 579-1/ASME FFS-1": {
    uk: { equivalent: "BS 7910 / R5/R6 (EDF Energy)", equivalence_type: "PARTIAL", differences: ["BS 7910 for fracture assessment (widely used)", "R5/R6 for nuclear (creep and fracture)", "Different FAD (Failure Assessment Diagram) approach", "Reference stress solutions may differ"], usage_rule: "NOT_PRIMARY" },
    eu: { equivalent: "EN 13445-3 Annex B (Design by Analysis) / FITNET", equivalence_type: "PARTIAL", differences: ["EN 13445-3 Annex B for DBA fitness-for-service", "FITNET procedure (European FFS framework)", "Different partial safety factor approach", "Material data requirements differ"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS/NZS 3788 Appendix I / BS 7910", equivalence_type: "PARTIAL", differences: ["AS/NZS 3788 references fitness-for-service", "Often uses BS 7910 by reference", "Australian-specific material property data may apply"], usage_rule: "NOT_PRIMARY" }
  }
};

// REGION FALLBACK — specific jurisdictions cascade to parent region for crosswalk lookup
const REGION_FALLBACK: Record<string, string> = {
  germany: "eu",
  france: "eu",
  italy: "eu",
  spain: "eu",
  netherlands: "eu",
  belgium: "eu",
  austria: "eu",
  sweden: "eu",
  finland: "eu",
  denmark: "eu",
  alberta: "canada",
  scotland: "uk",
  wales: "uk",
  new_zealand: "australia"
};

// ============================================================
// UNIT SYSTEM CONVERSION
// ============================================================
interface UnitSystem {
  system: "Imperial" | "Metric" | "Mixed";
  thickness: string;
  pressure: string;
  temperature: string;
  length: string;
  stress: string;
  corrosion_rate: string;
}

const UNIT_SYSTEMS: Record<string, UnitSystem> = {
  us: { system: "Imperial", thickness: "inches", pressure: "psi", temperature: "°F", length: "feet", stress: "ksi", corrosion_rate: "mpy (mils/year)" },
  metric: { system: "Metric", thickness: "mm", pressure: "MPa", temperature: "°C", length: "m", stress: "MPa", corrosion_rate: "mm/year" },
  mixed: { system: "Mixed", thickness: "mm/inches", pressure: "psi/bar", temperature: "°C/°F", length: "m/ft", stress: "MPa/ksi", corrosion_rate: "mm/year or mpy" }
};

const CONVERSIONS = {
  thickness_in_to_mm: 25.4,
  thickness_mm_to_in: 0.03937,
  pressure_psi_to_mpa: 0.006895,
  pressure_mpa_to_psi: 145.038,
  pressure_psi_to_bar: 0.06895,
  pressure_bar_to_psi: 14.504,
  temp_f_to_c: (f: number) => (f - 32) * 5 / 9,
  temp_c_to_f: (c: number) => c * 9 / 5 + 32,
  length_ft_to_m: 0.3048,
  length_m_to_ft: 3.2808,
  stress_ksi_to_mpa: 6.895,
  stress_mpa_to_ksi: 0.1450,
  corrosion_mpy_to_mmyr: 0.0254,
  corrosion_mmyr_to_mpy: 39.37
};

// ============================================================
// AUTHORITY HARD LOCKS — rules that CANNOT be overridden
// ============================================================
interface HardLock {
  condition: string;
  action: string;
  reason: string;
}

const AUTHORITY_HARD_LOCKS: HardLock[] = [
  { condition: "jurisdiction != US AND authority_chain contains only US codes", action: "BLOCK_LOCK", reason: "Cannot lock to US codes when asset is in non-US jurisdiction" },
  { condition: "jurisdiction == China AND code == ASME", action: "FLAG_INVALID", reason: "ASME stamp not accepted as compliance proof in China; GB 150 required" },
  { condition: "jurisdiction requires Notified Body AND no NB involvement", action: "BLOCK_ACCEPTANCE", reason: "PED requires Notified Body conformity assessment" },
  { condition: "class_society required AND none assigned", action: "HOLD_FOR_INPUT", reason: "Offshore/marine assets require classification society survey" },
  { condition: "CRN required AND not registered", action: "FLAG_REGULATORY", reason: "Canadian pressure equipment requires CRN registration" },
  { condition: "owner_user_program active AND standard_interval applied", action: "FLAG_OVERRIDE", reason: "Owner-user programs may extend intervals beyond code minimum — verify program validity" }
];

// ============================================================
// CORE ENGINE
// ============================================================
interface AuthorityInput {
  asset_type: string;
  jurisdiction: string;
  component_type?: string;
  component_description?: string;
  service_environment?: string;
  damage_mechanisms?: string[];
  is_pressure_boundary?: boolean;
  has_cracking?: boolean;
  wall_loss_percent?: number;
  class_society?: string;
  owner_user_program?: boolean;
  company_spec?: string;
  us_codes_requested?: string[];  // codes the user/system wants to apply
}

interface CrosswalkResult {
  us_code: string;
  local_equivalent: string;
  equivalence_type: "FULL" | "PARTIAL" | "NONE";
  key_differences: string[];
  usage_rule: string;
  critical_note?: string;
}

interface AuditEntry {
  timestamp: string;
  step: string;
  decision: string;
  basis: string;
}

interface InspectorMessage {
  summary: string;
  action_required: string[];
  warnings: string[];
  codes_that_govern: string[];
  codes_supplemental: string[];
  unit_note: string;
}

interface AuthorityOutput {
  status: "LOCKED" | "PARTIAL" | "BLOCKED" | "HOLD_FOR_INPUT";
  confidence: "deterministic" | "high" | "low" | "none";
  jurisdiction_resolved: {
    key: string;
    region: string;
    regulatory_body: string;
    class_society: string[];
    is_us: boolean;
    is_mismatch: boolean;
  };
  authority_chain: { code: string; role: string; locked: boolean }[];
  crosswalk: CrosswalkResult[] | null;
  unit_system: {
    source: UnitSystem;
    target: UnitSystem;
    conversion_required: boolean;
    conversions: typeof CONVERSIONS | null;
  };
  hard_locks_triggered: HardLock[];
  inspector_message: InspectorMessage;
  audit_trace: AuditEntry[];
  metadata: {
    engine: string;
    version: string;
    timestamp: string;
    jurisdiction_input: string;
    asset_type: string;
  };
}

function resolveJurisdiction(input: string): { key: string; entry: JurisdictionEntry | null; isUS: boolean } {
  const j = (input || "").toLowerCase().trim();

  // Check if US-equivalent
  if (!j || US_JURISDICTION_PATTERN.test(j) || j.indexOf("offshore_gulf") >= 0 || j.indexOf("us_") >= 0) {
    return { key: "us", entry: null, isUS: true };
  }

  // Direct match
  if (JURISDICTION_REGISTRY[j]) {
    return { key: j, entry: JURISDICTION_REGISTRY[j], isUS: false };
  }

  // Fuzzy match — check if input contains a jurisdiction key or vice versa
  for (const key of Object.keys(JURISDICTION_REGISTRY)) {
    if (j.indexOf(key) >= 0 || key.indexOf(j) >= 0) {
      return { key, entry: JURISDICTION_REGISTRY[key], isUS: false };
    }
  }

  // Unknown non-US
  return { key: j, entry: null, isUS: false };
}

function findCrosswalk(usCode: string, jurisdictionKey: string): CrosswalkResult | null {
  // Direct match
  if (CROSSWALK_MATRIX[usCode]?.[jurisdictionKey]) {
    const m = CROSSWALK_MATRIX[usCode][jurisdictionKey];
    return { us_code: usCode, local_equivalent: m.equivalent, equivalence_type: m.equivalence_type, key_differences: m.differences, usage_rule: m.usage_rule, critical_note: m.critical_note };
  }

  // Region fallback
  const fallback = REGION_FALLBACK[jurisdictionKey];
  if (fallback && CROSSWALK_MATRIX[usCode]?.[fallback]) {
    const m = CROSSWALK_MATRIX[usCode][fallback];
    return { us_code: usCode, local_equivalent: m.equivalent, equivalence_type: m.equivalence_type, key_differences: m.differences, usage_rule: m.usage_rule, critical_note: m.critical_note };
  }

  // Fuzzy match on code name
  for (const cwKey of Object.keys(CROSSWALK_MATRIX)) {
    if (usCode.indexOf(cwKey) >= 0 || cwKey.indexOf(usCode) >= 0) {
      if (CROSSWALK_MATRIX[cwKey][jurisdictionKey]) {
        const m = CROSSWALK_MATRIX[cwKey][jurisdictionKey];
        return { us_code: usCode, local_equivalent: m.equivalent, equivalence_type: m.equivalence_type, key_differences: m.differences, usage_rule: m.usage_rule, critical_note: m.critical_note };
      }
      if (fallback && CROSSWALK_MATRIX[cwKey][fallback]) {
        const m = CROSSWALK_MATRIX[cwKey][fallback];
        return { us_code: usCode, local_equivalent: m.equivalent, equivalence_type: m.equivalence_type, key_differences: m.differences, usage_rule: m.usage_rule, critical_note: m.critical_note };
      }
    }
  }

  return null;
}

function buildInspectorMessage(
  jurisdiction: { key: string; entry: JurisdictionEntry | null; isUS: boolean },
  crosswalks: CrosswalkResult[],
  hardLocks: HardLock[],
  unitTarget: UnitSystem
): InspectorMessage {
  const warnings: string[] = [];
  const actions: string[] = [];

  if (!jurisdiction.isUS && jurisdiction.entry) {
    warnings.push(`This asset is in ${jurisdiction.entry.region}. U.S. codes (API/ASME/AWS) are NOT the primary governing authority.`);
    actions.push(`Verify compliance with ${jurisdiction.entry.codes.slice(0, 3).join(", ")} before proceeding.`);
    actions.push(`Contact ${jurisdiction.entry.regulatory_body} for jurisdiction-specific requirements.`);
  }

  if (crosswalks.length > 0) {
    for (const cw of crosswalks) {
      if (cw.usage_rule === "NOT_PRIMARY" || cw.usage_rule === "PROHIBITED") {
        warnings.push(`${cw.us_code} is NOT primary in this jurisdiction. Local equivalent: ${cw.local_equivalent}`);
      }
      if (cw.critical_note) {
        warnings.push(`CRITICAL: ${cw.critical_note}`);
      }
    }
  }

  for (const hl of hardLocks) {
    warnings.push(`HARD LOCK: ${hl.reason}`);
    actions.push(`Resolve: ${hl.action}`);
  }

  const unitNote = jurisdiction.isUS
    ? "US codes apply — use Imperial units (inches, psi, °F, ksi, mpy)"
    : `Local codes use ${unitTarget.system} units (${unitTarget.thickness}, ${unitTarget.pressure}, ${unitTarget.temperature}). Convert all US-sourced measurements before applying local acceptance criteria.`;

  return {
    summary: jurisdiction.isUS
      ? "Asset in US jurisdiction. Standard US code authority applies."
      : `Asset in ${jurisdiction.entry?.region || "non-US jurisdiction"}. Local standards govern. US codes supplemental only.`,
    action_required: actions,
    warnings,
    codes_that_govern: jurisdiction.entry?.codes || [],
    codes_supplemental: crosswalks.map(cw => cw.us_code),
    unit_note: unitNote
  };
}

function processAuthority(input: AuthorityInput): AuthorityOutput {
  const audit: AuditEntry[] = [];
  const now = new Date().toISOString();

  // Step 1: Resolve jurisdiction
  audit.push({ timestamp: now, step: "jurisdiction_resolution", decision: `Input: "${input.jurisdiction}"`, basis: "Jurisdiction resolver module" });
  const jurisdiction = resolveJurisdiction(input.jurisdiction);
  audit.push({ timestamp: now, step: "jurisdiction_resolved", decision: `Key: "${jurisdiction.key}", US: ${jurisdiction.isUS}`, basis: jurisdiction.entry ? `Matched registry entry: ${jurisdiction.entry.region}` : (jurisdiction.isUS ? "US-equivalent pattern matched" : "Unknown non-US jurisdiction") });

  // Step 2: Determine what US codes would normally apply
  const usCodes = input.us_codes_requested || [];

  // Step 3: Build crosswalk
  const crosswalks: CrosswalkResult[] = [];
  if (!jurisdiction.isUS) {
    for (const code of usCodes) {
      const cw = findCrosswalk(code, jurisdiction.key);
      if (cw) crosswalks.push(cw);
    }
    audit.push({ timestamp: now, step: "crosswalk_resolution", decision: `${crosswalks.length} crosswalk entries resolved for ${usCodes.length} US codes`, basis: "Standard Equivalency Table + region fallback" });
  }

  // Step 4: Check hard locks
  const triggeredLocks: HardLock[] = [];
  if (!jurisdiction.isUS && usCodes.length > 0 && crosswalks.every(cw => cw.usage_rule === "NOT_PRIMARY" || cw.usage_rule === "PROHIBITED")) {
    triggeredLocks.push(AUTHORITY_HARD_LOCKS[0]); // US-only codes in non-US jurisdiction
  }
  audit.push({ timestamp: now, step: "hard_lock_check", decision: `${triggeredLocks.length} hard locks triggered`, basis: "Authority Hard Lock rules" });

  // Step 5: Determine status
  let status: AuthorityOutput["status"] = "LOCKED";
  let confidence: AuthorityOutput["confidence"] = "deterministic";

  if (!jurisdiction.isUS) {
    if (jurisdiction.entry) {
      status = "PARTIAL";
      confidence = "low";
    } else {
      status = "HOLD_FOR_INPUT";
      confidence = "none";
    }
  }
  if (triggeredLocks.length > 0) {
    status = "BLOCKED";
    confidence = "none";
  }

  audit.push({ timestamp: now, step: "status_determination", decision: `Status: ${status}, Confidence: ${confidence}`, basis: "Jurisdiction mismatch + hard lock evaluation" });

  // Step 6: Unit system
  const sourceUnits = UNIT_SYSTEMS.us;
  const targetUnits = jurisdiction.entry
    ? (jurisdiction.entry.unit_system === "Mixed" ? UNIT_SYSTEMS.mixed : UNIT_SYSTEMS.metric)
    : (jurisdiction.isUS ? UNIT_SYSTEMS.us : UNIT_SYSTEMS.metric);

  // Step 7: Inspector message
  const inspectorMessage = buildInspectorMessage(jurisdiction, crosswalks, triggeredLocks, targetUnits);

  // Step 8: Build authority chain
  const authorityChain = jurisdiction.entry
    ? jurisdiction.entry.codes.map(c => ({ code: c, role: "jurisdiction_primary", locked: true }))
    : (jurisdiction.isUS ? usCodes.map(c => ({ code: c, role: "primary", locked: true })) : []);

  return {
    status,
    confidence,
    jurisdiction_resolved: {
      key: jurisdiction.key,
      region: jurisdiction.entry?.region || (jurisdiction.isUS ? "United States" : "Unknown"),
      regulatory_body: jurisdiction.entry?.regulatory_body || (jurisdiction.isUS ? "OSHA / state authorities" : "Unknown"),
      class_society: jurisdiction.entry?.class_society || [],
      is_us: jurisdiction.isUS,
      is_mismatch: !jurisdiction.isUS
    },
    authority_chain: authorityChain,
    crosswalk: crosswalks.length > 0 ? crosswalks : null,
    unit_system: {
      source: sourceUnits,
      target: targetUnits,
      conversion_required: !jurisdiction.isUS,
      conversions: !jurisdiction.isUS ? CONVERSIONS : null
    },
    hard_locks_triggered: triggeredLocks,
    inspector_message: inspectorMessage,
    audit_trace: audit,
    metadata: {
      engine: "global-authority-engine",
      version: "2.0.0",
      timestamp: now,
      jurisdiction_input: input.jurisdiction,
      asset_type: input.asset_type
    }
  };
}

// ============================================================
// NETLIFY HANDLER
// ============================================================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body: AuthorityInput = JSON.parse(event.body || "{}");

    if (!body.asset_type) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "asset_type required" }) };
    }
    if (!body.jurisdiction) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "jurisdiction required" }) };
    }

    const result = processAuthority(body);

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Global Authority Engine error: " + (err.message || String(err)) }) };
  }
};
