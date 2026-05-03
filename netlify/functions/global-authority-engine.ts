/**
 * GLOBAL AUTHORITY ENGINE v2.1.0
 * FORGED 4D NDT Intelligence OS
 *
 * Prevents the platform from applying the wrong code, standard, or regulatory
 * authority when inspections occur across different countries, offshore regions,
 * class societies, owner-user programs, or company specifications.
 *
 * Modules:
 *   1. Jurisdiction Resolver — NLP-style detection from location_text
 *   2. Global Authority Matrix — which codes govern in which jurisdictions
 *   3. Standard Equivalency Table — crosswalk between US and foreign standards
 *   4. Authority Hard Locks — prevents wrong-code application
 *   5. Unit Conversion Engine — detects mixed units, converts, validates thresholds
 *   6. Audit Trace — full decision provenance for every authority resolution
 *   7. Inspector Messages — human-readable explanations for field personnel
 *   8. Mandatory Questions — prompts when jurisdiction/authority is ambiguous
 *
 * Engine: global-authority-engine
 * Version: 2.1.0
 * Input: POST { asset_description, location_text, units_detected, asset_type, inspection_method, requested_code, operator_name, owner_user_program }
 * Output: { country, primary_authority, decision_lock, warning, unit_conversion_required, conversion_check, mandatory_user_questions, secondary_authorities, audit_trace, ... }
 */

import { Handler } from "@netlify/functions";

// ============================================================
// JURISDICTION REGISTRY
// ============================================================
interface JurisdictionEntry {
  country: string;
  region?: string;
  codes: string[];
  primary_authority_description: string;
  regulatory_body: string;
  class_societies: string[];
  unit_system: "Metric" | "Imperial" | "Mixed";
  note: string;
  is_offshore?: boolean;
}

