// @ts-nocheck
/**
 * DEPLOY218 - composite-repair-authority.ts
 *
 * Bonded Composite Repair Authority Pack.
 *
 * Purpose: extend FORGED's physics-first decision stack to cover
 * carbon-fiber / FRP / bonded composite repair systems. The bare-metal
 * ruleset alone misses the wrap itself — which, once installed, is a
 * structural element with its own failure modes (disbond, matrix
 * cracking, fiber breakage, water ingress, UV degradation) and its
 * own code basis (ASME PCC-2 Article 4.1, ISO 24817).
 *
 * This function reads the case transcript + findings, detects composite-
 * repair signals, emits a deterministic mechanism list, a composite-
 * specific inspection plan, and a pass/suspect/failed status.
 *
 * Endpoint: POST /api/composite-repair-authority { case_id }
 * Writes:   composite_repair_assessment (jsonb),
 *           composite_repair_generated_at (timestamptz),
 *           composite_repair_status (text)
 *
 * No backticks. var only. String concatenation only.
 */

import { createClient } from "@supabase/supabase-js";

var PACK_VERSION = "composite-repair-authority/1.0.0";

// -------- Signal dictionaries -------------------------------------------

// Presence signals: does a bonded composite repair exist on this asset?
var PRESENCE_KEYWORDS = [
  "composite wrap", "composite repair", "carbon fiber", "carbon-fiber",
  "fiberglass wrap", "glass fiber wrap", "frp wrap", "frp repair",
  "bonded repair", "wrap system", "reinforcement wrap", "clockspring",
  "armor plate composite", "wet layup", "pre-cured laminate",
  "asme pcc-2", "iso 24817"
];

// Disbond signals (tap test, edge lifting, rust bleed)
var DISBOND_KEYWORDS = [
  "tap test soft", "soft sounding zone", "hollow sound", "hollow zone",
  "edge lifting", "lifting at the edge", "lifted edge", "debond", "disbond",
  "delamination", "rust bleed", "rust staining", "rust bleeding",
  "rust at overlap", "staining at seam", "bleed through"
];

// Matrix / resin degradation
var MATRIX_KEYWORDS = [
  "matrix cracking", "resin cracking", "surface craze", "crazing",
  "discoloration", "yellowing", "uv degradation", "chalking"
];

// Fiber breakage / impact
var FIBER_DAMAGE_KEYWORDS = [
  "fiber break", "broken fiber", "fiber pull-out", "impact damage on wrap",
  "dent on wrap", "cut in wrap", "gouge on wrap"
];

// Water ingress
var WATER_INGRESS_KEYWORDS = [
  "blistering on wrap", "blister in laminate", "moisture under wrap",
  "water ingress", "saturated laminate"
];

// General blister signals (adjacent substrate rather than wrap itself)
var ADJACENT_COATING_KEYWORDS = [
  "coating blistering", "coating breakdown", "paint blister"
];

// -------- Helpers -------------------------------------------------------

function lower(s) { return (s || "").toString().toLowerCase(); }

function anyHit(hay, list) {
  var h = lower(hay);
  for (var i = 0; i < list.length; i++) {
    if (h.indexOf(list[i]) !== -1) return true;
  }
  return false;
}

function hitList(hay, list) {
  var h = lower(hay);
  var out = [];
  for (var i = 0; i < list.length; i++) {
    if (h.indexOf(list[i]) !== -1) out.push(list[i]);
  }
  return out;
}

function dedupe(arr) {
  var seen = {};
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); }
  }
  return out;
}

// -------- Core assessment ------------------------------------------------

