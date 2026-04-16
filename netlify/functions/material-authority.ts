// @ts-nocheck
/**
 * DEPLOY219 - material-authority.ts
 * netlify/functions/material-authority.ts
 *
 * Unified Material Authority Engine.
 *
 * Single endpoint that detects material class from case context,
 * then routes to the appropriate keyword bank + mechanism set +
 * authority codes + inspection plan.
 *
 * Material modules (in deployment order):
 *   1. composite_repair  — CFRP, GFRP, bonded wraps (ASME PCC-2, ISO 24817)
 *   2. coatings           — epoxy, FBE, thermal spray, ceramic coatings
 *   3. ceramics           — alumina, SiC, CMC, zirconia
 *   4. polymers           — HDPE, PTFE, PEEK, PVC, epoxy resin
 *   5. elastomers         — neoprene, nitrile, EPDM, viton, rubber linings
 *   6. advanced_alloys    — titanium, inconel, hastelloy, monel, cu-ni
 *   7. foams              — PU foam, phenolic foam, honeycomb
 *   8. hybrid_smart       — nanocomposites, SMA, FGM, self-healing
 *
 * Endpoint: POST /api/material-authority { case_id }
 * Writes:   material_authority_assessment (jsonb),
 *           material_authority_generated_at (timestamptz),
 *           material_authority_status (text)
 *
 * No backticks. var only. String concatenation only.
 */

import { createClient } from "@supabase/supabase-js";

var ENGINE_VERSION = "material-authority/1.0.0";

// =====================================================================
// SHARED HELPERS
// =====================================================================

function lower(s) { return (s || "").toString().toLowerCase(); }

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

function resolveStatus(mechanisms) {
  var hasHigh = false;
  var hasAny = mechanisms.length > 0;
  for (var i = 0; i < mechanisms.length; i++) {
    if (mechanisms[i].severity === "high" || mechanisms[i].severity === "critical") hasHigh = true;
  }
  if (hasHigh) return "failed";
  if (hasAny) return "suspect";
  return "intact";
}

// =====================================================================
// MODULE 1: COMPOSITE REPAIR (ported from DEPLOY218)
// =====================================================================

var COMPOSITE_PRESENCE = [
  "composite wrap", "composite repair", "carbon fiber", "carbon-fiber",
  "fiberglass wrap", "glass fiber wrap", "frp wrap", "frp repair",
  "bonded repair", "wrap system", "reinforcement wrap", "clockspring",
  "armor plate composite", "wet layup", "pre-cured laminate",
  "cfrp", "gfrp", "grp wrap", "gre pipe", "aramid wrap", "kevlar wrap",
  "basalt fiber", "hybrid composite", "sandwich panel", "sandwich structure",
  "asme pcc-2", "iso 24817"
];

var COMPOSITE_DISBOND = [
  "tap test soft", "soft sounding zone", "hollow sound", "hollow zone",
  "edge lifting", "lifting at the edge", "lifted edge", "debond", "disbond",
  "delamination", "rust bleed", "rust staining", "rust bleeding",
  "rust at overlap", "staining at seam", "bleed through"
];

var COMPOSITE_MATRIX = [
  "matrix cracking", "resin cracking", "surface craze", "crazing",
  "discoloration", "yellowing", "uv degradation", "chalking"
];

var COMPOSITE_FIBER = [
  "fiber break", "broken fiber", "fiber pull-out", "impact damage on wrap",
  "dent on wrap", "cut in wrap", "gouge on wrap"
];

var COMPOSITE_WATER = [
  "blistering on wrap", "blister in laminate", "moisture under wrap",
  "water ingress", "saturated laminate"
];

var COMPOSITE_ADJACENT = [
  "coating blistering", "coating breakdown", "paint blister"
];