const JURISDICTION_REGISTRY: Record<string, JurisdictionEntry> = {
  us: {
    country: "United States",
    codes: ["API 570", "API 510", "ASME BPVC", "API 579-1/ASME FFS-1", "API 1104", "AWS D1.1"],
    primary_authority_description: "API / ASME codes as adopted by OSHA / state jurisdiction",
    regulatory_body: "OSHA / state authorities / owner-user program",
    class_societies: [],
    unit_system: "Imperial",
    note: "US codes apply directly; OSHA 29 CFR 1910.119 for PSM covered facilities"
  },
  canada: {
    country: "Canada",
    codes: ["CSA Z662", "CSA B51", "CSA W59", "CSA Z245.1"],
    primary_authority_description: "Provincial pressure equipment authority / CSA / applicable owner-user program",
    regulatory_body: "TSSA / ABSA / provincial authorities",
    class_societies: [],
    unit_system: "Metric",
    note: "Canadian Standards Association primary; API supplemental only if adopted by owner"
  },
  alberta: {
    country: "Canada",
    region: "Alberta",
    codes: ["CSA Z662", "ABSA", "CSA B51"],
    primary_authority_description: "Provincial pressure equipment authority / CSA / applicable owner-user program",
    regulatory_body: "ABSA",
    class_societies: [],
    unit_system: "Metric",
    note: "Alberta Boilers Safety Association + CSA standards govern"
  },
  germany: {
    country: "Germany",
    codes: ["PED 2014/68/EU", "EN 13445", "AD 2000 Merkblätter", "BetrSichV"],
    primary_authority_description: "PED / EN harmonized standards / TÜV oversight",
    regulatory_body: "TÜV / ZÜS / BAM",
    class_societies: ["DNV", "Lloyd's", "Bureau Veritas"],
    unit_system: "Metric",
    note: "Pressure Equipment Directive + EN harmonized standards; TÜV oversight"
  },
  eu: {
    country: "European Union",
    codes: ["PED 2014/68/EU", "EN 13445", "EN 12952", "EN 13480"],
    primary_authority_description: "PED / EN harmonized standards / Notified Body oversight",
    regulatory_body: "Notified Bodies (NB) per member state",
    class_societies: ["DNV", "Lloyd's", "Bureau Veritas", "TÜV"],
    unit_system: "Metric",
    note: "PED + EN harmonized standards govern; ASME not primary; CE marking required"
  },
  uk: {
    country: "United Kingdom",
    codes: ["BS EN 1090", "BS 7910", "PER 1999", "PSSR 2000"],
    primary_authority_description: "UK pressure systems / HSE / written scheme / applicable EN or ISO standards",
    regulatory_body: "HSE / Competent Authority",
    class_societies: ["Lloyd's Register", "DNV"],
    unit_system: "Metric",
    note: "Pressure Equipment Regulations + Written Scheme of Examination required"
  },
  australia: {
    country: "Australia",
    codes: ["AS/NZS 3788", "AS 4458", "AS 2885", "AS 1210"],
    primary_authority_description: "Australian state/territory WHS requirements / AS/NZS standards / owner-user program",
    regulatory_body: "WorkSafe / state regulators",
    class_societies: ["Lloyd's", "DNV", "Bureau Veritas"],
    unit_system: "Metric",
    note: "Australian/NZ Standards govern; state WorkSafe authorities"
  },
  norway: {
    country: "Norway",
    codes: ["NORSOK M-001", "NORSOK M-501", "DNV-OS-F101", "DNV-ST-F101"],
    primary_authority_description: "Norwegian offshore regulatory framework / NORSOK / DNV / operator specification",
    regulatory_body: "Petroleumstilsynet (PSA)",
    class_societies: ["DNV"],
    unit_system: "Metric",
    is_offshore: true,
    note: "NORSOK standards + DNV rules govern offshore; PSA regulatory oversight"
  },
  brazil: {
    country: "Brazil",
    codes: ["NR-13", "ABNT NBR 15749", "ABNT NBR 14842"],
    primary_authority_description: "Brazilian regulatory requirements / owner specification / ABNT / ISO",
    regulatory_body: "MTE / ANP / INMETRO",
    class_societies: ["DNV", "Bureau Veritas", "ABS"],
    unit_system: "Metric",
    note: "NR-13 regulatory + ABNT national standards; ANP for oil & gas"
  },
  japan: {
    country: "Japan",
    codes: ["JIS B 8265", "JIS B 8266", "METI High Pressure Gas Safety Act"],
    primary_authority_description: "JIS / METI regulatory framework",
    regulatory_body: "METI / KHK",
    class_societies: ["ClassNK", "DNV"],
    unit_system: "Metric",
    note: "JIS standards + METI regulations; KHK certification required"
  },
  singapore: {
    country: "Singapore",
    codes: ["SS CP 79", "WSH Act", "SS 531"],
    primary_authority_description: "Singapore Standards / WSH Act / MOM",
    regulatory_body: "MOM / WSH Council",
    class_societies: ["ABS", "Lloyd's", "DNV", "Bureau Veritas"],
    unit_system: "Metric",
    note: "Singapore Standards + Workplace Safety & Health regulations"
  },
  middle_east: {
    country: "Middle East",
    codes: ["ARAMCO Standards", "ADNOC Standards", "QP Standards"],
    primary_authority_description: "Owner engineering authority / national standards",
    regulatory_body: "Owner engineering authority",
    class_societies: ["ABS", "Lloyd's", "DNV"],
    unit_system: "Mixed",
    note: "Owner/national standards often adopt API with modifications; verify per owner spec"
  },
  korea: {
    country: "South Korea",
    codes: ["KGS FP 111", "KOSHA", "KS B 6750"],
    primary_authority_description: "KGS / KOSHA / MOTIE regulatory framework",
    regulatory_body: "KGS / KOSHA / MOTIE",
    class_societies: ["Korean Register", "DNV"],
    unit_system: "Metric",
    note: "Korean Gas Safety + occupational safety standards; KGS certification"
  },
  india: {
    country: "India",
    codes: ["IS 2825", "IBR 1950", "OISD Standards", "IS 803"],
    primary_authority_description: "IBR / IS / OISD regulatory framework",
    regulatory_body: "DIPP / State Boiler Directorate / OISD",
    class_societies: ["Indian Register of Shipping", "DNV", "Lloyd's"],
    unit_system: "Metric",
    note: "Indian Boiler Regulations + OISD for petroleum; state-level boiler inspectorates"
  },
  china: {
    country: "China",
    codes: ["GB 150", "GB/T 20801", "TSG 21"],
    primary_authority_description: "GB national standards / SAMR regulatory",
    regulatory_body: "SAMR / Provincial MSA",
    class_societies: ["CCS", "DNV", "Lloyd's"],
    unit_system: "Metric",
    note: "GB national standards govern; SAMR/TSG regulatory; no foreign code primary"
  },
  offshore_international: {
    country: "International Waters",
    codes: ["MODU Code", "SOLAS", "ISM Code"],
    primary_authority_description: "Flag state / class society / maritime regulatory framework",
    regulatory_body: "Flag State / IMO",
    class_societies: ["ABS", "DNV", "Lloyd's", "Bureau Veritas", "ClassNK"],
    unit_system: "Metric",
    is_offshore: true,
    note: "Flag state + classification society rules govern; IMO conventions apply"
  }
};

// ============================================================
// LOCATION TEXT → JURISDICTION RESOLVER (NLP-style)
// ============================================================
interface LocationResolution {
  jurisdiction_key: string | null;
  jurisdiction_entry: JurisdictionEntry | null;
  country: string | null;
  region_or_state: string | null;
  is_us: boolean;
  is_offshore: boolean;
  is_unknown: boolean;
  confidence: "high" | "medium" | "low" | "none";
}

// US patterns — these resolve to US jurisdiction
const US_PATTERNS = [
  /\bunited\s*states\b/i,
  /\bu\.?s\.?\s*(refinery|facility|plant|onshore|gulf|coast|pipeline)?\b/i,
  /\bgulf\s*of\s*mexico\b/i,
  /\boffshore\s*gulf/i,
  /\b(texas|louisiana|california|alaska|hawaii|oklahoma|new\s*mexico|ohio|pennsylvania|west\s*virginia|wyoming|montana|north\s*dakota|colorado|kansas|illinois|indiana|michigan)\b/i,
  /\bamerican\b/i,
  /\busa\b/i
];

