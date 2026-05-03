/**
 * FIELD CHAOS VALIDATOR v1.0.0
 * FORGED 4D NDT Intelligence OS
 *
 * Validates the full platform using real messy field inputs:
 * - scanned inspection reports
 * - conflicting WPS documents
 * - incomplete field data
 * - inspector voice-to-text
 * - photos / image notes
 * - mixed units
 * - wrong-code requests
 * - missing authority
 * - conflicting uploaded documents
 *
 * 7-Stage Pipeline:
 *   Stage 1 — Evidence Intake
 *   Stage 2 — Structured Extraction
 *   Stage 3 — Conflict Detection
 *   Stage 4 — Global Authority Engine v2.2
 *   Stage 5 — Technical Sufficiency Engine
 *   Stage 6 — Human Review Gate
 *   Stage 7 — Final Output
 *
 * Engine: field-chaos-validator
 * Version: 1.0.0
 * Input: POST { case_id, case_title, documents[], voice_transcripts[], photos[], field_notes[], measurements{}, asset_info{}, code_references{} }
 * Output: Full Field Chaos Validation output object
 */

import { Handler } from "@netlify/functions";
import { randomUUID } from "crypto";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface DocumentInput {
  filename: string;
  type: "ut_report" | "paut_report" | "rt_report" | "mt_report" | "pt_report" | "wps" | "pqr" | "itp" | "client_spec" | "procedure" | "drawing" | "photo" | "unknown";
  content_text?: string;
  ocr_confidence?: number;
  metadata?: Record<string, any>;
}

interface VoiceTranscript {
  speaker?: string;
  text: string;
  timestamp?: string;
  confidence?: number;
}

interface Measurement {
  location: string;
  value: number;
  unit: "mm" | "in" | "inches" | "millimeters";
  nominal?: number;
  t_min?: number;
  reading_type?: string;
}

interface AssetInfo {
  asset_type?: string;
  asset_id?: string;
  location_text?: string;
  material?: string;
  service?: string;
  owner_operator?: string;
  component_type?: string;
  multi_asset?: boolean;
  asset_list?: string[];
}

interface CodeReference {
  requested_code?: string;
  requested_edition?: string;
  wps_code?: string;
  wps_edition?: string;
  client_spec_code?: string;
  procedure_code?: string;
  procedure_edition?: string;
}

interface FieldChaosInput {
  case_id?: string;
  case_title?: string;
  documents?: DocumentInput[];
  voice_transcripts?: VoiceTranscript[];
  photos?: DocumentInput[];
  field_notes?: string[];
  measurements?: Measurement[];
  asset_info?: AssetInfo;
  code_references?: CodeReference;
  wps_data?: WPSData[];
  acceptance_criteria?: AcceptanceCriteria;
  flags?: string[];
}

interface WPSData {
  revision: string;
  process?: string;
  filler_metal?: string;
  base_material?: string;
  preheat?: string;
  preheat_value?: number;
  preheat_unit?: string;
  approved_date?: string;
  status?: string;
}

interface AcceptanceCriteria {
  code?: string;
  minimum_thickness?: number;
  minimum_thickness_unit?: string;
  flaw_acceptance?: string;
  readable?: boolean;
}

interface ConflictRecord {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  source_a: string;
  source_b: string;
  resolution_required: boolean;
}