function assessCompositeRepair(transcript, findings) {
  var haystack = transcript || "";
  if (Array.isArray(findings)) {
    for (var i = 0; i < findings.length; i++) {
      var f = findings[i];
      if (f) haystack += " " + (f.description || "") + " " + (f.observation || "") + " " + (f.narrative || "");
    }
  }

  var presenceHits = hitList(haystack, PRESENCE_KEYWORDS);
  var hasRepair = presenceHits.length > 0;

  if (!hasRepair) {
    return {
      version: PACK_VERSION,
      status: "no_composite_repair_detected",
      summary: "No bonded composite repair detected in the case evidence. ASME PCC-2 / ISO 24817 authority pack not invoked.",
      detected: false,
      mechanisms: [],
      authority_codes: [],
      required_inspection_plan: [],
      evidence_gate: { passes: true, gaps: [] },
      signals: { presence: [], disbond: [], matrix: [], fiber: [], water_ingress: [], adjacent_coating: [] }
    };
  }

  var disbondHits = hitList(haystack, DISBOND_KEYWORDS);
  var matrixHits = hitList(haystack, MATRIX_KEYWORDS);
  var fiberHits = hitList(haystack, FIBER_DAMAGE_KEYWORDS);
  var waterHits = hitList(haystack, WATER_INGRESS_KEYWORDS);
  var adjacentHits = hitList(haystack, ADJACENT_COATING_KEYWORDS);

  var mechanisms = [];

  if (disbondHits.length > 0) {
    mechanisms.push({
      name: "composite_repair_disbond",
      severity: disbondHits.length >= 2 ? "high" : "medium",
      basis: "Sensory signatures of disbond detected: " + disbondHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-405", "ISO 24817 §9"],
      confirmation_evidence: [
        "Tap test grid mapping disbonded area",
        "Infrared thermography scan of wrap surface",
        "Shearography or laser-shearography for disbond extent",
        "Cross-section sample at suspect zone (destructive if permitted)"
      ],
      rule_out_evidence: [
        "Uniform tap-test acoustic response across wrap",
        "Thermography shows uniform thermal diffusivity",
        "No rust bleed at any seam after 24-hour water test"
      ]
    });
  }

  if (matrixHits.length > 0) {
    mechanisms.push({
      name: "composite_matrix_cracking",
      severity: "medium",
      basis: "Matrix/resin degradation signatures: " + matrixHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-404", "ISO 24817 §8.7"],
      confirmation_evidence: [
        "Surface microscopy or macro-photography of craze pattern",
        "Hardness/durometer comparison to baseline",
        "UV exposure history vs. qualified life"
      ],
      rule_out_evidence: [
        "Cosmetic-only discoloration with no surface cracks at 10x",
        "Durometer within qualified range"
      ]
    });
  }

  if (fiberHits.length > 0) {
    mechanisms.push({
      name: "composite_fiber_breakage",
      severity: "high",
      basis: "Fiber damage / impact signatures: " + fiberHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-406", "ISO 24817 §9.4"],
      confirmation_evidence: [
        "Visual + macro-photography of damage zone",
        "Ultrasonic A-scan / C-scan through laminate",
        "Cross-sectional examination of damaged region"
      ],
      rule_out_evidence: [
        "Damage confined to outer cosmetic layer only",
        "No fiber continuity loss on ultrasonic C-scan"
      ]
    });
  }

  if (waterHits.length > 0) {
    mechanisms.push({
      name: "composite_water_ingress",
      severity: "high",
      basis: "Water-ingress signatures under wrap: " + waterHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-407", "ISO 24817 §9.5"],
      confirmation_evidence: [
        "Microwave moisture imaging under laminate",
        "Thermography showing differential cool zones",
        "Moisture-meter readings at laminate edges"
      ],
      rule_out_evidence: [
        "Microwave imaging clean",
        "No thermal anomaly at 2-minute hold"
      ]
    });
  }

  // Status resolution
  var status = "repair_intact";
  var hasHigh = mechanisms.some(function(m) { return m.severity === "high"; });
  var hasAny = mechanisms.length > 0;
  if (hasHigh) status = "repair_failed";
  else if (hasAny) status = "repair_suspect";

  // Authority codes are always invoked once a repair is detected.
  var authority_codes = [
    { code: "ASME PCC-2 Art. 4.1", title: "Non-metallic Composite Repair Systems — High-Risk Applications", role: "primary_repair_authority" },
    { code: "ISO 24817", title: "Composite Repairs for Pipework — Qualification, Design, Installation, Testing and Inspection", role: "supplemental_repair_authority" }
  ];

  // Composite-specific inspection plan (always returned when repair present)
  var required_inspection_plan = [
    {
      method: "Tap test grid",
      rationale: "Primary field method for disbond mapping on bonded composite repairs. Required by ASME PCC-2 Art. 4.1 periodic inspection.",
      targets: ["full wrap surface area", "all overlap seams", "edge terminations"]
    },
    {
      method: "Infrared thermography",
      rationale: "Non-contact disbond and water-ingress detection. Differential thermal diffusivity reveals hidden voids and moisture pockets.",
      targets: ["wrap body", "suspect soft zones", "overlap seams"]
    },
    {
      method: "Shearography / laser-shearography",
      rationale: "Highest-sensitivity method for quantifying disbond area. Required if tap test or thermography flags any anomaly.",
      targets: ["anomaly zones from tap test", "high-stress nodes"]
    },
    {
      method: "Visual + macro-photography at 10x",
      rationale: "Detects matrix crazing, fiber exposure, and resin degradation not visible to naked eye.",
      targets: ["entire wrap surface", "UV-exposed regions"]
    },
    {
      method: "UT on underlying steel substrate at wrap edges",
      rationale: "The wrap does not eliminate corrosion under wrap (CUW). Substrate thickness must still be verified where accessible.",
      targets: ["wrap edge bands", "any exposed substrate between repair sections"]
    }
  ];

  // Evidence gate: for HIGH/CRITICAL consequence assets with a repair,
  // the inspection plan must include at least one disbond-detection method.
  var gate_gaps = [];
  // Caller can augment this logic against authority_lock.consequence tier.
  var evidence_gate = { passes: true, gaps: gate_gaps };

  // Narrative summary
  var summary_lines = [];
  summary_lines.push("Bonded composite repair detected. ASME PCC-2 Art. 4.1 and ISO 24817 authority invoked.");
  if (disbondHits.length > 0) summary_lines.push("Disbond signatures present (" + disbondHits.length + "): " + disbondHits.slice(0, 4).join("; ") + ".");
  if (fiberHits.length > 0) summary_lines.push("Fiber/impact damage signatures present: " + fiberHits.slice(0, 4).join("; ") + ".");
  if (waterHits.length > 0) summary_lines.push("Water-ingress signatures present: " + waterHits.slice(0, 4).join("; ") + ".");
  if (matrixHits.length > 0) summary_lines.push("Matrix degradation signatures present: " + matrixHits.slice(0, 4).join("; ") + ".");
  if (adjacentHits.length > 0) summary_lines.push("Adjacent substrate coating degradation noted — corrosion-under-wrap risk elevated.");
  if (!hasAny) summary_lines.push("No degradation signatures detected — repair presumed intact pending inspection-plan execution.");
  summary_lines.push("Status: " + status.replace(/_/g, " ").toUpperCase() + ".");

  return {
    version: PACK_VERSION,
    status: status,
    detected: true,
    summary: summary_lines.join(" "),
    mechanisms: mechanisms,
    authority_codes: authority_codes,
    required_inspection_plan: required_inspection_plan,
    evidence_gate: evidence_gate,
    signals: {
      presence: dedupe(presenceHits),
      disbond: dedupe(disbondHits),
      matrix: dedupe(matrixHits),
      fiber: dedupe(fiberHits),
      water_ingress: dedupe(waterHits),
      adjacent_coating: dedupe(adjacentHits)
    }
  };
}