// International offshore patterns (NOT US offshore)
const INTERNATIONAL_OFFSHORE_PATTERNS = [
  /\binternational\s*waters?\b/i,
  /\bflagged?\s*vessel\b/i,
  /\bflag\s*state\b/i
];

// Country/region detection patterns
const LOCATION_PATTERNS: { pattern: RegExp; key: string; region?: string }[] = [
  { pattern: /\bnorway|norwegian|north\s*sea.*norway|norway.*offshore\b/i, key: "norway" },
  { pattern: /\baberdeen|united\s*kingdom|\buk\b|scotland|england|wales|british\b/i, key: "uk" },
  { pattern: /\bbrazil|brazilian|petrobras|fpso.*brazil|brazil.*fpso\b/i, key: "brazil" },
  { pattern: /\balberta\b/i, key: "alberta", region: "Alberta" },
  { pattern: /\bcanada|canadian|british\s*columbia|ontario|quebec|saskatchewan|manitoba|nova\s*scotia\b/i, key: "canada" },
  { pattern: /\baustralia|australian|western\s*australia|queensland|victoria|nsw|new\s*south\s*wales\b/i, key: "australia", region: "Western Australia" },
  { pattern: /\bgermany|german\b/i, key: "germany" },
  { pattern: /\bjapan|japanese\b/i, key: "japan" },
  { pattern: /\bchina|chinese\b/i, key: "china" },
  { pattern: /\bindia|indian\b/i, key: "india" },
  { pattern: /\bkorea|korean\b/i, key: "korea" },
  { pattern: /\bsingapore\b/i, key: "singapore" },
  { pattern: /\bsaudi|aramco|adnoc|uae|qatar|middle\s*east|kuwait|oman|bahrain\b/i, key: "middle_east" },
  { pattern: /\beu\b|european\s*union/i, key: "eu" }
];

function resolveLocationText(locationText: string | undefined): LocationResolution {
  if (!locationText || locationText.trim() === "") {
    return {
      jurisdiction_key: null,
      jurisdiction_entry: null,
      country: null,
      region_or_state: null,
      is_us: false,
      is_offshore: false,
      is_unknown: true,
      confidence: "none"
    };
  }

  const loc = locationText.trim();

  // Check international offshore first (flagged vessels, international waters)
  for (const pat of INTERNATIONAL_OFFSHORE_PATTERNS) {
    if (pat.test(loc)) {
      const entry = JURISDICTION_REGISTRY["offshore_international"];
      return {
        jurisdiction_key: "offshore_international",
        jurisdiction_entry: entry,
        country: "International Waters",
        region_or_state: null,
        is_us: false,
        is_offshore: true,
        is_unknown: false,
        confidence: "medium"
      };
    }
  }

  // Check US patterns
  for (const pat of US_PATTERNS) {
    if (pat.test(loc)) {
      // Make sure it's not "Norway offshore" containing "gulf" or something
      // Double-check: no non-US country in the string takes priority
      let overriddenByForeign = false;
      for (const lp of LOCATION_PATTERNS) {
        if (lp.pattern.test(loc)) {
          overriddenByForeign = true;
          break;
        }
      }
      if (!overriddenByForeign) {
        const entry = JURISDICTION_REGISTRY["us"];
        const isOffshore = /offshore|gulf\s*of\s*mexico/i.test(loc);
        return {
          jurisdiction_key: "us",
          jurisdiction_entry: entry,
          country: "United States",
          region_or_state: null,
          is_us: true,
          is_offshore: isOffshore,
          is_unknown: false,
          confidence: "high"
        };
      }
    }
  }

  // Check country/region patterns
  for (const lp of LOCATION_PATTERNS) {
    if (lp.pattern.test(loc)) {
      const entry = JURISDICTION_REGISTRY[lp.key];
      const isOffshore = /offshore|subsea|north\s*sea|fpso/i.test(loc);
      let region = lp.region || null;
      // Detect specific regions
      if (lp.key === "australia" && /western\s*australia/i.test(loc)) region = "Western Australia";
      if (lp.key === "canada" && /alberta/i.test(loc)) region = "Alberta";
      return {
        jurisdiction_key: lp.key,
        jurisdiction_entry: entry,
        country: entry.country,
        region_or_state: region,
        is_us: false,
        is_offshore: isOffshore || (entry.is_offshore || false),
        is_unknown: false,
        confidence: "high"
      };
    }
  }

  // Unknown jurisdiction
  return {
    jurisdiction_key: null,
    jurisdiction_entry: null,
    country: null,
    region_or_state: null,
    is_us: false,
    is_offshore: /offshore|subsea/i.test(loc),
    is_unknown: true,
    confidence: "none"
  };
}

// ============================================================
// UNIT CONVERSION ENGINE
// ============================================================
const CONVERSIONS = {
  inches_to_mm: 25.4,
  mm_to_inches: 0.0393701,
  psi_to_mpa: 0.006895,
  mpa_to_psi: 145.038,
  f_to_c: (f: number) => (f - 32) * 5 / 9,
  c_to_f: (c: number) => c * 9 / 5 + 32
};

interface ThicknessValue {
  value: number;
  unit: "inches" | "mm";
  context: string;
}