function assessComposite(haystack) {
  var presenceHits = hitList(haystack, COMPOSITE_PRESENCE);
  if (presenceHits.length === 0) return null;

  var disbondHits = hitList(haystack, COMPOSITE_DISBOND);
  var matrixHits = hitList(haystack, COMPOSITE_MATRIX);
  var fiberHits = hitList(haystack, COMPOSITE_FIBER);
  var waterHits = hitList(haystack, COMPOSITE_WATER);
  var adjacentHits = hitList(haystack, COMPOSITE_ADJACENT);

  var mechanisms = [];

  if (disbondHits.length > 0) {
    mechanisms.push({
      name: "composite_repair_disbond",
      severity: disbondHits.length >= 2 ? "high" : "medium",
      basis: "Sensory signatures of disbond detected: " + disbondHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-405", "ISO 24817 §9"],
      confirmation_evidence: ["Tap test grid mapping", "IR thermography", "Shearography"],
      rule_out_evidence: ["Uniform tap-test response", "No rust bleed after 24h water test"]
    });
  }
  if (matrixHits.length > 0) {
    mechanisms.push({
      name: "composite_matrix_cracking",
      severity: "medium",
      basis: "Matrix/resin degradation signatures: " + matrixHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-404", "ISO 24817 §8.7"],
      confirmation_evidence: ["Surface microscopy", "Durometer comparison to baseline"],
      rule_out_evidence: ["Cosmetic-only discoloration", "Durometer within range"]
    });
  }
  if (fiberHits.length > 0) {
    mechanisms.push({
      name: "composite_fiber_breakage",
      severity: "high",
      basis: "Fiber damage / impact signatures: " + fiberHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-406", "ISO 24817 §9.4"],
      confirmation_evidence: ["Visual + macro-photo", "UT A-scan / C-scan through laminate"],
      rule_out_evidence: ["Damage confined to cosmetic layer", "No fiber loss on C-scan"]
    });
  }
  if (waterHits.length > 0) {
    mechanisms.push({
      name: "composite_water_ingress",
      severity: "high",
      basis: "Water-ingress signatures: " + waterHits.join(", "),
      references: ["ASME PCC-2 Art. 4.1 §4.1-407", "ISO 24817 §9.5"],
      confirmation_evidence: ["Microwave moisture imaging", "Thermography cool zones"],
      rule_out_evidence: ["Microwave imaging clean", "No thermal anomaly"]
    });
  }

  var authority_codes = [
    { code: "ASME PCC-2 Art. 4.1", title: "Non-metallic Composite Repair Systems", role: "primary_repair_authority" },
    { code: "ISO 24817", title: "Composite Repairs for Pipework", role: "supplemental_repair_authority" }
  ];

  var inspection_plan = [
    { method: "Tap test grid", rationale: "Primary disbond mapping for bonded composite repairs." },
    { method: "Infrared thermography", rationale: "Non-contact disbond and water-ingress detection." },
    { method: "Shearography", rationale: "Highest-sensitivity disbond quantification." },
    { method: "Visual + macro-photography at 10x", rationale: "Matrix crazing and fiber exposure detection." },
    { method: "UT on substrate at wrap edges", rationale: "Corrosion-under-wrap verification." }
  ];

  var summary_lines = ["Bonded composite repair detected. ASME PCC-2 Art. 4.1 and ISO 24817 invoked."];
  if (disbondHits.length > 0) summary_lines.push("Disbond signatures (" + disbondHits.length + "): " + disbondHits.slice(0, 4).join("; ") + ".");
  if (fiberHits.length > 0) summary_lines.push("Fiber damage: " + fiberHits.slice(0, 4).join("; ") + ".");
  if (waterHits.length > 0) summary_lines.push("Water ingress: " + waterHits.slice(0, 4).join("; ") + ".");
  if (matrixHits.length > 0) summary_lines.push("Matrix degradation: " + matrixHits.slice(0, 4).join("; ") + ".");
  if (adjacentHits.length > 0) summary_lines.push("Adjacent coating degradation — CUW risk elevated.");

  return {
    material_class: "composite_repair",
    material_label: "Bonded Composite Repair (CFRP / GFRP / FRP)",
    mechanisms: mechanisms,
    authority_codes: authority_codes,
    inspection_plan: inspection_plan,
    summary: summary_lines.join(" "),
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

// =====================================================================
// MODULE 2: COATINGS & SURFACE SYSTEMS
// =====================================================================

var COATING_PRESENCE = [
  "epoxy coating", "epoxy coat", "fusion bonded epoxy", "fbe coating", "fbe coat",
  "thermal spray", "hvof", "plasma spray", "flame spray", "arc spray",
  "ceramic coating", "ceramic coat", "metallic coating",
  "polyurea", "polyurethane coating", "polyurethane coat",
  "zinc coating", "zinc primer", "galvanized", "galvanised",
  "paint system", "paint coat", "protective coating", "corrosion coating",
  "intumescent", "fireproofing coat", "nace", "sspc",
  "coating system", "primer", "topcoat", "intermediate coat"
];

var COATING_DISBOND = [
  "coating disbond", "disbonded coating", "coating lifting", "lift at edge",
  "flaking", "peeling", "spalling", "delaminated coating", "coating delamination",
  "blister", "blistering", "osmotic blister", "cathodic disbondment",
  "pull-off test fail", "adhesion failure", "dolly test fail",
  "loss of adhesion"
];

var COATING_HOLIDAY = [
  "holiday", "pinhole", "coating discontinuity", "bare spot", "skip area",
  "spark test fail", "jeep test fail", "porosity in coating",
  "low voltage holiday", "high voltage holiday", "coating void"
];

var COATING_UNDERFILM = [
  "under-film corrosion", "underfilm corrosion", "filiform corrosion",
  "corrosion under coating", "cuc", "rust under paint", "rust under coating",
  "subsurface rust", "hidden corrosion", "coating over rust",
  "pack rust under coating"
];

var COATING_BREAKDOWN = [
  "coating breakdown", "coating failure", "coating erosion",
  "chalking", "checking", "cracking of coating", "crazing of coating",
  "weathering", "uv degradation of coating", "chemical attack on coating",
  "abrasion damage", "mechanical damage to coating",
  "thermal damage to coating", "heat damage to coating"
];

var COATING_THICKNESS = [
  "low dft", "dft below spec", "thin coating", "insufficient thickness",
  "high dft", "excessive thickness", "overcoated", "runs and sags",
  "uneven coating", "coating too thin", "coating too thick"
];

function assessCoatings(haystack) {
  var presenceHits = hitList(haystack, COATING_PRESENCE);
  if (presenceHits.length === 0) return null;

  var disbondHits = hitList(haystack, COATING_DISBOND);
  var holidayHits = hitList(haystack, COATING_HOLIDAY);
  var underfilmHits = hitList(haystack, COATING_UNDERFILM);
  var breakdownHits = hitList(haystack, COATING_BREAKDOWN);
  var thicknessHits = hitList(haystack, COATING_THICKNESS);

  var mechanisms = [];

  if (disbondHits.length > 0) {
    mechanisms.push({
      name: "coating_disbond",
      severity: disbondHits.length >= 2 ? "high" : "medium",
      basis: "Coating adhesion loss detected: " + disbondHits.join(", "),
      references: ["ASTM D4541 (Pull-off)", "ASTM D3359 (Cross-cut)", "ISO 4624", "NACE SP0188"],
      confirmation_evidence: ["Pull-off adhesion test per ASTM D4541", "Cross-cut test per ASTM D3359", "Knife test per ASTM D6677"],
      rule_out_evidence: ["Adhesion > 500 psi on pull-off", "Cross-cut rating 4B or 5B"]
    });
  }
  if (holidayHits.length > 0) {
    mechanisms.push({
      name: "coating_holidays",
      severity: "high",
      basis: "Coating continuity failures: " + holidayHits.join(", "),
      references: ["NACE SP0188", "ASTM G62 (Holiday detection)", "SSPC-PA 14"],
      confirmation_evidence: ["High-voltage spark test (ASTM D5162)", "Low-voltage wet sponge test", "Visual mapping of holiday locations"],
      rule_out_evidence: ["Full-coverage spark test pass at specified voltage", "No bare metal exposed"]
    });
  }
  if (underfilmHits.length > 0) {
    mechanisms.push({
      name: "under_film_corrosion",
      severity: "high",
      basis: "Corrosion progressing beneath coating system: " + underfilmHits.join(", "),
      references: ["NACE SP0188 §6", "SSPC-PA Guide 4", "ISO 4628-8 (Filiform)"],
      confirmation_evidence: ["Coating removal at suspect zone + visual of substrate", "UT thickness at corroded area", "Profile measurement of pitting under coating"],
      rule_out_evidence: ["Substrate clean after coating removal", "No thickness loss on UT"]
    });
  }
  if (breakdownHits.length > 0) {
    mechanisms.push({
      name: "coating_degradation",
      severity: breakdownHits.length >= 2 ? "high" : "medium",
      basis: "Coating integrity degradation: " + breakdownHits.join(", "),
      references: ["ASTM D610 (Rust grade)", "ASTM D714 (Blister size)", "ASTM D1654 (Scribe test)", "ISO 4628"],
      confirmation_evidence: ["Rust grading per ASTM D610", "Blister size/frequency per ASTM D714", "Gloss / color retention measurement"],
      rule_out_evidence: ["Rust grade 9-10 (minimal)", "Cosmetic only — no substrate exposure"]
    });
  }
  if (thicknessHits.length > 0) {
    mechanisms.push({
      name: "coating_thickness_deviation",
      severity: "medium",
      basis: "Dry film thickness out of specification: " + thicknessHits.join(", "),
      references: ["SSPC-PA 2 (DFT measurement)", "ISO 19840", "NACE SP0188"],
      confirmation_evidence: ["DFT gauge readings per SSPC-PA 2", "Mapping of under/over-thickness zones"],
      rule_out_evidence: ["DFT within specified range across all measurement points"]
    });
  }

  var authority_codes = [
    { code: "NACE SP0188", title: "Discontinuity (Holiday) Testing of New Protective Coatings on Conductive Substrates", role: "primary_coating_authority" },
    { code: "SSPC-PA 2", title: "Measurement of Dry Coating Thickness with Magnetic Gauges", role: "thickness_standard" },
    { code: "ASTM D4541", title: "Pull-Off Strength of Coatings Using Portable Adhesion Testers", role: "adhesion_standard" },
    { code: "ISO 4628", title: "Paints and Varnishes — Evaluation of Degradation of Coatings", role: "degradation_standard" }
  ];

  var inspection_plan = [
    { method: "Holiday / spark test (ASTM D5162 / NACE SP0188)", rationale: "Detects pinholes, voids, and bare spots in coating continuity. Primary gate for corrosion protection verification." },
    { method: "DFT measurement (SSPC-PA 2)", rationale: "Confirms coating thickness meets specification. Both under- and over-thickness compromise protection." },
    { method: "Pull-off adhesion test (ASTM D4541)", rationale: "Quantifies bond strength between coating and substrate. Required when disbond or lifting is suspected." },
    { method: "Rust / blister / degradation grading (ASTM D610 / D714 / ISO 4628)", rationale: "Standardized grading of visible coating deterioration. Establishes recoat urgency." },
    { method: "Substrate inspection at coating removal zones", rationale: "Reveals hidden corrosion damage beneath coating. Required when under-film corrosion is suspected." },
    { method: "UT thickness at suspect zones", rationale: "Quantifies wall loss beneath degraded or disbonded coating areas." }
  ];

  var summary_lines = ["Protective coating system detected. NACE / SSPC / ASTM coating authority invoked."];
  if (disbondHits.length > 0) summary_lines.push("Disbond / adhesion loss (" + disbondHits.length + "): " + disbondHits.slice(0, 4).join("; ") + ".");
  if (holidayHits.length > 0) summary_lines.push("Holiday / continuity failures: " + holidayHits.slice(0, 4).join("; ") + ".");
  if (underfilmHits.length > 0) summary_lines.push("Under-film corrosion: " + underfilmHits.slice(0, 4).join("; ") + ".");
  if (breakdownHits.length > 0) summary_lines.push("Coating degradation: " + breakdownHits.slice(0, 4).join("; ") + ".");
  if (thicknessHits.length > 0) summary_lines.push("Thickness deviation: " + thicknessHits.slice(0, 4).join("; ") + ".");

  return {
    material_class: "coatings",
    material_label: "Coatings & Surface Systems",
    mechanisms: mechanisms,
    authority_codes: authority_codes,
    inspection_plan: inspection_plan,
    summary: summary_lines.join(" "),
    signals: {
      presence: dedupe(presenceHits),
      disbond: dedupe(disbondHits),
      holidays: dedupe(holidayHits),
      under_film: dedupe(underfilmHits),
      breakdown: dedupe(breakdownHits),
      thickness: dedupe(thicknessHits)
    }
  };
}

// =====================================================================
// MODULE 3: CERAMICS (placeholder — keyword banks ready for expansion)
// =====================================================================

var CERAMIC_PRESENCE = [
  "alumina", "al2o3", "silicon carbide", "sic", "silicon nitride", "si3n4",
  "zirconia", "zro2", "ceramic matrix composite", "cmc", "ceramic liner",
  "ceramic coating", "refractory", "refractory lining", "castable refractory",
  "brick lining", "acid brick"
];

function assessCeramics(haystack) {
  var presenceHits = hitList(haystack, CERAMIC_PRESENCE);
  if (presenceHits.length === 0) return null;

  var mechanisms = [];
  var crackHits = hitList(haystack, ["microcracking", "thermal shock", "thermal crack", "brittle fracture", "spall", "spalling"]);
  var porosityHits = hitList(haystack, ["porosity", "internal void", "density loss", "erosion wear"]);
  var thermalHits = hitList(haystack, ["thermal cycling", "thermal fatigue", "heat shock", "rapid cooling"]);

  if (crackHits.length > 0) {
    mechanisms.push({
      name: "ceramic_cracking",
      severity: "high",
      basis: "Crack / fracture signatures: " + crackHits.join(", "),
      references: ["ASTM C1161 (Flexural strength)", "ASTM C1421 (Fracture toughness)"],
      confirmation_evidence: ["Dye penetrant test", "Acoustic emission monitoring", "X-ray / CT scan"],
      rule_out_evidence: ["No surface-breaking indications on PT", "AE below threshold"]
    });
  }
  if (porosityHits.length > 0) {
    mechanisms.push({
      name: "ceramic_porosity_erosion",
      severity: "medium",
      basis: "Porosity / erosion signatures: " + porosityHits.join(", "),
      references: ["ASTM C373 (Water absorption)", "ASTM G76 (Erosion)"],
      confirmation_evidence: ["Density / water absorption test", "Wall thickness measurement", "Visual mapping of erosion pattern"],
      rule_out_evidence: ["Density within specification", "No measurable wall loss"]
    });
  }
  if (thermalHits.length > 0) {
    mechanisms.push({
      name: "ceramic_thermal_damage",
      severity: "high",
      basis: "Thermal damage signatures: " + thermalHits.join(", "),
      references: ["ASTM C1525 (Thermal shock)", "ASTM E1461 (Thermal diffusivity)"],
      confirmation_evidence: ["IR thermography for crack detection", "Thermal cycle history review", "Microstructure examination"],
      rule_out_evidence: ["Thermal history within design envelope", "No new indications on PT"]
    });
  }

  var authority_codes = [
    { code: "ASTM C1161", title: "Flexural Strength of Advanced Ceramics at Ambient Temperature", role: "mechanical_standard" },
    { code: "ASTM C1421", title: "Fracture Toughness of Advanced Ceramics", role: "fracture_standard" },
    { code: "ASTM C1525", title: "Thermal Shock Resistance of Advanced Ceramics", role: "thermal_standard" }
  ];

  var inspection_plan = [
    { method: "Liquid penetrant testing (PT)", rationale: "Surface-breaking crack detection on ceramic surfaces." },
    { method: "Acoustic emission (AE)", rationale: "Real-time crack growth monitoring under thermal/mechanical load." },
    { method: "IR thermography", rationale: "Detects subsurface cracks and thermal damage zones." },
    { method: "X-ray / CT scan", rationale: "Internal porosity and crack mapping in critical ceramic components." }
  ];

  var summary_lines = ["Ceramic / refractory material detected."];
  if (crackHits.length > 0) summary_lines.push("Cracking signatures: " + crackHits.join("; ") + ".");
  if (porosityHits.length > 0) summary_lines.push("Porosity / erosion: " + porosityHits.join("; ") + ".");
  if (thermalHits.length > 0) summary_lines.push("Thermal damage: " + thermalHits.join("; ") + ".");

  return {
    material_class: "ceramics",
    material_label: "Ceramic / Refractory Materials",
    mechanisms: mechanisms,
    authority_codes: authority_codes,
    inspection_plan: inspection_plan,
    summary: summary_lines.join(" "),
    signals: { presence: dedupe(presenceHits), cracking: dedupe(crackHits), porosity: dedupe(porosityHits), thermal: dedupe(thermalHits) }
  };
}

// =====================================================================
// MODULE 4: POLYMERS & ENGINEERING PLASTICS
// =====================================================================

var POLYMER_PRESENCE = [
  "hdpe", "high-density polyethylene", "polyethylene pipe", "pe pipe",
  "ptfe", "teflon", "pvc", "cpvc", "pvdf", "polyvinylidene",
  "peek", "polyether ether ketone", "epoxy resin", "phenolic resin",
  "fiberglass pipe", "gre piping", "polymer liner", "plastic pipe",
  "thermoplastic", "thermoset"
];

function assessPolymers(haystack) {
  var presenceHits = hitList(haystack, POLYMER_PRESENCE);
  if (presenceHits.length === 0) return null;

  var mechanisms = [];
  var creepHits = hitList(haystack, ["creep", "cold flow", "deformation", "sag", "bulge", "wall thinning"]);
  var crackHits = hitList(haystack, ["stress crack", "environmental stress cracking", "esc", "crazing", "brittle crack", "slow crack growth"]);
  var thermalHits = hitList(haystack, ["thermal degradation", "heat damage", "overtemp", "melting", "softening", "char"]);
  var chemHits = hitList(haystack, ["chemical attack", "swelling", "dissolution", "permeation", "chemical degradation"]);

  if (creepHits.length > 0) {
    mechanisms.push({ name: "polymer_creep", severity: "medium", basis: "Creep / deformation signatures: " + creepHits.join(", "), references: ["ASTM D2990 (Creep)", "ISO 899"], confirmation_evidence: ["Dimensional measurement vs. baseline", "Strain gauge monitoring"], rule_out_evidence: ["Dimensions within tolerance"] });
  }
  if (crackHits.length > 0) {
    mechanisms.push({ name: "polymer_stress_cracking", severity: "high", basis: "Stress cracking signatures: " + crackHits.join(", "), references: ["ASTM D1693 (ESC)", "ISO 16770"], confirmation_evidence: ["Visual + microscopy of crack surface", "Notched specimen ESC test"], rule_out_evidence: ["No crack indications at 10x magnification"] });
  }
  if (thermalHits.length > 0) {
    mechanisms.push({ name: "polymer_thermal_degradation", severity: "high", basis: "Thermal damage: " + thermalHits.join(", "), references: ["ASTM D3045 (Heat aging)", "ISO 188"], confirmation_evidence: ["Tensile test vs. baseline", "DSC / TGA analysis"], rule_out_evidence: ["Mechanical properties within specification"] });
  }
  if (chemHits.length > 0) {
    mechanisms.push({ name: "polymer_chemical_attack", severity: "high", basis: "Chemical degradation: " + chemHits.join(", "), references: ["ASTM D543 (Chemical resistance)", "ISO 175"], confirmation_evidence: ["Weight / dimension change measurement", "Tensile strength comparison"], rule_out_evidence: ["No measurable property change after exposure"] });
  }

  var authority_codes = [
    { code: "ASTM D2990", title: "Tensile, Compressive, and Flexural Creep of Plastics", role: "creep_standard" },
    { code: "ASTM D1693", title: "Environmental Stress-Cracking of Ethylene Plastics", role: "esc_standard" },
    { code: "ASME B31.3 Ch. VII", title: "Nonmetallic Piping and Piping Lined with Nonmetals", role: "piping_code" }
  ];

  var inspection_plan = [
    { method: "Visual inspection + dimensional survey", rationale: "Detects creep deformation, bulging, and surface cracking." },
    { method: "Hardness / durometer testing", rationale: "Detects thermal or chemical softening / embrittlement." },
    { method: "UT (contact or immersion)", rationale: "Wall thickness verification on polymer piping." },
    { method: "Coupon / witness sample testing", rationale: "Tensile, ESC, and chemical resistance verification against baseline." }
  ];

  var summary_lines = ["Polymer / engineering plastic detected."];
  if (creepHits.length > 0) summary_lines.push("Creep: " + creepHits.join("; ") + ".");
  if (crackHits.length > 0) summary_lines.push("Stress cracking: " + crackHits.join("; ") + ".");
  if (thermalHits.length > 0) summary_lines.push("Thermal damage: " + thermalHits.join("; ") + ".");
  if (chemHits.length > 0) summary_lines.push("Chemical attack: " + chemHits.join("; ") + ".");

  return {
    material_class: "polymers",
    material_label: "Polymers & Engineering Plastics",
    mechanisms: mechanisms,
    authority_codes: authority_codes,
    inspection_plan: inspection_plan,
    summary: summary_lines.join(" "),
    signals: { presence: dedupe(presenceHits), creep: dedupe(creepHits), cracking: dedupe(crackHits), thermal: dedupe(thermalHits), chemical: dedupe(chemHits) }
  };
}

// =====================================================================
// MODULE 5: ELASTOMERS & RUBBER SYSTEMS
// =====================================================================

var ELASTOMER_PRESENCE = [
  "neoprene", "nitrile", "nbr", "epdm", "viton", "fkm",
  "natural rubber", "rubber lining", "rubber liner", "elastomer",
  "gasket", "seal", "o-ring", "packer", "hose", "rubber coating"
];

function assessElastomers(haystack) {
  var presenceHits = hitList(haystack, ELASTOMER_PRESENCE);
  if (presenceHits.length === 0) return null;

  var mechanisms = [];
  var agingHits = hitList(haystack, ["hardening", "embrittlement", "aging", "dried out", "cracked rubber", "ozone cracking", "surface crack"]);
  var swellHits = hitList(haystack, ["swelling", "swollen", "chemical attack", "softening", "dissolution", "volume change"]);
  var disbondHits = hitList(haystack, ["lining failure", "lining disbond", "lining lift", "blister under lining", "debond", "tank lining fail"]);

  if (agingHits.length > 0) {
    mechanisms.push({ name: "elastomer_aging", severity: "medium", basis: "Aging / embrittlement: " + agingHits.join(", "), references: ["ASTM D573 (Heat aging)", "ASTM D1171 (Ozone cracking)"], confirmation_evidence: ["Durometer hardness comparison", "Elongation at break test"], rule_out_evidence: ["Hardness within specification range"] });
  }
  if (swellHits.length > 0) {
    mechanisms.push({ name: "elastomer_chemical_attack", severity: "high", basis: "Chemical swell / attack: " + swellHits.join(", "), references: ["ASTM D471 (Fluid resistance)", "ISO 1817"], confirmation_evidence: ["Volume change measurement", "Tensile comparison"], rule_out_evidence: ["Volume change < 5%"] });
  }
  if (disbondHits.length > 0) {
    mechanisms.push({ name: "elastomer_lining_disbond", severity: "high", basis: "Lining disbond / failure: " + disbondHits.join(", "), references: ["NACE SP0105", "ASTM D4541 (Adhesion)"], confirmation_evidence: ["Spark test on lining", "Pull-off adhesion test", "UT for disbond mapping"], rule_out_evidence: ["Full-coverage spark test pass", "Adhesion above threshold"] });
  }

  return {
    material_class: "elastomers",
    material_label: "Elastomers & Rubber Systems",
    mechanisms: mechanisms,
    authority_codes: [
      { code: "NACE SP0105", title: "Liquid-Applied Internal Protective Coatings and Lining Systems", role: "lining_standard" },
      { code: "ASTM D471", title: "Rubber Property — Effect of Liquids", role: "chemical_resistance" }
    ],
    inspection_plan: [
      { method: "Spark / holiday test on lining", rationale: "Detects pinholes and disbond in rubber linings." },
      { method: "Durometer hardness testing", rationale: "Detects aging-related hardening or chemical softening." },
      { method: "Pull-off adhesion test", rationale: "Quantifies lining bond strength." },
      { method: "Visual + dimensional survey", rationale: "Detects swelling, cracking, and deformation." }
    ],
    summary: "Elastomer / rubber system detected. " + (agingHits.length > 0 ? "Aging: " + agingHits.join("; ") + ". " : "") + (swellHits.length > 0 ? "Chemical attack: " + swellHits.join("; ") + ". " : "") + (disbondHits.length > 0 ? "Lining disbond: " + disbondHits.join("; ") + ". " : ""),
    signals: { presence: dedupe(presenceHits), aging: dedupe(agingHits), swell: dedupe(swellHits), disbond: dedupe(disbondHits) }
  };
}

// =====================================================================
// MODULE 6: ADVANCED ALLOYS
// =====================================================================

var ALLOY_PRESENCE = [
  "titanium", "ti-6al-4v", "inconel", "hastelloy", "monel",
  "nickel alloy", "nickel-based", "duplex", "super duplex",
  "aluminum alloy", "al-li", "magnesium alloy",
  "copper-nickel", "cu-ni", "bronze", "brass", "cupro-nickel",
  "exotic metal", "corrosion resistant alloy", "cra"
];

function assessAdvancedAlloys(haystack) {
  var presenceHits = hitList(haystack, ALLOY_PRESENCE);
  if (presenceHits.length === 0) return null;

  var mechanisms = [];
  var sccHits = hitList(haystack, ["stress corrosion", "scc", "chloride cracking", "caustic cracking", "intergranular", "transgranular", "branching crack"]);
  var creepHits = hitList(haystack, ["creep", "creep void", "creep crack", "high temperature", "elevated temperature", "service temperature"]);
  var grainHits = hitList(haystack, ["grain boundary", "sensitization", "sensitized", "sigma phase", "475 embrittlement", "intermetallic"]);
  var galvanicHits = hitList(haystack, ["galvanic", "dissimilar metal", "bimetallic", "crevice corrosion"]);

  if (sccHits.length > 0) {
    mechanisms.push({ name: "alloy_scc", severity: "high", basis: "SCC signatures: " + sccHits.join(", "), references: ["NACE MR0175 / ISO 15156", "ASTM G36 (Chloride SCC)"], confirmation_evidence: ["MT/PT at suspect zones", "Metallographic section", "SEM fractography"], rule_out_evidence: ["No crack indications on MT/PT", "Environment below SCC threshold"] });
  }
  if (creepHits.length > 0) {
    mechanisms.push({ name: "alloy_creep", severity: "high", basis: "High-temperature creep indicators: " + creepHits.join(", "), references: ["API 579 Part 10 (Creep)", "ASTM E139"], confirmation_evidence: ["Replica metallography for creep voids", "Hardness survey", "Dimensional check for bulging"], rule_out_evidence: ["Service temperature below creep threshold", "No voids on replica"] });
  }
  if (grainHits.length > 0) {
    mechanisms.push({ name: "alloy_microstructural_degradation", severity: "high", basis: "Microstructural attack: " + grainHits.join(", "), references: ["ASTM A262 (Sensitization)", "ASTM A923 (Sigma phase)"], confirmation_evidence: ["Oxalic acid etch test (A262 Practice A)", "Ferrite measurement", "Impact test comparison"], rule_out_evidence: ["Step structure on etch test", "Ferrite in acceptable range"] });
  }
  if (galvanicHits.length > 0) {
    mechanisms.push({ name: "alloy_galvanic_corrosion", severity: "medium", basis: "Galvanic / dissimilar metal: " + galvanicHits.join(", "), references: ["ASTM G82 (Galvanic tables)", "NACE SP0169"], confirmation_evidence: ["UT thickness at bimetallic joints", "Visual mapping of preferential attack"], rule_out_evidence: ["Isolation kit in place", "No preferential attack pattern"] });
  }

  return {
    material_class: "advanced_alloys",
    material_label: "Advanced Alloys (Ti, Ni, Al, Cu alloys)",
    mechanisms: mechanisms,
    authority_codes: [
      { code: "NACE MR0175 / ISO 15156", title: "Materials for Use in H2S-Containing Environments", role: "sour_service_standard" },
      { code: "API 579 Part 10", title: "Assessment of Components Operating in the Creep Range", role: "creep_assessment" },
      { code: "ASTM A262", title: "Detecting Susceptibility to Intergranular Attack in Austenitic Stainless Steels", role: "sensitization_standard" }
    ],
    inspection_plan: [
      { method: "MT / PT at welds and stress zones", rationale: "SCC crack detection on alloy surfaces." },
      { method: "Replica metallography", rationale: "In-situ microstructure examination for creep voids and sensitization." },
      { method: "Ferrite measurement", rationale: "Phase balance verification for duplex / super duplex." },
      { method: "Hardness survey", rationale: "Detects creep softening and thermal embrittlement." },
      { method: "UT at bimetallic joints", rationale: "Galvanic and crevice corrosion wall loss measurement." }
    ],
    summary: "Advanced alloy detected. " + (sccHits.length > 0 ? "SCC risk: " + sccHits.join("; ") + ". " : "") + (creepHits.length > 0 ? "Creep indicators: " + creepHits.join("; ") + ". " : "") + (grainHits.length > 0 ? "Microstructural degradation: " + grainHits.join("; ") + ". " : "") + (galvanicHits.length > 0 ? "Galvanic risk: " + galvanicHits.join("; ") + ". " : ""),
    signals: { presence: dedupe(presenceHits), scc: dedupe(sccHits), creep: dedupe(creepHits), grain: dedupe(grainHits), galvanic: dedupe(galvanicHits) }
  };
}

// =====================================================================
// MODULE 7: FOAMS & CORE MATERIALS
// =====================================================================

var FOAM_PRESENCE = [
  "polyurethane foam", "pu foam", "phenolic foam", "aluminum honeycomb",
  "nomex honeycomb", "honeycomb core", "foam core", "sandwich panel",
  "cryogenic insulation", "pipe insulation", "buoyancy module",
  "syntactic foam", "structural foam"
];

function assessFoams(haystack) {
  var presenceHits = hitList(haystack, FOAM_PRESENCE);
  if (presenceHits.length === 0) return null;

  var mechanisms = [];
  var waterHits = hitList(haystack, ["water ingress", "moisture", "saturated", "wet insulation", "waterlogged"]);
  var crushHits = hitList(haystack, ["core crush", "compression set", "collapsed cell", "dented panel", "impact damage"]);
  var debondHits = hitList(haystack, ["skin debond", "face sheet", "disbond", "lifting", "separation from core"]);

  if (waterHits.length > 0) {
    mechanisms.push({ name: "foam_water_ingress", severity: "high", basis: "Water ingress: " + waterHits.join(", "), references: ["ASTM C272 (Water absorption)", "ASTM D2842"], confirmation_evidence: ["Neutron / microwave moisture imaging", "Thermography", "Core sample weight test"], rule_out_evidence: ["Moisture content below threshold"] });
  }
  if (crushHits.length > 0) {
    mechanisms.push({ name: "foam_core_crush", severity: "high", basis: "Core crush / compression: " + crushHits.join(", "), references: ["ASTM C365 (Flatwise compressive)", "ASTM D7766"], confirmation_evidence: ["UT C-scan for void mapping", "Tap test", "X-ray / CT"], rule_out_evidence: ["No deformation on dimensional check", "C-scan clean"] });
  }
  if (debondHits.length > 0) {
    mechanisms.push({ name: "foam_skin_debond", severity: "high", basis: "Skin-to-core debond: " + debondHits.join(", "), references: ["ASTM C297 (Flatwise tensile)", "ASTM D7249"], confirmation_evidence: ["Tap test mapping", "UT / phased array", "Thermography"], rule_out_evidence: ["Uniform tap response", "No anomaly on thermography"] });
  }

  return {
    material_class: "foams",
    material_label: "Foams & Core Materials",
    mechanisms: mechanisms,
    authority_codes: [
      { code: "ASTM C365", title: "Flatwise Compressive Properties of Sandwich Cores", role: "compression_standard" },
      { code: "ASTM C297", title: "Flatwise Tensile Strength of Sandwich Constructions", role: "tensile_standard" }
    ],
    inspection_plan: [
      { method: "Tap test / coin tap", rationale: "Quick debond and water detection in foam/honeycomb panels." },
      { method: "Thermography", rationale: "Maps moisture ingress and disbond zones non-destructively." },
      { method: "UT C-scan / phased array", rationale: "Quantitative void and debond mapping in sandwich structures." }
    ],
    summary: "Foam / core material detected. " + (waterHits.length > 0 ? "Water ingress: " + waterHits.join("; ") + ". " : "") + (crushHits.length > 0 ? "Core crush: " + crushHits.join("; ") + ". " : "") + (debondHits.length > 0 ? "Skin debond: " + debondHits.join("; ") + ". " : ""),
    signals: { presence: dedupe(presenceHits), water: dedupe(waterHits), crush: dedupe(crushHits), debond: dedupe(debondHits) }
  };
}

// =====================================================================
// MODULE 8: HYBRID / SMART / EMERGING MATERIALS
// =====================================================================

var HYBRID_PRESENCE = [
  "nanocomposite", "graphene", "carbon nanotube", "cnt",
  "self-healing", "self healing", "shape memory", "sma", "nitinol",
  "functionally graded", "fgm", "piezoelectric", "pzt",
  "embedded sensor", "fiber optic sensor", "smart material",
  "additive manufactured", "3d printed metal", "3d printed polymer"
];

function assessHybrid(haystack) {
  var presenceHits = hitList(haystack, HYBRID_PRESENCE);
  if (presenceHits.length === 0) return null;

  var mechanisms = [];
  mechanisms.push({
    name: "hybrid_non_standard_behavior",
    severity: "medium",
    basis: "Emerging / hybrid material detected — standard NDT assumptions may not apply. Signals: " + presenceHits.join(", "),
    references: ["Material-specific qualification data required", "ASTM E3166 (AM materials)"],
    confirmation_evidence: ["Manufacturer qualification test data", "Material-specific NDT procedure validation"],
    rule_out_evidence: ["Qualified NDT procedure exists for this material system"]
  });

  return {
    material_class: "hybrid_smart",
    material_label: "Hybrid / Smart / Emerging Materials",
    mechanisms: mechanisms,
    authority_codes: [
      { code: "ASTM E3166", title: "NDT of Additive Manufactured Metal Parts", role: "am_standard" }
    ],
    inspection_plan: [
      { method: "Material-specific qualified procedure", rationale: "Standard NDT methods may not apply — manufacturer guidance required." },
      { method: "CT scan / micro-CT", rationale: "Internal structure verification for AM and nanocomposite parts." }
    ],
    summary: "Hybrid / smart / emerging material detected: " + presenceHits.join("; ") + ". Standard NDT assumptions require validation against material-specific qualification data.",
    signals: { presence: dedupe(presenceHits) }
  };
}

// =====================================================================
// ROUTER — runs all modules, merges results
// =====================================================================

var ALL_MODULES = [
  { name: "composite_repair", fn: assessComposite },
  { name: "coatings", fn: assessCoatings },
  { name: "ceramics", fn: assessCeramics },
  { name: "polymers", fn: assessPolymers },
  { name: "elastomers", fn: assessElastomers },
  { name: "advanced_alloys", fn: assessAdvancedAlloys },
  { name: "foams", fn: assessFoams },
  { name: "hybrid_smart", fn: assessHybrid }
];

function runMaterialAuthority(haystack) {
  var detected = [];
  var allMechanisms = [];
  var allAuthorityCodes = [];
  var allInspectionPlan = [];
  var allSignals = {};
  var summaryParts = [];

  for (var i = 0; i < ALL_MODULES.length; i++) {
    var result = ALL_MODULES[i].fn(haystack);
    if (result) {
      detected.push({
        material_class: result.material_class,
        material_label: result.material_label,
        mechanism_count: result.mechanisms.length
      });
      for (var m = 0; m < result.mechanisms.length; m++) allMechanisms.push(result.mechanisms[m]);
      for (var a = 0; a < result.authority_codes.length; a++) allAuthorityCodes.push(result.authority_codes[a]);
      for (var p = 0; p < result.inspection_plan.length; p++) allInspectionPlan.push(result.inspection_plan[p]);
      allSignals[result.material_class] = result.signals;
      summaryParts.push(result.summary);
    }
  }

  if (detected.length === 0) {
    return {
      version: ENGINE_VERSION,
      status: "no_material_detected",
      detected_classes: [],
      summary: "No non-metallic or advanced material signatures detected. Standard carbon/low-alloy steel authority applies.",
      mechanisms: [],
      authority_codes: [],
      inspection_plan: [],
      signals: {}
    };
  }

  var status = resolveStatus(allMechanisms);

  // Deduplicate authority codes by code field
  var seenCodes = {};
  var uniqueCodes = [];
  for (var c = 0; c < allAuthorityCodes.length; c++) {
    if (!seenCodes[allAuthorityCodes[c].code]) {
      seenCodes[allAuthorityCodes[c].code] = 1;
      uniqueCodes.push(allAuthorityCodes[c]);
    }
  }

  // Deduplicate inspection plan by method
  var seenMethods = {};
  var uniquePlan = [];
  for (var ip = 0; ip < allInspectionPlan.length; ip++) {
    if (!seenMethods[allInspectionPlan[ip].method]) {
      seenMethods[allInspectionPlan[ip].method] = 1;
      uniquePlan.push(allInspectionPlan[ip]);
    }
  }

  return {
    version: ENGINE_VERSION,
    status: status,
    detected_classes: detected,
    summary: summaryParts.join(" | "),
    mechanisms: allMechanisms,
    authority_codes: uniqueCodes,
    inspection_plan: uniquePlan,
    signals: allSignals
  };
}

// =====================================================================
// HANDLER
// =====================================================================

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

  // Load case
  var caseQ = await supabase.from("inspection_cases").select("*").eq("id", caseId).single();
  if (caseQ.error || !caseQ.data) {
    return { statusCode: 404, body: JSON.stringify({ error: "case_not_found", detail: caseQ.error && caseQ.error.message }) };
  }
  var c = caseQ.data;

  // Build haystack from all text fields
  var textParts = [];
  var textFieldNames = [
    "transcript", "narrative", "description", "summary", "notes",
    "title", "inspector_notes", "observations", "remarks", "background",
    "context", "history", "asset_description", "inspection_context",
    "ai_openai_summary", "ai_claude_summary", "truth_engine_summary",
    "final_decision_reason", "authority_reason"
  ];
  for (var tf = 0; tf < textFieldNames.length; tf++) {
    var v = c[textFieldNames[tf]];
    if (typeof v === "string" && v.length > 0) textParts.push(v);
  }

  // Also include material_class and component_name as context
  if (c.material_class) textParts.push(c.material_class);
  if (c.material_family) textParts.push(c.material_family);
  if (c.component_name) textParts.push(c.component_name);

  // Pull findings
  try {
    var fRes = await supabase.from("findings").select("*").eq("case_id", caseId);
    if (!fRes.error && Array.isArray(fRes.data)) {
      for (var fi = 0; fi < fRes.data.length; fi++) {
        var fRow = fRes.data[fi];
        if (fRow && typeof fRow.indication_type === "string") textParts.push(fRow.indication_type);
        if (fRow && typeof fRow.notes === "string") textParts.push(fRow.notes);
        if (fRow && typeof fRow.recommended_action === "string") textParts.push(fRow.recommended_action);
      }
    }
  } catch (eFind) { /* non-fatal */ }

  var haystack = textParts.join(" ");

  var assessment = runMaterialAuthority(haystack);
  var generatedAt = new Date().toISOString();

  var upd = await supabase
    .from("inspection_cases")
    .update({
      material_authority_assessment: assessment,
      material_authority_generated_at: generatedAt,
      material_authority_status: assessment.status
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