// -------- Handler ------------------------------------------------------

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "method_not_allowed" }) };
  }

  var supabaseUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "missing_service_credentials" }) };
  }

  var supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  var body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: "invalid_json" }) }; }

  var caseId = body.case_id;
  if (!caseId) return { statusCode: 400, body: JSON.stringify({ error: "case_id_required" }) };

  // Load case transcript + findings
  var caseQ = await supabase
    .from("inspection_cases")
    .select("id, org_id, transcript, narrative, description, findings")
    .eq("id", caseId)
    .single();

  if (caseQ.error || !caseQ.data) {
    return { statusCode: 404, body: JSON.stringify({ error: "case_not_found", detail: caseQ.error && caseQ.error.message }) };
  }

  var c = caseQ.data;
  var transcript = (c.transcript || "") + " " + (c.narrative || "") + " " + (c.description || "");
  var findings = c.findings || [];

  var assessment = assessCompositeRepair(transcript, findings);
  var generatedAt = new Date().toISOString();

  var upd = await supabase
    .from("inspection_cases")
    .update({
      composite_repair_assessment: assessment,
      composite_repair_generated_at: generatedAt,
      composite_repair_status: assessment.status
    })
    .eq("id", caseId);

  if (upd.error) {
    return { statusCode: 500, body: JSON.stringify({ error: "persist_failed", detail: upd.error.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      case_id: caseId,
      assessment: assessment,
      generated_at: generatedAt
    })
  };
}