function extractThicknessValues(description: string): ThicknessValue[] {
  const values: ThicknessValue[] = [];

  // Match "X.XX inches" or "X.XX in" or "X.XX in."
  const inchPatterns = /(\d+\.?\d*)\s*(?:inches|inch|in\.?)\b/gi;
  let match;
  while ((match = inchPatterns.exec(description)) !== null) {
    values.push({ value: parseFloat(match[1]), unit: "inches", context: match[0] });
  }

  // Match "X.X mm" but NOT "X.X mpy"
  const mmPatterns = /(\d+\.?\d*)\s*mm\b/gi;
  while ((match = mmPatterns.exec(description)) !== null) {
    values.push({ value: parseFloat(match[1]), unit: "mm", context: match[0] });
  }

  return values;
}

interface UnitConversionResult {
  unit_conversion_required: boolean;
  detected_units: "IMPERIAL" | "METRIC" | "MIXED";
  jurisdiction_expects: "Imperial" | "Metric" | "Mixed";
  conversions_performed: { original: string; converted: string; value_original: number; value_converted: number }[];
  conversion_check?: string;
  threshold_violation?: { required: string; measured: string; disposition: string };
}

function analyzeUnits(
  description: string,
  unitsDetected: string,
  jurisdictionEntry: JurisdictionEntry | null,
  isUS: boolean
): UnitConversionResult {
  const thicknessValues = extractThicknessValues(description);
  const hasMM = thicknessValues.some(v => v.unit === "mm");
  const hasInches = thicknessValues.some(v => v.unit === "inches");
  const isMixed = (hasMM && hasInches) || unitsDetected === "MIXED";

  const jurisdictionExpects = isUS ? "Imperial" : (jurisdictionEntry?.unit_system || "Metric");
  const conversionRequired = isMixed || (isUS && hasMM) || (!isUS && hasInches);

  const conversions: UnitConversionResult["conversions_performed"] = [];
  let conversionCheck: string | undefined;
  let thresholdViolation: UnitConversionResult["threshold_violation"] | undefined;

  // Perform conversions for mixed-unit scenarios
  if (isMixed || conversionRequired) {
    for (const tv of thicknessValues) {
      if (tv.unit === "inches") {
        const mmVal = parseFloat((tv.value * CONVERSIONS.inches_to_mm).toFixed(2));
        conversions.push({
          original: `${tv.value} inches`,
          converted: `${mmVal} mm`,
          value_original: tv.value,
          value_converted: mmVal
        });
        if (!conversionCheck) conversionCheck = `${tv.value} inches = ${mmVal} mm`;
      } else {
        const inVal = parseFloat((tv.value * CONVERSIONS.mm_to_inches).toFixed(4));
        conversions.push({
          original: `${tv.value} mm`,
          converted: `${inVal} inches`,
          value_original: tv.value,
          value_converted: inVal
        });
      }
    }

    // Check for threshold violations: if there's a "required" and "measured" value
    const reqMatch = description.match(/(?:required|minimum\s*required|min\.?\s*req(?:uired)?)\s*(?:thickness\s*(?:is|=|:)?\s*)?(\d+\.?\d*)\s*(inches|inch|in\.?|mm)/i);
    const measMatch = description.match(/(?:measured|remaining|actual)\s*(?:thickness\s*(?:is|=|:)?\s*)?(\d+\.?\d*)\s*(inches|inch|in\.?|mm)/i);

    if (reqMatch && measMatch) {
      let reqValue = parseFloat(reqMatch[1]);
      let reqUnit = reqMatch[2].toLowerCase().startsWith("in") ? "inches" : "mm";
      let measValue = parseFloat(measMatch[1]);
      let measUnit = measMatch[2].toLowerCase().startsWith("in") ? "inches" : "mm";

      // Convert both to same unit for comparison
      let reqMM = reqUnit === "inches" ? reqValue * CONVERSIONS.inches_to_mm : reqValue;
      let measMM = measUnit === "inches" ? measValue * CONVERSIONS.inches_to_mm : measValue;

      reqMM = parseFloat(reqMM.toFixed(2));
      measMM = parseFloat(measMM.toFixed(2));

      if (reqUnit !== measUnit) {
        conversionCheck = `${reqValue} ${reqUnit} = ${reqUnit === "inches" ? reqMM : parseFloat((reqValue * CONVERSIONS.mm_to_inches).toFixed(4))} ${reqUnit === "inches" ? "mm" : "inches"}`;
      }

      if (measMM < reqMM) {
        thresholdViolation = {
          required: `${reqValue} ${reqUnit} (${reqMM} mm)`,
          measured: `${measValue} ${measUnit} (${measMM} mm)`,
          disposition: "BELOW_MINIMUM_REQUIRED_THICKNESS"
        };
      }
    }
  }

  return {
    unit_conversion_required: conversionRequired,
    detected_units: isMixed ? "MIXED" : (hasInches ? "IMPERIAL" : "METRIC"),
    jurisdiction_expects: jurisdictionExpects,
    conversions_performed: conversions,
    conversion_check: conversionCheck,
    threshold_violation: thresholdViolation
  };
}