interface AuditStep {
  timestamp: string;
  stage: string;
  decision: string;
  basis: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const VERSION = "1.0.0";

const UNIT_CONVERSIONS: Record<string, number> = {
  "in_to_mm": 25.4,
  "mm_to_in": 1 / 25.4,
  "ft_to_m": 0.3048,
  "m_to_ft": 1 / 0.3048,
};

// Codes that only apply to specific asset types
const CODE_ASSET_RESTRICTIONS: Record<string, string[]> = {
  "API 570": ["Process Piping", "Piping", "Pipeline"],
  "API 510": ["Pressure Vessel", "Vessel", "Heat Exchanger", "Reactor"],
  "API 653": ["Storage Tank", "Tank", "AST"],
  "API 1104": ["Pipeline", "Transmission Pipeline"],
  "AWS D1.1": ["Structural Steel", "Steel Structure", "Bridge"],
  "ASME B31.3": ["Process Piping", "Piping"],
  "DNV-ST-F101": ["Subsea Pipeline", "Pipeline", "Riser"],
};

// Codes that belong to specific jurisdictions
const CODE_JURISDICTION_MAP: Record<string, string[]> = {
  "API 570": ["us", "international_contract"],
  "API 510": ["us", "international_contract"],
  "API 653": ["us", "international_contract"],
  "ASME BPVC Section VIII": ["us", "international_contract"],
  "ASME B31.3": ["us", "international_contract"],
  "CSA Z662": ["canada", "alberta"],
  "CSA B51": ["canada"],
  "EN 13445": ["eu", "netherlands", "germany", "france"],
  "PED 2014/68/EU": ["eu", "netherlands", "germany", "france"],
  "NORSOK M-001": ["norway"],
  "DNV-ST-F101": ["norway", "international_contract"],
  "AS/NZS 3788": ["australia"],
  "NR-13": ["brazil"],
  "GB 150": ["china"],
  "AWS D1.1": ["us"],
  "AWS D1.6": ["us"],
};

// Materials that indicate stainless steel
const STAINLESS_INDICATORS = ["316", "316L", "304", "304L", "321", "347", "stainless", "SS", "austenitic"];

// ============================================================
// STAGE 1 — EVIDENCE INTAKE
// ============================================================

function stageEvidenceIntake(input: FieldChaosInput): {
  documents_processed: any[];
  input_quality_score: number;
  audit: AuditStep;
} {
  const docs: any[] = [];
  let quality_total = 0;
  let doc_count = 0;

  // Process documents
  if (input.documents) {
    for (const doc of input.documents) {
      const confidence = doc.ocr_confidence ?? (doc.content_text ? 0.9 : 0.3);
      docs.push({
        filename: doc.filename,
        type: doc.type,
        extraction_confidence: confidence,
        has_text: !!doc.content_text,
        flagged_low_quality: confidence < 0.6,
      });
      quality_total += confidence;
      doc_count++;
    }
  }

  // Process photos
  if (input.photos) {
    for (const photo of input.photos) {
      docs.push({
        filename: photo.filename,
        type: "photo",
        extraction_confidence: photo.ocr_confidence ?? 0.5,
        has_text: !!photo.content_text,
        flagged_low_quality: (photo.ocr_confidence ?? 0.5) < 0.6,
      });
      quality_total += (photo.ocr_confidence ?? 0.5);
      doc_count++;
    }
  }

  // Process voice transcripts
  if (input.voice_transcripts) {
    for (const vt of input.voice_transcripts) {
      docs.push({
        filename: `voice_transcript_${vt.timestamp || "unknown"}`,
        type: "voice_transcript",
        extraction_confidence: vt.confidence ?? 0.7,
        has_text: true,
        flagged_low_quality: (vt.confidence ?? 0.7) < 0.6,
      });
      quality_total += (vt.confidence ?? 0.7);
      doc_count++;
    }
  }

  // Process field notes
  if (input.field_notes) {
    for (let i = 0; i < input.field_notes.length; i++) {
      docs.push({
        filename: `field_note_${i + 1}`,
        type: "field_note",
        extraction_confidence: 0.8,
        has_text: true,
        flagged_low_quality: false,
      });
      quality_total += 0.8;
      doc_count++;
    }
  }

  const input_quality_score = doc_count > 0 ? Math.round((quality_total / doc_count) * 100) / 100 : 0;

  return {
    documents_processed: docs,
    input_quality_score,
    audit: {
      timestamp: new Date().toISOString(),
      stage: "evidence_intake",
      decision: `Processed ${doc_count} evidence items. Quality score: ${input_quality_score}`,
      basis: "Document classification + OCR confidence assessment",
    },
  };
}

// ============================================================
// STAGE 2 — STRUCTURED EXTRACTION
// ============================================================

function stageStructuredExtraction(input: FieldChaosInput): {
  extracted_facts: Record<string, any>;
  extraction_confidence: number;
  audit: AuditStep;
} {
  const facts: Record<string, any> = {};
  let confidence_factors: number[] = [];

  // Asset information
  if (input.asset_info) {
    facts.asset_type = input.asset_info.asset_type || null;
    facts.asset_id = input.asset_info.asset_id || null;
    facts.location = input.asset_info.location_text || null;
    facts.material = input.asset_info.material || null;
    facts.service = input.asset_info.service || null;
    facts.owner_operator = input.asset_info.owner_operator || null;
    facts.component_type = input.asset_info.component_type || null;
    facts.multi_asset = input.asset_info.multi_asset || false;
    facts.asset_list = input.asset_info.asset_list || null;

    if (facts.location) confidence_factors.push(0.9);
    else confidence_factors.push(0.2);

    if (facts.asset_type) confidence_factors.push(0.9);
    else confidence_factors.push(0.3);
  } else {
    confidence_factors.push(0.1);
  }

  // Code references
  if (input.code_references) {
    facts.requested_code = input.code_references.requested_code || null;
    facts.requested_edition = input.code_references.requested_edition || null;
    facts.wps_code = input.code_references.wps_code || null;
    facts.procedure_code = input.code_references.procedure_code || null;
    facts.procedure_edition = input.code_references.procedure_edition || null;
    facts.client_spec_code = input.code_references.client_spec_code || null;
    if (facts.requested_code) confidence_factors.push(0.8);
  }

  // Measurements
  if (input.measurements && input.measurements.length > 0) {
    facts.measurements = input.measurements;
    facts.units_detected = detectUnits(input.measurements);
    facts.has_thickness_data = true;

    // Check for t-min
    const has_tmin = input.measurements.some(m => m.t_min !== undefined && m.t_min !== null);
    facts.has_t_min = has_tmin;
    if (has_tmin) confidence_factors.push(0.9);
    else confidence_factors.push(0.4);
  } else {
    facts.has_thickness_data = false;
    facts.has_t_min = false;
  }

  // WPS data
  if (input.wps_data && input.wps_data.length > 0) {
    facts.wps_revisions = input.wps_data.map(w => w.revision);
    facts.wps_process = input.wps_data[0].process || null;
    facts.wps_filler_metal = input.wps_data[0].filler_metal || null;
    facts.wps_base_material = input.wps_data[0].base_material || null;
    confidence_factors.push(0.85);
  }

  // Voice transcripts — extract key phrases
  if (input.voice_transcripts && input.voice_transcripts.length > 0) {
    facts.voice_data = input.voice_transcripts.map(vt => vt.text);
    facts.voice_risk_indicators = detectVoiceRisk(input.voice_transcripts);
    confidence_factors.push(0.6); // voice is always less reliable
  }

  // Acceptance criteria
  if (input.acceptance_criteria) {
    facts.acceptance_criteria = input.acceptance_criteria;
    if (input.acceptance_criteria.readable === false) {
      confidence_factors.push(0.3);
    } else {
      confidence_factors.push(0.85);
    }
  }

  // OCR quality from documents
  if (input.documents) {
    const low_ocr = input.documents.filter(d => (d.ocr_confidence ?? 1) < 0.6);
    if (low_ocr.length > 0) {
      facts.low_ocr_documents = low_ocr.map(d => d.filename);
      confidence_factors.push(0.4);
    }
  }

  const extraction_confidence = confidence_factors.length > 0
    ? Math.round((confidence_factors.reduce((a, b) => a + b, 0) / confidence_factors.length) * 100) / 100
    : 0;

  return {
    extracted_facts: facts,
    extraction_confidence,
    audit: {
      timestamp: new Date().toISOString(),
      stage: "structured_extraction",
      decision: `Extracted ${Object.keys(facts).filter(k => facts[k] !== null && facts[k] !== undefined).length} structured fields. Confidence: ${extraction_confidence}`,
      basis: "Multi-source field extraction with confidence weighting",
    },
  };
}

function detectUnits(measurements: Measurement[]): string {
  const units = measurements.map(m => m.unit);
  const has_metric = units.some(u => u === "mm" || u === "millimeters");
  const has_imperial = units.some(u => u === "in" || u === "inches");
  if (has_metric && has_imperial) return "MIXED";
  if (has_metric) return "METRIC";
  if (has_imperial) return "IMPERIAL";
  return "UNKNOWN";
}

function detectVoiceRisk(transcripts: VoiceTranscript[]): string[] {
  const risks: string[] = [];
  const all_text = transcripts.map(t => t.text.toLowerCase()).join(" ");

  if (all_text.includes("under min") || all_text.includes("below min") || all_text.includes("below minimum")) {
    risks.push("BELOW_MINIMUM_ACKNOWLEDGED");
  }
  if (all_text.includes("don't red tag") || all_text.includes("dont red tag") || all_text.includes("no red tag")) {
    risks.push("PRESSURE_TO_AVOID_REJECTION");
  }
  if (all_text.includes("boss wants") || all_text.includes("client wants") || all_text.includes("make it pass")) {
    risks.push("BUSINESS_PRESSURE_DETECTED");
  }
  if (all_text.includes("green") && (all_text.includes("wants") || all_text.includes("make it"))) {
    risks.push("PRESSURE_TO_ACCEPT");
  }
  if (all_text.includes("skip") || all_text.includes("ignore") || all_text.includes("don't report")) {
    risks.push("PRESSURE_TO_SUPPRESS_FINDING");
  }

  return risks;
}

// ============================================================
// STAGE 3 — CONFLICT DETECTION
// ============================================================

function stageConflictDetection(input: FieldChaosInput, facts: Record<string, any>): {
  conflicts: ConflictRecord[];
  audit: AuditStep;
} {
  const conflicts: ConflictRecord[] = [];

  // --- WPS vs Field Material Conflict ---
  if (input.wps_data && input.wps_data.length > 0 && facts.material) {
    const wps_material = input.wps_data[0].base_material || "";
    const field_material = facts.material || "";

    const wps_is_stainless = STAINLESS_INDICATORS.some(s => wps_material.toLowerCase().includes(s.toLowerCase()));
    const field_is_stainless = STAINLESS_INDICATORS.some(s => field_material.toLowerCase().includes(s.toLowerCase()));

    if (wps_is_stainless !== field_is_stainless) {
      conflicts.push({
        type: "WPS_MATERIAL_MISMATCH",
        severity: "CRITICAL",
        description: `WPS base material (${wps_material}) does not match field material (${field_material}). Carbon steel WPS cannot be used for stainless steel weld.`,
        source_a: `WPS ${input.wps_data[0].revision}`,
        source_b: "Field observation / photo",
        resolution_required: true,
      });
    }
  }

  // --- WPS Edition/Revision Conflict ---
  if (input.wps_data && input.wps_data.length > 1) {
    const revisions = input.wps_data.map(w => w.revision);
    const preheat_values = input.wps_data.map(w => w.preheat_value).filter(v => v !== undefined);
    const unique_preheats = [...new Set(preheat_values)];

    if (unique_preheats.length > 1) {
      conflicts.push({
        type: "WPS_REVISION_CONFLICT",
        severity: "CRITICAL",
        description: `Multiple WPS revisions with conflicting parameters. Preheat values: ${unique_preheats.join(" vs ")}. Revisions: ${revisions.join(", ")}`,
        source_a: `WPS ${revisions[0]}`,
        source_b: `WPS ${revisions[revisions.length - 1]}`,
        resolution_required: true,
      });
    } else if (revisions.length > 1) {
      conflicts.push({
        type: "WPS_MULTIPLE_REVISIONS",
        severity: "HIGH",
        description: `Multiple WPS revisions present: ${revisions.join(", ")}. Must confirm which revision was approved at time of weld.`,
        source_a: `WPS ${revisions[0]}`,
        source_b: `WPS ${revisions[revisions.length - 1]}`,
        resolution_required: true,
      });
    }
  }

  // --- Code vs Jurisdiction Conflict ---
  if (facts.requested_code && facts.location) {
    const code = facts.requested_code;
    const location = (facts.location || "").toLowerCase();

    // Check if code is applied to wrong asset type
    if (facts.asset_type && CODE_ASSET_RESTRICTIONS[code]) {
      const allowed = CODE_ASSET_RESTRICTIONS[code];
      const asset = facts.asset_type;
      if (!allowed.some(a => asset.toLowerCase().includes(a.toLowerCase()))) {
        conflicts.push({
          type: "CODE_ASSET_MISMATCH",
          severity: "CRITICAL",
          description: `${code} is not applicable to asset type "${asset}". ${code} applies to: ${allowed.join(", ")}.`,
          source_a: `Requested code: ${code}`,
          source_b: `Asset type: ${asset}`,
          resolution_required: true,
        });
      }
    }
  }

  // --- Wrong welding code for material ---
  if (facts.requested_code && facts.material) {
    const code = facts.requested_code;
    const material = facts.material.toLowerCase();
    const is_stainless = STAINLESS_INDICATORS.some(s => material.includes(s.toLowerCase()));

    if (code === "AWS D1.1" && is_stainless) {
      conflicts.push({
        type: "WRONG_WELD_CODE_FOR_MATERIAL",
        severity: "CRITICAL",
        description: `AWS D1.1 is for structural carbon/low-alloy steel. Stainless steel (${facts.material}) requires AWS D1.6 or ASME Section IX / B31.3 for process piping.`,
        source_a: `Requested code: AWS D1.1`,
        source_b: `Field material: ${facts.material}`,
        resolution_required: true,
      });
    }
  }

  // --- Unit Conflicts ---
  if (facts.units_detected === "MIXED") {
    conflicts.push({
      type: "MIXED_UNITS",
      severity: "HIGH",
      description: "Mixed metric and imperial units detected in measurements. Conversion required before acceptance evaluation.",
      source_a: "Measurement data (metric)",
      source_b: "Measurement data (imperial)",
      resolution_required: true,
    });
  }

  // --- European decimal comma detection ---
  if (input.measurements) {
    for (const m of input.measurements) {
      if (input.flags && input.flags.includes("EUROPEAN_DECIMAL_COMMA")) {
        // Already handled by parser, just note it
      }
    }
  }

  // --- Voice vs Report Conflict ---
  if (facts.voice_risk_indicators && facts.voice_risk_indicators.length > 0) {
    if (facts.voice_risk_indicators.includes("BELOW_MINIMUM_ACKNOWLEDGED")) {
      conflicts.push({
        type: "VOICE_REPORT_CONFLICT",
        severity: "CRITICAL",
        description: "Voice transcript acknowledges below-minimum condition. Business pressure detected to accept unsafe condition.",
        source_a: "Voice transcript",
        source_b: "Measurement data / Report",
        resolution_required: true,
      });
    }
    if (facts.voice_risk_indicators.includes("BUSINESS_PRESSURE_DETECTED") || facts.voice_risk_indicators.includes("PRESSURE_TO_ACCEPT")) {
      conflicts.push({
        type: "BUSINESS_PRESSURE_OVERRIDE",
        severity: "CRITICAL",
        description: "Business pressure detected in voice transcript to override technical disposition. System will not allow pressure to override safety.",
        source_a: "Voice transcript — business instruction",
        source_b: "Technical measurement data",
        resolution_required: true,
      });
    }
  }

  // --- Below Minimum Detection ---
  if (input.measurements) {
    for (const m of input.measurements) {
      if (m.t_min !== undefined && m.t_min !== null) {
        let measured_mm = m.value;
        let tmin_mm = m.t_min;

        // Normalize to mm
        if (m.unit === "in" || m.unit === "inches") {
          measured_mm = m.value * 25.4;
        }
        // Check if t_min unit matches
        if (input.acceptance_criteria?.minimum_thickness_unit === "in" || input.acceptance_criteria?.minimum_thickness_unit === "inches") {
          tmin_mm = m.t_min * 25.4;
        }

        if (measured_mm < tmin_mm) {
          conflicts.push({
            type: "BELOW_MINIMUM_THICKNESS",
            severity: "CRITICAL",
            description: `Measurement at ${m.location}: ${m.value} ${m.unit} is BELOW minimum required ${m.t_min} ${input.acceptance_criteria?.minimum_thickness_unit || m.unit}. After conversion: ${measured_mm.toFixed(2)} mm < ${tmin_mm.toFixed(2)} mm.`,
            source_a: `Measured: ${m.value} ${m.unit}`,
            source_b: `t-min: ${m.t_min} ${input.acceptance_criteria?.minimum_thickness_unit || m.unit}`,
            resolution_required: true,
          });
        }
      }
    }
  }

  // --- Multi-Asset Single-Code Conflict ---
  if (facts.multi_asset && facts.asset_list && facts.asset_list.length > 1 && facts.requested_code) {
    const code = facts.requested_code;
    const restrictions = CODE_ASSET_RESTRICTIONS[code];
    if (restrictions) {
      const non_matching = facts.asset_list.filter(
        (a: string) => !restrictions.some(r => a.toLowerCase().includes(r.toLowerCase()))
      );
      if (non_matching.length > 0) {
        conflicts.push({
          type: "MULTI_ASSET_CODE_MISMATCH",
          severity: "CRITICAL",
          description: `${code} cannot be applied to all assets. Non-applicable: ${non_matching.join(", ")}. Each asset type requires its own code authority.`,
          source_a: `Requested: single ${code} disposition`,
          source_b: `Asset list: ${facts.asset_list.join(", ")}`,
          resolution_required: true,
        });
      }
    }
  }

  // --- Owner Spec vs Regulation Conflict ---
  if (input.flags && input.flags.includes("OWNER_SPEC_OVERRIDE_ATTEMPT")) {
    conflicts.push({
      type: "OWNER_SPEC_VS_REGULATION",
      severity: "CRITICAL",
      description: "Owner specification attempts to override regulatory requirement. Law/regulation always takes precedence over owner specification without formal engineering assessment.",
      source_a: "Owner specification",
      source_b: "Regulatory requirement / Provincial authority",
      resolution_required: true,
    });
  }

  // --- Procedure/Edition Staleness ---
  if (facts.procedure_edition) {
    const edition_year = extractYear(facts.procedure_edition);
    if (edition_year && edition_year < 2010) {
      conflicts.push({
        type: "STALE_PROCEDURE_EDITION",
        severity: "HIGH",
        description: `Procedure references edition from ${edition_year}. Current editions may differ significantly. Verify if this edition is still contractually approved.`,
        source_a: `Procedure edition: ${facts.procedure_edition}`,
        source_b: "Current edition registry",
        resolution_required: true,
      });
    }
  }

  // --- Low OCR confidence on critical documents ---
  if (facts.low_ocr_documents && facts.low_ocr_documents.length > 0) {
    conflicts.push({
      type: "LOW_OCR_CONFIDENCE",
      severity: "HIGH",
      description: `Low extraction confidence on: ${facts.low_ocr_documents.join(", ")}. Data from these documents cannot be treated as reliable.`,
      source_a: "OCR extraction",
      source_b: "Original scanned document",
      resolution_required: true,
    });
  }

  return {
    conflicts,
    audit: {
      timestamp: new Date().toISOString(),
      stage: "conflict_detection",
      decision: `Detected ${conflicts.length} conflicts. Critical: ${conflicts.filter(c => c.severity === "CRITICAL").length}`,
      basis: "Multi-document cross-reference analysis",
    },
  };
}

function extractYear(text: string): number | null {
  const match = text.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

// ============================================================
// STAGE 4 — GLOBAL AUTHORITY ENGINE (inline v2.2 call)
// ============================================================

function stageAuthorityEngine(facts: Record<string, any>, input: FieldChaosInput): {
  authority_decision: Record<string, any>;
  audit: AuditStep;
} {
  const location = facts.location || "";
  const code = facts.requested_code || "";
  const asset_type = facts.asset_type || "";
  const units = facts.units_detected || "UNKNOWN";

  // Jurisdiction resolution
  const jurisdiction = resolveJurisdiction(location);

  // Edition check
  const edition_info = checkEdition(code, facts.procedure_edition || facts.requested_edition || "");

  // Authority confidence
  let authority_confidence = 0.9;
  if (jurisdiction.key === "UNKNOWN") authority_confidence = 0.1;
  if (!code) authority_confidence = 0;

  // Decision lock logic
  let decision_lock = "ALLOW";
  let final_disposition_allowed = true;
  const mandatory_questions: string[] = [];

  if (jurisdiction.key === "UNKNOWN") {
    decision_lock = "HOLD_FOR_AUTHORITY";
    final_disposition_allowed = false;
    mandatory_questions.push("What country is the asset located in?");
    mandatory_questions.push("Is the asset onshore or offshore?");
    if (units === "IMPERIAL") {
      mandatory_questions.push("Imperial units detected but location unknown — confirm jurisdiction.");
    }
  }

  if (edition_info.status === "SUPERSEDED" || edition_info.status === "WITHDRAWN") {
    decision_lock = "BLOCK";
    final_disposition_allowed = false;
  } else if (edition_info.status === "OLD_EDITION") {
    decision_lock = "MANUAL_AUTHORITY_REVIEW";
    final_disposition_allowed = false;
    mandatory_questions.push("Is this older edition still contractually approved?");
    mandatory_questions.push("Provide current controlled procedure or approved legacy basis.");
  }

  // International waters / missing flag state
  if (input.flags && input.flags.includes("INTERNATIONAL_WATERS")) {
    decision_lock = "HOLD_FOR_AUTHORITY";
    final_disposition_allowed = false;
    mandatory_questions.push("What is the vessel flag state?");
    mandatory_questions.push("What class society governs?");
    mandatory_questions.push("What is the component type (hull, machinery, piping)?");
  }

  return {
    authority_decision: {
      jurisdiction_status: jurisdiction.key === "UNKNOWN" ? "UNKNOWN" : "CONFIRMED",
      country: jurisdiction.country,
      jurisdiction_key: jurisdiction.key,
      primary_authority: jurisdiction.authority || "UNKNOWN",
      requested_code: code,
      code_applicable: !!(code && jurisdiction.key !== "UNKNOWN"),
      edition_status: edition_info.status,
      authority_confidence,
      decision_lock,
      final_disposition_allowed,
      mandatory_questions,
    },
    audit: {
      timestamp: new Date().toISOString(),
      stage: "authority_engine",
      decision: `Jurisdiction: ${jurisdiction.key}, Code: ${code || "NONE"}, Edition: ${edition_info.status}, Lock: ${decision_lock}`,
      basis: "Global Authority Engine v2.2 routing",
    },
  };
}

function resolveJurisdiction(location: string): { key: string; country: string | null; authority: string | null } {
  const loc = location.toLowerCase();

  if (!location || location.trim() === "") {
    return { key: "UNKNOWN", country: null, authority: null };
  }

  // US patterns
  if (loc.includes("gulf of mexico") || loc.includes("texas") || loc.includes("louisiana") ||
      loc.includes("california") || loc.includes("usa") || loc.includes("united states") ||
      loc.includes("u.s.") || loc.includes("alaska")) {
    return { key: "us", country: "United States", authority: "ASME / API / OSHA / owner-user" };
  }

  // Canada
  if (loc.includes("alberta")) return { key: "alberta", country: "Canada", authority: "ABSA / Provincial pressure equipment authority" };
  if (loc.includes("canada") || loc.includes("ontario") || loc.includes("british columbia")) {
    return { key: "canada", country: "Canada", authority: "Provincial pressure equipment authority / CSA" };
  }

  // Norway
  if (loc.includes("norway") || loc.includes("norwegian") || loc.includes("north sea")) {
    return { key: "norway", country: "Norway", authority: "PSA / NORSOK / DNV" };
  }

  // EU countries
  if (loc.includes("netherlands") || loc.includes("rotterdam") || loc.includes("amsterdam")) {
    return { key: "netherlands", country: "Netherlands", authority: "PED / EN harmonized standards" };
  }
  if (loc.includes("germany") || loc.includes("hamburg") || loc.includes("munich")) {
    return { key: "germany", country: "Germany", authority: "PED / EN / TÜV" };
  }
  if (loc.includes("france") || loc.includes("paris")) {
    return { key: "france", country: "France", authority: "PED / EN / APAVE" };
  }

  // Brazil
  if (loc.includes("brazil") || loc.includes("campos") || loc.includes("petrobras")) {
    return { key: "brazil", country: "Brazil", authority: "NR-13 / ABNT / ANP" };
  }

  // China
  if (loc.includes("china") || loc.includes("shandong") || loc.includes("shanghai")) {
    return { key: "china", country: "China", authority: "GB / SAMR / TSA" };
  }

  // Australia
  if (loc.includes("australia") || loc.includes("perth") || loc.includes("western australia")) {
    return { key: "australia", country: "Australia", authority: "AS/NZS / WHS / SafeWork" };
  }

  // International waters
  if (loc.includes("international water") || loc.includes("high seas")) {
    return { key: "UNKNOWN", country: null, authority: null };
  }

  // Generic/ambiguous
  if (loc.match(/facility|site|plant|unit/i) && !loc.match(/texas|louisiana|alberta|norway|china/i)) {
    return { key: "UNKNOWN", country: null, authority: null };
  }

  return { key: "UNKNOWN", country: null, authority: null };
}

function checkEdition(code: string, reported_edition: string): { status: string; current_edition?: string } {
  const CURRENT_EDITIONS: Record<string, { current: string; year: number }> = {
    "API 570": { current: "4th Edition, 2016 (Add. 1, 2021)", year: 2016 },
    "API 510": { current: "11th Edition, 2023", year: 2023 },
    "API 653": { current: "5th Edition, 2014 (Add. 3, 2018)", year: 2014 },
    "ASME B31.3": { current: "2022 Edition", year: 2022 },
    "AWS D1.1": { current: "D1.1/D1.1M:2020", year: 2020 },
    "CSA Z662": { current: "CSA Z662:2023", year: 2023 },
  };

  if (!code) return { status: "NO_CODE" };

  const current = CURRENT_EDITIONS[code];
  if (!current) return { status: "VERIFIED_CURRENT" }; // Unknown code, pass through

  if (!reported_edition) return { status: "VERIFIED_CURRENT", current_edition: current.current };

  // Check for old edition
  const reported_year = extractYear(reported_edition);
  if (reported_year && reported_year < current.year - 5) {
    return { status: "OLD_EDITION", current_edition: current.current };
  }

  return { status: "VERIFIED_CURRENT", current_edition: current.current };
}

// ============================================================
// STAGE 5 — TECHNICAL SUFFICIENCY ENGINE
// ============================================================

function stageTechnicalSufficiency(facts: Record<string, any>, conflicts: ConflictRecord[], authority: Record<string, any>): {
  technical_sufficiency: Record<string, any>;
  audit: AuditStep;
} {
  const result: Record<string, any> = {
    sufficient_for_acceptance: false,
    sufficient_for_rejection: false,
    sufficient_for_repair: false,
    sufficient_for_ffs_escalation: false,
    sufficient_for_engineer_review: true,
    reason: "",
  };

  const reasons: string[] = [];

  // Check: enough data for acceptance?
  const has_measurements = facts.has_thickness_data;
  const has_tmin = facts.has_t_min;
  const has_code = !!facts.requested_code;
  const has_location = !!facts.location;
  const has_critical_conflicts = conflicts.some(c => c.severity === "CRITICAL");
  const has_below_min = conflicts.some(c => c.type === "BELOW_MINIMUM_THICKNESS");
  const has_business_pressure = conflicts.some(c => c.type === "BUSINESS_PRESSURE_OVERRIDE" || c.type === "VOICE_REPORT_CONFLICT");
  const low_ocr = conflicts.some(c => c.type === "LOW_OCR_CONFIDENCE");

  // ACCEPTANCE requires: measurements + t-min + code + location + no critical conflicts + above minimum
  if (has_measurements && has_tmin && has_code && has_location && !has_critical_conflicts && !has_below_min) {
    result.sufficient_for_acceptance = true;
  } else {
    if (!has_measurements) reasons.push("No thickness measurements");
    if (!has_tmin) reasons.push("No t-min provided");
    if (!has_code) reasons.push("No governing code identified");
    if (!has_location) reasons.push("Location/jurisdiction unknown");
    if (has_critical_conflicts) reasons.push("Critical conflicts unresolved");
    if (has_below_min) reasons.push("Below-minimum condition detected");
  }

  // REJECTION: if below minimum is confirmed with good data
  if (has_below_min && has_measurements && has_tmin && !low_ocr) {
    result.sufficient_for_rejection = true;
  }

  // REPAIR: if we know the flaw and material
  if (has_measurements && facts.material && has_code) {
    result.sufficient_for_repair = true;
  }

  // FFS escalation: if below minimum but repairable condition
  if (has_below_min && has_measurements) {
    result.sufficient_for_ffs_escalation = true;
  }

  // Engineer review: almost always possible
  result.sufficient_for_engineer_review = true;

  // Business pressure override
  if (has_business_pressure) {
    result.sufficient_for_acceptance = false;
    reasons.push("Business pressure detected — cannot accept under duress");
  }

  // Low OCR blocks finalization
  if (low_ocr) {
    result.sufficient_for_acceptance = false;
    result.sufficient_for_rejection = false;
    reasons.push("Low OCR confidence — data unreliable for disposition");
  }

  result.reason = reasons.join("; ") || "All criteria met";

  return {
    technical_sufficiency: result,
    audit: {
      timestamp: new Date().toISOString(),
      stage: "technical_sufficiency",
      decision: `Accept: ${result.sufficient_for_acceptance}, Reject: ${result.sufficient_for_rejection}, Repair: ${result.sufficient_for_repair}, FFS: ${result.sufficient_for_ffs_escalation}`,
      basis: "Minimum data completeness + conflict analysis",
    },
  };
}

// ============================================================
// STAGE 6 — HUMAN REVIEW GATE
// ============================================================

function stageHumanReviewGate(
  conflicts: ConflictRecord[],
  authority: Record<string, any>,
  sufficiency: Record<string, any>,
  facts: Record<string, any>,
  input: FieldChaosInput
): {
  decision_lock: string;
  final_disposition_allowed: boolean;
  mandatory_questions: string[];
  hold_reasons: string[];
  audit: AuditStep;
} {
  let decision_lock = authority.decision_lock || "ALLOW";
  let final_disposition_allowed = authority.final_disposition_allowed !== false;
  const mandatory_questions: string[] = [...(authority.mandatory_questions || [])];
  const hold_reasons: string[] = [];

  // Authority-level holds
  if (authority.jurisdiction_status === "UNKNOWN") {
    decision_lock = "HOLD_FOR_AUTHORITY";
    final_disposition_allowed = false;
    hold_reasons.push("Jurisdiction unresolved");
  }

  // Edition-level holds
  if (authority.edition_status === "OLD_EDITION") {
    if (decision_lock === "ALLOW") decision_lock = "MANUAL_AUTHORITY_REVIEW";
    final_disposition_allowed = false;
    hold_reasons.push("Stale procedure edition — requires verification");
    mandatory_questions.push("Is this older edition still contractually approved?");
    mandatory_questions.push("Provide current controlled procedure or approved legacy basis.");
  }

  // Conflict-level holds
  const critical_conflicts = conflicts.filter(c => c.severity === "CRITICAL");
  if (critical_conflicts.length > 0) {
    // Check conflict types for specific holds
    const has_wps_conflict = critical_conflicts.some(c => c.type.includes("WPS"));
    const has_doc_conflict = critical_conflicts.some(c => c.type === "WPS_REVISION_CONFLICT" || c.type === "WPS_MATERIAL_MISMATCH");
    const has_below_min = critical_conflicts.some(c => c.type === "BELOW_MINIMUM_THICKNESS");
    const has_pressure = critical_conflicts.some(c => c.type === "BUSINESS_PRESSURE_OVERRIDE" || c.type === "VOICE_REPORT_CONFLICT");
    const has_owner_override = critical_conflicts.some(c => c.type === "OWNER_SPEC_VS_REGULATION");
    const has_multi_asset = critical_conflicts.some(c => c.type === "MULTI_ASSET_CODE_MISMATCH");
    const has_code_asset = critical_conflicts.some(c => c.type === "CODE_ASSET_MISMATCH");

    if (has_doc_conflict || has_wps_conflict) {
      decision_lock = "HOLD_FOR_CONFLICTING_DOCUMENTS";
      final_disposition_allowed = false;
      hold_reasons.push("Conflicting documents detected");
      mandatory_questions.push("Which WPS revision was approved at time of weld?");
      mandatory_questions.push("Provide PQR support for the applicable WPS.");
    }

    if (has_below_min) {
      if (decision_lock === "ALLOW") decision_lock = "HOLD_FOR_ENGINEER_REVIEW";
      final_disposition_allowed = false;
      hold_reasons.push("Below-minimum condition requires engineering assessment");
      mandatory_questions.push("Has a fitness-for-service assessment been performed?");
    }

    if (has_pressure) {
      decision_lock = "BLOCK";
      final_disposition_allowed = false;
      hold_reasons.push("Business pressure cannot override technical disposition");
    }

    if (has_owner_override) {
      if (decision_lock !== "BLOCK") decision_lock = "HOLD_FOR_ENGINEER_REVIEW";
      final_disposition_allowed = false;
      hold_reasons.push("Owner spec cannot override regulation without formal engineering assessment");
      mandatory_questions.push("Has the provincial authority / regulator approved this deviation?");
      mandatory_questions.push("Provide engineering assessment per regulatory requirements.");
    }

    if (has_multi_asset || has_code_asset) {
      if (decision_lock === "ALLOW") decision_lock = "HOLD_FOR_MISSING_DATA";
      final_disposition_allowed = false;
      hold_reasons.push("Code cannot be applied to all assets — split routing required");
      mandatory_questions.push("Separate each asset type and identify the applicable code for each.");
    }
  }

  // Missing data holds
  if (!facts.has_t_min && facts.has_thickness_data) {
    if (decision_lock === "ALLOW") decision_lock = "HOLD_FOR_MISSING_DATA";
    final_disposition_allowed = false;
    hold_reasons.push("Thickness data present but no t-min — cannot determine acceptability");
    mandatory_questions.push("What is the minimum required thickness (t-min)?");
    mandatory_questions.push("Provide design code, MAWP, and corrosion allowance.");
  }

  // Low OCR hold
  if (conflicts.some(c => c.type === "LOW_OCR_CONFIDENCE")) {
    if (decision_lock === "ALLOW" || decision_lock === "ALLOW_WITH_WARNING") {
      decision_lock = "HOLD_FOR_MISSING_DATA";
    }
    final_disposition_allowed = false;
    hold_reasons.push("Low OCR quality — human verification required");
    mandatory_questions.push("Verify flaw dimensions from original document.");
    mandatory_questions.push("Verify acceptance criteria from original document.");
  }

  // International waters
  if (input.flags && input.flags.includes("INTERNATIONAL_WATERS")) {
    decision_lock = "HOLD_FOR_AUTHORITY";
    final_disposition_allowed = false;
    hold_reasons.push("International waters — flag state and class society required");
  }

  // Deduplicate questions
  const unique_questions = [...new Set(mandatory_questions)];

  return {
    decision_lock,
    final_disposition_allowed,
    mandatory_questions: unique_questions,
    hold_reasons,
    audit: {
      timestamp: new Date().toISOString(),
      stage: "human_review_gate",
      decision: `Lock: ${decision_lock}, Disposition: ${final_disposition_allowed}, Holds: ${hold_reasons.length}`,
      basis: "Conflict severity + authority status + data completeness",
    },
  };
}

// ============================================================
// STAGE 7 — FINAL OUTPUT ASSEMBLY
// ============================================================

function stageFinalOutput(
  input: FieldChaosInput,
  intake: any,
  extraction: any,
  conflicts: ConflictRecord[],
  authority: any,
  sufficiency: any,
  review_gate: any,
  audit_trace: AuditStep[]
): Record<string, any> {
  // Build inspector message
  let inspector_message = "";
  if (review_gate.decision_lock === "BLOCK") {
    inspector_message = "STOP: System has BLOCKED this disposition. ";
    if (review_gate.hold_reasons.includes("Business pressure cannot override technical disposition")) {
      inspector_message += "Business pressure detected — technical disposition cannot be overridden. Escalate to responsible engineer.";
    } else {
      inspector_message += review_gate.hold_reasons.join(". ") + ".";
    }
  } else if (review_gate.decision_lock.startsWith("HOLD")) {
    inspector_message = `HOLD: Cannot finalize disposition. ${review_gate.hold_reasons.join(". ")}. Resolve before proceeding.`;
  } else if (review_gate.decision_lock === "MANUAL_AUTHORITY_REVIEW") {
    inspector_message = `MANUAL REVIEW REQUIRED: ${review_gate.hold_reasons.join(". ")}. A Level III or responsible engineer must review before disposition.`;
  } else if (review_gate.decision_lock === "ALLOW_WITH_WARNING") {
    inspector_message = `Disposition permitted WITH WARNINGS. ${review_gate.hold_reasons.join(". ")}.`;
  } else {
    inspector_message = "All checks passed. Final disposition permitted.";
  }

  // Recommended next actions
  const next_actions: string[] = [];
  if (!review_gate.final_disposition_allowed) {
    if (review_gate.hold_reasons.some((r: string) => r.includes("Jurisdiction"))) {
      next_actions.push("Confirm asset location and governing jurisdiction");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("t-min"))) {
      next_actions.push("Provide minimum required thickness with design basis");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("Conflicting"))) {
      next_actions.push("Resolve document conflicts — identify controlling revision");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("Below-minimum"))) {
      next_actions.push("Initiate fitness-for-service assessment per API 579-1");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("Business pressure"))) {
      next_actions.push("Escalate to Level III / Responsible Engineer — override attempt logged");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("OCR"))) {
      next_actions.push("Obtain legible copy of original document for human verification");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("Owner spec"))) {
      next_actions.push("Obtain formal engineering assessment per regulatory authority");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("split routing"))) {
      next_actions.push("Separate assets by type and route each to applicable code");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("flag state"))) {
      next_actions.push("Determine flag state and class society before proceeding");
    }
    if (review_gate.hold_reasons.some((r: string) => r.includes("edition"))) {
      next_actions.push("Verify procedure edition is current or contractually approved");
    }
  }

  // Missing required data
  const missing_data: string[] = [];
  if (!extraction.extracted_facts.location) missing_data.push("Asset location / jurisdiction");
  if (!extraction.extracted_facts.has_t_min && extraction.extracted_facts.has_thickness_data) missing_data.push("Minimum required thickness (t-min)");
  if (!extraction.extracted_facts.requested_code) missing_data.push("Governing code / standard");
  if (!extraction.extracted_facts.asset_type) missing_data.push("Asset type");
  if (input.flags?.includes("INTERNATIONAL_WATERS")) {
    missing_data.push("Flag state");
    missing_data.push("Class society");
  }

  return {
    case_id: input.case_id || `FCV-${randomUUID().slice(0, 8)}`,
    case_title: input.case_title || "Untitled Field Chaos Case",
    engine: "field-chaos-validator",
    version: VERSION,
    input_quality_score: intake.input_quality_score,
    documents_processed: intake.documents_processed,
    extracted_facts: extraction.extracted_facts,
    extraction_confidence: extraction.extraction_confidence,
    conflicts_detected: conflicts,
    missing_required_data: missing_data,
    authority_decision: authority.authority_decision,
    technical_sufficiency: sufficiency.technical_sufficiency,
    decision_lock: review_gate.decision_lock,
    final_disposition_allowed: review_gate.final_disposition_allowed,
    mandatory_questions: review_gate.mandatory_questions,
    inspector_message,
    recommended_next_actions: next_actions,
    audit_trace: audit_trace,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

const handler: Handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "POST required" }),
    };
  }

  try {
    const input: FieldChaosInput = JSON.parse(event.body || "{}");
    const audit_trace: AuditStep[] = [];

    // Stage 1 — Evidence Intake
    const intake = stageEvidenceIntake(input);
    audit_trace.push(intake.audit);

    // Stage 2 — Structured Extraction
    const extraction = stageStructuredExtraction(input);
    audit_trace.push(extraction.audit);

    // Stage 3 — Conflict Detection
    const conflict_result = stageConflictDetection(input, extraction.extracted_facts);
    audit_trace.push(conflict_result.audit);

    // Stage 4 — Global Authority Engine
    const authority = stageAuthorityEngine(extraction.extracted_facts, input);
    audit_trace.push(authority.audit);

    // Stage 5 — Technical Sufficiency
    const sufficiency = stageTechnicalSufficiency(extraction.extracted_facts, conflict_result.conflicts, authority.authority_decision);
    audit_trace.push(sufficiency.audit);

    // Stage 6 — Human Review Gate
    const review_gate = stageHumanReviewGate(
      conflict_result.conflicts,
      authority.authority_decision,
      sufficiency.technical_sufficiency,
      extraction.extracted_facts,
      input
    );
    audit_trace.push(review_gate.audit);

    // Stage 7 — Final Output
    const output = stageFinalOutput(input, intake, extraction, conflict_result.conflicts, authority, sufficiency, review_gate, audit_trace);

    // Final assembly audit step
    audit_trace.push({
      timestamp: new Date().toISOString(),
      stage: "output_assembled",
      decision: `decision_lock=${review_gate.decision_lock}, final_disposition=${review_gate.final_disposition_allowed}, conflicts=${conflict_result.conflicts.length}`,
      basis: "All 7 stages combined",
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(output),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Engine failure", message: err.message }),
    };
  }
};

export { handler };