// ============================================================
// AUTHORITY CONFLICT ANALYSIS
// ============================================================
interface ConflictAnalysis {
  has_conflict: boolean;
  code_is_controlling: boolean;
  code_is_contractual: boolean;
  code_is_reference_only: boolean;
  warning: string | null;
}

// Codes that are inherently US-centric
const US_CODES = ["API 570", "API 510", "ASME BPVC", "ASME B31.3", "ASME Section VIII", "API 579", "API 1104", "AWS D1.1", "AWS D1.5"];

function analyzeAuthorityConflict(
  requestedCode: string,
  location: LocationResolution,
  ownerUserProgram?: string,
  operatorName?: string
): ConflictAnalysis {
  const isUSCode = US_CODES.some(c => requestedCode.toUpperCase().indexOf(c.toUpperCase()) >= 0 || c.toUpperCase().indexOf(requestedCode.toUpperCase()) >= 0);

  // If US jurisdiction, no conflict
  if (location.is_us) {
    return { has_conflict: false, code_is_controlling: true, code_is_contractual: false, code_is_reference_only: false, warning: null };
  }

  // If non-US and US code requested
  if (isUSCode && !location.is_us) {
    const isContractual = !!(ownerUserProgram && /contract|specify|specif|require|adopt/i.test(ownerUserProgram));

    let warning: string;
    if (isContractual) {
      warning = `Contractual ${requestedCode} may supplement but should not override mandatory ${location.country || "local"} offshore authority.`;
    } else if (operatorName) {
      warning = `${operatorName} or owner specification may dominate over generic ${requestedCode}.`;
    } else if (location.is_offshore) {
      warning = `${requestedCode} may be technical reference only unless contractually adopted.`;
    } else {
      warning = `${requestedCode} may apply by design basis or contract, but local ${location.jurisdiction_entry ? "WHS / " + location.jurisdiction_entry.codes[0] : ""} authority must be verified.`;
    }

    return {
      has_conflict: true,
      code_is_controlling: false,
      code_is_contractual: isContractual,
      code_is_reference_only: !isContractual,
      warning
    };
  }

  return { has_conflict: false, code_is_controlling: true, code_is_contractual: false, code_is_reference_only: false, warning: null };
}

// ============================================================
// MANDATORY QUESTIONS GENERATOR
// ============================================================
function generateMandatoryQuestions(
  location: LocationResolution,
  requestedCode: string,
  conflict: ConflictAnalysis
): string[] {
  const questions: string[] = [];

  if (location.is_unknown) {
    questions.push("What country is the asset located in?");
    questions.push("Is the asset onshore or offshore?");
    questions.push(`Is ${requestedCode} legally required or only contractually referenced?`);
    return questions;
  }

  if (location.jurisdiction_key === "offshore_international") {
    questions.push("What is the vessel flag state?");
    questions.push("Which class society governs the vessel?");
    questions.push(`Is ${requestedCode} contractually adopted for this component?`);
    return questions;
  }

  if (location.jurisdiction_key === "alberta" || location.jurisdiction_key === "canada") {
    questions.push("Which provincial pressure equipment authority applies?");
    questions.push(`Is ${requestedCode} contractually adopted?`);
    questions.push(`Does the owner-user program reference CSA, ASME, or API?`);
    return questions;
  }

  if (conflict.has_conflict && !conflict.code_is_contractual) {
    questions.push(`Is ${requestedCode} contractually adopted for this facility/component?`);
    questions.push(`Which local regulatory body has jurisdiction?`);
  }

  return questions;
}

// ============================================================
// DECISION LOCK DETERMINATION
// ============================================================
type DecisionLock = "ALLOW" | "ALLOW_WITH_WARNING" | "HOLD_FOR_AUTHORITY" | "BLOCK";

function determineDecisionLock(
  location: LocationResolution,
  conflict: ConflictAnalysis,
  unitResult: UnitConversionResult,
  mandatoryQuestions: string[]
): DecisionLock {
  // Unknown jurisdiction → hold
  if (location.is_unknown) return "HOLD_FOR_AUTHORITY";

  // International offshore → hold (need flag state + class society)
  if (location.jurisdiction_key === "offshore_international") return "HOLD_FOR_AUTHORITY";

  // US jurisdiction with no conflict
  if (location.is_us && !conflict.has_conflict && !unitResult.unit_conversion_required) {
    return "ALLOW";
  }

  // US jurisdiction but mixed units (still allow but warn)
  if (location.is_us && unitResult.unit_conversion_required) {
    return "ALLOW_WITH_WARNING";
  }

  // Non-US with code conflict → allow with warning
  if (conflict.has_conflict) return "ALLOW_WITH_WARNING";

  return "ALLOW";
}

// ============================================================
// CROSSWALK LOOKUP (reuse from v2.0)
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
    canada: { equivalent: "CSA Z662 / CSA B51", equivalence_type: "PARTIAL", differences: ["CSA governs nationally via CRN system", "Provincial adoption requirements apply", "API 570 supplemental only if owner-adopted"], usage_rule: "CSA_PRIMARY" },
    norway: { equivalent: "NORSOK M-001 / DNV-RP-G101", equivalence_type: "PARTIAL", differences: ["Risk-based inspection methodology differs", "NORSOK qualification requirements differ", "Acceptance criteria may vary from API 570"], usage_rule: "SUPPLEMENTAL_ONLY" },
    eu: { equivalent: "EN 13480 (in-service)", equivalence_type: "PARTIAL", differences: ["PED compliance required", "Harmonized standards differ", "Notified Body involvement required"], usage_rule: "NOT_PRIMARY" },
    uk: { equivalent: "BS EN 13480 / PER 1999 / SAFed guidelines", equivalence_type: "PARTIAL", differences: ["Pressure Equipment Regulations 1999 govern", "Written scheme of examination required", "Competent Person oversight required"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["Australian in-service inspection standard governs", "State-level WorkSafe registration required"], usage_rule: "NOT_PRIMARY" },
    brazil: { equivalent: "NR-13 / ABNT NBR 15749", equivalence_type: "PARTIAL", differences: ["NR-13 is mandatory Brazilian regulation", "ABNT standards supplement", "ANP oversight for oil & gas"], usage_rule: "NOT_PRIMARY" }
  },
  "API 510": {
    canada: { equivalent: "CSA B51", equivalence_type: "PARTIAL", differences: ["CSA B51 covers boilers and pressure vessels", "Provincial jurisdiction applies", "CRN required"], usage_rule: "CSA_PRIMARY" },
    norway: { equivalent: "NORSOK + EN 13445", equivalence_type: "PARTIAL", differences: ["EN 13445 for design/fabrication", "NORSOK for offshore integrity management", "PSA regulatory oversight required"], usage_rule: "NOT_PRIMARY" },
    eu: { equivalent: "EN 13445 + PED 2014/68/EU", equivalence_type: "PARTIAL", differences: ["PED 2014/68/EU mandatory", "EN 13445 for unfired pressure vessels", "CE marking required", "Notified Body involvement"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS 1210 + AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["AS 1210 for design of pressure vessels", "AS/NZS 3788 for in-service inspection", "State/territory WorkSafe requirements"], usage_rule: "NOT_PRIMARY" },
    uk: { equivalent: "PER 1999 / PSSR 2000 / EN 13445", equivalence_type: "PARTIAL", differences: ["HSE written scheme required", "Competent Person oversight", "UKCA marking post-Brexit"], usage_rule: "NOT_PRIMARY" }
  },
  "ASME B31.3": {
    australia: { equivalent: "AS 4458 / AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["AS 4458 for pressure piping construction", "AS/NZS 3788 for in-service", "State WorkSafe registration"], usage_rule: "NOT_PRIMARY" },
    norway: { equivalent: "NORSOK L-001 / DNV-OS-F101", equivalence_type: "PARTIAL", differences: ["NORSOK governs piping design offshore", "DNV rules for subsea piping", "PSA oversight"], usage_rule: "NOT_PRIMARY" },
    uk: { equivalent: "PD 8010 / BS EN 13480", equivalence_type: "PARTIAL", differences: ["EN 13480 for metallic industrial piping", "PD 8010 for pipeline systems", "HSE oversight"], usage_rule: "NOT_PRIMARY" }
  },
  "ASME BPVC Section VIII": {
    eu: { equivalent: "EN 13445", equivalence_type: "PARTIAL", differences: ["Different design methodology (DBA vs DBF)", "PED Essential Safety Requirements apply", "Material specifications differ"], usage_rule: "NOT_PRIMARY" },
    germany: { equivalent: "AD 2000 Merkblätter / EN 13445", equivalence_type: "PARTIAL", differences: ["AD 2000 historically used", "TÜV involvement required", "Different safety factors"], usage_rule: "NOT_PRIMARY" },
    china: { equivalent: "GB 150", equivalence_type: "PARTIAL", differences: ["GB 150 is mandatory national standard", "SAMR certification required", "ASME stamp NOT accepted"], usage_rule: "NOT_PRIMARY", critical_note: "ASME stamp NOT accepted as compliance proof in China" }
  },
  "AWS D1.1": {
    uk: { equivalent: "BS EN 1090 / EN ISO 15614", equivalence_type: "PARTIAL", differences: ["EN ISO 15614 for procedure qualification", "Execution class system (EXC1-4) replaces AWS categories", "CE/UKCA marking required"], usage_rule: "NOT_PRIMARY" },
    eu: { equivalent: "EN 1090 / EN ISO 15614 / EN ISO 3834", equivalence_type: "PARTIAL", differences: ["EN 1090 for structural steel execution", "EN ISO 3834 for quality requirements", "Factory Production Control required"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS/NZS 1554", equivalence_type: "PARTIAL", differences: ["AS/NZS 1554 for structural steel welding", "Australian welder qualification per AS/NZS ISO 9606"], usage_rule: "NOT_PRIMARY" }
  }
};

const REGION_FALLBACK: Record<string, string> = {
  germany: "eu",
  france: "eu",
  italy: "eu",
  spain: "eu",
  netherlands: "eu",
  belgium: "eu",
  austria: "eu",
  sweden: "eu",
  alberta: "canada",
  scotland: "uk",
  wales: "uk",
  new_zealand: "australia"
};

function findCrosswalk(requestedCode: string, jurisdictionKey: string): CrosswalkEntry | null {
  // Direct match
  if (CROSSWALK_MATRIX[requestedCode]?.[jurisdictionKey]) {
    return CROSSWALK_MATRIX[requestedCode][jurisdictionKey];
  }
  // Region fallback
  const fallback = REGION_FALLBACK[jurisdictionKey];
  if (fallback && CROSSWALK_MATRIX[requestedCode]?.[fallback]) {
    return CROSSWALK_MATRIX[requestedCode][fallback];
  }
  // Fuzzy code name match
  for (const cwKey of Object.keys(CROSSWALK_MATRIX)) {
    if (requestedCode.indexOf(cwKey) >= 0 || cwKey.indexOf(requestedCode) >= 0) {
      if (CROSSWALK_MATRIX[cwKey][jurisdictionKey]) return CROSSWALK_MATRIX[cwKey][jurisdictionKey];
      if (fallback && CROSSWALK_MATRIX[cwKey][fallback]) return CROSSWALK_MATRIX[cwKey][fallback];
    }
  }
  return null;
}

// ============================================================
// MAIN ENGINE OUTPUT
// ============================================================
interface EngineInput {
  asset_description?: string;
  location_text?: string;
  units_detected?: string;
  asset_type?: string;
  inspection_method?: string;
  requested_code?: string;
  operator_name?: string;
  owner_user_program?: string;
  // Legacy v2.0 format support
  jurisdiction?: string;
  us_codes?: string[];
  us_codes_requested?: string[];
}

interface AuditEntry {
  timestamp: string;
  step: string;
  decision: string;
  basis: string;
}

interface EngineOutput {
  engine: string;
  version: string;
  country: string | null;
  region_or_state?: string | null;
  jurisdiction_status: "RESOLVED" | "INFERRED" | "UNKNOWN";
  primary_authority: string;
  secondary_authorities?: string[];
  decision_lock: DecisionLock;
  unit_issue: boolean;
  unit_conversion_required: boolean;
  conversion_check?: string;
  technical_disposition?: string;
  warning?: string;
  mandatory_user_questions?: string[];
  crosswalk?: {
    us_code: string;
    local_equivalent: string;
    equivalence_type: string;
    usage_rule: string;
    differences: string[];
  } | null;
  unit_system: {
    detected: string;
    jurisdiction_expects: string;
    conversion_required: boolean;
  };
  inspector_message: string;
  audit_trace: AuditEntry[];
  metadata: {
    engine: string;
    version: string;
    timestamp: string;
    input_hash: string;
  };
}

function processAuthorityV2(input: EngineInput): EngineOutput {
  const now = new Date().toISOString();
  const audit: AuditEntry[] = [];

  // Normalize input — support both v2.0 and v2.1 formats
  const locationText = input.location_text || input.jurisdiction || "";
  const requestedCode = input.requested_code || (input.us_codes_requested || input.us_codes || [])[0] || "";
  const assetDescription = input.asset_description || "";
  const unitsDetected = input.units_detected || "UNKNOWN";
  const assetType = input.asset_type || "Unknown";

  audit.push({ timestamp: now, step: "input_received", decision: `location="${locationText}", code="${requestedCode}", units="${unitsDetected}"`, basis: "Raw input" });

  // Step 1: Resolve jurisdiction from location text
  const location = resolveLocationText(locationText);
  audit.push({ timestamp: now, step: "jurisdiction_resolution", decision: `key=${location.jurisdiction_key || "UNKNOWN"}, country=${location.country || "UNKNOWN"}, is_us=${location.is_us}, offshore=${location.is_offshore}`, basis: "NLP location resolver" });

  // Step 2: Analyze authority conflict
  const conflict = analyzeAuthorityConflict(requestedCode, location, input.owner_user_program, input.operator_name);
  audit.push({ timestamp: now, step: "authority_conflict_analysis", decision: `conflict=${conflict.has_conflict}, controlling=${conflict.code_is_controlling}, contractual=${conflict.code_is_contractual}`, basis: "Code vs jurisdiction comparison" });

  // Step 3: Unit analysis
  const unitResult = analyzeUnits(assetDescription, unitsDetected, location.jurisdiction_entry, location.is_us);
  audit.push({ timestamp: now, step: "unit_analysis", decision: `detected=${unitResult.detected_units}, expects=${unitResult.jurisdiction_expects}, conversion_required=${unitResult.unit_conversion_required}`, basis: "Unit conversion engine" });

  // Step 4: Generate mandatory questions
  const mandatoryQuestions = generateMandatoryQuestions(location, requestedCode, conflict);

  // Step 5: Decision lock
  const decisionLock = determineDecisionLock(location, conflict, unitResult, mandatoryQuestions);
  audit.push({ timestamp: now, step: "decision_lock", decision: decisionLock, basis: "Combined jurisdiction + conflict + unit analysis" });

  // Step 6: Crosswalk lookup (non-US only)
  let crosswalk: EngineOutput["crosswalk"] = null;
  if (!location.is_us && location.jurisdiction_key && requestedCode) {
    const cw = findCrosswalk(requestedCode, location.jurisdiction_key);
    if (cw) {
      crosswalk = {
        us_code: requestedCode,
        local_equivalent: cw.equivalent,
        equivalence_type: cw.equivalence_type,
        usage_rule: cw.usage_rule,
        differences: cw.differences
      };
      audit.push({ timestamp: now, step: "crosswalk_applied", decision: `${requestedCode} → ${cw.equivalent} (${cw.usage_rule})`, basis: "Standard Equivalency Table" });
    }
  }

  // Step 7: Build secondary authorities
  let secondaryAuthorities: string[] | undefined;
  if (!location.is_us && location.jurisdiction_entry) {
    const secs: string[] = [];
    if (conflict.code_is_contractual) {
      secs.push(`${requestedCode} by contract`);
    }
    if (location.jurisdiction_key === "norway") {
      secs.push("NORSOK", "DNV", "operator specification");
    }
    if (location.jurisdiction_key === "offshore_international") {
      secs.push("DNV", "ABS", "Lloyd's Register", "Bureau Veritas", "operator specification");
    }
    if (secs.length > 0) secondaryAuthorities = secs;
  }

  // Step 8: Determine primary authority string
  let primaryAuthority: string;
  if (location.is_us) {
    primaryAuthority = requestedCode || "API / ASME codes";
  } else if (location.jurisdiction_entry) {
    primaryAuthority = location.jurisdiction_entry.primary_authority_description;
  } else if (location.jurisdiction_key === "offshore_international") {
    primaryAuthority = "Flag state / class society / maritime regulatory framework";
  } else {
    primaryAuthority = "UNKNOWN — jurisdiction must be confirmed";
  }

  // Step 9: Build warning
  let warning: string | undefined;
  // Imperial trap takes priority when jurisdiction is unknown
  if (location.is_unknown && (unitsDetected === "IMPERIAL" || unitsDetected === "UNKNOWN")) {
    warning = "Imperial units and " + requestedCode + " are not enough to confirm U.S. jurisdiction.";
  } else if (conflict.warning) {
    warning = conflict.warning;
  }
  if (unitResult.threshold_violation) {
    const tv = unitResult.threshold_violation;
    warning = (warning ? warning + " " : "") + `Measured ${tv.measured.split(" (")[0]} is below required ${tv.required.split(" (")[0]}. Do not accept.`;
  }

  // Step 10: Inspector message
  let inspectorMessage: string;
  if (location.is_us && !unitResult.unit_conversion_required) {
    inspectorMessage = `${requestedCode} applies directly. Asset in U.S. jurisdiction. Standard acceptance criteria apply.`;
  } else if (location.is_us && unitResult.unit_conversion_required) {
    inspectorMessage = `${requestedCode} applies in U.S. jurisdiction. CAUTION: Mixed units detected — verify all conversions before final disposition.`;
    if (unitResult.threshold_violation) {
      inspectorMessage += ` CRITICAL: Measured thickness is below minimum required after conversion. REJECT.`;
    }
  } else if (location.is_unknown) {
    inspectorMessage = `Jurisdiction cannot be confirmed from available data. HOLD — do not lock to any code until location and authority are verified.`;
  } else {
    inspectorMessage = `Asset in ${location.country}${location.region_or_state ? "/" + location.region_or_state : ""}. ${primaryAuthority} governs. ${requestedCode} is ${conflict.code_is_contractual ? "contractual supplement" : "reference only"} unless contractually adopted.`;
  }

  // Build output
  const output: EngineOutput = {
    engine: "global-authority-engine",
    version: "2.1.0",
    country: location.country,
    jurisdiction_status: location.is_unknown ? "UNKNOWN" : (location.confidence === "high" ? "RESOLVED" : "INFERRED"),
    primary_authority: primaryAuthority,
    decision_lock: decisionLock,
    unit_issue: unitResult.unit_conversion_required,
    unit_conversion_required: unitResult.unit_conversion_required,
    unit_system: {
      detected: unitResult.detected_units,
      jurisdiction_expects: unitResult.jurisdiction_expects,
      conversion_required: unitResult.unit_conversion_required
    },
    inspector_message: inspectorMessage,
    audit_trace: audit,
    metadata: {
      engine: "global-authority-engine",
      version: "2.1.0",
      timestamp: now,
      input_hash: `${locationText}|${requestedCode}|${assetType}`
    }
  };

  // Conditional fields
  if (location.region_or_state) output.region_or_state = location.region_or_state;
  if (secondaryAuthorities && secondaryAuthorities.length > 0) output.secondary_authorities = secondaryAuthorities;
  if (warning) output.warning = warning;
  if (mandatoryQuestions.length > 0) output.mandatory_user_questions = mandatoryQuestions;
  if (crosswalk) output.crosswalk = crosswalk;
  if (unitResult.conversion_check) output.conversion_check = unitResult.conversion_check;
  if (unitResult.threshold_violation) output.technical_disposition = unitResult.threshold_violation.disposition;

  return output;
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
    const body: EngineInput = JSON.parse(event.body || "{}");

    if (!body.asset_type && !body.asset_description) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "asset_type or asset_description required" }) };
    }

    const result = processAuthorityV2(body);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Global Authority Engine error: " + (err.message || String(err)) }) };
  }
};
